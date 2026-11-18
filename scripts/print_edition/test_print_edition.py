"""Regression controls for the versioned prepress entry point."""

from dataclasses import replace
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from PIL import Image
from pikepdf import ContentStreamInstruction, Name, Pdf, Rectangle, parse_content_stream, unparse_content_stream

from design import BODY, balanced_lines
from layout import load, normalize_quotes, plan, spine_for
from render import build, verify_existing


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
