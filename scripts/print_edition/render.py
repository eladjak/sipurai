#!/usr/bin/env python3
"""Render and preflight a versioned Sipurai edition manifest."""

import argparse
from hashlib import file_digest
from io import BytesIO
import json
from pathlib import Path
import re
import subprocess
import sys
import unicodedata
from tempfile import TemporaryDirectory
from xml.etree import ElementTree

from PIL import Image, ImageCms
from pikepdf import Array, Dictionary, Matrix, Name, Pdf, PdfError, PdfImage, Rectangle, parse_content_stream
from weasyprint import HTML
from weasyprint.text.fonts import FontConfiguration
from weasyprint.urls import URLFetcher

from design import Art, BODY, DISPLAY, PT_PER_MM, compose_cover, compose_interior, document
from layout import BINDING_SAFE_MM, DPI, SAFE_MM, Edition, load, plan, spine_for

RESOLUTION = 120


def file_hash(file: Path) -> str:
    with file.open("rb") as source:
        return file_digest(source, "sha256").hexdigest()


def command(*args: str | Path) -> str:
    return subprocess.run([str(arg) for arg in args], capture_output=True, text=True,
                          check=True).stdout


def make_pdf(parts: list[str], size: tuple[float, float], edition: Edition,
             target: Path, work: Path) -> None:
    width, height = size
    raw = work / target.name
    resources = {file.as_uri() for file in (BODY, DISPLAY, *work.glob("*.jpg"), work / "qr.png")}
    read_local = URLFetcher(allowed_protocols={"file"}, allow_redirects=False, fail_on_errors=True)

    def fetch(url: str):
        if url not in resources:
            raise ValueError("Unexpected print resource")
        return read_local.fetch(url)

    HTML(string=document(parts, width, height, edition.title), url_fetcher=fetch).write_pdf(
        raw, font_config=FontConfiguration(), jpeg_quality=95,
    )
    srgb = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB"))
    profile = ImageCms.getOpenProfile(str(edition.icc_profile)) if edition.icc_profile else srgb
    if edition.icc_profile and profile.profile.xcolor_space.strip() != "CMYK":
        raise ValueError("iccProfile must describe a CMYK output condition")
    transform = (ImageCms.buildTransform(srgb, profile, "RGB", "CMYK",
                                         ImageCms.Intent.RELATIVE_COLORIMETRIC,
                                         ImageCms.Flags.BLACKPOINTCOMPENSATION)
                 if edition.icc_profile else None)
    with Pdf.open(raw) as pdf:
        # All legacy CSS colors remain in tagged sRGB. Photographic image
        # samples are converted to the selected CMYK exchange space below.
        default_rgb = pdf.make_stream(srgb.tobytes(), N=3, Alternate=Name.DeviceRGB)
        output = (pdf.make_stream(profile.tobytes(), N=4, Alternate=Name.DeviceCMYK)
                  if transform else default_rgb)
        pdf.Root.OutputIntents = Array([Dictionary(
            Type=Name.OutputIntent, S=Name.GTS_PDFX if transform else Name.GTS_PDFA1,
            OutputConditionIdentifier=ImageCms.getProfileName(profile).strip(),
            DestOutputProfile=output,
        )])
        seen = set()
        bleed = edition.geometry.bleed
        for page in pdf.pages:
            media = Rectangle(0, 0, width * PT_PER_MM, height * PT_PER_MM)
            trim = Rectangle(bleed * PT_PER_MM, bleed * PT_PER_MM,
                             (width - bleed) * PT_PER_MM, (height - bleed) * PT_PER_MM)
            page.MediaBox = media
            page.CropBox = media
            page.BleedBox = media
            page.TrimBox = trim
            page.Resources.ColorSpace = Dictionary(DefaultRGB=Array([Name.ICCBased, default_rgb]))
            if transform:
                for image in page.images.values():
                    if image.objgen in seen or image.get("/ColorSpace") != Name.DeviceRGB:
                        continue
                    seen.add(image.objgen)
                    pixels = PdfImage(image).as_pil_image().convert("RGB")
                    converted = ImageCms.applyTransform(pixels, transform)
                    data = BytesIO()
                    converted.save(data, "JPEG", quality=95)
                    image.write(data.getvalue(), filter=Name.DCTDecode)
                    image.ColorSpace = Name.DeviceCMYK
                    image.Decode = Array([1, 0] * 4)
        pdf.docinfo["/Title"] = edition.title
        pdf.docinfo["/Author"] = edition.creator
        if edition.nikud_status == "pending":
            pdf.docinfo["/Subject"] = "Review proof — Hebrew pointing awaits approval"
        pdf.save(target)


def first_image_bounds(page) -> tuple[float, float, float, float] | None:
    """Read the placement and rectangular clip of the first rendered image."""
    matrix = Matrix()
    clip = tuple(float(coordinate) for coordinate in page.MediaBox)
    stack = []
    path_bounds = None

    def transform_rectangle(x: float, y: float, w: float, h: float):
        corners = [matrix.transform(point) for point in ((x, y), (x+w, y), (x, y+h), (x+w, y+h))]
        xs, ys = zip(*corners)
        return min(xs), min(ys), max(xs), max(ys)

    def intersect(a, b):
        return max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])

    for operands, operator in parse_content_stream(page):
        operation = str(operator)
        if operation == "q":
            stack.append((matrix, clip))
        elif operation == "Q":
            matrix, clip = stack.pop()
        elif operation == "cm":
            matrix = Matrix(*(float(v) for v in operands)) @ matrix
        elif operation == "re":
            path_bounds = transform_rectangle(*(float(v) for v in operands))
        elif operation in ("W", "W*") and path_bounds:
            clip = intersect(clip, path_bounds)
        elif operation == "n":
            path_bounds = None
        elif operation == "Do" and str(operands[0]) in page.images:
            return intersect(clip, transform_rectangle(0, 0, 1, 1))
    return None


def inspect_pdf(file: Path, size: tuple[float, float], expected: int, edition: Edition) -> list[str]:
    errors = []
    bleed = edition.geometry.bleed
    width, height = size
    media = [0, 0, width, height]
    trim = [bleed, bleed, width - bleed, height - bleed]
    with Pdf.open(file) as pdf:
        if len(pdf.pages) != expected:
            errors.append(f"{file.name}: expected {expected} pages, got {len(pdf.pages)}")
        intents = pdf.Root.get("/OutputIntents", [])
        if len(intents) != 1:
            errors.append(f"{file.name}: missing output intent")
        else:
            profile = intents[0].get("/DestOutputProfile")
            if edition.icc_profile and (profile is None or profile.read_bytes() != edition.icc_profile.read_bytes()):
                errors.append(f"{file.name}: CMYK output intent profile does not match")
            if profile is None or profile.get("/N") != (4 if edition.icc_profile else 3):
                errors.append(f"{file.name}: invalid output intent color space")
        for index, page in enumerate(pdf.pages, 1):
            label = f"{file.name} page {index}"
            for name, values in (("MediaBox", media), ("CropBox", media), ("BleedBox", media), ("TrimBox", trim)):
                actual = page.get(f"/{name}", [])
                if len(actual) != 4 or any(abs(float(pt) / PT_PER_MM - mm) > 0.008
                                           for pt, mm in zip(actual, values)):
                    errors.append(f"{label}: invalid {name}")
            if not page.images:
                errors.append(f"{label}: missing illustration or patterned paper")
            elif file.name == "interior.pdf":
                bounds = first_image_bounds(page)
                if bounds is None or any(abs(actual / PT_PER_MM - expected_mm) > 0.06
                                         for actual, expected_mm in zip(bounds, media)):
                    errors.append(f"{label}: first image does not cover the full-bleed region")
            if edition.icc_profile and any(image.get("/ColorSpace") == Name.DeviceRGB
                                           for image in page.images.values()):
                errors.append(f"{label}: unconverted RGB image")
    fonts = command("pdffonts", file).splitlines()[2:]
    if not fonts or any(line.split()[-5] != "yes" for line in fonts if line.strip()):
        errors.append(f"{file.name}: missing embedded text fonts")
    intended = ["Rubik"]
    if file.name != "interior.pdf" or edition.story_font == "david-libre" or edition.dedication:
        intended.append("DavidLibre")
    if any(not any(family in line for line in fonts) for family in intended):
        errors.append(f"{file.name}: missing intended Hebrew fonts")
    rasters = [line.split() for line in command("pdfimages", "-list", file).splitlines()[2:] if line.strip()]
    for row in rasters:
        if row[2] == "image" and min(int(row[12]), int(row[13])) < DPI - 1:
            errors.append(f"{file.name} page {row[0]}: printed image placement below {DPI} effective dpi")
    tolerance = 0.08
    outer = bleed + SAFE_MM - tolerance
    inner = bleed + max(BINDING_SAFE_MM, SAFE_MM + edition.geometry.gutter) - tolerance
    xhtml = ElementTree.fromstring(command("pdftotext", "-bbox", file, "-"))
    pages = xhtml.findall(".//{*}page")
    if not xhtml.findall(".//{*}word"):
        errors.append(f"{file.name}: no searchable text")
    for index, page in enumerate(pages, 1):
        for word in page.findall(".//{*}word"):
            x0, y0, x1, y1 = (float(word.get(key, "NaN")) / PT_PER_MM
                              for key in ("xMin", "yMin", "xMax", "yMax"))
            # Poppler can emit negative-width words for isolated RTL combining marks.
            if x0 > x1 and word.text and all(unicodedata.combining(char) for char in word.text):
                x0, x1 = x1, x0
            if file.name.startswith("cover"):
                spine = width - 2 * edition.geometry.width - 2 * bleed
                front_binding = bleed + edition.geometry.width
                binding_overlap = x0 < front_binding + spine + inner - bleed and x1 > front_binding - inner + bleed
            else:
                binding_overlap = x1 > width - inner if index % 2 else x0 < inner
            if (not (outer <= x0 <= x1 <= width - outer and outer <= y0 <= y1 <= height - outer)
                    or binding_overlap):
                errors.append(f"{file.name} page {index}: glyphs outside safe areas: {word.text!r}")
    return errors


def geometry_inspection(edition: Edition, folder: Path) -> list[str]:
    pages = plan(edition)
    spine, _ = spine_for(edition, pages)
    geom = edition.geometry
    cover = geom.cover_media(spine)
    errors = (inspect_pdf(folder / "interior.pdf", geom.media, len(pages), edition)
              + inspect_pdf(folder / "cover.pdf", cover, 1, edition))
    if edition.inside_cover:
        errors += inspect_pdf(folder / "cover-with-inside.pdf", cover, 2, edition)
    return errors


def asset_hashes(edition: Edition) -> dict[str, str]:
    names = {
        "cover": edition.cover_art, "closing": edition.closing_art,
        "dedication": edition.dedication_art, "endpaper": edition.endpaper_art,
        "reference": edition.character_sheet, "profile": edition.icc_profile,
        **{f"scene-{index}": scene.art for index, scene in enumerate(edition.scenes, 1)},
    }
    hashed = {}
    for asset in {path for path in names.values() if path is not None}:
        hashed[asset] = file_hash(asset)
    return {name: hashed[path] for name, path in names.items() if path is not None}


def verify_existing(edition: Edition, root: Path, manifest: Path) -> list[str]:
    errors = geometry_inspection(edition, root)
    record = json.loads((root / "preflight.json").read_text())
    if record.get("manifestSha256") != file_hash(manifest):
        errors.append("Manifest changed after rendering")
    if record.get("assetSha256") != asset_hashes(edition):
        errors.append("An input asset changed after rendering")
    for name in pdf_names(edition):
        if record.get("pdfSha256", {}).get(name) != file_hash(root / name):
            errors.append(f"{name}: PDF changed after rendering")
    return errors


def preview(edition: Edition, count: int, spine: float, root: Path) -> None:
    destination = root / "previews"
    destination.mkdir()
    interior = root / "interior.pdf"
    cover = root / "cover.pdf"
    command("pdftoppm", "-png", "-r", str(RESOLUTION), interior, destination / "page")
    command("pdftoppm", "-singlefile", "-png", "-r", str(RESOLUTION), cover, destination / "cover-wrap")
    if edition.inside_cover:
        command("pdftoppm", "-f", "2", "-l", "2", "-singlefile", "-png", "-r",
                str(RESOLUTION), root / "cover-with-inside.pdf", destination / "cover-inside")
    geom = edition.geometry
    scale = RESOLUTION / 25.4
    trim_w, trim_h, bleed = (round(n * scale) for n in (geom.width, geom.height, geom.bleed))
    start_back = round((geom.width + geom.bleed + spine) * scale)
    with Image.open(destination / "cover-wrap.png") as wrap:
        wrap.crop((bleed, bleed, bleed + trim_w, bleed + trim_h)).save(destination / "cover-front.png")
        wrap.crop((start_back, bleed, start_back + trim_w, bleed + trim_h)).save(destination / "cover-back.png")
    files = sorted(destination.glob("page-*.png"))
    if len(files) != count:
        raise ValueError("Incomplete print preview")
    box = (bleed, bleed, bleed + trim_w, bleed + trim_h)

    def save_spread(left: Image.Image, right: Image.Image, label: str) -> None:
        spread = Image.new("RGB", (2 * trim_w, trim_h))
        spread.paste(left, (0, 0))
        spread.paste(right, (trim_w, 0))
        spread.save(destination / f"spread-{label}.png")

    for i in range(1, count - 1, 2):
        with Image.open(files[i]) as right, Image.open(files[i + 1]) as left:
            save_spread(left.crop(box), right.crop(box), f"{i+1:02d}-{i+2:02d}")
    with Image.open(files[0]) as first:
        first.resize((375, round(first.height * 375 / first.width))).save(destination / "opening-375.png")
        if edition.inside_cover:
            with Image.open(destination / "cover-inside.png") as inside, Image.open(files[-1]) as last:
                inside_front = inside.crop((start_back, bleed, start_back + trim_w, bleed + trim_h))
                save_spread(first.crop(box), inside_front, "opening")
                save_spread(inside.crop(box), last.crop(box), "closing")


def pdf_names(edition: Edition) -> tuple[str, ...]:
    names = ("interior.pdf", "cover.pdf")
    return (*names, "cover-with-inside.pdf") if edition.inside_cover else names


def build(edition: Edition, manifest: Path, target: Path, *, make_previews: bool = True) -> None:
    pages = plan(edition)
    spine, spine_source = spine_for(edition, pages)
    with TemporaryDirectory(prefix="print-assets-") as temp:
        work = Path(temp)
        art = Art(work, edition.brightness)
        interior, boxes = compose_interior(edition, pages, art)
        cover, cover_boxes = compose_cover(edition, spine, art)
        make_pdf(interior, edition.geometry.media, edition, target / "interior.pdf", work)
        cover_size = edition.geometry.cover_media(spine)
        make_pdf(cover[:1], cover_size, edition, target / "cover.pdf", work)
        if edition.inside_cover:
            make_pdf(cover, cover_size, edition, target / "cover-with-inside.pdf", work)
        native = art.native.copy()
        staged = art.staged.copy()
    errors = geometry_inspection(edition, target)
    warnings = []
    low_dpi = {file: round(value, 2) for file, value in native.items() if value < DPI}
    if low_dpi:
        warnings.append("Some art is resampled to 300 dpi. The native placement dpi is recorded separately.")
    if edition.inside_cover:
        warnings.append("BookPod's production validator may flag the separately supplied two-page cover; use cover.pdf for its single-wrap check.")
    if not edition.profile_vendor_verified:
        warnings.append("Confirm the printer and paper ICC condition and inspect a physical proof.")
    if spine_source != "measured-24pp-soft-white110":
        warnings.append("Confirm the full wrap template and spine caliper with the printer.")
    if edition.nikud_status == "pending":
        warnings.append("Review-only proof: Hebrew pointing awaits the parent's approval.")
    if not edition.character_sheet:
        warnings.append("Review character consistency against a reference sheet.")
    record = {
        "structuralPass": not errors, "errors": errors, "warnings": warnings,
        "interiorPages": len(pages), "signatureMultiple": edition.signature,
        "coverPages": 1, "optionalInsideCover": edition.inside_cover, "spineMm": spine, "spineSource": spine_source,
        "bleedMm": edition.geometry.bleed, "outerTextSafeMm": SAFE_MM,
        "bindingTextSafeMm": max(BINDING_SAFE_MM, SAFE_MM + edition.geometry.gutter),
        "interiorMediaMm": edition.geometry.media, "coverMediaMm": edition.geometry.cover_media(spine),
        "coverOutside": ["front", "spine", "back"],
        "iccProfile": str(edition.icc_profile.name) if edition.icc_profile else None,
        "iccSha256": file_hash(edition.icc_profile) if edition.icc_profile else None,
        "colorMode": "CMYK images, tagged sRGB vector/text" if edition.icc_profile else "tagged sRGB",
        "vendorProfileVerified": edition.profile_vendor_verified, "physicalProofRequired": True,
        "brightnessMultiplier": edition.brightness, "nikudStatus": edition.nikud_status,
        "storyFont": edition.story_font,
        "reviewOnly": edition.nikud_status == "pending",
        "nativeDpiBelow300": low_dpi,
        "stagedPlacementDpi": {name: round(value, 2) for name, value in staged.items()},
        "effectiveDpiTarget": DPI, "pages": boxes, "coverText": cover_boxes,
        "manifestSha256": file_hash(manifest),
        "assetSha256": asset_hashes(edition),
        "pdfSha256": {name: file_hash(target / name) for name in pdf_names(edition)},
    }
    (target / "preflight.json").write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n")
    if errors:
        raise ValueError("\n".join(errors))
    if make_previews:
        preview(edition, len(pages), spine, target)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--check", action="store_true", help="Recheck existing files without writing them")
    parser.add_argument("--review-pending", action="store_true", help="Build/check a review-only proof with unapproved nikud")
    args = parser.parse_args()
    try:
        edition = load(args.manifest, review_pending=args.review_pending)
        if args.check:
            errors = verify_existing(edition, args.output, args.manifest)
            if errors:
                raise ValueError("\n".join(errors))
        else:
            args.output.mkdir(parents=True, exist_ok=False)
            build(edition, args.manifest, args.output)
    except (OSError, ValueError, PdfError, subprocess.CalledProcessError) as error:
        print(f"Print edition failed: {error}", file=sys.stderr)
        return 1
    suffix = " (pending nikud review)" if edition.nikud_status == "pending" else ""
    print(f"Structural preflight passed{suffix}: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
