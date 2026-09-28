'use strict';

// Depends on pieces.js, audio.js, scoring.js, powerups.js, modes.js and
// abilities.js (loaded first by index.html).

const POPUP_MS = 1200;
const FLASH_MS = 600;
const FREEZE_MS = 5000;
const POWERUP_EVERY = 8; // lines
const QUEUE_SIZE = 5;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = holdCanvas.getContext('2d');
const queueCanvas = document.getElementById('queue-canvas');
const queueCtx = queueCanvas.getContext('2d');
const queueSection = document.getElementById('queue-section');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const comboEl = document.getElementById('combo');
const energySection = document.getElementById('energy-section');
const energyFill = document.getElementById('energy-fill');
const modeLabelEl = document.getElementById('mode-label');
const goalEl = document.getElementById('goal-text');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const modeBtn = document.getElementById('mode-btn');
const modeMenu = document.getElementById('mode-menu');
const modeList = document.getElementById('mode-list');
const abilityMenu = document.getElementById('ability-menu');
const abilityList = document.getElementById('ability-list');
const themeToggleBtn = document.getElementById('theme-toggle');
const soundToggleBtn = document.getElementById('sound-toggle');

const THEME_KEY = 'tetris-theme';

let board, current, queue, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let hold, holdUsed, combo, b2b, lastMoveRotate, popups, flashUntil;
let nextPowerAt, pendingPower, pendingSingle, freezeUntil, pausedAt;
let mode = 'classic', elapsed, garbageAccum, energy, slowUntil, previewUntil, snapshot;
let modeMenuOpen = false, abilityMenuOpen = false;
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

function rotateCCW(shape) {
  return rotateCW(rotateCW(rotateCW(shape)));
}

function inverseRotation() {
  const from = MODES[mode].inverseFromLevel;
  return !!from && level >= from;
}

function tryRotate() {
  const rotated = inverseRotation() ? rotateCCW(current.shape) : rotateCW(current.shape);
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

// Everything the "undo" ability needs to rewind one placement.
function takeSnapshot() {
  const spec = p => ({ type: p.type, power: p.power });
  snapshot = {
    board: board.map(row => [...row]),
    score, lines, level, dropInterval, combo, b2b,
    hold: hold && { ...hold }, holdUsed,
    piece: spec(current),
    queue: queue.map(spec),
    nextPowerAt, pendingPower, pendingSingle,
  };
}

function restoreSnapshot() {
  const s = snapshot;
  snapshot = null;
  board = s.board;
  ({ score, lines, level, dropInterval, combo, b2b, holdUsed, nextPowerAt, pendingPower, pendingSingle } = s);
  hold = s.hold;
  queue = s.queue.map(p => createPiece(p.type, p.power));
  current = createPiece(s.piece.type, s.piece.power);
  lastMoveRotate = false;
  drawNext();
  drawHold();
}

function lockPiece() {
  takeSnapshot();
  const tspin = isTSpin();
  const lvl = level;
  const prevCombo = combo;
  const power = current.power;
  // Power-ups are never merged: they apply their effect at the landing cell.
  if (power) {
    if (applyPowerUp(board, power, current.x, current.y)) freezeUntil = performance.now() + FREEZE_MS;
    showPopups([`${POWERUPS[power].icon} ${POWERUPS[power].label}`]);
    sfx.power(power);
  } else {
    merge();
  }
  const cleared = clearLines();
  const perfect = cleared > 0 && board.every(row => row.every(v => !v));
  const result = evaluateClear({ cleared, tspin, perfect, combo, b2b, level: lvl });
  score += result.points;
  combo = result.combo;
  b2b = result.b2b;

  showPopups(result.labels);
  playLockSfx(cleared, tspin, perfect, result.labels.includes('B2B'), !!power);
  if (perfect) flashUntil = performance.now() + FLASH_MS;
  if (combo >= 2 && combo > prevCombo) pulse(comboEl);
  if (cleared >= 4 && !tspin) pendingSingle = true;
  while (lines >= nextPowerAt) {
    pendingPower = true;
    nextPowerAt += POWERUP_EVERY;
  }
  chargeEnergy(cleared);
  const inverseFrom = MODES[mode].inverseFromLevel;
  if (inverseFrom && lvl < inverseFrom && level >= inverseFrom) showPopups(['🔃 ROTACIÓN INVERSA']);

  holdUsed = false;
  lastMoveRotate = false;
  drawHold();
  updateHUD();
  spawn();
  checkGoalNow();
}

function playLockSfx(cleared, tspin, perfect, isB2B, wasPower) {
  if (!cleared && !tspin) { if (!wasPower) sfx.lock(); return; }
  if (tspin) sfx.tspin();
  if (cleared) sfx.clear(cleared);
  if (combo >= 2) sfx.combo(combo);
  if (isB2B) sfx.b2b();
  if (perfect) sfx.perfect();
}

function holdPiece() {
  if (holdUsed) return;
  if (hold === null) {
    hold = { type: current.type, power: current.power };
    spawn();
  } else {
    const held = hold;
    hold = { type: current.type, power: current.power };
    current = createPiece(held.type, held.power);
    if (collide(current.shape, current.x, current.y)) endGame();
  }
  holdUsed = true;
  lastMoveRotate = false;
  sfx.hold();
  drawHold();
}

// Power-ups jump the queue ahead of the single-block reward; both are flagged by lockPiece().
function spawn() {
  current = queue.shift();
  if (pendingPower) { pendingPower = false; queue.unshift(randomPowerUp()); }
  else if (pendingSingle) { pendingSingle = false; queue.unshift(createPiece(SINGLE_TYPE)); }
  while (queue.length < QUEUE_SIZE) queue.push(randomPiece());
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

// ---- Energy & abilities ----

function chargeEnergy(cleared) {
  if (!cleared || energy >= ENERGY_MAX) return;
  energy = Math.min(ENERGY_MAX, energy + cleared * ENERGY_PER_LINE);
  if (energy >= ENERGY_MAX) {
    showPopups(['⚡ ENERGÍA LISTA · E']);
    sfx.b2b();
  }
}

function openAbilityMenu() {
  if (energy < ENERGY_MAX || paused || gameOver) return;
  paused = true;
  suspend();
  abilityMenuOpen = true;
  abilityList.replaceChildren(...ABILITIES.map((a, i) =>
    menuButton(i + 1, `${a.icon} ${a.name}`, a.desc, () => chooseAbility(i), a.id === 'undo' && !snapshot)));
  abilityMenu.classList.remove('hidden');
}

function closeAbilityMenu() {
  abilityMenu.classList.add('hidden');
  abilityMenuOpen = false;
  paused = false;
  resume();
}

function chooseAbility(i) {
  const ability = ABILITIES[i];
  if (!ability || (ability.id === 'undo' && !snapshot)) return;
  closeAbilityMenu();
  energy = 0;
  useAbility(ability.id);
  showPopups([`${ability.icon} ${ability.name.toUpperCase()}`]);
  sfx.hold();
  updateHUD();
}

function useAbility(id) {
  const now = performance.now();
  switch (id) {
    case 'preview':
      previewUntil = now + PREVIEW_MS;
      drawNext();
      break;
    case 'swap': {
      const types = [];
      for (let t = 1; t <= STANDARD_COUNT; t++) if (t !== current.type) types.push(t);
      const piece = createPiece(types[Math.floor(Math.random() * types.length)]);
      // Keep the current position when it fits, otherwise fall back to the spawn position.
      if (!collide(piece.shape, current.x, current.y)) { piece.x = current.x; piece.y = current.y; }
      if (!collide(piece.shape, piece.x, piece.y)) current = piece;
      lastMoveRotate = false;
      break;
    }
    case 'slow':
      slowUntil = now + SLOW_MS;
      break;
    case 'undo':
      restoreSnapshot();
      break;
  }
}

// ---- Modes & goals ----

function stats() {
  return { lines, level, elapsed, garbageLeft: countGarbage(board) };
}

function checkGoalNow() {
  if (gameOver) return;
  const status = checkGoal(mode, stats());
  if (status === 'win') endGame('¡OBJETIVO CUMPLIDO!', true);
  else if (status === 'lose') endGame('TIEMPO AGOTADO');
}

function addGarbage() {
  snapshot = null; // undo must not rewind past the rising garbage
  if (!pushGarbage(board)) { endGame(); return; }
  if (collide(current.shape, current.x, current.y)) {
    if (!collide(current.shape, current.x, current.y - 1)) current.y--;
    else endGame();
  }
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  comboEl.textContent = combo >= 2 ? `x${combo}` : '—';
  energyFill.style.width = `${(energy / ENERGY_MAX) * 100}%`;
  energySection.classList.toggle('full', energy >= ENERGY_MAX);
  updateGoal();
}

function updateGoal() {
  const text = goalText(mode, stats());
  if (goalEl.textContent !== text) goalEl.textContent = text;
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

// ---- Drawing ----

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

function drawPowerIcon(context, x, y, size, kind, alpha) {
  context.save();
  context.globalAlpha = alpha ?? 1;
  context.font = `${Math.floor(size * 0.8)}px system-ui, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#000'; // opaque: emoji inherit the fill's alpha
  context.fillText(POWERUPS[kind].icon, x * size + size / 2, y * size + size / 2 + 1);
  context.restore();
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
  // shadow instead of strokeText: stroking emoji draws broken outlines
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 2;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = '#ffd54f';
  popups.forEach((p, i) => {
    const t = (now - p.t0) / POPUP_MS;
    if (t < 0) return;
    const y = canvas.height * 0.4 + i * 30 - t * 40;
    ctx.globalAlpha = 1 - t;
    ctx.fillText(p.text, canvas.width / 2, y);
  });
  ctx.restore();
}

// Countdown badges for timed effects, stacked in the top-right corner.
function drawTimers(now) {
  const timers = [
    [freezeUntil, '❄️', '#64b5f6'],
    [slowUntil, '🐢', '#81c784'],
    [previewUntil, '👁️', '#ba68c8'],
  ].filter(([until]) => now < until);
  if (!timers.length) return;
  ctx.save();
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  timers.forEach(([until, icon, color], i) => {
    ctx.fillStyle = color;
    ctx.fillText(`${icon} ${Math.ceil((until - now) / 1000)}s`, canvas.width - 8, 8 + i * 22);
  });
  ctx.restore();
}

function draw() {
  const now = performance.now();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board (hidden in the invisible challenge until the game ends)
  if (!MODES[mode].invisible || gameOver)
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

  if (current.power) {
    drawPowerIcon(ctx, current.x, gy, BLOCK, current.power, 0.3);
    drawPowerIcon(ctx, current.x, current.y, BLOCK, current.power);
  }

  if (now < freezeUntil) {
    ctx.fillStyle = 'rgba(100,180,255,0.12)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  drawTimers(now);

  // perfect clear flash
  if (now < flashUntil) {
    ctx.fillStyle = `rgba(255,255,255,${0.5 * (flashUntil - now) / FLASH_MS})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  drawPopups(now);
}

// piece: anything with { type, power } (a live piece or a hold entry).
// Draws it centred in a 4×4 cell box whose top row is `row0`.
function drawPreview(context, piece, size, row0 = 0) {
  const shape = PIECES[piece.type];
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = row0 + Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(context, offX + c, offY + r, shape[r][c], size);
  if (piece.power) drawPowerIcon(context, offX, offY, size, piece.power);
}

function drawNext() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  drawPreview(nextCtx, queue[0], 30);
  const showQueue = performance.now() < previewUntil;
  queueSection.classList.toggle('hidden', !showQueue);
  if (showQueue) {
    queueCtx.clearRect(0, 0, queueCanvas.width, queueCanvas.height);
    for (let i = 1; i < QUEUE_SIZE; i++) drawPreview(queueCtx, queue[i], 15, (i - 1) * 4);
  }
}

function drawHold() {
  holdCtx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
  if (hold) drawPreview(holdCtx, hold, 30);
  holdCanvas.classList.toggle('locked', holdUsed);
}

// ---- Game flow ----

function endGame(title = 'GAME OVER', won = false) {
  gameOver = true;
  cancelAnimationFrame(animId);
  won ? sfx.perfect() : sfx.gameOver();
  overlayTitle.textContent = title;
  overlayTitle.classList.toggle('win', won);
  const time = mode === 'classic' ? '' : ` · Tiempo ${formatTime(elapsed)}`;
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}${time}`;
  overlay.classList.remove('hidden');
}

function suspend() {
  cancelAnimationFrame(animId);
  pausedAt = performance.now();
}

// Timed effects don't run down while the game is suspended.
function resume() {
  const now = performance.now();
  const gap = now - pausedAt;
  if (freezeUntil > pausedAt) freezeUntil += gap;
  if (slowUntil > pausedAt) slowUntil += gap;
  if (previewUntil > pausedAt) previewUntil += gap;
  lastTime = now;
  loop(now);
}

function togglePause() {
  if (gameOver || abilityMenuOpen) return;
  paused = !paused;
  if (!paused) {
    overlay.classList.add('hidden');
    resume();
  } else {
    suspend();
    overlayTitle.textContent = 'PAUSA';
    overlayTitle.classList.remove('win');
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  if (gameOver || paused) return;
  const now = performance.now();
  const dt = ts - lastTime;
  lastTime = ts;
  elapsed += dt;

  const every = MODES[mode].garbageEvery;
  if (every) {
    garbageAccum += dt;
    if (garbageAccum >= every) {
      garbageAccum -= every;
      addGarbage();
      if (gameOver) { draw(); return; }
    }
  }

  const interval = dropInterval * (now < slowUntil ? SLOW_FACTOR : 1);
  dropAccum = now < freezeUntil ? 0 : dropAccum + dt;
  if (dropAccum >= interval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      lastMoveRotate = false;
    } else {
      lockPiece();
      if (gameOver) { draw(); return; }
    }
  }

  checkGoalNow();
  if (gameOver) { draw(); return; }
  if (!queueSection.classList.contains('hidden') && now >= previewUntil) drawNext();
  updateGoal();
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  readGridColor();
  board = createBoard();
  if (MODES[mode].prefillRows) prefillBoard(board, MODES[mode].prefillRows);
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
  freezeUntil = 0;
  slowUntil = 0;
  previewUntil = 0;
  pausedAt = 0;
  nextPowerAt = POWERUP_EVERY;
  pendingPower = false;
  pendingSingle = false;
  energy = 0;
  snapshot = null;
  elapsed = 0;
  garbageAccum = 0;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  queue = Array.from({ length: QUEUE_SIZE }, () => randomPiece());
  spawn();
  drawHold();
  modeLabelEl.textContent = MODES[mode].name.toUpperCase();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

// ---- Menus ----

function menuButton(n, title, desc, onClick, disabled = false) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'menu-btn';
  btn.disabled = disabled;
  const kbd = document.createElement('kbd');
  kbd.textContent = n;
  const strong = document.createElement('strong');
  strong.textContent = title;
  const small = document.createElement('small');
  small.textContent = desc;
  btn.append(kbd, strong, small);
  btn.addEventListener('click', () => { ensureAudio(); btn.blur(); onClick(); });
  return btn;
}

function showModeMenu() {
  overlay.classList.add('hidden');
  modeMenuOpen = true;
  modeMenu.classList.remove('hidden');
}

function selectMode(id) {
  mode = id;
  modeMenuOpen = false;
  modeMenu.classList.add('hidden');
  init();
}

modeList.append(...MODE_IDS.map((id, i) =>
  menuButton(i + 1, MODES[id].name, MODES[id].desc, () => selectMode(id))));

function digitIndex(code) {
  const m = /^(?:Digit|Numpad)([1-9])$/.exec(code);
  return m ? Number(m[1]) - 1 : -1;
}

document.addEventListener('keydown', e => {
  ensureAudio();
  if (modeMenuOpen) {
    const i = digitIndex(e.code);
    if (i >= 0 && i < MODE_IDS.length) selectMode(MODE_IDS[i]);
    return;
  }
  if (abilityMenuOpen) {
    const i = digitIndex(e.code);
    if (i >= 0) chooseAbility(i);
    else if (e.code === 'Escape' || e.code === 'KeyE') closeAbilityMenu();
    return;
  }
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
    case 'KeyE':
      openAbilityMenu();
      return;
  }
  updateHUD();
});

restartBtn.addEventListener('click', () => { ensureAudio(); restartBtn.blur(); init(); });
modeBtn.addEventListener('click', () => { modeBtn.blur(); showModeMenu(); });
// blur so a focused button doesn't also react to Space (hard drop)
themeToggleBtn.addEventListener('click', () => { toggleTheme(); themeToggleBtn.blur(); });
soundToggleBtn.addEventListener('click', () => { toggleSound(); soundToggleBtn.blur(); });
themeToggleBtn.textContent = document.body.dataset.theme === 'light' ? '☀️' : '🌙';
updateSoundButton();

showModeMenu();
