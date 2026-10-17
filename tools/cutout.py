"""Schneidet Katzen aus Fotos aus und speichert sie als WebP mit Transparenz.

Aufruf: cutout.py <ausgabeordner> <bild> [<bild> ...]
"""
import os
import sys

from PIL import Image
from rembg import new_session, remove

out_dir, sources = sys.argv[1], sys.argv[2:]
os.makedirs(out_dir, exist_ok=True)
session = new_session("birefnet-general-lite")

for n, path in enumerate(sources, 1):
    img = Image.open(path).convert("RGB")
    cut = remove(img, session=session, post_process_mask=True)
    alpha = cut.getchannel("A").point(lambda a: 0 if a < 12 else a)
    cut.putalpha(alpha)
    cut = cut.crop(alpha.getbbox())
    cut.thumbnail((480, 480), Image.LANCZOS)
    name = f"cat-{n:02d}.webp"
    cut.save(os.path.join(out_dir, name), "WEBP", quality=86, method=6)
    print(name, cut.size, os.path.basename(path))
