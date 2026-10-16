export const PALETTE = {
  sky: '#83c7bd', night: '#7299b2', dusk: '#ac91b5',
  ink: '#182442', white: '#fff3ce', cloud: '#d7e9cf',
  gold: '#f9c85b', orange: '#e78b47', red: '#be5148',
  green: '#78b84a', lightGreen: '#bed768', darkGreen: '#3e7544',
  dirt: '#b18152', sand: '#e9cc86',
};

const birdFrames = [
  ['....KKKK....', '..KKYYYYK...', '.KYYYYYYWK..', 'KYYYYYYWKWK.', 'KYYYOOYYWWK.', 'KYYOOOOYYKKK', '.KOOOOOYRRRK', '..KOOOORRRRK', '...KKKKKK...'],
  ['....KKKK....', '..KKYYYYK...', '.KYYYYYYWK..', 'KYYYYYYWKWK.', 'KOOOOOYYWWK.', 'KOOOOOOYYKKK', '.KOOOYYYRRRK', '..KYYYYRRRRK', '...KKKKKK...'],
  ['....KKKK....', '..KKYYYYK...', '.KOOOYYYWK..', 'KOOOOOYWKWK.', 'KOOOOOYYWWK.', 'KYYYYYYYYKKK', '.KYYYYYYRRRK', '..KYYYYRRRRK', '...KKKKKK...'],
];
const cloud = [
  '......CCCC......', '....CCCCCCCC....', '..CCCCCCCCCCCC..',
  'CCCCCCCCCCCCCCCC', 'CCCCCCCCCCCCCCCC', '..CCCCCCCCCCCC..',
];
const ground = ['LLLLLLLL', 'GGGGGGGG', 'GDGGGDGG', 'SSSSSSSS', 'SSDSSSSD', 'DSSSSDSS'];
const pipe = ['KLGGGGDK', 'KLGGGGDK', 'KLGGGGDK', 'KLGGGGDK'];
const colors = { K: PALETTE.ink, Y: PALETTE.gold, W: PALETTE.white, O: PALETTE.orange,
  R: PALETTE.red, C: PALETTE.cloud, L: PALETTE.lightGreen, G: PALETTE.green,
  D: PALETTE.darkGreen, S: PALETTE.sand };

export function sprite(ctx, rows, x, y) {
  rows.forEach((row, dy) => [...row].forEach((pixel, dx) => {
    if (colors[pixel]) {
      ctx.fillStyle = colors[pixel];
      ctx.fillRect(Math.round(x) + dx, Math.round(y) + dy, 1, 1);
    }
  }));
}

export function drawBird(ctx, x, y, frame) {
  sprite(ctx, birdFrames[frame % birdFrames.length], x, y);
}

export function drawCloud(ctx, x, y) { sprite(ctx, cloud, x, y); }

export function drawPipe(ctx, x, top, width, height, capAtBottom) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(Math.round(x), top, width, height);
  ctx.clip();
  for (let y = top; y < top + height; y += pipe.length) {
    for (let dx = 0; dx < width; dx += pipe[0].length) sprite(ctx, pipe, x + dx, y);
  }
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(Math.round(x), top, 1, height);
  ctx.fillRect(Math.round(x) + width - 1, top, 1, height);
  const capY = capAtBottom ? top + height - 6 : top;
  ctx.fillRect(Math.round(x), capY, width, 6);
  ctx.fillStyle = PALETTE.lightGreen;
  ctx.fillRect(Math.round(x) + 1, capY + 1, width - 2, 2);
  ctx.fillStyle = PALETTE.green;
  ctx.fillRect(Math.round(x) + 1, capY + 3, width - 2, 2);
  ctx.restore();
}

export function drawGround(ctx, y, width, height, offset) {
  ctx.fillStyle = PALETTE.dirt;
  ctx.fillRect(0, y, width, height);
  for (let x = -8; x < width + 8; x += 8) sprite(ctx, ground, x - Math.floor(offset % 8), y);
}
