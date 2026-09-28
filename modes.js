'use strict';

// Challenge modes. Pure helpers: they read a stats object
// ({ lines, level, elapsed, garbageLeft }) or mutate the board passed in.

const MODES = {
  classic:   { name: 'Clásico', desc: 'Juego libre, sin objetivo' },
  sprint:    { name: 'Sprint 40', desc: 'Limpia 40 líneas en 2 minutos', targetLines: 40, timeLimit: 120000 },
  garbage:   { name: 'Basura', desc: 'Sobrevive 2 minutos; sube basura cada 10 s', survive: 120000, garbageEvery: 10000 },
  fixed:     { name: 'Bloques fijos', desc: 'Elimina todos los bloques pre-colocados', prefillRows: 8 },
  invisible: { name: 'Invisible', desc: 'Las piezas desaparecen al fijarse. Limpia 20 líneas', invisible: true, targetLines: 20 },
  inverse:   { name: 'Rotación inversa', desc: 'Desde el nivel 3 se invierte el giro. Llega al nivel 5', inverseFromLevel: 3, targetLevel: 5 },
};

const MODE_IDS = Object.keys(MODES);

function formatTime(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function countGarbage(board) {
  let n = 0;
  for (const row of board) for (const v of row) if (v === GARBAGE_TYPE) n++;
  return n;
}

// 'win', 'lose' or null. Win conditions are checked before the time limit.
function checkGoal(mode, s) {
  const m = MODES[mode];
  if (m.targetLines && s.lines >= m.targetLines) return 'win';
  if (m.targetLevel && s.level >= m.targetLevel) return 'win';
  if (m.prefillRows && s.garbageLeft === 0) return 'win';
  if (m.survive && s.elapsed >= m.survive) return 'win';
  if (m.timeLimit && s.elapsed >= m.timeLimit) return 'lose';
  return null;
}

function goalText(mode, s) {
  const m = MODES[mode];
  if (m.timeLimit) return `${Math.min(s.lines, m.targetLines)}/${m.targetLines} líneas · ${formatTime(m.timeLimit - s.elapsed)}`;
  if (m.targetLines) return `${Math.min(s.lines, m.targetLines)}/${m.targetLines} líneas`;
  if (m.targetLevel) return `Nivel ${Math.min(s.level, m.targetLevel)}/${m.targetLevel}`;
  if (m.prefillRows) return `${s.garbageLeft} bloques fijos`;
  if (m.survive) return `Sobrevive ${formatTime(m.survive - s.elapsed)}`;
  return 'Libre';
}

function garbageRow(cols) {
  const row = new Array(cols).fill(GARBAGE_TYPE);
  row[Math.floor(Math.random() * cols)] = 0;
  return row;
}

// Fill the bottom `rows` rows ~60 % with fixed blocks, never leaving a complete row.
function prefillBoard(board, rows) {
  for (let r = board.length - rows; r < board.length; r++) {
    const row = board[r];
    for (let c = 0; c < row.length; c++) row[c] = Math.random() < 0.6 ? GARBAGE_TYPE : 0;
    if (row.every(v => v)) row[Math.floor(Math.random() * row.length)] = 0;
  }
}

// Push a garbage row in from the bottom (in place). Returns false if blocks fell off the top.
function pushGarbage(board) {
  const top = board.shift();
  board.push(garbageRow(board[0].length));
  return top.every(v => !v);
}
