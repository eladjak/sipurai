"""Artwork composition and Hebrew typography for the print edition."""

from dataclasses import dataclass
from functools import lru_cache
from hashlib import sha256
from html import escape
from io import BytesIO
from math import ceil
from pathlib import Path

from PIL import Image, ImageCms, ImageDraw, ImageEnhance, ImageFont, ImageOps
import qrcode

from layout import BINDING_SAFE_MM, DPI, SAFE_MM, Edition, Geometry, Page

FONT_DIR = Path(__file__).with_name("fonts")
BODY = FONT_DIR / "DavidLibre-Medium.ttf"
DISPLAY = FONT_DIR / "Rubik.ttf"
PT_PER_MM = 72 / 25.4
INK, CREAM, PAPER = "#24243b", "#fff4e1", "#f5e8d7"
NIGHT, GOLD = "#262743", "#f7ce89"
LOGO = """<svg viewBox="0 0 260 260" aria-label="סיפוראי">
<rect width="260" height="260" rx="48" fill="#262743" />
<g fill="none" stroke="#f7ce89" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 42)">
<path d="M130 30C158 22 194 24 214 33V141C194 132 158 130 130 138ZM130 30C102 22 66 24 46 33V141C66 132 102 130 130 138ZM203 58L150 55M203 76L141 74M203 94L158 93M110 55L57 58M119 74L57 76M102 93L57 94"/>
</g></svg>"""


@dataclass(frozen=True)
class TextBox:
    x: float
    y: float
    width: float
    height: float
    size: int
    lines: tuple[str, ...]
    name: str

    def evidence(self) -> dict:
        return {"role": self.name, "boxMm": [round(n, 3) for n in
                (self.x, self.y, self.width, self.height)], "fontPt": self.size,
                "lines": list(self.lines)}


def px(mm: float) -> int:
    return ceil(mm * DPI / 25.4)


@lru_cache(maxsize=64)
def font(path: Path, points: int) -> ImageFont.FreeTypeFont:
    result = ImageFont.truetype(path, points * 4, layout_engine=ImageFont.Layout.RAQM)
    if path == DISPLAY:
        result.set_variation_by_axes([650])
    return result


def text_width(value: str, points: int, path: Path) -> float:
    # Oversampled HarfBuzz measurement for the same RTL fonts used in the PDF.
    return font(path, points).getlength(value, direction="rtl") / (4 * PT_PER_MM)


def balanced_lines(value: str, points: int, width: float, max_lines: int,
                   path: Path) -> tuple[str, ...] | None:
    paragraphs = [part for part in value.splitlines() if part.strip()]
    if len(paragraphs) > 1:
        laid_out: list[str] = []
        for paragraph in paragraphs:
            remaining = max_lines - len(laid_out)
            current = balanced_lines(paragraph, points, width, remaining, path) if remaining else None
            if current is None:
                return None
            laid_out.extend(current)
        return tuple(laid_out)
    words = value.split()
    if not words:
        return None
    if len(words) > max_lines * 15:
        return None
    if text_width(" ".join(words), points, path) <= width:
        return (" ".join(words),)

    @lru_cache(maxsize=None)
    def line(start: int, stop: int) -> tuple[str, float]:
        text = " ".join(words[start:stop])
        return text, text_width(text, points, path)

    @lru_cache(maxsize=None)
    def fitting_ends(start: int, count: int) -> tuple[int, ...]:
        # Reserve at least two words for every subsequent line. Only the
        # opening line can contain a single word.
        earliest = start + (1 if start == 0 else 2)
        latest = len(words) - 2 * (count - 1)
        if count == 1:
            return (latest,) if earliest <= latest and line(start, latest)[1] <= width else ()
        return tuple(end for end in range(earliest, latest + 1)
                     if line(start, end)[1] <= width and fitting_ends(end, count - 1))

    for count in range(2, min(max_lines, len(words)) + 1):
        best_cost = float("inf")
        best_lines = None

        def search(start: int, remaining: int, lines: tuple[str, ...],
                   narrowest: float, widest: float, penalty: float) -> None:
            nonlocal best_cost, best_lines
            if remaining == 0:
                best_cost, best_lines = widest - narrowest + penalty, lines
                return
            for end in fitting_ends(start, remaining):
                text, measured = line(start, end)
                smallest = min(narrowest, measured)
                largest = max(widest, measured)
                cost = width if start == 0 and end == 1 else penalty
                # The width difference can only grow as more lines are added.
                if largest - smallest + cost < best_cost:
                    search(end, remaining - 1, (*lines, text), smallest, largest, cost)

        search(0, count, (), float("inf"), 0, 0)
        if best_lines:
            return best_lines
    return None


def fit(value: str, maximum: int, minimum: int, width: float, height: float,
        max_lines: int, path: Path, name: str) -> tuple[int, tuple[str, ...], float]:
    for points in range(maximum, minimum - 1, -1):
        lines = balanced_lines(value, points, width - 1.5, max_lines, path)
        if lines:
            used = points / PT_PER_MM * 1.31 * len(lines)
            if used <= height:
                return points, lines, used
    raise ValueError(f"{name} does not fit its safe area at {minimum} pt")


def mm_box(x: float, y: float, w: float, h: float) -> str:
    return f"left:{x:.5f}mm;top:{y:.5f}mm;width:{w:.5f}mm;height:{h:.5f}mm"


def block(box: TextBox, *, color: str = INK, align: str = "center",
          display: bool = False, extra: str = "") -> str:
    content = "".join(f"<div>{escape(line)}</div>" for line in box.lines)
    family = "Rubik" if display else "DavidLibre"
    weight = 650 if display else 500
    return (f'<section class="layer text" dir="rtl" style="{mm_box(box.x, box.y, box.width, box.height)};'
            f'font-family:{family};font-weight:{weight};font-size:{box.size}pt;text-align:{align};color:{color};{extra}">'
            f'{content}</section>')


def text_at(value: str, name: str, x: float, y: float, width: float, height: float,
            maximum: int, minimum: int, max_lines: int, *, display: bool = False,
            color: str = INK, align: str = "center") -> tuple[str, TextBox]:
    points, lines, used = fit(value, maximum, minimum, width, height, max_lines,
                              DISPLAY if display else BODY, name)
    box = TextBox(x, y + (height - used) / 2, width, used, points, lines, name)
    return block(box, display=display, color=color, align=align), box


def panel(value: str, page: Page, geometry: Geometry, dark: bool,
          width_cap: float | None = None, *, rubik: bool = False, integrated: bool = False) -> tuple[str, TextBox]:
    w, h = geometry.media
    inset = geometry.bleed + SAFE_MM + 2
    extra = max(geometry.gutter, BINDING_SAFE_MM - SAFE_MM)
    left = inset + (extra if page.side == "right" else 0)
    right = w - inset - (extra if page.side == "left" else 0)
    maximum = min(right - left, geometry.width * 0.80)
    if width_cap is not None:
        maximum = min(maximum, width_cap)
    padding_x, padding_y = 5.2, 3.1
    typeface = DISPLAY if rubik else BODY
    points, lines, used = fit(value, 27, 22, maximum - 2 * padding_x,
                              h * 0.31, 4, typeface, f"Page {page.number} story text")
    text_w = max(text_width(line, points, typeface) for line in lines) + 1.4
    pnl_w = text_w + 2 * padding_x
    pnl_h = used + 2 * padding_y
    if page.zone.endswith("left"):
        x = left
    elif page.zone.endswith("right"):
        x = right - pnl_w
    else:
        x = (left + right - pnl_w) / 2
    y = geometry.bleed + 15 if page.zone.startswith("top") else h - geometry.bleed - 24 - pnl_h
    box = TextBox(x + padding_x, y + padding_y, text_w, used, points, lines, "story")
    bg = "rgba(28,29,52,0.94)" if dark else "rgba(255,244,225,0.95)"
    colored = (f'<div class="layer" style="{mm_box(x, y, pnl_w, pnl_h)};'
               f'background:{bg};border-radius:4mm"></div>')
    if integrated:
        # Full-bleed wash reaches beyond the entire text box, then feathers
        # into the image. Keep the same measured safe text box and live glyphs.
        feather = 20.0
        if page.zone.startswith("top"):
            wash_h = min(h, y + pnl_h + feather)
            direction = "to bottom"
        else:
            wash_h = min(h, h - y + feather)
            direction = "to top"
        wash_y = 0 if page.zone.startswith("top") else h - wash_h
        opaque = 100 * (wash_h - feather) / wash_h
        colored = (f'<div class="layer" style="{mm_box(0, wash_y, w, wash_h)};'
                   f'background:linear-gradient({direction},rgba(255,244,225,0.97) 0%, '
                   f'rgba(255,244,225,0.97) {opaque:.2f}%, rgba(255,244,225,0) 100%)"></div>')
    return colored + block(box, color=CREAM if dark else INK, align="right", display=rubik), box


class Art:
    """Cached profile-normalized source art and measured 300ppi renditions."""

    def __init__(self, folder: Path, brightness: float):
        self.folder = folder
        self.brightness = brightness
        self.native: dict[str, float] = {}
        self.staged: dict[str, float] = {}
        # The composition uses sRGB; a separate PDF finalization step applies
        # the selected print color space to the actual encoded images.
        self.srgb = ImageCms.createProfile("sRGB")

    @lru_cache(maxsize=6)
    def source(self, path: Path) -> Image.Image:
        with Image.open(path) as raw:
            original = ImageOps.exif_transpose(raw)
            profile = original.info.get("icc_profile")
            if profile:
                source_profile = ImageCms.getOpenProfile(BytesIO(profile))
                original = ImageCms.profileToProfile(original, source_profile, self.srgb, outputMode="RGB")
            else:
                if original.mode == "CMYK":
                    raise ValueError(f"CMYK source requires an ICC profile: {path.name}")
                original = original.convert("RGB")
        return ImageEnhance.Brightness(original).enhance(self.brightness)

    def crop(self, path: Path, width: float, height: float, name: str, *,
             anchor: tuple[float, float] = (0.5, 0.5),
             crop: tuple[float, float, float, float] | None = None,
             native_pixels: tuple[int, int] | None = None,
             shade_top: float = 0) -> Path:
        target_w, target_h = px(width), px(height)
        original = self.source(path)
        ratio = width / height
        raw_w, raw_h = original.size
        crop_w, crop_h = min(raw_w, raw_h * ratio), min(raw_h, raw_w / ratio)
        left, top = (raw_w - crop_w) * anchor[0], (raw_h - crop_h) * anchor[1]
        staged_dpi = min(crop_w / width, crop_h / height) * 25.4
        self.staged[name] = staged_dpi
        if native_pixels:
            native_w, native_h = native_pixels
            if native_w > raw_w or native_h > raw_h:
                raise ValueError(f"{name}: original pixels exceed supplied art dimensions")
            if abs((native_w / native_h) / (raw_w / raw_h) - 1) > 0.04:
                raise ValueError(f"{name}: original and staged art dimensions disagree on aspect ratio")
            staged_dpi *= min(native_w / raw_w, native_h / raw_h)
        self.native[name] = staged_dpi
        if crop:
            if not 0.82 <= (raw_w / raw_h) / ratio <= 1.24:
                raise ValueError(f"{name}: spread needs one panoramic asset near the trim-spread aspect ratio")
            x, y, sub_w, sub_h = crop
            left, top = left + x / width * crop_w, top + y / height * crop_h
            crop_w, crop_h = sub_w / width * crop_w, sub_h / height * crop_h
            target_w, target_h = px(sub_w), px(sub_h)
        fitted = original.resize((target_w, target_h), Image.Resampling.LANCZOS,
                                 box=(left, top, left + crop_w, top + crop_h))
        if shade_top:
            # Composite the fade before PDF encoding, avoiding a hard clip
            # boundary when a PDF viewer flattens CMYK art with transparency.
            fade_rows = min(target_h, px(shade_top))
            mask = Image.new("L", (1, target_h))
            mask.putdata([round(145 * max(0, 1 - y / fade_rows)) for y in range(target_h)])
            tint = Image.new("RGB", fitted.size, (20, 23, 57))
            fitted = Image.composite(tint, fitted, mask.resize(fitted.size))
        out = self.folder / f"{name}.jpg"
        fitted.save(out, quality=95, subsampling=0, optimize=True)
        return out

    def pattern(self, edition: Edition, *, barcode_reserve: bool = False) -> Path:
        if edition.endpaper_art and not barcode_reserve:
            return self.crop(edition.endpaper_art, *edition.geometry.media, "endpaper-art")
        # A colored paper pattern uses hues and a motif variation derived from
        # the closing art, with a consistent ink limit suitable for a proof.
        image = self.source(edition.closing_art)
        reduced = image.resize((36, 36)).quantize(colors=6)
        color_index = max(reduced.getcolors(), default=(0, 0))[1]
        palette = reduced.getpalette() or [53, 50, 83]
        hue = palette[color_index * 3:color_index * 3 + 3]
        digest = sha256(image.tobytes()).digest()
        w, h = map(px, edition.geometry.media)
        background = tuple(int(249 * 0.86 + value * 0.14) for value in hue)
        tint = tuple(int(245 * 0.67 + value * 0.33) for value in hue)
        paper = Image.new("RGB", (w, h), background)
        draw = ImageDraw.Draw(paper)
        step = px(20 + digest[0] % 4)
        for row, y in enumerate(range(step // 2, h, step)):
            for col, x in enumerate(range(step // 2, w, step)):
                x += (row % 2) * step // 3
                radius = px(1.2 + digest[(row + col) % len(digest)] % 4 / 4)
                if (row + col + digest[1]) % 3:
                    draw.polygon([(x, y-radius), (x+radius//4, y-radius//4),
                                  (x+radius, y), (x+radius//4, y+radius//4),
                                  (x, y+radius), (x-radius//4, y+radius//4),
                                  (x-radius, y), (x-radius//4, y-radius//4)], fill=tint)
                else:
                    draw.ellipse((x-radius//3, y-radius//3, x+radius//3, y+radius//3), fill=tint)
        out = self.folder / ("inside-back-pattern.jpg" if barcode_reserve else "endpaper.jpg")
        paper.save(out, quality=94, subsampling=0)
        return out


def picture(path: Path, x: float, y: float, w: float, h: float, *, radius: int = 0) -> str:
    return (f'<img class="layer" style="{mm_box(x, y, w, h)};border-radius:{radius}mm" '
            f'alt="" src="{escape(path.resolve().as_uri(), quote=True)}"/>')


def solid(x: float, y: float, w: float, h: float, color: str, radius: int = 0) -> str:
    return (f'<div class="layer" style="{mm_box(x, y, w, h)};'
            f'background:{color};border-radius:{radius}mm"></div>')


def qr_image(url: str, folder: Path) -> Path:
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_Q, box_size=18, border=4)
    qr.add_data(url)
    qr.make(fit=True)
    path = folder / "qr.png"
    qr.make_image(fill_color="black", back_color="white").get_image().convert("L").save(path)
    return path


def document(parts: list[str], width: float, height: float, title: str) -> str:
    return f"""<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8">
<title>{escape(title)}</title><style>
@font-face {{font-family:DavidLibre;src:url("{BODY.as_uri()}");font-weight:500}}
@font-face {{font-family:Rubik;src:url("{DISPLAY.as_uri()}");font-weight:300 900}}
@page {{size:{width}mm {height}mm;margin:0}}
html,body {{margin:0;padding:0}}
.sheet {{width:{width}mm;height:{height}mm;position:relative;overflow:hidden;break-after:page;direction:ltr}}
.sheet:last-child {{break-after:auto}}
.layer {{position:absolute;box-sizing:border-box}}
.text {{white-space:nowrap;line-height:1.31;font-weight:650}}
svg {{width:100%;height:100%}}
</style><body>{''.join(f'<main class="sheet">{part}</main>' for part in parts)}</body></html>"""


def compose_interior(edition: Edition, pages: list[Page], art: Art) -> tuple[list[str], list[dict]]:
    geometry = edition.geometry
    width, height = geometry.media
    scale_x, scale_y = geometry.width / 220, geometry.height / 220
    center = width / 2
    pattern = art.pattern(edition)
    evidence, parts = [], []
    for page in pages:
        boxes: list[TextBox] = []
        kind = page.kind
        content = ""
        asset_name = None

        def text(value: str, name: str, x: float, y: float, w: float, h: float,
                 maximum: int, minimum: int, max_lines: int, **style) -> None:
            nonlocal content
            html, box = text_at(value, name, x, y, w, h, maximum, minimum, max_lines, **style)
            content += html
            boxes.append(box)

        if kind == "story":
            assert page.scene is not None
            scene = edition.scenes[page.scene]
            asset_name = f"story-{page.number:02d}"
            source_w = 2 * geometry.width + 2 * geometry.bleed if scene.layout == "spread" else width
            crop = None
            if scene.layout == "spread":
                # At trim the two image coordinates meet. The inner 3.2 mm of
                # each PDF samples real neighbouring artwork from the same canvas.
                offset = geometry.width if page.side == "right" else 0
                crop = offset, 0, width, height
            image = art.crop(scene.art, source_w, height, asset_name, anchor=scene.anchor,
                             crop=crop, native_pixels=scene.native_pixels)
            content += picture(image, 0, 0, width, height)
            cap = None
            if scene.panel_widths:
                index = 1 if scene.layout == "spread" and page.side == "left" else 0
                cap = scene.panel_widths[index]
            pnl, panel_box = panel(page.text, page, geometry, scene.panel == "dark", cap,
                                   rubik=edition.story_font == "rubik", integrated=scene.panel == "integrated")
            content += pnl
            boxes.append(panel_box)
            x = width - geometry.bleed - 24 if page.side == "right" else geometry.bleed + 12
            y = height - geometry.bleed - 21
            content += solid(x, y, 12, 9, "rgba(30,29,50,0.94)", 4)
            text(str(page.folio), "folio", x + 1, y + 1, 10, 7, 13, 12, 1, display=True, color=CREAM)
        else:
            content += picture(pattern, 0, 0, width, height)
            if kind in ("title", "dedication", "closing"):
                card_w, card_h = 178 * scale_x, 178 * scale_y
                content += solid(center - card_w / 2, (height - card_h)/2, card_w, card_h, PAPER, 7)
            if kind == "title":
                text(edition.title, "title", 27 * scale_x, 32 * scale_y, width - 54 * scale_x,
                     41 * scale_y, 41, 29, 2, display=True)
                text(edition.creator, "creator", 35 * scale_x, 75 * scale_y,
                     width - 70 * scale_x, 14 * scale_y, 17, 14, 2, display=True)
                vignette_w, vignette_h = 92 * scale_x, 80 * scale_y
                asset_name = "title-vignette"
                image = art.crop(edition.cover_art, vignette_w, vignette_h, asset_name, anchor=(0.5, .63),
                                 native_pixels=edition.cover_native_pixels)
                content += picture(image, center - vignette_w/2, 99 * scale_y, vignette_w, vignette_h, radius=7)
            elif kind == "dedication":
                text(edition.dedication, "dedication", 32 * scale_x, 53 * scale_y,
                     width - 64 * scale_x, 49 * scale_y, 26, 20, 4)
                vignette_w, vignette_h = 86 * scale_x, 70 * scale_y
                asset_name = "dedication-vignette"
                image = art.crop(edition.dedication_art or edition.cover_art, vignette_w, vignette_h,
                                 asset_name, anchor=(0.5, .63),
                                 native_pixels=edition.cover_native_pixels if not edition.dedication_art else None)
                content += picture(image, center - vignette_w/2, 118 * scale_y, vignette_w, vignette_h, radius=5)
            elif kind == "copyright":
                content += f'<div class="layer" style="{mm_box(center - 9, 71 * scale_y, 18, 18)}">{LOGO}</div>'
                if edition.copyright:
                    text(edition.copyright, "copyright", 32 * scale_x, 95 * scale_y,
                         width - 64 * scale_x, 36 * scale_y, 15, 13, 4, display=True)
                else:
                    text(edition.creator, "copyright-credit", 32 * scale_x, 95 * scale_y,
                         width - 64 * scale_x, 36 * scale_y, 15, 13, 2, display=True)
            elif kind == "closing":
                vignette_w, vignette_h = 148 * scale_x, 132 * scale_y
                asset_name = "closing-wink"
                image = art.crop(edition.closing_art, vignette_w, vignette_h, asset_name,
                                 native_pixels=edition.closing_native_pixels)
                content += picture(image, center - vignette_w/2, 38 * scale_y, vignette_w, vignette_h, radius=6)
                text("סוף", "closing", 37 * scale_x, 177 * scale_y,
                     width - 74 * scale_x, 18 * scale_y, 28, 23, 1, display=True)
        parts.append(content)
        evidence.append({"page": page.number, "side": page.side, "kind": kind,
                         "scene": page.scene + 1 if page.scene is not None else None, "folio": page.folio,
                         "boxes": [box.evidence() for box in boxes],
                         "nativeDpi": round(art.native[asset_name], 2) if asset_name else None,
                         "stagedDpi": round(art.staged[asset_name], 2) if asset_name else None})
    return parts, evidence


def compose_cover(edition: Edition, spine: float, art: Art) -> tuple[list[str], list[dict]]:
    geometry = edition.geometry
    width, height = geometry.cover_media(spine)
    page_width, _ = geometry.media
    scale_x, scale_y = geometry.width / 220, geometry.height / 220
    front_end = geometry.bleed + geometry.width
    back_start = front_end + spine
    sizes = []
    cover = solid(0, 0, width, height, NIGHT)

    def text(value: str, name: str, x: float, y: float, w: float, h: float,
             maximum: int, minimum: int, max_lines: int, **style) -> None:
        nonlocal cover
        html, box = text_at(value, name, x, y, w, h, maximum, minimum, max_lines, **style)
        cover += html
        sizes.append(box.evidence())

    # Outside RTL wrap is Front | Spine | Back, viewed flat.
    hero = art.crop(edition.cover_art, front_end, height, "cover-front", anchor=(.5, .5),
                   native_pixels=edition.cover_native_pixels, shade_top=62 * scale_y)
    cover += picture(hero, 0, 0, front_end, height)
    title_x, title_width = 16 * scale_x, front_end - 32 * scale_x
    text(edition.title, "cover-title", title_x + 5, max(12, 12 * scale_y), title_width - 10,
         31 * scale_y, 42, 32, 2, display=True, color=CREAM)
    _, title_y, _, title_h = sizes[-1]["boxMm"]
    text(edition.creator, "cover-creator", title_x + 5, title_y + title_h + 1.8,
         title_width - 10, 9 * scale_y, 17, 14, 1, display=True, color=GOLD)
    cover += f'<div class="layer" style="{mm_box(15, height - 29, 13, 13)}">{LOGO}</div>'

    back_x = back_start + 19 * scale_x
    back_w = geometry.width - 38 * scale_x
    # A single ink field carries the blurb, the creator note and the imprint.
    text(edition.blurb, "back-blurb", back_x, 22 * scale_y, back_w, 71 * scale_y,
         23, 18, 7, color=CREAM)
    if edition.about_author:
        text("על היוצרים", "back-author-heading", back_x, 94 * scale_y, back_w,
             10 * scale_y, 16, 14, 1, color=GOLD, display=True)
        text(edition.about_author, "back-about-author", back_x, 107 * scale_y, back_w, 33 * scale_y,
             17, 14, 4, color=CREAM)

    rule_y = 155 * scale_y
    cover += solid(back_x, rule_y, back_w, .35, GOLD)
    logo_x = back_x
    logo_y = 178 * scale_y
    cover += f'<div class="layer" style="{mm_box(logo_x, logo_y, 14, 14)}">{LOGO}</div>'
    text("סיפוראי", "back-logo-text", logo_x + 14, logo_y, 29 * scale_x, 14,
         15, 12, 1, display=True, color=GOLD)

    if edition.qr_url:
        qr_size = 38 * scale_x
        qr_x = back_x + back_w - qr_size
        row_y = 162 * scale_y
        cover += picture(qr_image(edition.qr_url, art.folder), qr_x, row_y, qr_size, qr_size)
        label_w = 42 * scale_x
        label_h = 11 * scale_y
        text("לספר שלכם", "qr-label", qr_x - label_w - 4, row_y + (qr_size - label_h) / 2,
             label_w, label_h, 14, 12, 1, display=True, color=CREAM)
    parts = [cover]

    if edition.inside_cover:
        # BookPod specifies a 40 × 15 mm barcode in the middle of the
        # left side of the optional inside cover; its example shows it near
        # the bottom. The 5 mm trim offset is inferred, not specified.
        inside_back = art.pattern(edition, barcode_reserve=True)
        inside_front = art.pattern(edition)
        inside = picture(inside_back, 0, 0, page_width, height)
        inside += solid(geometry.bleed + (geometry.width - 40) / 2,
                        geometry.bleed + geometry.height - 5 - 15, 40, 15, "#fff")
        inside += picture(inside_front, back_start - geometry.bleed, 0, page_width, height)
        parts.append(inside)
    return parts, sizes
