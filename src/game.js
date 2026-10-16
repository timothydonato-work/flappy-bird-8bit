import { CONFIG } from './config.js';

const playHeight = () => CONFIG.height - CONFIG.groundHeight;
const settings = (state) => CONFIG.levels[state.level];
const active = (state) => state.screen === 'playing' && !state.paused;

// Coordinates are top-left positions, except gapY, which is the gap's center.
export function generatePipe(state, x) {
  const level = settings(state);
  const previous = state.pipes.at(-1)?.gapY ?? playHeight() / 2;
  const min = CONFIG.pipeMargin + level.gap / 2;
  const max = playHeight() - CONFIG.pipeMargin - level.gap / 2;
  const gapY = Math.max(
    min,
    Math.min(max, previous + (state.rng() * 2 - 1) * level.variation),
  );
  return { x, gapY, scored: false };
}

function resetLevel(state) {
  state.paused = false;
  state.levelScore = 0;
  state.bird = {
    x: CONFIG.bird.x,
    y: (playHeight() - CONFIG.bird.height) / 2,
    velocity: 0,
  };
  state.pipes = [];
  state.groundOffset = 0;
  state.elapsed = 0;
  state.pipes.push(generatePipe(state, CONFIG.width + CONFIG.firstPipeOffset));
}

export function createGame(rng = Math.random) {
  const state = { screen: 'title', level: 0, score: 0, rng };
  resetLevel(state);
  return state;
}

export function startGame(state) {
  if (state.screen === 'title') state.screen = 'playing';
}

export function flap(state) {
  if (active(state)) state.bird.velocity = settings(state).flapVelocity;
}

export function restartGame(state) {
  state.screen = 'playing';
  state.level = 0;
  state.score = 0;
  resetLevel(state);
}

export function nextLevel(state) {
  if (state.screen !== 'levelcomplete') return;
  state.level += 1;
  state.screen = 'playing';
  resetLevel(state);
}

export function togglePause(state) {
  if (state.screen === 'playing') state.paused = !state.paused;
}

function step(state, dt) {
  const level = settings(state);
  const bird = state.bird;
  state.elapsed += dt;
  state.groundOffset =
    (state.groundOffset + level.speed * dt) % CONFIG.groundTileWidth;
  bird.velocity = Math.min(
    level.maxFallSpeed,
    bird.velocity + level.gravity * dt,
  );
  bird.y += bird.velocity * dt;
  for (const pipe of state.pipes) pipe.x -= level.speed * dt;

  const hitsBoundary =
    bird.y <= 0 || bird.y + CONFIG.bird.height >= playHeight();
  const hitsPipe = state.pipes.some(
    (pipe) =>
      bird.x + CONFIG.bird.width > pipe.x &&
      bird.x < pipe.x + CONFIG.pipeWidth &&
      (bird.y < pipe.gapY - level.gap / 2 ||
        bird.y + CONFIG.bird.height > pipe.gapY + level.gap / 2),
  );
  if (hitsBoundary || hitsPipe) {
    state.screen = 'gameover';
    return;
  }

  for (const pipe of state.pipes) {
    if (!pipe.scored && pipe.x + CONFIG.pipeWidth <= bird.x) {
      pipe.scored = true;
      state.score += 1;
      state.levelScore += 1;
      if (state.levelScore >= level.target) {
        state.screen =
          state.level === CONFIG.levels.length - 1 ? 'win' : 'levelcomplete';
        return;
      }
    }
  }

  // Spacing is leading-edge distance; retain one pipe beyond the viewport.
  while (state.pipes.length === 0 || state.pipes.at(-1).x <= CONFIG.width) {
    const x = state.pipes.length
      ? state.pipes.at(-1).x + level.spacing
      : CONFIG.width + CONFIG.firstPipeOffset;
    state.pipes.push(generatePipe(state, x));
  }
  state.pipes = state.pipes.filter((pipe) => pipe.x + CONFIG.pipeWidth >= 0);
}

export function update(state, dt) {
  if (!active(state) || !Number.isFinite(dt) || dt <= 0) return;
  let remaining = dt;
  while (remaining > 0 && active(state)) {
    const duration = Math.min(remaining, CONFIG.fixedStep);
    step(state, duration);
    remaining -= duration;
  }
}
