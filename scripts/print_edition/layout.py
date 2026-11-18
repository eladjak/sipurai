"""Versioned inputs and logical/physical pagination for RTL print editions."""

from dataclasses import dataclass
from math import ceil, isfinite
import json
from pathlib import Path
import re
from typing import Literal
from urllib.parse import urlsplit

Side = Literal["left", "right"]
Kind = Literal["title", "dedication", "copyright", "endpaper", "story", "closing"]
ZONES = {"top", "bottom", "top-left", "bottom-left", "top-right", "bottom-right"}
NIKUD = re.compile(r"[\u05b0-\u05bc\u05c1\u05c2\u05c7]")
BIDI_CONTROLS = re.compile(r"[\u202a-\u202e\u2066-\u2069]")
PRINT_SIZES = {(220, 220), (200, 200), (165, 235)}
BLEED_MM = 3.2
SAFE_MM = 12.0
BINDING_SAFE_MM = 16.0
DPI = 300
MIN_PAGES = 24
MAX_PAGES = 80


@dataclass(frozen=True)
class Scene:
    layout: Literal["single", "spread"]
    art: Path
    text: tuple[str, ...]
    zones: tuple[str, ...]
    anchor: tuple[float, float] = (0.5, 0.5)
    panel: Literal["cream", "dark"] = "cream"
    native_pixels: tuple[int, int] | None = None
    panel_widths: tuple[float, ...] | None = None


@dataclass(frozen=True)
class Geometry:
    width: float
    height: float
    bleed: float
    gutter: float

    @property
    def media(self) -> tuple[float, float]:
        return self.width + 2 * self.bleed, self.height + 2 * self.bleed

    def cover_media(self, spine: float) -> tuple[float, float]:
        return 2 * self.width + 2 * self.bleed + spine, self.media[1]


@dataclass(frozen=True)
class Edition:
    title: str
    creator: str
    blurb: str
    cover_art: Path
    closing_art: Path
    scenes: tuple[Scene, ...]
    geometry: Geometry
    minimum: int
    signature: int
    spine: float | None
    about_author: str
    dedication: str
    copyright: str
    qr_url: str
    character_sheet: Path | None
    nikud_status: Literal["unpointed", "approved", "pending"]
    icc_profile: Path | None
    endpaper_art: Path | None
    dedication_art: Path | None
    profile_vendor_verified: bool
    inside_cover: bool
    brightness: float
    cover_native_pixels: tuple[int, int] | None
    closing_native_pixels: tuple[int, int] | None
    story_font: Literal["david-libre", "rubik"] = "david-libre"
    unsaved_draft: bool = False


@dataclass(frozen=True)
class Page:
    number: int
    kind: Kind
    side: Side
    scene: int | None = None
    text: str = ""
    zone: str = ""
    folio: int | None = None


def normalize_quotes(value: str) -> str:
    """Use neutral double quotes for dialogue and keep Hebrew acronyms intact."""
    letters_and_marks = r"[א-ת֑-ֽֿׁ-ׂׄ-ׇ]"
    value = value.translate(str.maketrans({"“": '"', "”": '"', "„": '"'}))
    return re.sub(rf"(?<!{letters_and_marks})״|״(?!{letters_and_marks})", '"', value)


def text_field(value: object, name: str, *, optional: bool = False) -> str:
    if optional and value is None:
        return ""
    if not isinstance(value, str) or (not optional and not value.strip()):
        raise ValueError(f"{name} must be text")
    if BIDI_CONTROLS.search(value):
        raise ValueError(f"{name} contains unsupported bidi controls")
    return normalize_quotes(value.strip())


def number(value: object, name: str, lower: float, upper: float) -> float:
    if isinstance(value, bool) or not isinstance(value, (float, int)):
        raise ValueError(f"{name} must be numeric")
    if not isfinite(value) or not lower <= value <= upper:
        raise ValueError(f"{name} must be between {lower} and {upper}")
    return float(value)


def integer(value: object, name: str, lower: int, upper: int) -> int:
    if type(value) is not int or not lower <= value <= upper:
        raise ValueError(f"{name} must be an integer between {lower} and {upper}")
    return value


def source_pixels(value: object, name: str) -> tuple[int, int] | None:
    if value is None:
        return None
    if not isinstance(value, list) or len(value) != 2:
        raise ValueError(f"{name} must be an original pixel dimensions pair")
    return integer(value[0], name, 1, 100_000), integer(value[1], name, 1, 100_000)


def boolean(value: object, name: str) -> bool:
    if type(value) is not bool:
        raise ValueError(f"{name} must be true or false")
    return value


def load(path: Path, *, review_pending: bool = False) -> Edition:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or type(data.get("version")) is not int or data["version"] != 1:
        raise ValueError("Expected edition manifest version 1")

    def asset(value: object, name: str, *, optional: bool = False) -> Path | None:
        if optional and value is None:
            return None
        result = (path.parent / text_field(value, name)).resolve()
        if not result.is_file():
            raise ValueError(f"Missing {name} asset: {result}")
        return result

    raw_scenes = data.get("scenes")
    if not isinstance(raw_scenes, list) or not raw_scenes:
        raise ValueError("At least one scene is required")
    if len(raw_scenes) > MAX_PAGES - 4:
        raise ValueError("Too many scenes")
    status = data.get("nikudStatus", "unpointed")
    if status not in ("unpointed", "approved") and not (status == "pending" and review_pending):
        raise ValueError("Nikud must be approved or omitted before rendering; a pending review proof requires --review-pending")
    scenes: list[Scene] = []
    for ix, item in enumerate(raw_scenes, 1):
        if not isinstance(item, dict) or item.get("layout") not in ("single", "spread"):
            raise ValueError(f"Scene {ix}: expected single or spread layout")
        length = 2 if item["layout"] == "spread" else 1
        blocks, zones = item.get("text"), item.get("zones")
        if not isinstance(blocks, list) or len(blocks) != length:
            raise ValueError(f"Scene {ix}: expected {length} text blocks")
        if not isinstance(zones, list) or len(zones) != length or any(
            not isinstance(zone, str) or zone not in ZONES for zone in zones
        ):
            raise ValueError(f"Scene {ix}: expected {length} recognised quiet zones")
        text = tuple(text_field(block, f"Scene {ix} text") for block in blocks)
        pointing = item.get("pointing", [status] * length)
        valid_pointing = ("approved", "unpointed", "pending") if status == "pending" else ("approved", "unpointed")
        if (not isinstance(pointing, list) or len(pointing) != length
                or any(mode not in valid_pointing for mode in pointing)
                or (status == "unpointed" and "approved" in pointing)):
            raise ValueError(f"Scene {ix}: invalid pointing status")
        if any((bool(NIKUD.search(block)) != (mode != "unpointed")
                and re.search(r"[א-ת]", block)) for block, mode in zip(text, pointing, strict=True)):
            raise ValueError(f"Scene {ix}: text disagrees with its nikud status")
        anchor = item.get("anchor", [0.5, 0.5])
        if not isinstance(anchor, list) or len(anchor) != 2:
            raise ValueError(f"Scene {ix}: anchor must be an [x, y] pair")
        panel = item.get("panel", "cream")
        if panel not in ("cream", "dark"):
            raise ValueError(f"Scene {ix}: unknown text panel")
        widths = item.get("panelWidthsMm")
        if widths is not None:
            if not isinstance(widths, list) or len(widths) != length:
                raise ValueError(f"Scene {ix}: expected {length} panel width caps")
            widths = tuple(number(v, "panel width", 55, 176) for v in widths)
        art = asset(item.get("art"), f"Scene {ix} art")
        assert art is not None
        scenes.append(Scene(item["layout"], art, text, tuple(zones), (
            number(anchor[0], "anchor x", 0, 1), number(anchor[1], "anchor y", 0, 1),
        ), panel, source_pixels(item.get("nativePixels"), f"Scene {ix} nativePixels"), widths))
    width = number(data.get("widthMm", 220), "widthMm", 120, 220)
    height = number(data.get("heightMm", 220), "heightMm", 170, 297)
    if (width, height) not in PRINT_SIZES:
        raise ValueError("Unknown Sipurai print trim")
    bleed = number(data.get("bleedMm", BLEED_MM), "bleedMm", BLEED_MM, BLEED_MM)
    gutter = number(data.get("gutterMm", 5), "gutterMm", 0, 12)
    minimum = integer(data.get("minPages", MIN_PAGES), "minPages", MIN_PAGES, MAX_PAGES)
    signature = integer(data.get("signatureMultiple", 4), "signatureMultiple", 4, 16)
    if signature % 4:
        raise ValueError("signatureMultiple must be divisible by four")
    spine = data.get("spineMm")
    if spine is not None:
        spine = number(spine, "spineMm", 0.1, 20)
    qr = text_field(data.get("qrUrl"), "qrUrl", optional=True)
    if qr:
        uri = urlsplit(qr)
        if (uri.scheme != "https" or uri.netloc not in {"www.sipurai.ai", "sipurai.ai"} or uri.query or uri.fragment
                or not re.fullmatch(r"/b/print/[a-zA-Z0-9_-]{1,100}", uri.path)):
            raise ValueError("QR must use a canonical Sipurai public entry URL")
    cover = asset(data.get("coverArt"), "coverArt")
    closing = asset(data.get("closingArt"), "closingArt")
    assert cover is not None and closing is not None
    if data.get("binding", "soft-matte") != "soft-matte" or data.get("paper", "white-110gsm") != "white-110gsm":
        raise ValueError("This renderer uses the BookPod soft-matte white-110gsm proof template")
    icc = asset(data.get("iccProfile"), "iccProfile", optional=True)
    profile_verified = boolean(data.get("profileVendorVerified", False), "profileVendorVerified")
    if profile_verified and icc is None:
        raise ValueError("Vendor verification requires an ICC profile")
    title = text_field(data.get("title"), "title")
    creator = text_field(data.get("creator"), "creator")
    blurb = text_field(data.get("blurb"), "blurb")
    about = text_field(data.get("aboutAuthor"), "aboutAuthor", optional=True)
    dedication = text_field(data.get("dedication"), "dedication", optional=True)
    copyright = text_field(data.get("copyright"), "copyright", optional=True)
    story_font = data.get("storyFont", "david-libre")
    if story_font not in ("david-libre", "rubik"):
        raise ValueError("Unknown story font")
    if status == "unpointed" and any(NIKUD.search(value) for value in (title, creator, blurb, about, dedication, copyright)):
        raise ValueError("Pointed front or back matter requires approved nikud or a pending review proof")
    return Edition(
        title, creator, blurb, cover, closing, tuple(scenes),
        Geometry(width, height, bleed, gutter), minimum, signature, spine,
        about, dedication, copyright, qr,
        asset(data.get("characterSheet"), "characterSheet", optional=True),
        status, icc, asset(data.get("endpaperArt"), "endpaperArt", optional=True),
        asset(data.get("dedicationArt"), "dedicationArt", optional=True), profile_verified,
        boolean(data.get("insideCover", True), "insideCover"),
        number(data.get("brightness", 1.07), "brightness", 1, 1.15),
        source_pixels(data.get("coverNativePixels"), "coverNativePixels"),
        source_pixels(data.get("closingNativePixels"), "closingNativePixels"),
        story_font,
        boolean(data.get("unsavedDraft", False), "unsavedDraft"),
    )


def plan(edition: Edition) -> list[Page]:
    pages: list[Page] = []
    folio = 0

    def add(kind: Kind, scene: int | None = None, text: str = "", zone: str = "") -> None:
        nonlocal folio
        page = len(pages) + 1
        if kind == "story":
            folio += 1
        pages.append(Page(page, kind, "left" if page % 2 else "right", scene,
                          text, zone, folio if kind == "story" else None))

    add("title")
    add("dedication" if edition.dedication else "endpaper")
    add("copyright")
    for index, scene in enumerate(edition.scenes):
        if scene.layout == "spread" and len(pages) % 2 == 0:
            add("endpaper")
        for text, zone in zip(scene.text, scene.zones, strict=True):
            add("story", index, text, zone)
    target = ceil(max(len(pages) + 1, edition.minimum) / edition.signature) * edition.signature
    if target > MAX_PAGES:
        raise ValueError(f"Edition needs {target} pages; the maximum is {MAX_PAGES}")
    while len(pages) < target - 1:
        add("endpaper")
    add("closing")
    return pages


def spine_for(edition: Edition, pages: list[Page]) -> tuple[float, str]:
    assumed = round(len(pages) * 0.075, 3)
    spine = edition.spine if edition.spine is not None else assumed
    if (len(pages), edition.geometry.width, edition.geometry.height, spine) == (24, 220, 220, 1.8):
        return spine, "measured-24pp-soft-white110"
    return spine, "user-supplied-unverified" if edition.spine is not None else "derived-unverified"
