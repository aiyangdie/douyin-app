# -*- coding: utf-8 -*-
"""Generate the app's local image assets.

    python tools/gen_images.py

* `assets/avatars/*.png` — 256x256 gradient avatars with the creator's key
  character, drawn with Pillow.
* `assets/thumbs/*.jpg`  — poster frames pulled from the generated videos, used
  as feed placeholders and as profile-grid covers.

Run `gen_videos.py` first: the thumbnails are extracted from its output.
"""
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT.parent / "assets"
AVATARS = ASSETS / "avatars"
THUMBS = ASSETS / "thumbs"
VIDEOS = ASSETS / "videos"
FONTS = ROOT / "fonts"
for d in (AVATARS, THUMBS):
    d.mkdir(parents=True, exist_ok=True)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SIZE = 256

# key, display character, gradient start, gradient end
AVATAR_SPECS = [
    ("u1", "夜", (34, 22, 84), (124, 58, 237)),
    ("u2", "鱼", (43, 16, 85), (255, 107, 53)),
    ("u3", "慢", (62, 39, 35), (196, 164, 132)),
    ("u4", "橘", (255, 200, 170), (240, 128, 128)),
    ("u5", "铁", (26, 0, 0), (230, 57, 70)),
    ("u6", "码", (0, 20, 16), (0, 255, 156)),
    ("u7", "鹿", (43, 11, 11), (255, 183, 3)),
    ("u8", "May", (0, 18, 25), (148, 210, 189)),
    ("me", "我", (18, 18, 22), (255, 45, 85)),
]


def diagonal_gradient(size, start, end):
    """Linear gradient running from the top-left to the bottom-right."""
    y, x = np.mgrid[0:size, 0:size]
    t = (x + y) / (2.0 * (size - 1))
    t = t[..., None]
    rgb = np.array(start, dtype=float) * (1 - t) + np.array(end, dtype=float) * t
    return Image.fromarray(rgb.astype("uint8"), "RGB")


def radial_glow(size, center, radius, color, strength):
    """Soft additive light blob, used to give the avatar some depth."""
    y, x = np.mgrid[0:size, 0:size]
    dist = np.sqrt((x - center[0]) ** 2 + (y - center[1]) ** 2)
    falloff = np.clip(1 - dist / radius, 0, 1) ** 2 * strength
    layer = np.zeros((size, size, 3), dtype=float)
    layer += falloff[..., None] * np.array(color, dtype=float)
    return Image.fromarray(layer.astype("uint8"), "RGB")


def make_avatar(key, char, start, end):
    base = diagonal_gradient(SIZE, start, end)
    base = Image.blend(base, Image.new("RGB", (SIZE, SIZE), (10, 10, 12)), 0.12)

    glow = radial_glow(SIZE, (SIZE * 0.32, SIZE * 0.28), SIZE * 0.78, (255, 255, 255), 0.34)
    base = Image.fromarray(
        np.clip(np.asarray(base, float) + np.asarray(glow, float), 0, 255).astype("uint8"), "RGB"
    )

    # Circular mask, antialiased by supersampling the ellipse.
    ss = SIZE * 4
    mask = Image.new("L", (ss, ss), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, ss - 1, ss - 1), fill=255)
    mask = mask.resize((SIZE, SIZE), Image.LANCZOS)

    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    img.paste(base, (0, 0), mask)
    img = img.filter(ImageFilter.SMOOTH)

    draw = ImageDraw.Draw(img)
    font_size = int(SIZE * (0.40 if len(char) > 1 else 0.52))
    font = ImageFont.truetype(str(FONTS / "hei.ttf"), font_size)
    box = draw.textbbox((0, 0), char, font=font)
    tw, th = box[2] - box[0], box[3] - box[1]
    pos = ((SIZE - tw) / 2 - box[0], (SIZE - th) / 2 - box[1] - SIZE * 0.02)
    draw.text((pos[0] + 2, pos[1] + 3), char, font=font, fill=(0, 0, 0, 90))
    draw.text(pos, char, font=font, fill=(255, 255, 255, 245))

    dest = AVATARS / f"{key}.png"
    img.save(dest)
    return dest


def make_thumbnail(index):
    source = VIDEOS / f"v{index}.mp4"
    if not source.exists():
        sys.stderr.write(f"missing {source}; run gen_videos.py first\n")
        return None
    dest = THUMBS / f"v{index}.jpg"
    cmd = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-ss", "2.5", "-i", str(source),
        "-frames:v", "1", "-vf", "scale=360:-2", "-q:v", "4", str(dest),
    ]
    proc = subprocess.run(cmd, capture_output=True)
    if proc.returncode != 0:
        sys.stderr.write(proc.stderr.decode("utf-8", "replace")[-800:] + "\n")
        return None
    return dest


def main() -> int:
    if not (FONTS / "hei.ttf").exists():
        sys.stderr.write("missing tools/fonts/hei.ttf; run gen_videos.py first\n")
        return 1

    made = 0
    for key, char, start, end in AVATAR_SPECS:
        p = make_avatar(key, char, start, end)
        print(f"avatar  {p.name:<8} {p.stat().st_size / 1024:6.1f} KB")
        made += 1

    for i in range(1, 9):
        p = make_thumbnail(i)
        if p:
            print(f"thumb   {p.name:<8} {p.stat().st_size / 1024:6.1f} KB")
            made += 1

    print(f"\n{made} assets written")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
