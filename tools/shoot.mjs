/**
 * Minimal Chrome DevTools Protocol driver used to verify the app on web.
 *
 * Node 24 ships a global WebSocket and fetch, so this needs no dependencies.
 *
 *   node shoot.mjs <plan.json>
 *
 * Plan shape:
 * {
 *   "url": "http://localhost:8081",
 *   "viewport": { "width": 390, "height": 844, "scale": 2 },
 *   "outDir": "shots",
 *   "shots": [
 *     { "name": "01-home", "wait": 6000, "actions": [ { "click": "[aria-label=\"评论\"]" } ] }
 *   ]
 * }
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const CDP_HOST = process.env.CDP_HOST ?? 'http://127.0.0.1:9222';

async function findPageTarget(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const targets = await (await fetch(`${CDP_HOST}/json`)).json();
      const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      // Chrome is not listening yet.
    }
    await sleep(300);
  }
  throw new Error(`No CDP page target on ${CDP_HOST} within ${timeoutMs}ms`);
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result);
      }
    });
  }

  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', () => reject(new Error('CDP socket error')), { once: true });
    });
    return new Cdp(ws);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error(`evaluate failed: ${result.exceptionDetails.text}`);
    }
    return result.result?.value;
  }

  /** Centre point of the first element matching a CSS selector, in CSS pixels. */
  async centerOf(selector) {
    const point = await this.evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return null;
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    if (!point) throw new Error(`No visible element for selector: ${selector}`);
    return point;
  }

  async mouse(type, x, y, clickCount = 1) {
    await this.send('Input.dispatchMouseEvent', {
      type,
      x,
      y,
      button: 'left',
      buttons: type === 'mousePressed' ? 1 : 0,
      clickCount,
      pointerType: 'mouse',
    });
  }

  async tap(selector, { clickCount = 1, delay = 60 } = {}) {
    const { x, y } = await this.centerOf(selector);
    await this.mouse('mousePressed', x, y, clickCount);
    await sleep(delay);
    await this.mouse('mouseReleased', x, y, clickCount);
    return { x, y };
  }

  async tapAt(x, y, { clickCount = 1, delay = 60 } = {}) {
    await this.mouse('mousePressed', x, y, clickCount);
    await sleep(delay);
    await this.mouse('mouseReleased', x, y, clickCount);
  }

  /** Two clicks inside the app's 280ms double-tap window. */
  async doubleTapAt(x, y) {
    await this.mouse('mousePressed', x, y, 1);
    await this.mouse('mouseReleased', x, y, 1);
    await sleep(70);
    await this.mouse('mousePressed', x, y, 2);
    await this.mouse('mouseReleased', x, y, 2);
  }

  /**
   * Vertical swipe by `dy` pixels (negative scrolls the feed forward).
   *
   * Uses touch events rather than a mouse drag: a browser does not scroll a
   * scrollable div on mouse-drag, so a synthetic mouse swipe silently does
   * nothing to the feed.
   */
  async swipe(x, y, dy, steps = 14) {
    await this.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y, id: 1 }],
    });
    for (let i = 1; i <= steps; i += 1) {
      await this.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: y + (dy * i) / steps, id: 1 }],
      });
      await sleep(14);
    }
    await this.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
}

async function runAction(cdp, action) {
  if (action.wait) {
    await sleep(action.wait);
    return;
  }
  if (action.eval) {
    const value = await cdp.evaluate(action.eval);
    if (value !== undefined && value !== null) {
      console.log(`      eval -> ${JSON.stringify(value).slice(0, 300)}`);
    }
    return;
  }
  if (action.click) {
    await cdp.tap(action.click, { clickCount: action.clickCount ?? 1 });
    return;
  }
  if (action.clickXY) {
    await cdp.tapAt(action.clickXY[0], action.clickXY[1], {
      clickCount: action.clickCount ?? 1,
    });
    return;
  }
  if (action.doubleClickXY) {
    await cdp.doubleTapAt(action.doubleClickXY[0], action.doubleClickXY[1]);
    return;
  }
  if (action.swipe) {
    const { x, y, dy } = action.swipe;
    await cdp.swipe(x, y, dy);
    return;
  }
  throw new Error(`Unknown action: ${JSON.stringify(action)}`);
}

async function main() {
  const planPath = process.argv[2];
  if (!planPath) throw new Error('usage: node shoot.mjs <plan.json>');
  const plan = JSON.parse(readFileSync(planPath, 'utf8'));
  const outDir = plan.outDir ?? join(dirname(planPath), 'shots');
  mkdirSync(outDir, { recursive: true });

  const target = await findPageTarget();
  const cdp = await Cdp.connect(target.webSocketDebuggerUrl);

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: plan.viewport?.width ?? 390,
    height: plan.viewport?.height ?? 844,
    deviceScaleFactor: plan.viewport?.scale ?? 2,
    mobile: true,
  });
  // Required for Input.dispatchTouchEvent to drive scrolling.
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });

  // Surface page errors so a blank screenshot is explainable.
  await cdp.evaluate(`
    window.__errors = [];
    window.addEventListener('error', (e) => window.__errors.push(String(e.message)));
    window.addEventListener('unhandledrejection', (e) => window.__errors.push('rejection: ' + String(e.reason)));
  `);

  console.log(`navigate -> ${plan.url}`);
  await cdp.send('Page.navigate', { url: plan.url });
  await sleep(plan.initialWait ?? 9000);

  const errors = await cdp.evaluate('window.__errors || []');
  if (errors && errors.length) console.log(`  page errors: ${JSON.stringify(errors).slice(0, 600)}`);

  for (const shot of plan.shots) {
    console.log(`  shot: ${shot.name}`);
    for (const action of shot.actions ?? []) {
      await runAction(cdp, action);
    }
    await sleep(shot.wait ?? 1200);
    const { data } = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    const file = join(outDir, `${shot.name}.png`);
    writeFileSync(file, Buffer.from(data, 'base64'));
    console.log(`    -> ${file}`);
  }

  const finalErrors = await cdp.evaluate('window.__errors || []');
  if (finalErrors && finalErrors.length) {
    console.log(`  final page errors: ${JSON.stringify(finalErrors).slice(0, 600)}`);
  } else {
    console.log('  no page errors');
  }

  cdp.ws.close();
}

main().catch((error) => {
  console.error(`FAILED: ${error.message}`);
  process.exit(1);
});
