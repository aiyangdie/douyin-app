# Asset pipeline

Everything the app displays is generated locally. There are no downloads, no
placeholder CDNs, and no licensing questions.

## Regenerating the media

```bash
python tools/gen_videos.py   # assets/videos/v1..v8.mp4   (~2.5 MB total)
python tools/gen_images.py   # assets/avatars/*.png, assets/thumbs/*.jpg
```

Requirements: `ffmpeg` on `PATH`, and Python with `numpy` + `Pillow`.
`gen_videos.py` must run first — `gen_images.py` pulls poster frames out of the
videos it produces.

`gen_videos.py` copies `simhei.ttf` and `Deng.ttf` from `C:\Windows\Fonts` into
`tools/fonts/` on first run, which is why that folder is git-ignored. On a
non-Windows host, drop any CJK-capable TTF/TTC in there as `hei.ttf` (bold) and
`deng.ttf` (regular) before running.

## Web verification harness

```bash
# 1. start the dev server
npx expo start --web --port 8081

# 2. launch headless Chrome with remote debugging
chrome --headless=new --remote-debugging-port=9222 \
       --user-data-dir=/tmp/dsh-chrome --autoplay-policy=no-user-gesture-required \
       --window-size=390,844 about:blank

# 3. drive it
node tools/shoot.mjs ../_assets_build/plan-04.json
```

`shoot.mjs` speaks the Chrome DevTools Protocol directly using Node's built-in
`WebSocket` and `fetch`, so it needs no dependencies. A plan is a JSON file:

```jsonc
{
  "url": "http://localhost:8081",
  "viewport": { "width": 390, "height": 844, "scale": 2 },
  "outDir": "shots",
  "shots": [
    {
      "name": "01-home",
      "wait": 2000,                       // settle time before capture
      "actions": [
        { "click": "[aria-label=\"评论\"]" },
        { "wait": 900 },
        { "swipe": { "x": 110, "y": 620, "dy": -500 } },
        { "doubleClickXY": [195, 380] },
        { "eval": "document.title" }
      ]
    }
  ]
}
```

Supported actions: `click` (CSS selector), `clickXY`, `doubleClickXY`, `swipe`,
`eval`, `wait`. Page errors are collected and printed at the end, which is how a
blank screenshot gets explained instead of guessed at.

Two things learned the hard way, both encoded in `shoot.mjs`:

* **`swipe` dispatches touch events, not a mouse drag.** A browser does not
  scroll a scrollable `div` on mouse-drag, so a synthetic mouse swipe silently
  leaves the feed where it was — and the resulting screenshot looks plausible,
  which is worse than an obvious failure. Touch emulation has to be switched on
  (`Emulation.setTouchEmulationEnabled`) for it to drive scrolling.
* **Assert on state, not just pixels.** Suites here check `scrollTop`,
  `video.paused` and `video.currentTime` via `eval`. The scroll assertion is what
  proved a page had actually advanced from `scrollTop: 0` to `scrollTop: 844`.
