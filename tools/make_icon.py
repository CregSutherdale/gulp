# App icon: pink tile, black hole with a pink rim and a donut tipping in. Drawn with PIL.
from PIL import Image, ImageDraw

for size in (180, 512):
    S = size * 4
    im = Image.new('RGB', (S, S), (255, 156, 198))
    d = ImageDraw.Draw(im)
    for y in range(S):  # soft vertical gradient
        t = y / S
        d.line([(0, y), (S, y)], fill=(255, int(150 + 60 * t), int(198 - 40 * t)))
    cx, cy, rx, ry = S * 0.5, S * 0.62, S * 0.36, S * 0.19
    d.ellipse([cx - rx * 1.12, cy - ry * 1.12 + S * 0.03, cx + rx * 1.12, cy + ry * 1.12 + S * 0.03], fill=(217, 63, 128))
    d.ellipse([cx - rx * 1.12, cy - ry * 1.12, cx + rx * 1.12, cy + ry * 1.12], fill=(255, 95, 162))
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(26, 16, 48))
    d.ellipse([cx - rx * 0.75, cy - ry * 0.55, cx + rx * 0.75, cy + ry * 0.75], fill=(0, 0, 0))
    dx, dy, dr = S * 0.5, S * 0.4, S * 0.15  # donut
    d.ellipse([dx - dr, dy - dr * 0.62, dx + dr, dy + dr * 0.62 + S * 0.02], fill=(190, 120, 60))
    d.ellipse([dx - dr * 0.95, dy - dr * 0.6, dx + dr * 0.95, dy + dr * 0.55], fill=(255, 140, 190))
    d.ellipse([dx - dr * 0.35, dy - dr * 0.22, dx + dr * 0.35, dy + dr * 0.2], fill=(190, 120, 60))
    for ox, oy, c in [(-0.55, -0.2, (255, 255, 255)), (0.5, -0.25, (80, 200, 255)), (0.1, 0.32, (255, 220, 60)), (-0.2, 0.3, (120, 230, 160)), (0.62, 0.15, (255, 255, 255))]:
        x, y = dx + ox * dr, dy + oy * dr
        d.rounded_rectangle([x - S * 0.014, y - S * 0.006, x + S * 0.014, y + S * 0.006], radius=S * 0.005, fill=c)
    im.resize((size, size), Image.LANCZOS).save(f'dist/icon-{size}.png')
print('icons ok')
