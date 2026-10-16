import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import {
  createGame, startGame, flap, update, restartGame, nextLevel, togglePause,
  generatePipe,
} from '../src/game.js';

const tick = CONFIG.fixedStep;
const level = CONFIG.levels[0];
const floor = CONFIG.height - CONFIG.groundHeight;
const close = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
const snapshot = (state) => structuredClone({ ...state, rng: undefined });

function playing(rng = () => 0.5) {
  const state = createGame(rng);
  startGame(state);
  return state;
}

function seeded(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function scorePipe(state) {
  state.bird.y = floor / 2;
  state.bird.velocity = 0;
  state.pipes = [{
    x: state.bird.x - CONFIG.pipeWidth,
    gapY: floor / 2,
    scored: false,
  }];
  update(state, tick);
}

test('initial state, runway, title freeze, and title-only start', () => {
  const state = createGame(() => 0.5);
  assert.equal(state.screen, 'title');
  assert.equal(state.paused, false);
  assert.equal(state.level, 0);
  assert.equal(state.score, 0);
  assert.equal(state.levelScore, 0);
  assert.equal(state.bird.x, CONFIG.bird.x);
  assert.ok(state.pipes[0].x > CONFIG.width);
  assert.ok((state.pipes[0].x - state.bird.x) / level.speed > 3);
  const before = snapshot(state);
  update(state, 1);
  flap(state);
  togglePause(state);
  assert.deepEqual(snapshot(state), before);
  startGame(state);
  assert.equal(state.screen, 'playing');
  state.screen = 'gameover';
  startGame(state);
  assert.equal(state.screen, 'gameover');
});

test('gravity, flap impulse, terminal velocity, elapsed, and scrolling', () => {
  const state = playing();
  const y = state.bird.y;
  update(state, tick);
  close(state.bird.velocity, level.gravity * tick);
  close(state.bird.y, y + level.gravity * tick ** 2);
  close(state.elapsed, tick);
  close(state.groundOffset, level.speed * tick);
  flap(state);
  assert.equal(state.bird.velocity, level.flapVelocity);
  const flapY = state.bird.y;
  update(state, tick);
  assert.ok(state.bird.y < flapY);
  state.bird.velocity = level.maxFallSpeed * 2;
  update(state, tick);
  assert.equal(state.bird.velocity, level.maxFallSpeed);
});

test('ceiling and ground cause death and terminal screens freeze', () => {
  for (const y of [-1, floor - CONFIG.bird.height]) {
    const state = playing();
    state.bird.y = y;
    update(state, tick);
    assert.equal(state.screen, 'gameover');
    const before = snapshot(state);
    flap(state);
    togglePause(state);
    update(state, 2);
    assert.deepEqual(snapshot(state), before);
  }
});

test('overlapping upper and lower pipes kill but the gap is safe', () => {
  for (const [y, expected] of [
    [floor / 2 - level.gap / 2 - CONFIG.bird.height / 2, 'gameover'],
    [floor / 2 + level.gap / 2 - CONFIG.bird.height / 2, 'gameover'],
    [floor / 2 - CONFIG.bird.height / 2, 'playing'],
  ]) {
    const state = playing();
    state.bird.y = y;
    state.pipes = [{ x: state.bird.x, gapY: floor / 2, scored: false }];
    update(state, tick);
    assert.equal(state.screen, expected);
  }
});

test('horizontal separation is safe and large updates cannot tunnel through pipes', () => {
  const state = playing();
  state.bird.y = 30;
  state.pipes = [{
    x: CONFIG.bird.x + CONFIG.bird.width + level.speed * tick + 1,
    gapY: floor / 2,
    scored: false,
  }];
  update(state, tick);
  assert.equal(state.screen, 'playing');
  update(state, 0.2);
  assert.equal(state.screen, 'gameover');
});

test('a pipe scores only at its trailing edge, and only once', () => {
  const state = playing();
  const pipe = {
    x: state.bird.x - CONFIG.pipeWidth + level.speed * tick * 2,
    gapY: floor / 2,
    scored: false,
  };
  state.pipes = [pipe];
  update(state, tick);
  assert.equal(state.score, 0);
  update(state, tick * 1.1);
  assert.equal(state.score, 1);
  assert.equal(state.levelScore, 1);
  assert.equal(pipe.scored, true);
  update(state, tick);
  assert.equal(state.score, 1);
});

test('all level targets, cumulative score, transitions, and final win', () => {
  const state = playing();
  let cumulative = 0;
  for (let index = 0; index < CONFIG.levels.length; index += 1) {
    const current = CONFIG.levels[index];
    assert.equal(state.level, index);
    assert.equal(state.levelScore, 0);
    for (let count = 1; count <= current.target; count += 1) {
      scorePipe(state);
      cumulative += 1;
      assert.equal(state.score, cumulative);
      assert.equal(state.levelScore, count);
      assert.equal(
        state.screen,
        count < current.target ? 'playing' :
          index === CONFIG.levels.length - 1 ? 'win' : 'levelcomplete',
      );
    }
    const before = snapshot(state);
    update(state, 1);
    flap(state);
    assert.deepEqual(snapshot(state), before);
    nextLevel(state);
    if (index < CONFIG.levels.length - 1) {
      assert.equal(state.screen, 'playing');
      assert.equal(state.score, cumulative);
      assert.equal(state.elapsed, 0);
      assert.equal(state.bird.velocity, 0);
      assert.equal(state.pipes.length, 1);
    }
  }
  assert.equal(state.score, 45);
  assert.equal(state.screen, 'win');
  assert.equal(state.level, 2);
});

test('pause freezes every gameplay field and blocks flap until resumed', () => {
  const state = playing();
  togglePause(state);
  assert.equal(state.paused, true);
  const before = snapshot(state);
  update(state, 5);
  flap(state);
  assert.deepEqual(snapshot(state), before);
  togglePause(state);
  flap(state);
  assert.equal(state.bird.velocity, level.flapVelocity);
  update(state, tick);
  assert.ok(state.elapsed > 0);
});

test('restart resets progression and world but preserves RNG identity', () => {
  const rng = seeded(7);
  const state = playing(rng);
  state.level = 2;
  state.score = 30;
  state.levelScore = 5;
  state.paused = true;
  state.elapsed = 10;
  state.groundOffset = 5;
  state.bird.y = 1;
  state.screen = 'win';
  restartGame(state);
  assert.equal(state.rng, rng);
  assert.equal(state.screen, 'playing');
  assert.equal(state.level, 0);
  assert.equal(state.score, 0);
  assert.equal(state.levelScore, 0);
  assert.equal(state.paused, false);
  assert.equal(state.elapsed, 0);
  assert.equal(state.groundOffset, 0);
  assert.equal(state.bird.y, (floor - CONFIG.bird.height) / 2);
  assert.equal(state.bird.velocity, 0);
  assert.equal(state.pipes.length, 1);
  const before = snapshot(state);
  nextLevel(state);
  assert.deepEqual(snapshot(state), before);
});

test('seeded pipe generation is deterministic, bounded, and variation-limited', () => {
  const a = createGame(seeded(42));
  const b = createGame(seeded(42));
  const c = createGame(seeded(43));
  assert.notEqual(a.pipes[0].gapY, c.pipes[0].gapY);
  for (let index = 0; index < CONFIG.levels.length; index += 1) {
    a.level = b.level = index;
    const current = CONFIG.levels[index];
    for (let count = 0; count < 100; count += 1) {
      const previous = a.pipes.at(-1).gapY;
      const pipeA = generatePipe(a, count * current.spacing);
      const pipeB = generatePipe(b, count * current.spacing);
      assert.deepEqual(pipeA, pipeB);
      assert.ok(pipeA.gapY >= CONFIG.pipeMargin + current.gap / 2);
      assert.ok(pipeA.gapY <= floor - CONFIG.pipeMargin - current.gap / 2);
      assert.ok(Math.abs(pipeA.gapY - previous) <= current.variation);
      assert.equal(pipeA.scored, false);
      a.pipes.push(pipeA);
      b.pipes.push(pipeB);
    }
  }
});

test('spawned pipes retain configured spacing and remove offscreen pipes', () => {
  const state = playing();
  state.pipes[0].x = CONFIG.width;
  const first = state.pipes[0];
  update(state, tick);
  assert.equal(state.pipes.length, 2);
  close(state.pipes[1].x - first.x, level.spacing);
  assert.ok(state.pipes[1].x > CONFIG.width);
  state.pipes.unshift({ x: -CONFIG.pipeWidth - 1, gapY: floor / 2, scored: true });
  update(state, tick);
  assert.equal(state.pipes.length, 2);
  assert.ok(state.pipes.every((pipe) => pipe.x + CONFIG.pipeWidth >= 0));
});

test('difficulty increases monotonically and all gaps remain playable', () => {
  assert.deepEqual(CONFIG.levels.map((entry) => entry.target), [10, 15, 20]);
  for (let index = 0; index < CONFIG.levels.length; index += 1) {
    const current = CONFIG.levels[index];
    assert.ok(current.flapVelocity < 0);
    assert.ok(current.gap > CONFIG.bird.height);
    assert.ok(current.gap + CONFIG.pipeMargin * 2 < floor);
    assert.ok(current.spacing > CONFIG.pipeWidth);
    if (index === 0) continue;
    const previous = CONFIG.levels[index - 1];
    for (const key of ['speed', 'gravity', 'variation']) {
      assert.ok(current[key] > previous[key], key);
    }
    for (const key of ['gap', 'spacing']) {
      assert.ok(current[key] < previous[key], key);
    }
  }
});

test('invalid delta times do nothing and substeps match repeated fixed updates', () => {
  const state = playing();
  const before = snapshot(state);
  for (const dt of [0, -1, NaN, Infinity, -Infinity, undefined]) update(state, dt);
  assert.deepEqual(snapshot(state), before);
  const other = playing();
  update(state, tick * 8);
  for (let count = 0; count < 8; count += 1) update(other, tick);
  close(state.bird.y, other.bird.y);
  close(state.bird.velocity, other.bird.velocity);
  close(state.elapsed, other.elapsed);
  close(state.pipes[0].x, other.pipes[0].x);
});
