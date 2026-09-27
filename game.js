'use strict';

// Depends on pieces.js, audio.js and scoring.js (loaded first by index.html).

const POPUP_MS = 1200;
const FLASH_MS = 600;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = holdCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const comboEl = document.getElementById('combo');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggleBtn = document.getElementById('theme-toggle');
const soundToggleBtn = document.getElementById('sound-toggle');

const THEME_KEY = 'tetris-theme';

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let hold, holdUsed, combo, b2b, lastMoveRotate, popups, flashUntil;
let gridColor;

function readGridColor() {
  gridColor = getComputedStyle(document.body).getPropertyValue('--grid-color').trim();
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  themeToggleBtn.textContent = theme === 'light' ? '☀️' : '🌙';
  readGridColor();
  if (board) {
    draw();
    drawNext();
    drawHold();
  }
}

function toggleTheme() {
  const activeTheme = document.body.dataset.theme === 'light' ? 'light' : 'dark';
  applyTheme(activeTheme === 'light' ? 'dark' : 'light');
}

function updateSoundButton() {
  soundToggleBtn.textContent = muted ? '🔇' : '🔊';
  soundToggleBtn.setAttribute('aria-label', muted ? 'Activar sonido' : 'Silenciar sonido');
}

function toggleSound() {
  ensureAudio();
  setMuted(!muted);
  updateSoundButton();
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      lastMoveRotate = true;
      sfx.rotate();
      return;
    }
  }
}

function tryMove(dx) {
  if (!collide(current.shape, current.x + dx, current.y)) {
    current.x += dx;
    lastMoveRotate = false;
  }
}

// 3-corner rule: a T locked right after a rotation with ≥3 of the corners
// around its center occupied (walls and floor count as occupied).
function isTSpin() {
  if (current.type !== T_TYPE || !lastMoveRotate) return false;
  const cx = current.x + 1, cy = current.y + 1;
  let filled = 0;
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = cx + dx, y = cy + dy;
    if (x < 0 || x >= COLS || y >= ROWS || (y >= 0 && board[y][x])) filled++;
  }
  return filled >= 3;
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  }
  return cleared;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  if (gy > current.y) lastMoveRotate = false;
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    lastMoveRotate = false;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  const tspin = isTSpin();
  const lvl = level;
  const prevCombo = combo;
  merge();
  const cleared = clearLines();
  const perfect = cleared > 0 && board.every(row => row.every(v => !v));
  const result = evaluateClear({ cleared, tspin, perfect, combo, b2b, level: lvl });
  score += result.points;
  combo = result.combo;
  b2b = result.b2b;

  showPopups(result.labels);
  playLockSfx(cleared, tspin, perfect, result.labels.includes('B2B'));
  if (perfect) flashUntil = performance.now() + FLASH_MS;
  if (combo >= 2 && combo > prevCombo) pulse(comboEl);

  holdUsed = false;
  lastMoveRotate = false;
  drawHold();
  updateHUD();
  spawn();
}

function playLockSfx(cleared, tspin, perfect, isB2B) {
  if (!cleared && !tspin) { sfx.lock(); return; }
  if (tspin) sfx.tspin();
  if (cleared) sfx.clear(cleared);
  if (combo >= 2) sfx.combo(combo);
  if (isB2B) sfx.b2b();
  if (perfect) sfx.perfect();
}

function holdPiece() {
  if (holdUsed) return;
  if (hold === null) {
    hold = current.type;
    spawn();
  } else {
    const held = hold;
    hold = current.type;
    current = createPiece(held);
    if (collide(current.shape, current.x, current.y)) endGame();
  }
  holdUsed = true;
  lastMoveRotate = false;
  sfx.hold();
  drawHold();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  comboEl.textContent = combo >= 2 ? `x${combo}` : '—';
}

function pulse(el) {
  el.classList.remove('pulse');
  void el.offsetWidth; // force reflow so the animation restarts
  el.classList.add('pulse');
}

function showPopups(labels) {
  const now = performance.now();
  labels.forEach((text, i) => popups.push({ text, t0: now + i * 120 }));
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function drawPopups(now) {
  popups = popups.filter(p => now - p.t0 < POPUP_MS);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.fillStyle = '#ffd54f';
  popups.forEach((p, i) => {
    const t = (now - p.t0) / POPUP_MS;
    if (t < 0) return;
    const y = canvas.height * 0.4 + i * 30 - t * 40;
    ctx.globalAlpha = 1 - t;
    ctx.strokeText(p.text, canvas.width / 2, y);
    ctx.fillText(p.text, canvas.width / 2, y);
  });
  ctx.restore();
}

function draw() {
  const now = performance.now();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);

  // perfect clear flash
  if (now < flashUntil) {
    ctx.fillStyle = `rgba(255,255,255,${0.5 * (flashUntil - now) / FLASH_MS})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  drawPopups(now);
}

function drawPreview(context, canvasEl, type) {
  const NB = 30;
  context.clearRect(0, 0, canvasEl.width, canvasEl.height);
  if (!type) return;
  const shape = PIECES[type];
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(context, offX + c, offY + r, shape[r][c], NB);
}

function drawNext() {
  drawPreview(nextCtx, nextCanvas, next.type);
}

function drawHold() {
  drawPreview(holdCtx, holdCanvas, hold);
  holdCanvas.classList.toggle('locked', holdUsed);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  sfx.gameOver();
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    overlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  if (gameOver || paused) return;
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      lastMoveRotate = false;
    } else {
      lockPiece();
      if (gameOver) { draw(); return; }
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  readGridColor();
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  combo = 0;
  b2b = false;
  hold = null;
  holdUsed = false;
  lastMoveRotate = false;
  popups = [];
  flashUntil = 0;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  drawHold();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  ensureAudio();
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      tryMove(-1);
      break;
    case 'ArrowRight':
      tryMove(1);
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
    case 'KeyC':
    case 'ShiftLeft':
    case 'ShiftRight':
      holdPiece();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', () => { ensureAudio(); init(); });
themeToggleBtn.addEventListener('click', toggleTheme);
soundToggleBtn.addEventListener('click', toggleSound);
themeToggleBtn.textContent = document.body.dataset.theme === 'light' ? '☀️' : '🌙';
updateSoundButton();

init();
