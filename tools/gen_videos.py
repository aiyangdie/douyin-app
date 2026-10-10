# -*- coding: utf-8 -*-
"""Generate the app's local sample videos.

Fully offline: every clip is synthesized by ffmpeg from lavfi sources, so the
app ships with real playable media and zero external dependencies.

    python tools/gen_videos.py

Outputs `assets/videos/v1.mp4` .. `v8.mp4` (720x1280, 8s, H.264 + AAC,
faststart). Total is roughly 2.5 MB for all eight.

Two gotchas worth keeping in mind if you edit this:

* Fonts are copied next to this script and referenced by *relative* path on
  purpose. An absolute Windows path contains a drive-letter colon, which the
  ffmpeg filtergraph parser reads as an option separator.
* Do not add the `noise` filter. Random per-frame grain is incompressible and
  turned each 8 second clip into ~77 MB instead of ~300 KB.
"""
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT.parent / "assets"
OUT = ASSETS / "videos"
FONTS = ROOT / "fonts"
OUT.mkdir(parents=True, exist_ok=True)
FONTS.mkdir(parents=True, exist_ok=True)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# (source font on this machine, local file name)
FONT_SOURCES = [
    (r"C:\Windows\Fonts\simhei.ttf", "hei.ttf"),    # 黑体 — bold titles
    (r"C:\Windows\Fonts\Deng.ttf", "deng.ttf"),     # 等线 — light body text
]

W, H, FPS, DUR = 720, 1280, 30, 8
FONT_BOLD = "fonts/hei.ttf"
FONT_REG = "fonts/deng.ttf"

# title, watermark handle, 4 gradient stops, gradient speed, base tone (Hz)
THEMES = [
    ("霓虹都市", "夜行者Leo",   ["0x0B1026", "0x2D1B69", "0x0B1026", "0x4C1D95"], 0.012, 196.00),
    ("海边日落", "旅行的鱼",     ["0x2B1055", "0xFF6B35", "0xFFD166", "0x7209B7"], 0.010, 174.61),
    ("咖啡时光", "慢生活研究所", ["0x3E2723", "0x8D6E63", "0xD7CCC8", "0x5D4037"], 0.008, 220.00),
    ("猫咪日常", "橘猫日记",     ["0xFFF1E6", "0xFFB4A2", "0xFFE5D9", "0xF08080"], 0.014, 261.63),
    ("燃脂打卡", "铁馆阿哲",     ["0x1A0000", "0xE63946", "0xFF9F1C", "0x7F0000"], 0.020, 146.83),
    ("代码人生", "深夜提交",     ["0x000000", "0x0F3D2E", "0x00FF9C", "0x041A14"], 0.016, 164.81),
    ("深夜食堂", "干饭人小鹿",   ["0x2B0B0B", "0xD62828", "0xFFB703", "0x6A040F"], 0.013, 185.00),
    ("旅行Vlog", "背包客阿May",  ["0x001219", "0x005F73", "0x94D2BD", "0x0A9396"], 0.011, 233.08),
]


def ensure_fonts() -> None:
    for src, name in FONT_SOURCES:
        dest = FONTS / name
        if not dest.exists():
            shutil.copyfile(src, dest)
            print(f"copied font {src} -> {dest.name}")


def escape(text: str) -> str:
    """Escape a drawtext literal for the filtergraph parser."""
    return text.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")


def render(index: int, theme) -> bool:
    title, handle, colors, speed, tone = theme
    c0, c1, c2, c3 = colors
    dest = OUT / f"v{index}.mp4"

    graph = (
        # Animated 4-stop gradient screened with a drifting radial light. Both
        # layers are smooth, so h264 compresses them to a few hundred KB.
        f"[0:v]format=yuv420p[bg];"
        f"[1:v]format=yuv420p[light];"
        f"[bg][light]blend=all_mode=screen:all_opacity=0.55,"
        f"vignette=PI/4.5[base];"
        # Creator handle watermark, top-right.
        f"[base]drawtext=fontfile={FONT_REG}:text='@{escape(handle)}'"
        f":fontsize=28:fontcolor=white@0.55:x=w-text_w-32:y=64[wm];"
        # Centered title card.
        f"[wm]drawtext=fontfile={FONT_BOLD}:text='{escape(title)}'"
        f":fontsize=66:fontcolor=white@0.92:x=(w-text_w)/2:y=h*0.45"
        f":shadowcolor=black@0.5:shadowx=0:shadowy=4[title];"
        # Subtitle line.
        f"[title]drawtext=fontfile={FONT_REG}:text='示例视频 · SAMPLE CLIP'"
        f":fontsize=24:fontcolor=white@0.42:x=(w-text_w)/2:y=h*0.45+100,"
        f"format=yuv420p[vout];"
        # Quiet three-note pad so every clip has a real audio track.
        f"[2:a][3:a][4:a]amix=inputs=3:normalize=0,tremolo=f=0.5:d=0.25,"
        f"volume=0.10,afade=t=in:d=1.2,afade=t=out:st={DUR - 1.5}:d=1.5[aout]"
    )

    cmd = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-f", "lavfi", "-i",
        f"gradients=s={W}x{H}:r={FPS}:nb_colors=4:c0={c0}:c1={c1}:c2={c2}:c3={c3}"
        f":speed={speed}:type=linear",
        "-f", "lavfi", "-i",
        f"gradients=s={W}x{H}:r={FPS}:nb_colors=2:c0={c1}:c1=0x000000"
        f":speed={speed * 2.5}:type=radial",
        "-f", "lavfi", "-i", f"sine=frequency={tone:.2f}:duration={DUR}",
        "-f", "lavfi", "-i", f"sine=frequency={tone * 1.5:.2f}:duration={DUR}",
        "-f", "lavfi", "-i", f"sine=frequency={tone * 2:.2f}:duration={DUR}",
        "-filter_complex", graph,
        "-map", "[vout]", "-map", "[aout]",
        "-t", str(DUR),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "25",
        "-profile:v", "main", "-level", "3.1",
        "-c:a", "aac", "-b:a", "96k", "-ar", "44100",
        "-movflags", "+faststart",
        str(dest),
    ]
    proc = subprocess.run(cmd, capture_output=True, cwd=str(ROOT))
    if proc.returncode != 0:
        sys.stderr.write(f"[v{index}] {title} FAILED\n")
        sys.stderr.write(proc.stderr.decode("utf-8", "replace")[-1500:] + "\n")
        return False
    print(f"[v{index}] {title:<6} -> {dest.name}  {dest.stat().st_size / 1024:.0f} KB")
    return True


def main() -> int:
    ensure_fonts()
    ok = 0
    for i, theme in enumerate(THEMES, start=1):
        if render(i, theme):
            ok += 1
    print(f"\n{ok}/{len(THEMES)} clips rendered into {OUT}")
    return 0 if ok == len(THEMES) else 1


if __name__ == "__main__":
    raise SystemExit(main())
