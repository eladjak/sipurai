#!/usr/bin/env python3
"""Offline, manual visual audit of a *rendered proof page*, not face detection.

Input rectangles are normalized [left, top, right, bottom] in the same raster
coordinate system (including bleed, if present). The reviewer must inspect the
whole image and all caption areas. Never interpret clear as a detection guarantee.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw


def rectangle(box):
    if not isinstance(box, list) or len(box) != 4:
        raise ValueError('rectangle must contain four numbers')
    if any(isinstance(x, bool) or not isinstance(x, (int, float)) or not math.isfinite(x) for x in box):
        raise ValueError('invalid coordinate')
    left, top, right, bottom = box
    if not (0 <= left < right <= 1 and 0 <= top < bottom <= 1):
        raise ValueError('rectangle must be inside the raster')
    return box


def audit(data, margin=0.02):
    """Return (status, overlap pairs); missing/invalid review is unknown."""
    if not isinstance(data, dict) or data.get('reviewed_entire_page') is not True:
        return 'unknown', 0
    if not isinstance(margin, (int, float)) or isinstance(margin, bool) or not math.isfinite(margin) or not 0 <= margin <= .1:
        return 'unknown', 0
    faces, captions = data.get('faces'), data.get('captions')
    if not isinstance(faces, list) or not isinstance(captions, list) or not captions:
        return 'unknown', 0
    try:
        faces = [rectangle(b) for b in faces]
        captions = [rectangle(b) for b in captions]
    except (ValueError, TypeError):
        return 'unknown', 0
    count = 0
    for l, t, r, b in faces:
        l, t, r, b = max(0, l-margin), max(0, t-margin), min(1, r+margin), min(1, b+margin)
        for cl, ct, cr, cb in captions:
            if l <= cr and r >= cl and t <= cb and b >= ct:
                count += 1
    return ('overlap' if count else 'clear'), count


def run(image, annotations, output, margin):
    data = json.loads(Path(annotations).read_text())
    status, count = audit(data, margin)
    # Bind boxes to the exact reviewed raster, not merely its dimensions.
    if data.get('image_sha256') != hashlib.sha256(Path(image).read_bytes()).hexdigest():
        status, count = 'unknown', 0
    if status != 'unknown':
        with Image.open(image) as original:
            pic = original.convert('RGB'); draw = ImageDraw.Draw(pic)
            for boxes, color in ((data['faces'], '#ff00ff'), (data['captions'], '#00ffff')):
                for l, t, r, b in boxes:
                    draw.rectangle((round(l*pic.width), round(t*pic.height), round(r*pic.width), round(b*pic.height)), outline=color, width=max(2, pic.width//300))
            pic.save(output)
    print(json.dumps({'status': status, 'face_count': len(data.get('faces', [])) if status != 'unknown' else None,
                      'caption_count': len(data.get('captions', [])) if status != 'unknown' else None,
                      'overlap_pairs': count if status != 'unknown' else None,
                      'scope': 'manual boxes; visual audit only; not face detection'}))
    return status


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('image'); parser.add_argument('annotations'); parser.add_argument('output')
    parser.add_argument('--margin', type=float, default=.02)
    args = parser.parse_args()
    raise SystemExit(2 if run(args.image, args.annotations, args.output, args.margin) == 'unknown' else 0)
