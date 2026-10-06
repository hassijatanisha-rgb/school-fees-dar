"""Generates Snipkey's toolbar/store icons (original design: a keycap with a semicolon).
Run: python3 tests/make-icons.py   (writes icons/icon{16,32,48,128}.png)"""
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'icons')
S = 1024  # draw large, then downsample for smooth edges


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def draw():
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    # background: rounded square, indigo -> violet diagonal gradient
    grad = Image.new('RGBA', (S, S))
    gp = grad.load()
    c1, c2 = (79, 70, 229), (139, 92, 246)
    for y in range(S):
        for x in range(0, S, 4):
            col = lerp(c1, c2, (x + y) / (2 * S)) + (255,)
            for dx in range(4):
                gp[x + dx, y] = col
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=230, fill=255)
    img.paste(grad, (0, 0), mask)

    d = ImageDraw.Draw(img)
    # keycap: darker base + lighter top
    d.rounded_rectangle([170, 205, 854, 870], radius=120, fill=(212, 214, 240, 255))
    d.rounded_rectangle([170, 160, 854, 800], radius=120, fill=(255, 255, 255, 255))
    ink = (67, 56, 202, 255)
    # semicolon: dot + comma
    d.ellipse([440, 270, 584, 414], fill=ink)
    d.ellipse([440, 505, 584, 649], fill=ink)
    d.polygon([(500, 600), (584, 590), (520, 740), (452, 740)], fill=ink)
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    big = draw()
    for size in (16, 32, 48, 128):
        big.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, f'icon{size}.png'))
    print('icons written to', os.path.normpath(OUT))


if __name__ == '__main__':
    main()
