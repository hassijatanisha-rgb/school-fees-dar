"""Generate Stitchly's toolbar/store icons (original design) with Pillow.
Usage: python3 tests/make-icons.py  (writes icons/icon{16,32,48,128}.png)"""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), '..', 'icons')
S = 1024  # draw large, then downsample


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def draw(simple):
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    # Gradient tile
    grad = Image.new('RGBA', (S, S))
    gd = ImageDraw.Draw(grad)
    top, bottom = (20, 184, 166), (15, 94, 89)
    for y in range(S):
        gd.line([(0, y), (S, y)], fill=lerp(top, bottom, y / S) + (255,))
    mask = Image.new('L', (S, S), 0)
    pad = 0 if simple else 40
    ImageDraw.Draw(mask).rounded_rectangle([pad, pad, S - pad, S - pad], radius=230, fill=255)
    img.paste(grad, (0, 0), mask)

    d = ImageDraw.Draw(img)
    # Tall white sheet (the long page)
    px0, px1, py0, py1 = 300, 724, 170, 854
    d.rounded_rectangle([px0, py0, px1, py1], radius=56, fill=(255, 255, 255, 255))
    ink = (15, 94, 89, 255)
    soft = (153, 214, 206, 255)
    if not simple:
        # content lines, top half
        d.rounded_rectangle([370, 250, 654, 294], radius=22, fill=ink)
        d.rounded_rectangle([370, 336, 600, 370], radius=17, fill=soft)
        d.rounded_rectangle([370, 400, 630, 434], radius=17, fill=soft)
        # content lines, bottom half
        d.rounded_rectangle([370, 600, 640, 634], radius=17, fill=soft)
        d.rounded_rectangle([370, 664, 580, 698], radius=17, fill=soft)
        d.rounded_rectangle([370, 728, 620, 762], radius=17, fill=soft)
    # Stitch seam across the middle: dashes that run past the sheet edges
    y = 512
    dash, gap, h = (90, 50, 30) if not simple else (150, 70, 70)
    x = 210
    amber = (251, 191, 36, 255)
    while x < S - 210:
        d.rounded_rectangle([x, y - h // 2, min(x + dash, S - 210), y + h // 2], radius=h // 2, fill=amber)
        x += dash + gap
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    for size in (16, 32, 48, 128):
        img = draw(simple=size <= 32)
        img.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, f'icon{size}.png'))
    draw(False).resize((512, 512), Image.LANCZOS).save(os.path.join(os.path.dirname(__file__), '..', 'store', 'icon-512.png'))
    print('icons written')


main()
