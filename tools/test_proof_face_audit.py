import unittest
import json
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

if __name__ == '__main__': unittest.main()
