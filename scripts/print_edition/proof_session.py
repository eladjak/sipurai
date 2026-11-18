"""Manage one private Sandbox's uploads and completed print proofs."""

from contextlib import ExitStack, contextmanager
import fcntl
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from tempfile import NamedTemporaryFile, TemporaryDirectory
from time import time

from layout import load, plan
from proof_job import MAX_ART_BYTES, MAX_ASSETS, MAX_IMAGE_BYTES, MAX_MANIFEST_BYTES, MIB, manifest_assets
from render import file_hash

CHUNK_SIZE = MIB
MAX_JOBS = 8
MAX_CACHE_BYTES = 320 * MIB
MAX_OUTPUT_BYTES = 1152 * MIB
STAGING_IDLE_SECONDS = 90
DIGEST = re.compile(r"[a-f0-9]{64}", re.ASCII)
NONCE = re.compile(r"[a-f0-9]{32}", re.ASCII)
FIT_ERROR = re.compile(
    r"(?:Page [0-9]{1,2} story text|title|creator|dedication|copyright|cover-title|cover-creator|"
    r"back-blurb|back-about-author) does not fit its safe area at [0-9]{2} pt"
)


class Refused(Exception):
    def __init__(self, code: str, detail: str | None = None):
        self.code = code
        self.detail = detail
        super().__init__(code)


def read_json(file: Path):
    return json.loads(file.read_text(encoding="utf-8"))


def write_json(file: Path, data) -> None:
    with NamedTemporaryFile(mode="w", encoding="utf-8", dir=file.parent, delete=False) as stream:
        json.dump(data, stream, ensure_ascii=False, separators=(",", ":"))
        temporary = Path(stream.name)
    temporary.replace(file)


@contextmanager
def lock(path: Path, *, exclusive_now: bool = False):
    with path.open("a") as handle:
        try:
            options = fcntl.LOCK_EX | (fcntl.LOCK_NB if exclusive_now else 0)
            fcntl.flock(handle.fileno(), options)
        except BlockingIOError as error:
            raise Refused("proof_busy") from error
        yield


def blob_path(root: Path, digest: str) -> Path:
    return root / "cache" / digest


def spec_for(root: Path, job: str):
    spec = root / "jobs" / job / "request.json"
    if not spec.is_file():
        raise Refused("proof_session_expired")
    return read_json(spec)


def reserved_art(jobs: list[Path]) -> dict[str, int]:
    sizes = {}
    for job in jobs:
        for entry in read_json(job / "request.json")["assets"]:
            sizes[entry["sha256"]] = entry["size"]
    return sizes


def idle_since(job: Path, cutoff: float) -> bool:
    request = job / "request.json"
    if request.stat().st_mtime > cutoff:
        return False
    try:
        with lock(request, exclusive_now=True):
            return True
    except Refused:
        return False


def make_room(root: Path, *, art: dict[str, int] | None = None, output_bytes: int = 0,
              staging: bool = False) -> None:
    # Caller holds metadata.lock. Uploads and new render leases serialize with
    # retirement. A job being rendered holds its request lock until publication.
    jobs = list((root / "jobs").iterdir())
    old_art = reserved_art(jobs)
    new_art = art or {}
    if any(digest in old_art and size != old_art[digest] for digest, size in new_art.items()):
        raise Refused("proof_input")
    if staging:
        def fits():
            return len(jobs) < MAX_JOBS and sum((reserved_art(jobs) | new_art).values()) <= MAX_CACHE_BYTES
    else:
        def fits():
            return output_bytes + sum(total_file_size(job / "output") for job in jobs) <= MAX_OUTPUT_BYTES

    if fits():
        return
    completed = sorted((job for job in jobs if (job / "output").is_dir()),
                       key=lambda job: ((job / "output").stat().st_mtime_ns, job.name))
    idle = []
    if staging:
        cutoff = time() - STAGING_IDLE_SECONDS
        idle = sorted((job for job in jobs if job not in completed and idle_since(job, cutoff)),
                      key=lambda job: ((job / "request.json").stat().st_mtime_ns, job.name))
    retired = []
    for job in (*idle, *completed):
        jobs.remove(job)
        retired.append(job)
        if fits():
            break
    else:
        raise Refused("proof_limit")

    for job in retired:
        shutil.rmtree(job)
    remaining = reserved_art(jobs).keys() | new_art.keys()
    for digest in old_art.keys() - remaining:
        blob_path(root, digest).unlink(missing_ok=True)
        partial = root / "chunks" / digest
        if partial.exists():
            shutil.rmtree(partial)


def exact_spec(data: object):
    if not isinstance(data, dict) or set(data) != {"manifest", "assets", "sourceFingerprint"}:
        raise Refused("proof_input")
    if not isinstance(data["sourceFingerprint"], str) or not DIGEST.fullmatch(data["sourceFingerprint"]):
        raise Refused("proof_input")
    manifest, assets = data["manifest"], data["assets"]
    if not isinstance(assets, list) or not 1 <= len(assets) <= MAX_ASSETS:
        raise Refused("proof_input")
    referenced = manifest_assets(manifest)
    if referenced != {f"image-{number}" for number in range(1, len(assets) + 1)}:
        raise Refused("proof_input")
    declared = {}
    for entry in assets:
        if not isinstance(entry, dict) or set(entry) != {"sha256", "size"}:
            raise Refused("proof_input")
        digest, size = entry["sha256"], entry["size"]
        if not isinstance(digest, str) or not DIGEST.fullmatch(digest):
            raise Refused("proof_input")
        if type(size) is not int or not 1 <= size <= MAX_IMAGE_BYTES:
            raise Refused("proof_input")
        if declared.setdefault(digest, size) != size:
            raise Refused("proof_input")
    if sum(entry["size"] for entry in assets) > MAX_ART_BYTES:
        raise Refused("proof_input")
    manifest_bytes = json.dumps(manifest, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if len(manifest_bytes) > MAX_MANIFEST_BYTES:
        raise Refused("proof_input")
    # Validate geometry, required texts, scene structure and page count before accepting asset bytes.
    with TemporaryDirectory() as folder:
        preview = Path(folder)
        art = preview / "art"
        art.mkdir()
        for name in referenced:
            (art / name).touch()
        source = preview / "edition.json"
        source.write_bytes(manifest_bytes)
        plan(load(source, review_pending=True))
    return declared, manifest_bytes


def prepare(root: Path, job: str, incoming: Path):
    try:
        data = read_json(incoming)
        declared, manifest_bytes = exact_spec(data)
        asset_spec = {"assets": data["assets"], "sourceFingerprint": data["sourceFingerprint"]}
        jobs = root / "jobs"
        with lock(root / "metadata.lock"):
            folder = jobs / job
            if folder.is_dir():
                if spec_for(root, job) != asset_spec or (folder / "edition.json").read_bytes() != manifest_bytes:
                    raise Refused("proof_input")
                if (folder / "output").is_dir():
                    os.utime(folder / "output")
                else:
                    os.utime(folder / "request.json")
            else:
                make_room(root, art=declared, staging=True)
                with TemporaryDirectory(dir=root) as scratch:
                    next_job = Path(scratch) / "job"
                    next_job.mkdir()
                    write_json(next_job / "request.json", asset_spec)
                    (next_job / "edition.json").write_bytes(manifest_bytes)
                    next_job.rename(folder)
            return {"missing": [i for i, item in enumerate(data["assets"], 1)
                                if not blob_path(root, item["sha256"]).is_file()]}
    finally:
        incoming.unlink(missing_ok=True)


def upload(root: Path, job: str, index: int, part: int, incoming: Path):
    try:
        with lock(root / "metadata.lock"):
            assets = spec_for(root, job)["assets"]
            if not 1 <= index <= len(assets):
                raise Refused("proof_input")
            asset = assets[index - 1]
            digest = asset["sha256"]
            size = asset["size"]
            expected = min(CHUNK_SIZE, size - CHUNK_SIZE * part)
            parts_count = (size + CHUNK_SIZE - 1) // CHUNK_SIZE
            if not 0 <= part < parts_count or incoming.stat().st_size != expected:
                raise Refused("proof_input")
            os.utime(root / "jobs" / job / "request.json")
            final = blob_path(root, digest)
            if final.is_file():
                return {"cached": True}
            parts = root / "chunks" / digest
            parts.mkdir(exist_ok=True)
            incoming.replace(parts / str(part))
            if any(not (parts / str(i)).is_file() for i in range(parts_count)):
                return {"cached": False}
            combined = parts / "combined"
            try:
                with combined.open("wb") as destination:
                    for i in range(parts_count):
                        with (parts / str(i)).open("rb") as source:
                            shutil.copyfileobj(source, destination)
                if file_hash(combined) != digest:
                    raise Refused("proof_checksum")
                combined.chmod(0o400)
                combined.replace(final)
            finally:
                shutil.rmtree(parts)
            return {"cached": True}
    finally:
        incoming.unlink(missing_ok=True)


def total_file_size(folder: Path) -> int:
    return sum(file.stat().st_size for file in folder.rglob("*") if file.is_file())


def render(root: Path, job: str):
    folder = root / "jobs" / job
    output = folder / "output"
    with lock(root / "metadata.lock"):
        if output.is_dir():
            os.utime(output)
            return {"ok": True}
        if not folder.is_dir():
            raise Refused("proof_session_expired")
        # Repeated render requests keep a queued job alive while another runs.
        os.utime(folder / "request.json")
    with lock(root / "render.lock", exclusive_now=True), ExitStack() as lease:
        with lock(root / "metadata.lock"):
            if output.is_dir():
                os.utime(output)
                return {"ok": True}
            request = spec_for(root, job)
            assets = [blob_path(root, item["sha256"]) for item in request["assets"]]
            if any(not asset.is_file() for asset in assets):
                raise Refused("proof_incomplete")
            lease.enter_context(lock(folder / "request.json", exclusive_now=True))
        with TemporaryDirectory(dir=root) as scratch:
            temp = Path(scratch)
            source = temp / "source"
            art = source / "art"
            art.mkdir(parents=True)
            for number, asset in enumerate(assets, 1):
                # The worker forbids hardlinks and copies into its own private workspace.
                shutil.copyfile(asset, art / f"image-{number}")
            shutil.copyfile(folder / "edition.json", source / "edition.json")
            temporary_output = temp / "output"
            command = subprocess.run(
                [sys.executable, "-B", str(Path(__file__).with_name("proof_job.py")),
                 str(source), str(temporary_output)],
                capture_output=True, text=True, timeout=130, check=False,
            )
            if command.returncode != 0:
                detail = command.stderr.strip()
                raise Refused("proof_input", detail if FIT_ERROR.fullmatch(detail) else None)
            if not (temporary_output / "proof.json").is_file():
                raise Refused("proof_unavailable")
            with lock(root / "metadata.lock"):
                make_room(root, output_bytes=total_file_size(temporary_output))
                temporary_output.rename(output)
        return {"ok": True}


def main() -> None:
    os.umask(0o077)
    operation, directory, job, *args = sys.argv[1:]
    root = Path(directory)
    try:
        if not DIGEST.fullmatch(job):
            raise Refused("proof_input")
        if operation in ("prepare", "upload", "discard"):
            nonce = args[-1]
            if not NONCE.fullmatch(nonce):
                raise Refused("proof_input")
            incoming = root / "incoming" / nonce
        if operation == "prepare":
            result = prepare(root, job, incoming)
        elif operation == "upload":
            result = upload(root, job, int(args[0]), int(args[1]), incoming)
        elif operation == "discard":
            incoming.unlink(missing_ok=True)
            result = {}
        elif operation == "render":
            result = render(root, job)
        else:
            raise Refused("proof_input")
    except Refused as error:
        result = {"error": error.code}
        if error.detail:
            result["detail"] = error.detail
    except (ValueError, OverflowError, RecursionError):
        result = {"error": "proof_input"}
    except subprocess.TimeoutExpired:
        result = {"error": "proof_unavailable"}
    except OSError:
        result = {"error": "proof_unavailable"}
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
