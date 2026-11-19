"""Regression controls for the versioned prepress entry point."""

from dataclasses import replace
from hashlib import sha256
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from PIL import Image
from fontTools.ttLib import TTFont
from pikepdf import ContentStreamInstruction, Name, Pdf, Rectangle, parse_content_stream, unparse_content_stream

from design import BODY, FRIENDLY, balanced_lines, document, floating_style, panel
from layout import load, normalize_quotes, plan, spine_for
from render import build, verify_existing
from weasyprint import HTML


class EditionTest(unittest.TestCase):
    def setUp(self):
        temp = TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.manifest = self.root / "edition.json"
        picture = Image.new("RGB", (1024, 512), "#1c305b")
        picture.paste("#dc9a6c", (512, 0, 1024, 512))
        picture.save(self.root / "art.png")
        self.single = {"layout": "single", "art": "art.png", "text": ["לילה טוב"],
                       "zones": ["bottom"]}
        self.spread = {"layout": "spread", "art": "art.png",
                       "text": ["נועם פתח את הדלת", "ופגש את הגור שלו"],
                       "zones": ["top-right", "bottom-left"]}
        self.edition = {"version": 1, "title": "סיפור שלום", "creator": "המשפחה",
                        "blurb": "לילה שקט בעיירה קטנה ושני חברים שיוצאים למסע",
                        "dedication": "לכל הילדים הסקרנים", "coverArt": "art.png",
                        "closingArt": "art.png", "scenes": [self.spread]}

    def parse(self, **options):
        self.manifest.write_text(json.dumps(self.edition, ensure_ascii=False))
        return load(self.manifest, **options)

    def test_integrated_wash_keeps_safe_text_and_legacy_panels(self):
        self.single["panel"] = "integrated"
        self.edition["scenes"] = [self.single]
        edition = self.parse()
        page = next(p for p in plan(edition) if p.kind == "story")
        for zone in ("top-left", "bottom-right"):
            for value in ("לילה טוב", "לילה אחד יצאו שני חברים למסע קטן בין העצים וראו כוכב נוצץ בשמים"):
                current = replace(page, zone=zone, text=value)
                html, box = panel(value, current, edition.geometry, False, integrated=True)
                old, old_box = panel(value, current, edition.geometry, False)
                self.assertIn("linear-gradient", html)
                self.assertNotIn("border-radius", html)
                self.assertEqual(box, old_box)
                self.assertIn("border-radius", old)
                self.assertGreaterEqual(box.x, edition.geometry.bleed + 12)
                self.assertLessEqual(box.x + box.width, edition.geometry.media[0] - edition.geometry.bleed - 12)
        self.single.pop("panel")
        self.assertEqual(self.parse().scenes[0].panel, "cream")
        self.single["panel"] = "dark"
        self.assertEqual(self.parse().scenes[0].panel, "dark")

    def test_floating_caption_measures_cropped_art_and_preserves_pdf_text(self):
        self.single["panel"] = "floating"
        self.edition["scenes"] = [self.single]
        for width, height in ((220, 220), (210, 170)):
            with self.subTest(trim=(width, height)):
                self.edition.update(widthMm=width, heightMm=height)
                edition = self.parse()
                self.assertEqual(edition.scenes[0].panel, "floating")
                page = next(page for page in plan(edition) if page.kind == "story")
                media_w, media_h = edition.geometry.media
                old, box = panel(page.text, page, edition.geometry, False)
                sample = self.root / "cropped.png"
                raster = Image.new("RGB", (round(media_w * 6), round(media_h * 6)), "#fffaf0")
                # Keep most of the art light. Only the caption footprint is dark.
                sample_x = int(box.x * 6) - 3
                sample_y = int(box.y * 6) - 3
                right = int((box.x + box.width) * 6) + 3
                bottom = int((box.y + box.height) * 6) + 3
                raster.paste("#172541", (sample_x, sample_y, right, bottom))
                raster.save(sample)
                html, floating_box = panel(page.text, page, edition.geometry, False, floating_image=sample)
                self.assertEqual(box, floating_box)
                self.assertIn("color:#ffffff", html)
                self.assertNotIn("linear-gradient", html)
                self.assertGreaterEqual(box.y, media_h * .68)
                self.assertLessEqual(box.y + box.height, media_h - edition.geometry.bleed - 12)
                self.assertIn("border-radius", old)

                raster.paste("#fffaf0", (sample_x, sample_y, right, bottom))
                raster.save(sample)
                self.assertEqual(floating_style(sample, box, edition.geometry), ("#000000", 0))

                raster.paste("#172541", (sample_x, sample_y, (sample_x + right) // 2, bottom))
                raster.save(sample)
                color, alpha = floating_style(sample, box, edition.geometry)
                self.assertEqual(color, "#000000")
                self.assertGreater(alpha, 0)
                self.assertLess(alpha, 0.5)
                html, _ = panel(page.text, page, edition.geometry, False, floating_image=sample)
                self.assertNotIn("linear-gradient", html)
                self.assertIn("-washed.jpg", html)
                with Image.open(self.root / "cropped-washed.jpg") as washed:
                    self.assertLessEqual(max(abs(a - b) for a, b in zip(washed.getpixel((0, 0)), (255, 250, 240), strict=True)), 2)
                    self.assertEqual(floating_style(self.root / "cropped-washed.jpg", box, edition.geometry), ("#000000", 0))
                pdf_path = self.root / "floating.pdf"
                HTML(string=document([html], media_w, media_h, page.text)).write_pdf(pdf_path)
                with Pdf.open(pdf_path) as pdf:
                    self.assertTrue(any(str(instruction.operator) in ("TJ", "Tj")
                                        for instruction in parse_content_stream(pdf.pages[0])))
                    self.assertTrue(all(font.get("/ToUnicode") for font in pdf.pages[0].Resources.Font.values()))

    def test_compact_opening_keeps_physical_story_leaf_and_folio(self):
        self.edition["scenes"] = [self.single, self.spread]
        legacy = plan(self.parse())
        self.edition["openingLayout"] = "compact"
        compact = plan(self.parse())
        self.assertEqual([(page.number, page.kind, page.side) for page in compact[:3]], [
            (1, "opening-art", "left"), (2, "dedication", "right"), (3, "title-credits", "left"),
        ])
        self.assertEqual(compact[3:], legacy[3:])
        self.assertEqual(compact[3].folio, 1)

        self.edition["dedication"] = ""
        self.assertEqual(plan(self.parse())[1].kind, "dedication-art")
        self.edition["openingLayout"] = "legacy"
        self.assertEqual([page.kind for page in plan(self.parse())[:3]], ["title", "endpaper", "copyright"])
        self.edition["openingLayout"] = "custom"
        with self.assertRaisesRegex(ValueError, "Unknown opening layout"):
            self.parse()

    def test_manual_caption_styles_compile_without_affecting_the_measured_box(self):
        self.edition["scenes"] = [self.single]
        self.single["panel"] = "manual"
        appearance = {"textColor": "#113366", "backdropColor": "#eedd77", "backdropOpacity": 0.5}
        self.single["captionStyle"] = appearance
        for width, height in ((220, 220), (210, 170)):
            with self.subTest(trim=(width, height)):
                self.edition.update(widthMm=width, heightMm=height)
                edition = self.parse()
                page = next(page for page in plan(edition) if page.kind == "story")
                appearance["backdropOpacity"] = 0.5
                style = self.parse().scenes[0].caption_style
                legacy, previous = panel(page.text, page, edition.geometry, False, width_cap=80)
                manual, fitted = panel(page.text, page, edition.geometry, False, width_cap=80, caption_style=style)
                self.assertEqual(fitted, previous)
                self.assertIn("background:rgba(238,221,119,0.5)", manual)
                self.assertIn("color:#113366", manual)
                self.assertNotIn("#113366", legacy)
                appearance["backdropOpacity"] = 0
                clear, _ = panel(page.text, page, edition.geometry, False, width_cap=80,
                                 caption_style=self.parse().scenes[0].caption_style)
                self.assertNotIn("border-radius", clear)
                self.assertIn("color:#113366", clear)
                pdf_path = self.root / "manual.pdf"
                media_w, media_h = edition.geometry.media
                HTML(string=document([manual, clear], media_w, media_h, page.text)).write_pdf(pdf_path)
                with Pdf.open(pdf_path) as pdf:
                    self.assertEqual(len(pdf.pages), 2)
                    for sheet in pdf.pages:
                        self.assertTrue(any(str(item.operator) in ("TJ", "Tj") for item in parse_content_stream(sheet)))
                        self.assertTrue(all(font.get("/ToUnicode") for font in sheet.Resources.Font.values()))

        for key, bad in (("textColor", "#000000;"), ("backdropColor", "#123"),
                         ("backdropOpacity", True), ("backdropOpacity", -0.1), ("backdropOpacity", 1.1)):
            self.single["captionStyle"] = {**appearance, key: bad}
            with self.assertRaises(ValueError):
                self.parse()
        self.single.update(panel="floating", captionStyle=appearance)
        with self.assertRaisesRegex(ValueError, "requires the manual panel"):
            self.parse()

    def test_manual_caption_height_sets_rectangle_without_changing_automatic_fit(self):
        self.edition["scenes"] = [self.single]
        self.single.update(panel="manual", captionStyle={
            "textColor": "#222222", "backdropColor": "#ffeecc", "backdropOpacity": 1,
        }, panelHeightsMm=[40])
        for width, height in ((165, 235), (210, 170)):
            with self.subTest(trim=(width, height)):
                self.edition.update(widthMm=width, heightMm=height)
                edition = self.parse()
                self.assertEqual(edition.scenes[0].panel_heights, (40,))
                page = next(page for page in plan(edition) if page.kind == "story")
                style = edition.scenes[0].caption_style
                old, old_box = panel(page.text, page, edition.geometry, False, width_cap=85, caption_style=style)
                for zone, top in (("top-left", True), ("bottom-right", False)):
                    changed = replace(page, zone=zone)
                    fixed, box = panel(page.text, changed, edition.geometry, False, width_cap=85,
                                       caption_style=style, height_mm=40)
                    self.assertIn("width:85.00000mm;height:40.00000mm", fixed)
                    self.assertGreater(box.width, old_box.width)
                    expected_y = edition.geometry.bleed + 15 if top else edition.geometry.media[1] - edition.geometry.bleed - 24 - 40
                    self.assertAlmostEqual(box.y, expected_y + (40 - box.height) / 2)
                    self.assertGreaterEqual(box.x, edition.geometry.bleed + 12)
                    self.assertLessEqual(box.x + box.width, edition.geometry.media[0] - edition.geometry.bleed - 12)
                self.assertNotIn("height:40.00000mm", old)
                with self.assertRaisesRegex(ValueError, "does not fit"):
                    panel("מילה " * 120, page, edition.geometry, False, width_cap=55, caption_style=style, height_mm=28)
        for invalid in ([27], [65], ["40"], [True], [], [40, None]):
            self.single["panelHeightsMm"] = invalid
            with self.assertRaises(ValueError):
                self.parse()
        self.single["panelHeightsMm"] = [None]
        self.assertEqual(self.parse().scenes[0].panel_heights, (None,))
        self.single.pop("captionStyle")
        self.single["panel"] = "cream"
        with self.assertRaises(ValueError):
            self.parse()

    def test_parity_signature_folios_and_cover_spine(self):
        self.edition.update(scenes=[self.single, self.spread])
        edition = self.parse()
        pages = plan(edition)
        self.assertEqual(len(pages), 24)
        self.assertEqual(spine_for(edition, pages), (1.8, "measured-24pp-soft-white110"))
        self.assertEqual([(p.number, p.kind, p.side, p.folio) for p in pages[:7]], [
            (1, "title", "left", None), (2, "dedication", "right", None),
            (3, "copyright", "left", None), (4, "story", "right", 1),
            (5, "endpaper", "left", None), (6, "story", "right", 2),
            (7, "story", "left", 3),
        ])
        self.assertEqual(pages[-1].kind, "closing")
        extended = replace(edition, minimum=25)
        self.assertEqual(spine_for(extended, plan(extended)), (2.1, "derived-unverified"))

    def test_fredoka_story_font_prints_pointed_hebrew_with_an_embedded_font(self):
        text = "שָׁלוֹם לַסִּפּוּר"
        self.assertEqual(sha256(FRIENDLY.read_bytes()).hexdigest(),
                         "b35d81b4161a69d875971fbf9367bdc73ce0368cd3446fce476dd5ee4a522f81")
        with TTFont(FRIENDLY) as font:
            self.assertNotIn("fvar", font)
            self.assertEqual(font["OS/2"].usWeightClass, 500)
            self.assertTrue(set(map(ord, text)).issubset(font.getBestCmap()))
        self.single.update(text=[text], pointing=["approved"], panel="floating")
        self.edition.update(storyFont="fredoka", nikudStatus="approved", scenes=[self.single])
        edition = self.parse()
        target = self.root / "fredoka-proof"
        target.mkdir()
        build(edition, self.manifest, target, make_previews=False)
        self.assertEqual(edition.story_font, "fredoka")
        self.assertTrue((target / "interior.pdf").is_file())

    def test_compact_opening_records_low_native_resolution_in_both_dedication_modes(self):
        Image.new("RGB", (600, 480), "#ab8054").save(self.root / "small-dedication.png")
        self.edition.update(widthMm=210, heightMm=170, openingLayout="compact",
                            dedicationArt="small-dedication.png", scenes=[self.single])
        for note, artwork in (("הקדשה למשפחה", "dedication-vignette"), ("", "dedication-art")):
            with self.subTest(artwork=artwork):
                self.edition["dedication"] = note
                edition = self.parse()
                target = self.root / artwork
                target.mkdir()
                build(edition, self.manifest, target, make_previews=False)
                preflight = json.loads((target / "preflight.json").read_text())
                self.assertLess(preflight["nativeDpiBelow300"][artwork], 300)
                self.assertIn("Some art is resampled to 300 dpi.", " ".join(preflight["warnings"]))

    def test_stock_caliper_and_mismatch_fail_closed(self):
        for paper, expected in (("white-110gsm", 1.8), ("chrome-matte-130", 1.5), ("chrome-matte-170", 1.92)):
            self.edition["paper"] = paper
            edition = self.parse()
            self.assertEqual(spine_for(edition, plan(edition))[0], expected)
        self.edition["requestedFinishing"] = {"cover": "softcover", "paper": "standard"}
        with self.assertRaisesRegex(ValueError, "does not match"):
            self.parse()
        self.edition["requestedFinishing"]["paper"] = "premium"
        with self.assertRaisesRegex(ValueError, "does not match"):
            self.parse()

    def test_pending_and_bad_approvals_fail_closed(self):
        self.spread["text"] = ["לַיְלָה טוֹב", "שלום חבר"]
        self.spread["pointing"] = ["pending", "unpointed"]
        self.edition["nikudStatus"] = "pending"
        with self.assertRaisesRegex(ValueError, "review-pending"):
            self.parse()
        self.assertEqual(self.parse(review_pending=True).nikud_status, "pending")
        self.edition["nikudStatus"] = "approved"
        with self.assertRaisesRegex(ValueError, "pointing status"):
            self.parse()
        self.spread["pointing"][0] = "approved"
        self.assertEqual(self.parse().nikud_status, "approved")
        self.spread["pointing"][1] = "approved"
        with self.assertRaisesRegex(ValueError, "nikud status"):
            self.parse()
        self.edition.update(nikudStatus="unpointed", scenes=[self.single], title="לַיְלָה טוֹב")
        with self.assertRaisesRegex(ValueError, "front or back matter"):
            self.parse()

    def test_rules_reject_invalid_spec_and_text(self):
        self.edition["signatureMultiple"] = 6
        with self.assertRaisesRegex(ValueError, "divisible by four"):
            self.parse()
        del self.edition["signatureMultiple"]
        self.edition["bleedMm"] = 3
        with self.assertRaisesRegex(ValueError, "bleedMm"):
            self.parse()
        del self.edition["bleedMm"]
        self.edition["paper"] = "premium"
        with self.assertRaisesRegex(ValueError, "Unsupported binding or paper"):
            self.parse()
        del self.edition["paper"]
        self.edition["qrUrl"] = "https://other.example/b/print/private"
        with self.assertRaisesRegex(ValueError, "canonical Sipurai"):
            self.parse()

    def test_dialogue_quotes_and_hebrew_acronyms(self):
        dialogue = '״רֶגַע, אֵיפֹה הַשְּׂמִיכָה הַכְּחוּלָּה שֶׁלְּךָ?״'
        self.assertEqual(normalize_quotes(dialogue), '"רֶגַע, אֵיפֹה הַשְּׂמִיכָה הַכְּחוּלָּה שֶׁלְּךָ?"')
        self.assertEqual(normalize_quotes('הֵם אָמְרוּ „צה״ל”'), 'הֵם אָמְרוּ "צה״ל"')

    def test_wrap_balances_without_terminal_single_word(self):
        text = "אמא של נועם חיבקה אותו עם חיוך לפני השינה"
        lines = balanced_lines(text, 27, 82, 3, BODY)
        self.assertIsNotNone(lines)
        self.assertEqual(" ".join(lines), text)
        self.assertGreaterEqual(len(lines[-1].split()), 2)
        self.assertEqual(
            balanced_lines("הופק בסיפוראי\nנוצר בסיוע בינה מלאכותית", 15, 150, 4, BODY),
            ("הופק בסיפוראי", "נוצר בסיוע בינה מלאכותית"),
        )

    def test_same_spread_detects_deliberate_imposition_break(self):
        self.edition["qrUrl"] = "https://www.sipurai.ai/b/print/illustrated-book"
        edition = self.parse()
        output = self.root / "output"
        output.mkdir()
        build(edition, self.manifest, output)
        self.assertEqual(verify_existing(edition, output, self.manifest), [])
        with Pdf.open(output / "cover.pdf") as cover:
            self.assertEqual(len(cover.pages), 1)
            self.assertTrue(any(image.ColorSpace == Name.DeviceGray for image in cover.pages[0].images.values()))
        # Actual generated second page: barcode reservation at center of the
        # physical left panel near its bottom, independently from the exterior QR.
        with Image.open(output / "previews" / "cover-inside.png").convert("RGB") as inside:
            scale = 120 / 25.4
            x = round((3.2 + 110) * scale)
            y = round((3.2 + 220 - 5 - 7.5) * scale)
            self.assertEqual(inside.getpixel((x, y)), (255, 255, 255))
            self.assertNotEqual(inside.getpixel((x, round((3.2 + 110) * scale))), (255, 255, 255))
            self.assertNotEqual(inside.getpixel((round((3.2 + 220 + 1.8 + 110) * scale), y)), (255, 255, 255))
        preview = output / "previews" / "spread-04-05.png"
        with Image.open(preview) as spread:
            y = spread.height // 2
            left, right = spread.getpixel((30, y)), spread.getpixel((spread.width - 30, y))
            self.assertLess(left[0], left[2], "physical left must show the cool left half of the source")
            self.assertGreater(right[0], right[2], "physical right must show the warm right half of the source")

        interior = output / "interior.pdf"
        with Pdf.open(interior, allow_overwriting_input=True) as pdf:
            page = pdf.pages[3]
            page.TrimBox = Rectangle(0, 0, 500, 500)
            instructions = parse_content_stream(page)
            first_image = next(i for i, op in enumerate(instructions) if str(op.operator) == "Do")
            image_matrix = instructions[first_image - 1]
            self.assertEqual(str(image_matrix.operator), "cm")
            operands = list(image_matrix.operands)
            operands[4] += 20
            instructions[first_image - 1] = ContentStreamInstruction(operands, image_matrix.operator)
            page.Contents = pdf.make_stream(unparse_content_stream(instructions))
            pdf.save(interior)
        errors = verify_existing(edition, output, self.manifest)
        self.assertTrue(any("page 4: invalid TrimBox" in error for error in errors))
        self.assertTrue(any("page 4: first image does not cover" in error for error in errors))
        self.assertTrue(any("PDF changed" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
