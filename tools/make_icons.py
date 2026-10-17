"""Erzeugt die App-Icons für lizzy.study aus dem Ornament.

Aufruf: python3 tools/make_icons.py
"""
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BG = (14, 13, 17)
TEXT = (242, 240, 246)
ACCENT = (157, 133, 255)
FONT = "/usr/share/fonts/noto/NotoSans-Bold.ttf"
SIZE = 1024


def build():
    icon = Image.new("RGB", (SIZE, SIZE), BG)

    # dezentes Ornament im Hintergrund
    mask = Image.open(os.path.join(ROOT, "assets/ornament.png")).getchannel("A")
    scale = SIZE * 1.15 / mask.height
    mask = mask.resize((int(mask.width * scale), int(mask.height * scale)), Image.LANCZOS)
    mask = mask.point(lambda a: int(a * 0.22))
    layer = Image.new("RGB", mask.size, ACCENT)
    icon.paste(layer, (SIZE - mask.width // 2 - 140, -int(SIZE * 0.07)), mask)

    # "l." in der Mitte
    draw = ImageDraw.Draw(icon)
    font = ImageFont.truetype(FONT, 600)
    l_box = draw.textbbox((0, 0), "l", font=font)
    dot_box = draw.textbbox((0, 0), ".", font=font)
    width = (l_box[2] - l_box[0]) + (dot_box[2] - dot_box[0]) + 10
    x = (SIZE - width) // 2 - l_box[0]
    y = (SIZE - (l_box[3] - l_box[1])) // 2 - l_box[1]
    draw.text((x, y), "l", font=font, fill=TEXT)
    draw.text((x + l_box[2] + 10 - dot_box[0], y), ".", font=font, fill=ACCENT)
    return icon


if __name__ == "__main__":
    out = os.path.join(ROOT, "icons")
    os.makedirs(out, exist_ok=True)
    big = build()
    for name, px in [("icon-512.png", 512), ("icon-192.png", 192), ("apple-touch-icon.png", 180)]:
        big.resize((px, px), Image.LANCZOS).save(os.path.join(out, name), optimize=True)
    print("Icons gespeichert in", out)
