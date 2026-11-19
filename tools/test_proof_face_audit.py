import unittest
import hashlib
import json
import os
import tempfile
from pathlib import Path
from contextlib import redirect_stdout
from io import StringIO
from PIL import Image
from proof_face_audit import audit, run

class AuditTest(unittest.TestCase):
    def test_overlap_and_separation(self):
        d = {'reviewed_entire_page': True, 'faces': [[.1,.1,.3,.3]], 'captions': [[.2,.2,.4,.4]]}
        self.assertEqual(audit(d), ('overlap', 1))
        d['captions'] = [[.7,.7,.9,.9]]
        self.assertEqual(audit(d), ('clear', 0))
    def test_margin_and_touch_count_as_overlap(self):
        d = {'reviewed_entire_page': True, 'faces': [[.1,.1,.3,.3]], 'captions': [[.31,.2,.4,.4]]}
        self.assertEqual(audit(d), ('overlap', 1))
        self.assertEqual(audit(d, 0), ('clear', 0))
    def test_missing_review_missing_caption_bad_coordinates_unknown(self):
        d = {'faces': [], 'captions': [[.1,.1,.2,.2]]}
        self.assertEqual(audit(d)[0], 'unknown')
        d['reviewed_entire_page'] = True; d['captions'] = []
        self.assertEqual(audit(d)[0], 'unknown')
        d['captions'] = [[0,0,float('nan'),1]]
        self.assertEqual(audit(d)[0], 'unknown')
    def test_wrong_raster_is_unknown_and_no_output(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            Image.new('RGB', (5, 5)).save(path / 'proof.png')
            (path / 'boxes.json').write_text(json.dumps({'reviewed_entire_page': True, 'image_sha256': 'wrong', 'faces': [], 'captions': [[.1,.1,.2,.2]]}))
            with redirect_stdout(StringIO()):
                self.assertEqual(run(path / 'proof.png', path / 'boxes.json', path / 'out.png', .02), 'unknown')
            self.assertFalse((path / 'out.png').exists())

    def test_verified_no_faces_is_clear_but_invalid_face_is_unknown(self):
        d = {'reviewed_entire_page': True, 'faces': [], 'captions': [[.1,.1,.2,.2]]}
        self.assertEqual(audit(d), ('clear', 0))
        d['faces'] = [[.2,.2,2,.4]]
        self.assertEqual(audit(d)[0], 'unknown')

    def test_output_is_created_privately_and_never_replaced(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            proof, boxes, output = (root / name for name in ('proof.png', 'boxes.json', 'out.png'))
            Image.new('RGB', (30, 30)).save(proof)
            boxes.write_text(json.dumps({
                'reviewed_entire_page': True,
                'image_sha256': hashlib.sha256(proof.read_bytes()).hexdigest(),
                'faces': [],
                'captions': [[.1, .1, .2, .2]],
            }))
            with redirect_stdout(StringIO()):
                self.assertEqual(run(proof, boxes, output, .02), 'clear')
                self.assertEqual(output.stat().st_mode & 0o777, 0o600)
                before = output.read_bytes()
                self.assertEqual(run(proof, boxes, output, .02), 'unknown')
                self.assertEqual(output.read_bytes(), before)
                boxes.write_text('[]')
                self.assertEqual(run(proof, boxes, output, .02), 'unknown')

    def test_annotations_fifo_is_rejected_without_waiting_for_writer(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            boxes = root / 'boxes.json'
            os.mkfifo(boxes)
            with redirect_stdout(StringIO()):
                self.assertEqual(run(root / 'proof.png', boxes, root / 'out.png', .02), 'unknown')

if __name__ == '__main__': unittest.main()
