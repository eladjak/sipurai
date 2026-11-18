"""Tests for the untrusted-input proof entry point and its PDF-derived previews."""

import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory
from time import time
import unittest

from PIL import Image
from pikepdf import Pdf, parse_content_stream

from layout import load, plan
from proof_job import InvalidProofInput, MAX_MANIFEST_BYTES, render_proof, stage_job
from proof_session import MAX_JOBS, STAGING_IDLE_SECONDS, Refused, lock, prepare, render, upload
from render import command, file_hash


class ProofJobTest(unittest.TestCase):
    def setUp(self):
        temp = TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.room = Path(temp.name)
        self.job = self.room / "input"
        (self.job / "art").mkdir(parents=True)
        self.manifest = self.job / "edition.json"
        self.art = self.job / "art/image-1"
        with Image.new("RGB", (1024, 512), "#333867") as image:
            image.paste("#ffbea0", (512, 0, 1024, 512))
            image.save(self.art, "JPEG")
        self.cover = self.job / "art/image-2"
        with Image.new("RGB", (600, 600), "#ac81b4") as image:
            image.save(self.cover, "WEBP")
        self.scene = {
            "layout": "spread", "art": "art/image-1", "text": ["לַיְלָה טוֹב", "מחר ניפגש"],
            "zones": ["top-right", "bottom-left"], "pointing": ["pending", "unpointed"],
        }
        self.edition = {
            "version": 1, "title": "הפתעה לפני השינה", "creator": "אור",
            "blurb": "סיפור על שני חברים שמגלים עולם חדש",
            "coverArt": "art/image-2", "closingArt": "art/image-2",
            "scenes": [
                {"layout": "single", "art": "art/image-2", "text": ["התחלה טובה"],
                 "zones": ["bottom"], "pointing": ["unpointed"]},
                self.scene,
            ],
            "nikudStatus": "pending", "requestedFinishing": {"cover": "softcover", "paper": "standard"},
            "qrUrl": "https://www.sipurai.ai/b/print/synthetic-book",
        }

    def write_manifest(self):
        self.manifest.write_text(json.dumps(self.edition, ensure_ascii=False), encoding="utf-8")

    def expect_bad_input(self):
        self.write_manifest()
        with TemporaryDirectory(dir=self.room) as stage:
            with self.assertRaises((InvalidProofInput, OSError)):
                stage_job(self.job, Path(stage))

    def story_fonts(self, output):
        with Pdf.open(output / "interior.pdf") as pdf:
            page = pdf.pages[3]
            used = {operands[0] for operands, operator in parse_content_stream(page) if str(operator) == "Tf"}
            return {str(page.Resources.Font[font].BaseFont) for font in used}

    def test_rejects_paths_unknown_fields_and_invalid_qrs(self):
        for invalid in ("../image-1", "/dev/null", "art/../image-1", "art//image-1", "art/image-01",
                        "https://example.invalid/image-1", "art/image-99", " art/image-1", "art/image-1\n"):
            with self.subTest(invalid=invalid):
                self.scene["art"] = invalid
                self.expect_bad_input()
        self.scene["art"] = "art/image-1"
        for field, value in (("iccProfile", "art/image-1"), ("profileVendorVerified", True),
                             ("unknown", {}), ("qrUrl", "https://other.invalid/b/print/book"),
                             ("title", "x" * 131), ("unsavedDraft", "true")):
            with self.subTest(field=field):
                before = self.edition.copy()
                self.edition[field] = value
                self.expect_bad_input()
                self.edition = before

    def test_rejects_extra_entries_symlinks_hard_links_and_pipes(self):
        extra = self.job / "art/image-3"
        extra.touch()
        self.expect_bad_input()
        extra.unlink()

        outside = self.room / "outside"
        self.art.rename(outside)
        self.art.symlink_to(outside)
        self.expect_bad_input()
        self.art.unlink()
        os.link(outside, self.art)
        self.expect_bad_input()
        self.art.unlink()
        os.mkfifo(self.art)
        self.expect_bad_input()
        self.art.unlink()
        outside.rename(self.art)
        (self.job / "art").rename(self.room / "moved-art")
        (self.job / "art").symlink_to(self.room / "moved-art", target_is_directory=True)
        self.expect_bad_input()

    def test_rejects_mislabeled_multiframe_and_large_art(self):
        self.art.write_text("<svg/>", encoding="utf-8")
        self.expect_bad_input()
        with Image.new("RGB", (6501, 2)) as big:
            big.save(self.art, "PNG")
        self.expect_bad_input()
        with Image.new("RGB", (15, 15), "red") as first, Image.new("RGB", (15, 15), "blue") as second:
            first.save(self.art, "WEBP", save_all=True, append_images=[second])
        self.expect_bad_input()

    def test_rendered_preview_follows_pdf_reading_order_and_hashes(self):
        self.edition["dedication"] = "למי שאוהב סיפורים"
        self.edition["paper"] = "chrome-matte-130"
        self.edition["requestedFinishing"]["paper"] = "chrome-matte-130"
        self.write_manifest()
        output = self.room / "proof"
        render_proof(self.job, output)
        result = json.loads((output / "proof.json").read_text())
        self.assertEqual((result["trimWidthMm"], result["trimHeightMm"], result["bleedMm"], result["spineMm"]),
                         (220, 220, 3.2, 1.5))
        self.assertEqual(result["paper"], "chrome-matte-130")
        self.assertEqual(result["pdfs"], {"interior": "interior.pdf", "cover": "cover.pdf"})
        self.assertEqual(result["insideFile"], "cover-inside.webp")
        self.assertEqual(result["coverFile"], "cover-wrap.webp")
        self.assertEqual(result["nikudStatus"], "pending")
        self.assertIn(self.edition["title"], result["coverText"]["front"])
        self.assertIn(self.edition["blurb"], result["coverText"]["back"])
        self.assertEqual(result["pages"][1]["text"], self.edition["dedication"])
        self.assertIn(self.edition["creator"], result["pages"][2]["text"])
        self.assertEqual(set(result["pdfSha256"]), {"interior.pdf", "cover.pdf", "cover-with-inside.pdf"})
        for file, digest in result["pdfSha256"].items():
            self.assertEqual(file_hash(output / file), digest)
        with Pdf.open(output / "interior.pdf") as pdf:
            self.assertEqual(len(pdf.pages), 24)
            self.assertIn("awaits approval", str(pdf.docinfo["/Subject"]))
        self.assertTrue(any("DavidLibre" in name for name in self.story_fonts(output)))
        plan_pages = plan(load(self.manifest, review_pending=True))
        self.assertEqual(len(result["pages"]), len(plan_pages))
        self.assertEqual(
            [(preview["kind"], preview.get("storyIndex"), preview.get("text") if "storyIndex" in preview else None)
             for preview in result["pages"]],
            [(page.kind, page.folio - 1 if page.folio else None, page.text if page.folio else None)
             for page in plan_pages],
        )
        for filename in (result["insideFile"], result["coverFile"], *(page["file"] for page in result["pages"])):
            with Image.open(output / filename) as preview:
                self.assertEqual(preview.format, "WEBP")
                self.assertEqual(max(preview.size), 1600 if filename.startswith("cover") else 1050)
        first_spread_page = result["pages"][5]
        self.assertEqual(first_spread_page["storyIndex"], 1)
        command("pdftoppm", "-f", "6", "-l", "6", "-singlefile", "-scale-to", "1050",
                output / "interior.pdf", self.room / "actual")
        with Image.open(self.room / "actual.ppm") as page, Image.open(output / first_spread_page["file"]) as preview:
            for x, y in ((24, 250), (525, 525), (1000, 900)):
                self.assertTrue(all(abs(a - b) < 6 for a, b in zip(page.getpixel((x, y)), preview.getpixel((x, y)))))

    def test_render_without_inside_and_refuse_existing_output(self):
        self.edition["insideCover"] = False
        self.edition["storyFont"] = "rubik"
        self.write_manifest()
        output = self.room / "proof"
        render_proof(self.job, output)
        result = json.loads((output / "proof.json").read_text())
        self.assertIsNone(result["insideFile"])
        self.assertFalse((output / "cover-with-inside.pdf").exists())
        self.assertFalse((output / "cover-inside.webp").exists())
        fonts = self.story_fonts(output)
        self.assertTrue(fonts and all("Rubik" in name for name in fonts))
        with self.assertRaisesRegex(InvalidProofInput, "must be new"):
            render_proof(self.job, output)

    def test_approved_unsaved_proof_keeps_draft_subject_in_all_pdfs(self):
        self.edition["nikudStatus"] = "approved"
        self.scene["pointing"][0] = "approved"
        checked = []
        for draft in (True, False):
            # The saved handoff omits the draft flag completely.
            if draft:
                self.edition["unsavedDraft"] = True
            else:
                del self.edition["unsavedDraft"]
            self.write_manifest()
            output = self.room / ("unsaved" if draft else "saved")
            render_proof(self.job, output)
            record = json.loads((output / "preflight.json").read_text())
            metadata = json.loads((output / "proof.json").read_text())
            self.assertEqual(record["reviewOnly"], draft)
            self.assertEqual(record["unsavedDraft"], draft)
            self.assertEqual(metadata["unsavedDraft"], draft)
            self.assertEqual(metadata["nikudStatus"], "approved")
            self.assertEqual(set(metadata["pdfSha256"]), {"interior.pdf", "cover.pdf", "cover-with-inside.pdf"})
            for filename in metadata["pdfSha256"]:
                with Pdf.open(output / filename) as pdf:
                    subject = str(pdf.docinfo.get("/Subject", ""))
                    self.assertEqual(subject, "Unsaved draft — Hebrew pointing approved" if draft else "")
            checked.append(((record["pages"], record["coverText"]),
                            {file.name: file_hash(file) for file in output.glob("*.webp")}))
        self.assertEqual(checked[0], checked[1], "draft status must not affect rendered layout")

    def test_prepare_persists_exact_worker_manifest_bytes_at_limit(self):
        manifest = dict(self.edition, coverArt="art/image-1", closingArt="art/image-1")
        manifest["scenes"] = [
            {"layout": "single", "art": "art/image-1", "text": ["a" * 4000], "zones": ["top"]}
            for _ in range(33)
        ]
        ending = manifest["scenes"][-1]["text"]

        def encoded():
            return json.dumps(manifest, ensure_ascii=False, separators=(",", ":")).encode("utf-8")

        ending[0] = ending[0][:-(len(encoded()) - MAX_MANIFEST_BYTES)]
        content = encoded()
        self.assertEqual(len(content), MAX_MANIFEST_BYTES)
        self.assertGreater(len(json.dumps(manifest, ensure_ascii=False).encode("utf-8")), MAX_MANIFEST_BYTES)
        jobs = self.room / "jobs"
        jobs.mkdir()
        incoming = self.room / "request"
        asset = {"sha256": file_hash(self.art), "size": self.art.stat().st_size}

        def submit(job):
            incoming.write_text(json.dumps({"manifest": manifest, "assets": [asset], "sourceFingerprint": "0" * 64},
                                           ensure_ascii=False),
                                encoding="utf-8")
            return prepare(self.room, job, incoming)

        job = "a" * 64
        self.assertEqual(submit(job), {"missing": [1]})
        self.assertEqual((jobs / job / "edition.json").read_bytes(), content)
        ending[0] += "a"
        with self.assertRaisesRegex(Refused, "proof_input"):
            submit("b" * 64)

    def test_more_than_eight_edits_preserve_pending_jobs_and_referenced_art(self):
        for name in ("jobs", "cache", "chunks"):
            (self.room / name).mkdir()
        manifest = dict(self.edition, coverArt="art/image-1", closingArt="art/image-1", scenes=[self.scene])
        incoming = self.room / "request"
        early = {"sha256": "c" * 64, "size": 13}
        shared = {"sha256": "d" * 64, "size": 33}
        (self.room / "cache" / early["sha256"]).write_bytes(b"a" * 13)
        (self.room / "cache" / shared["sha256"]).write_bytes(b"b" * 33)

        def submit(index, art, *, completed):
            job = f"{index:064x}"
            incoming.write_text(json.dumps({"manifest": dict(manifest, title=f"Proof {index}"), "assets": [art],
                                           "sourceFingerprint": "0" * 64}))
            self.assertEqual(prepare(self.room, job, incoming), {"missing": []})
            if completed:
                output = self.room / "jobs" / job / "output"
                output.mkdir()
                os.utime(output, (index + 1, index + 1))
            return job

        active = submit(0, shared, completed=False)
        retired = submit(1, early, completed=True)
        for i in range(2, 12):
            latest = submit(i, shared, completed=True)
        jobs = self.room / "jobs"
        self.assertEqual(len(list(jobs.iterdir())), MAX_JOBS)
        self.assertTrue((jobs / active).is_dir())
        self.assertTrue((jobs / latest / "output").is_dir())
        self.assertFalse((jobs / retired).exists())
        self.assertEqual({p.name for p in (self.room / "cache").iterdir()}, {shared["sha256"]})
        with self.assertRaisesRegex(Refused, "proof_session_expired"):
            render(self.room, retired)

    def test_idle_canceled_prepares_recover_capacity_and_keep_activity(self):
        jobs = self.room / "jobs"
        for path in (jobs, self.room / "cache", self.room / "chunks"):
            path.mkdir()
        source = self.art.read_bytes()
        asset = {"sha256": file_hash(self.art), "size": len(source)}
        manifest = dict(self.edition, coverArt="art/image-1", closingArt="art/image-1", scenes=[self.scene])
        incoming = self.room / "request"
        expired = time() - STAGING_IDLE_SECONDS - 1

        def submit(index):
            job = f"{index:064x}"
            incoming.write_text(json.dumps({"manifest": dict(manifest, title=f"Proof {index}"), "assets": [asset],
                                            "sourceFingerprint": "0" * 64}))
            prepare(self.room, job, incoming)
            return job

        abandoned = [submit(index) for index in range(MAX_JOBS)]
        with self.assertRaisesRegex(Refused, "proof_limit"):
            submit(MAX_JOBS)
        for job in abandoned:
            os.utime(jobs / job / "request.json", (expired, expired))

        # One old job is actually rendering. A matching prepare and valid
        # upload refresh two others, including a job shared with another tab.
        locked, refreshed, uploading, first_expired = abandoned[:4]
        upload_input = self.room / "upload-part"
        upload_input.write_bytes(source)
        self.assertEqual(upload(self.room, uploading, 1, 0, upload_input), {"cached": True})
        self.assertEqual(submit(1), refreshed)
        with lock(jobs / locked / "request.json"):
            for index in range(MAX_JOBS, MAX_JOBS + 5):
                latest = submit(index)
            self.assertTrue((jobs / locked).is_dir())

        for job in (locked, refreshed, uploading, latest):
            self.assertTrue((jobs / job).is_dir())
        self.assertFalse((jobs / first_expired).exists())
        self.assertTrue((self.room / "cache" / asset["sha256"]).is_file())
        self.assertEqual(len(list(jobs.iterdir())), MAX_JOBS)


if __name__ == "__main__":
    unittest.main()
