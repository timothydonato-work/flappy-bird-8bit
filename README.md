# Pixel Flight — Flappy Bird 8-bit

A browser-playable, three-level Flappy Bird clone. Plain HTML, CSS and JavaScript
ES modules: no build step, dependencies, remote fonts, images, or audio downloads.
Original sprite arrays and a bitmap alphabet draw directly to a 160×240 canvas,
scaled by whole numbers with smoothing disabled.

## Play

Fly through pipe gaps without hitting pipes, the ceiling, or the ground.
Clear **10 pipes** in level 1, **15** in level 2, and **20** in level 3 to win.
Each new sky has smaller gaps, faster scrolling, closer pipes, and more gap-height
variation. Level transitions wait for you to continue.

| Control | Action |
| --- | --- |
| Space / ↑ / click or tap canvas | Start, flap, advance level, or play again |
| R / Restart button | Restart from level 1 |
| P / Pause button | Pause or resume |
| M / Sound button | Mute or unmute |

Sound is synthesized locally with Web Audio and only initialized after a user
gesture. Best total score is saved in localStorage when available; storage or
audio restrictions do not prevent play. Switching browser tabs pauses the game.
On-screen buttons also support touch and keyboard activation.

## Run locally

From the repository root:

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000>. Serve over HTTP rather than opening `index.html`
directly, because the game uses ES modules. No `npm install` is needed.

## Tests

Install Node.js 24 (the version used in CI), then run:

```sh
npm test
```

The dependency-free Node test suite covers physics, collisions, scoring,
level progression, win/reset/pause behavior, difficulty ordering, and seeded
pipe generation. GitHub Actions runs it on every push and pull request.

An optional automated browser smoke test uses Chrome and ChromeDriver, if already
installed. With the HTTP server running, start `chromedriver --port=9515` in
another terminal, then run:

```sh
BROWSER_DRIVER_URL=http://127.0.0.1:9515 node --test test/browser.test.js
```

It verifies canvas pixels, integer scaling, start/pause/restart/mute controls,
and startup with blocked storage. Set `GAME_URL` to test another served URL.
It is skipped by default, including in CI, and adds no package dependencies.
For a manual check, also play using touch/click and judge the difficulty and sound.
The canvas exposes `data-screen` and `data-paused` attributes for automation.

## GitHub Pages

In the repository's **Settings → Pages**, select **Deploy from a branch**,
choose the branch containing these files (usually `main`) and **/ (root)**,
then save. Once deployed, visit
`https://timothydonato-work.github.io/flappy-bird-8bit/`.
All asset paths are relative so project-site hosting works without configuration.

## Tune or extend

- `src/config.js`: all gameplay numbers, including resolution, bird dimensions,
  physics, pipe spacing, gap variation, speed, and the three score targets.
- `src/game.js`: pure game state and rules; no DOM, audio, storage, or rendering.
  Pipe generation accepts an injectable RNG for reproducible tests.
- `src/main.js`: fixed-step loop, rendering, input, and guarded score persistence.
- `src/art.js` / `src/font.js`: original sprite arrays, retro palette, bitmap font.
- `src/audio.js`: optional square-wave sound effects.

The simulation advances at a fixed timestep, independent of display refresh rate.
Large frame delays are capped to avoid sudden jumps after a stall.
