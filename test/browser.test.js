import test from 'node:test';
import assert from 'node:assert/strict';

const driver = process.env.BROWSER_DRIVER_URL;
const site = process.env.GAME_URL || 'http://127.0.0.1:8000';

test('browser renders pixels and supports keyboard, buttons, and storage restrictions', {
  skip: !driver,
  timeout: 30000,
}, async () => {
  async function request(path, body) {
    const response = await fetch(`${driver}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const { value } = await response.json();
    if (!response.ok || value?.error) throw new Error(JSON.stringify(value));
    return value;
  }
  const session = await request('/session', {
    capabilities: { alwaysMatch: {
      browserName: 'chrome',
      'goog:chromeOptions': { args: ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--window-size=800,900'] },
    } },
  });
  const base = `/session/${session.sessionId}`;
  const execute = (script) => request(`${base}/execute/sync`, { script, args: [] });
  const key = (code) => execute(`window.dispatchEvent(new KeyboardEvent('keydown', {code: '${code}', bubbles: true}));`);
  try {
    await request(`${base}/url`, { url: site });
    const canvas = await execute(`
      const canvas = document.querySelector('canvas');
      const ctx = canvas.getContext('2d');
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const colors = new Set();
      for (let i = 0; i < pixels.length; i += 4) colors.add(pixels.slice(i, i + 4).join(','));
      return {
        screen: canvas.dataset.screen,
        smoothing: ctx.imageSmoothingEnabled,
        rendering: getComputedStyle(canvas).imageRendering,
        scale: canvas.clientWidth / canvas.width,
        colors: colors.size
      };
    `);
    assert.equal(canvas.screen, 'title');
    assert.equal(canvas.smoothing, false);
    assert.equal(canvas.rendering, 'pixelated');
    assert.ok(Number.isInteger(canvas.scale) && canvas.scale >= 1);
    assert.ok(canvas.colors > 5, 'canvas has drawn multicolor pixel art');
    await key('Space');
    assert.equal(await execute("return document.querySelector('canvas').dataset.screen;"), 'playing');
    await key('KeyP');
    assert.equal(await execute("return document.querySelector('canvas').dataset.paused;"), 'true');
    await key('KeyP');
    assert.equal(await execute("return document.querySelector('canvas').dataset.paused;"), 'false');
    await key('KeyM');
    assert.equal(await execute("return document.querySelector('#mute').getAttribute('aria-pressed');"), 'true');
    await execute("document.querySelector('#restart').click();");
    assert.equal(await execute("return document.querySelector('canvas').dataset.screen;"), 'playing');
    await key('KeyP');
    await execute("document.querySelector('#flap').click();");
    assert.equal(await execute("return document.querySelector('canvas').dataset.paused;"), 'true');
    await execute("localStorage.setItem('pixel-flight-best', '17');");
    await request(`${base}/url`, { url: site });
    assert.match(await execute("return document.querySelector('#status').textContent;"), /title/);
    // Restrict storage before re-importing the browser entry point.
    await execute(`
      Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('Storage blocked'); } });
    `);
    const blocked = await request(`${base}/execute/async`, {
      script: `const done = arguments[arguments.length - 1];
        import('./src/main.js?storage-blocked').then(() => done(true)).catch(error => done(error.message));`,
      args: [],
    });
    assert.equal(blocked, true, 'game initializes without localStorage');
  } finally {
    await fetch(`${driver}${base}`, { method: 'DELETE' });
  }
});
