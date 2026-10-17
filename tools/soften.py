"""Lässt Kanten, an denen das Foto abgeschnitten war, weich ausblenden.

Aufruf: soften.py <eingabeordner> <ausgabeordner>
"""
import glob
import os
import sys

import numpy as np
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)

for path in sorted(glob.glob(os.path.join(src, "*.webp"))):
    im = Image.open(path).convert("RGBA")
    a = np.asarray(im.getchannel("A"), dtype=np.float32) / 255
    h, w = a.shape
    edges = {"top": a[0], "bottom": a[-1], "left": a[:, 0], "right": a[:, -1]}
    for side, line in edges.items():
        # Kante gilt als abgeschnitten, wenn ein großer Teil davon deckend ist
        if (line > 0.6).mean() < 0.25:
            continue
        depth = int((h if side in ("top", "bottom") else w) * 0.2)
        ramp = np.linspace(0, 1, depth) ** 1.4
        if side == "top":
            a[:depth] *= ramp[:, None]
        elif side == "bottom":
            a[-depth:] *= ramp[::-1, None]
        elif side == "left":
            a[:, :depth] *= ramp[None, :]
        else:
            a[:, -depth:] *= ramp[None, ::-1]
        print(os.path.basename(path), "weich:", side)
    im.putalpha(Image.fromarray((a * 255).astype(np.uint8)))
    im.save(os.path.join(dst, os.path.basename(path)), "WEBP", quality=86, method=6)
