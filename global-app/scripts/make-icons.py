from PIL import Image, ImageDraw

GOLD = (200, 170, 110, 255)
GOLD_BRIGHT = (240, 230, 210, 255)
TEAL = (10, 200, 185, 255)
DARK = (7, 16, 24, 255)


def draw(size):
    scale = size / 256
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(image)
    pad = int(12 * scale)
    d.ellipse((pad, pad, size - pad, size - pad), fill=DARK, outline=GOLD, width=max(2, int(7 * scale)))
    inner = int(38 * scale)
    d.ellipse((inner, inner, size - inner, size - inner), outline=(10, 200, 185, 90), width=max(1, int(2 * scale)))
    cx = cy = size / 2
    r = size * 0.19
    points = [
        (cx, cy - r),
        (cx + r * 0.32, cy - r * 0.32),
        (cx + r, cy),
        (cx + r * 0.32, cy + r * 0.32),
        (cx, cy + r),
        (cx - r * 0.32, cy + r * 0.32),
        (cx - r, cy),
        (cx - r * 0.32, cy - r * 0.32),
    ]
    d.polygon(points, fill=GOLD_BRIGHT)
    dot = size * 0.055
    d.ellipse((cx - dot, cy + r * 0.72 - dot, cx + dot, cy + r * 0.72 + dot), fill=TEAL)
    return image


base = draw(256)
base.save("global-app/assets/icon.png")
base.save("global-app/assets/icon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
draw(32).save("global-app/assets/tray.png")
print("icons written")
