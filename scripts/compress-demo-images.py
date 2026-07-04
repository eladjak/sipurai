"""compress-demo-images.py — convert the generated demo-book PNGs to lean WebP.

PNG sources from Gemini are ~0.7-1.3MB each; 18 of them would add ~18MB to the
repo/deploy (the Apr-2026 audit already flagged unoptimized public images).
WebP q82 at max-width 1200 lands ~60-150KB each (total under 2.5MB).

Deletes the PNG after successful conversion (regenerate any time with
scripts/generate-demo-images.mjs).

Run: python scripts/compress-demo-images.py
"""
import os
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / "public" / "demo"
MAX_W = 1200

total_before = 0
total_after = 0
for png in sorted(ROOT.rglob("*.png")):
    total_before += png.stat().st_size
    img = Image.open(png).convert("RGB")
    if img.width > MAX_W:
        img = img.resize((MAX_W, int(img.height * MAX_W / img.width)), Image.LANCZOS)
    out = png.with_suffix(".webp")
    img.save(out, "WEBP", quality=82, method=6)
    total_after += out.stat().st_size
    print(f"{png.relative_to(ROOT)} -> {out.name} ({png.stat().st_size // 1024}KB -> {out.stat().st_size // 1024}KB)")
    os.remove(png)

print(f"\nTOTAL: {total_before // 1024}KB PNG -> {total_after // 1024}KB WebP")
