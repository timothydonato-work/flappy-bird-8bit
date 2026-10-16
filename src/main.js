import { CONFIG } from './config.js';
import { createGame, startGame, flap, update, restartGame, nextLevel, togglePause } from './game.js';
import { PALETTE, drawBird, drawCloud, drawPipe, drawGround } from './art.js';
import { text } from './font.js';
import { createAudio } from './audio.js';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const game = createGame();
const audio = createAudio();
const storageKey = 'pixel-flight-best';
let best = 0;
try {
  const saved = Number(localStorage.getItem(storageKey));
  if (Number.isSafeInteger(saved) && saved >= 0) best = saved;
} catch { /* Private browsing may disable storage. */ }

let accumulator = 0;
let lastTime;
let lastStatus = '';
const status = document.querySelector('#status');
const pauseButton = document.querySelector('#pause');
const muteButton = document.querySelector('#mute');

function resize() {
  const scale = Math.max(1, Math.floor(Math.min(
    (window.innerWidth - 32) / CONFIG.width,
    (window.innerHeight - 190) / CONFIG.height,
  )));
  canvas.style.width = `${CONFIG.width * scale}px`;
  canvas.style.height = `${CONFIG.height * scale}px`;
}
window.addEventListener('resize', resize);
resize();

function announce() {
  canvas.dataset.screen = game.screen;
  canvas.dataset.paused = String(game.paused);
  const message = `${game.screen}. Level ${game.level + 1}. Score ${game.score}.${game.paused ? ' Paused.' : ''}`;
  if (message !== lastStatus) {
    status.textContent = message;
    lastStatus = message;
  }
  pauseButton.textContent = game.paused ? 'RESUME' : 'PAUSE';
  pauseButton.setAttribute('aria-pressed', String(game.paused));
}

function act(action) {
  audio.unlock();
  if (action === 'mute') {
    audio.toggle();
    muteButton.textContent = audio.muted ? 'SOUND OFF' : 'SOUND ON';
    muteButton.setAttribute('aria-pressed', String(audio.muted));
  } else if (action === 'restart') {
    restartGame(game);
    accumulator = 0;
  } else if (action === 'pause') {
    togglePause(game);
    accumulator = 0;
  } else if (action === 'flap') {
    if (game.screen === 'title') startGame(game);
    else if (game.screen === 'levelcomplete') nextLevel(game);
    else if (game.screen === 'gameover' || game.screen === 'win') restartGame(game);
    if (game.screen === 'playing' && !game.paused) {
      flap(game);
      audio.play('flap');
    }
  }
  announce();
}

window.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.altKey || event.metaKey) return;
  // Native buttons keep their normal keyboard activation.
  if (event.target instanceof HTMLButtonElement && (event.code === 'Space' || event.code === 'Enter')) return;
  const action = { Space: 'flap', ArrowUp: 'flap', KeyR: 'restart', KeyP: 'pause', KeyM: 'mute' }[event.code];
  if (action) {
    event.preventDefault();
    if (!event.repeat) act(action);
  }
});
canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  canvas.focus({ preventScroll: true });
  act('flap');
});
for (const action of ['flap', 'pause', 'restart', 'mute']) {
  document.querySelector(`#${action}`).addEventListener('click', () => act(action));
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.screen === 'playing' && !game.paused) togglePause(game);
  lastTime = undefined;
  accumulator = 0;
  announce();
});

function panel(title, lines, accent = PALETTE.gold) {
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(10, 65, CONFIG.width - 20, 105);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1;
  ctx.strokeRect(12.5, 67.5, CONFIG.width - 25, 100);
  text(ctx, title, 80, 79, accent, title.length <= 9 ? 2 : 1);
  lines.forEach((line, index) => text(ctx, line, 80, 105 + index * 12));
}

function render() {
  const level = CONFIG.levels[game.level];
  const groundY = CONFIG.height - CONFIG.groundHeight;
  ctx.fillStyle = [PALETTE.sky, PALETTE.night, PALETTE.dusk][game.level];
  ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
  for (let i = 0; i < 4; i++) {
    const x = ((i * 53 + 12 - game.elapsed * level.speed * 0.18) % 212 + 212) % 212 - 26;
    drawCloud(ctx, x, 32 + (i % 3) * 19);
  }
  ctx.fillStyle = PALETTE.cloud;
  for (let x = 0; x < CONFIG.width; x += 16) {
    ctx.fillRect(x, groundY - 12 - (x % 3) * 4, 14, 24);
  }
  for (const pipe of game.pipes) {
    const topHeight = Math.round(pipe.gapY - level.gap / 2);
    const bottomY = Math.round(pipe.gapY + level.gap / 2);
    drawPipe(ctx, pipe.x, 0, CONFIG.pipeWidth, topHeight, true);
    drawPipe(ctx, pipe.x, bottomY, CONFIG.pipeWidth, groundY - bottomY, false);
  }
  drawGround(ctx, groundY, CONFIG.width, CONFIG.groundHeight, game.groundOffset);
  const frame = game.screen === 'playing' && !game.paused ? Math.floor(game.elapsed * 10) % 3 : 1;
  drawBird(ctx, game.bird.x, game.bird.y, frame);
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(0, 0, CONFIG.width, 15);
  text(ctx, `L${game.level + 1} ${game.levelScore}/${level.target}`, 4, 5, PALETTE.white, 1, false);
  text(ctx, `BEST ${best}`, CONFIG.width - 4 - (`BEST ${best}`.length * 4 - 1), 5, PALETTE.gold, 1, false);
  text(ctx, `SCORE ${game.score}`, 80, groundY + 12, PALETTE.ink);
  if (game.screen === 'title') panel('PIXEL FLIGHT', ['THREE SKIES AWAIT', 'SPACE / UP / TAP', 'TO FLAP AND START', '10 / 15 / 20 PIPES']);
  else if (game.screen === 'gameover') panel('GAME OVER', [`SCORE ${game.score}`, `BEST ${best}`, 'TAP TO TRY AGAIN', 'R TO RESTART'], PALETTE.orange);
  else if (game.screen === 'levelcomplete') panel('LEVEL CLEAR', [`LEVEL ${game.level + 1} COMPLETE`, `SCORE ${game.score}`, 'TAP FOR NEXT SKY', 'TAKE A BREATHER']);
  else if (game.screen === 'win') panel('YOU WIN!', ['ALL THREE SKIES!', `SCORE ${game.score}`, 'TAP TO PLAY AGAIN', 'THANKS FOR FLYING']);
  else if (game.paused) panel('PAUSED', ['P OR RESUME', 'TO KEEP FLYING', 'R TO RESTART']);
}

function tick(time) {
  if (lastTime !== undefined) accumulator += Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;
  while (accumulator >= CONFIG.fixedStep) {
    const oldScore = game.score;
    const oldScreen = game.screen;
    update(game, CONFIG.fixedStep);
    if (game.score > oldScore) {
      if (game.score > best) {
        best = game.score;
        try { localStorage.setItem(storageKey, String(best)); } catch { /* Saving is best-effort. */ }
      }
      audio.play('score');
    }
    if (game.screen !== oldScreen) {
      if (game.screen === 'gameover') audio.play('hit');
      if (game.screen === 'levelcomplete' || game.screen === 'win') audio.play('level');
    }
    accumulator -= CONFIG.fixedStep;
  }
  announce();
  render();
  requestAnimationFrame(tick);
}
announce();
render();
requestAnimationFrame(tick);
