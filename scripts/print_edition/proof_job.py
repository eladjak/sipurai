"""Offline renderer entry point for an isolated print-edition proof job."""

import argparse
from contextlib import contextmanager
import json
import logging
import os
from pathlib import Path
import re
import resource
import signal
import stat
import subprocess
import sys
from tempfile import TemporaryDirectory

from PIL import Image, ImageCms
from pikepdf import PdfError
from weasyprint.urls import FatalURLFetchingError

from layout import MAX_PAGES, load, plan, spine_for
from render import build, command


MIB = 1024 * 1024
MAX_MANIFEST_BYTES = 128 * 1024
MAX_IMAGE_BYTES = 15 * MIB
MAX_ART_BYTES = 160 * MIB
MAX_IMAGE_PIXELS = 12_000_000
MAX_IMAGE_EDGE = 6500
MAX_ART_PIXELS = 220_000_000
MAX_ASSETS = MAX_PAGES + 1
ART_NAME = re.compile(r"art/(image-[1-9][0-9]{0,2})", re.ASCII)
TEXT_LIMITS = {
    "title": 130, "creator": 75, "blurb": 450, "aboutAuthor": 200,
    "dedication": 160, "copyright": 240,
}
STORY_TEXT_LIMIT = 4000
ART_FIELDS = {"coverArt", "closingArt", "dedicationArt", "endpaperArt", "characterSheet"}
EDITION_FIELDS = set(TEXT_LIMITS) | ART_FIELDS | {
    "version", "scenes", "qrUrl", "nikudStatus", "widthMm", "heightMm", "bleedMm",
    "gutterMm", "minPages", "signatureMultiple", "spineMm", "binding", "paper",
    "insideCover", "brightness", "coverNativePixels", "closingNativePixels",
    "requestedFinishing", "storyFont", "unsavedDraft",
}
SCENE_FIELDS = {"layout", "art", "text", "zones", "anchor", "panel", "pointing", "nativePixels", "panelWidthsMm"}
IMAGE_FORMATS = ("JPEG", "PNG", "WEBP")
QR = re.compile(r"https://(?:www\.)?sipurai\.ai/b/print/[a-zA-Z0-9_-]{1,100}", re.ASCII)
DIRECTORY_FLAGS = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
FILE_FLAGS = os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK


class InvalidProofInput(ValueError):
    """An input validation error whose message contains no user data or paths."""


class ProofDeadline(RuntimeError):
    """The isolated worker exceeded its time allowance."""


def unique_fields(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise InvalidProofInput("Duplicate manifest field")
        result[key] = value
    return result


def check_text(value, limit: int) -> None:
    if not isinstance(value, str) or len(value) > limit or any(
        ord(char) < 32 and char not in "\r\n\t" or 0xD800 <= ord(char) <= 0xDFFF
        for char in value
    ):
        raise InvalidProofInput("Invalid proof text")


def asset_name(value) -> str:
    match = ART_NAME.fullmatch(value) if isinstance(value, str) else None
    if not match or int(match[1][6:]) > MAX_ASSETS:
        raise InvalidProofInput("Artwork must use a job-local art/image-N path")
    return match[1]


def manifest_assets(data) -> set[str]:
    if not isinstance(data, dict) or data.keys() - EDITION_FIELDS:
        raise InvalidProofInput("Unsupported manifest field")
    for field, limit in TEXT_LIMITS.items():
        if data.get(field) is not None:
            check_text(data[field], limit)
    if "storyFont" in data and data["storyFont"] not in ("david-libre", "rubik"):
        raise InvalidProofInput("Unknown story font")
    if "unsavedDraft" in data and type(data["unsavedDraft"]) is not bool:
        raise InvalidProofInput("Unsaved draft status must be true or false")
    if (qr_url := data.get("qrUrl")) not in (None, ""):
        if not isinstance(qr_url, str) or not QR.fullmatch(qr_url):
            raise InvalidProofInput("Invalid Sipurai book QR link")
    if "requestedFinishing" in data:
        value = data["requestedFinishing"]
        if (not isinstance(value, dict) or set(value) != {"cover", "paper"}
                or value["cover"] not in ("softcover", "hardcover")
                or value["paper"] not in ("standard", "premium")):
            raise InvalidProofInput("Invalid finishing preferences")

    assets = {asset_name(data[field]) for field in ART_FIELDS if data.get(field) is not None}
    scenes = data.get("scenes")
    if not isinstance(scenes, list) or not 1 <= len(scenes) <= MAX_PAGES - 4:
        raise InvalidProofInput("Invalid number of scenes")
    for scene in scenes:
        if not isinstance(scene, dict) or scene.keys() - SCENE_FIELDS:
            raise InvalidProofInput("Unsupported scene field")
        blocks = scene.get("text")
        if not isinstance(blocks, list) or not 1 <= len(blocks) <= 2:
            raise InvalidProofInput("Invalid scene text blocks")
        for block in blocks:
            check_text(block, STORY_TEXT_LIMIT)
        assets.add(asset_name(scene.get("art")))
    if len(assets) > MAX_ASSETS:
        raise InvalidProofInput("Too many artwork files")
    return assets


@contextmanager
def job_directory(path, *, parent: int | None = None):
    descriptor = os.open(path, DIRECTORY_FLAGS, dir_fd=parent)
    try:
        yield descriptor
    finally:
        os.close(descriptor)


def read_input(parent: int, name: str, limit: int) -> bytes:
    descriptor = os.open(name, FILE_FLAGS, dir_fd=parent)
    with os.fdopen(descriptor, "rb") as source:
        info = os.fstat(source.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or not 0 < info.st_size <= limit:
            raise InvalidProofInput("Invalid input file or input size")
        content = source.read(limit + 1)
    if not 0 < len(content) <= limit:
        raise InvalidProofInput("Invalid input file size")
    return content


def exact_entries(directory: int, expected: set[str]) -> None:
    remaining = expected.copy()
    with os.scandir(directory) as entries:
        for entry in entries:
            if entry.name not in remaining:
                raise InvalidProofInput("Unexpected job files")
            remaining.remove(entry.name)
    if remaining:
        raise InvalidProofInput("Missing job files")


def validate_image(file: Path) -> int:
    with Image.open(file, formats=IMAGE_FORMATS) as image:
        width, height = image.size
        pixels = width * height
        if (min(width, height) < 1 or max(width, height) > MAX_IMAGE_EDGE
                or pixels > MAX_IMAGE_PIXELS or getattr(image, "n_frames", 1) != 1):
            raise InvalidProofInput("Artwork exceeds dimensions or has multiple frames")
        image.verify()
        return pixels


def stage_job(job: Path, staged: Path) -> Path:
    manifest = staged / "edition.json"
    art = staged / "art"
    art.mkdir(mode=0o700)
    with job_directory(job) as root:
        source = read_input(root, "edition.json", MAX_MANIFEST_BYTES)
        data = json.loads(source.decode("utf-8"), object_pairs_hook=unique_fields)
        expected = manifest_assets(data)
        with job_directory("art", parent=root) as artwork:
            exact_entries(root, {"edition.json", "art"})
            exact_entries(artwork, expected)
            total_bytes = total_pixels = 0
            for name in sorted(expected):
                content = read_input(artwork, name, min(MAX_IMAGE_BYTES, MAX_ART_BYTES - total_bytes))
                total_bytes += len(content)
                target = art / name
                target.write_bytes(content)
                total_pixels += validate_image(target)
                if total_pixels > MAX_ART_PIXELS:
                    raise InvalidProofInput("Total artwork dimensions are too large")
    manifest.write_bytes(source)
    return manifest


def webp(source: Path, target: Path) -> None:
    with Image.open(source, formats=("PPM",)) as pixels:
        pixels.save(target, "WEBP", quality=86, method=4)
    source.unlink()


def spoken_text(boxes: list[dict]) -> str:
    return "\n".join(" ".join(box["lines"]) for box in boxes)


def render_proof(job: Path, output: Path) -> None:
    if os.path.lexists(output):
        raise InvalidProofInput("Output directory must be new")
    with TemporaryDirectory(dir=output.parent, prefix=".proof-") as temp:
        work = Path(temp)
        staged = work / "input"
        staged.mkdir(mode=0o700)
        manifest = stage_job(job, staged)
        edition = load(manifest, review_pending=True)
        pages = plan(edition)
        spine, _ = spine_for(edition, pages)

        target = work / "output"
        target.mkdir(mode=0o700)
        build(edition, manifest, target, make_previews=False)
        preflight = json.loads((target / "preflight.json").read_text(encoding="utf-8"))

        command("pdftoppm", "-scale-to", "1050", target / "interior.pdf", work / "page")
        page_records = []
        for page, evidence in zip(pages, preflight["pages"], strict=True):
            preview = f"page-{page.number:02d}.webp"
            webp(work / f"page-{page.number:02d}.ppm", target / preview)
            record = {"file": preview, "kind": page.kind}
            if page.folio is not None:
                record.update(storyIndex=page.folio - 1, text=page.text)
            elif text := spoken_text(evidence["boxes"]):
                record["text"] = text
            page_records.append(record)

        command("pdftoppm", "-singlefile", "-scale-to", "1600", target / "cover.pdf", work / "wrap")
        cover_file = "cover-wrap.webp"
        webp(work / "wrap.ppm", target / cover_file)
        inside_file = None
        if edition.inside_cover:
            command("pdftoppm", "-f", "2", "-l", "2", "-singlefile", "-scale-to", "1600",
                    target / "cover-with-inside.pdf", work / "inside")
            inside_file = "cover-inside.webp"
            webp(work / "inside.ppm", target / inside_file)

        proof = {
            "pages": page_records, "coverFile": cover_file, "insideFile": inside_file,
            "coverText": {
                "front": spoken_text([box for box in preflight["coverText"] if box["role"].startswith("cover-")]),
                "back": spoken_text([box for box in preflight["coverText"] if not box["role"].startswith("cover-")]),
            },
            "nikudStatus": edition.nikud_status,
            "unsavedDraft": edition.unsaved_draft,
            "trimWidthMm": edition.geometry.width, "trimHeightMm": edition.geometry.height,
            "bleedMm": edition.geometry.bleed, "spineMm": spine,
            "pdfs": {"interior": "interior.pdf", "cover": "cover.pdf"},
            "pdfSha256": preflight["pdfSha256"],
        }
        (target / "proof.json").write_text(json.dumps(proof, ensure_ascii=False) + "\n", encoding="utf-8")
        target.rename(output)


def deadline(_signum, _frame):
    raise ProofDeadline("Proof rendering timed out")


def set_worker_limits() -> None:
    # Apply limits only at the isolated CLI boundary, not to callers of the library.
    for kind, maximum in ((resource.RLIMIT_AS, 1536 * MIB), (resource.RLIMIT_FSIZE, 512 * MIB)):
        soft, hard = resource.getrlimit(kind)
        bounded = min(value for value in (soft, hard, maximum) if value != resource.RLIM_INFINITY)
        resource.setrlimit(kind, (bounded, bounded))
    signal.signal(signal.SIGALRM, deadline)
    signal.alarm(120)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    logging.disable(logging.CRITICAL)
    os.umask(0o077)
    set_worker_limits()
    try:
        render_proof(args.input, args.output)
    except (InvalidProofInput, ProofDeadline) as error:
        print(error, file=sys.stderr)
        return 1
    except (ValueError, OSError, OverflowError, RecursionError, MemoryError, SyntaxError,
            subprocess.SubprocessError, Image.DecompressionBombError, ImageCms.PyCMSError,
            PdfError, FatalURLFetchingError) as error:
        if isinstance(error, ValueError) and re.fullmatch(
            r"(?:Page [0-9]{1,2} story text|title|creator|dedication|copyright|cover-title|cover-creator|"
            r"back-blurb|back-about-author) does not fit its safe area at [0-9]{2} pt", str(error)
        ):
            print(error, file=sys.stderr)
        else:
            print("Could not render this edition", file=sys.stderr)
        return 1
    finally:
        signal.alarm(0)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
