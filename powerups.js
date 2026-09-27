'use strict';

// Board effects for power-ups. They mutate the board passed in (rows are
// modified in place), take the landing cell (x, y) and touch no other state.

function inBounds(board, x, y) {
  return y >= 0 && y < board.length && x >= 0 && x < board[0].length;
}

// Drop every block in each column to the bottom, closing all holes.
function compactColumns(board) {
  const rows = board.length, cols = board[0].length;
  for (let c = 0; c < cols; c++) {
    const cells = [];
    for (let r = rows - 1; r >= 0; r--) if (board[r][c]) cells.push(board[r][c]);
    for (let r = rows - 1, i = 0; r >= 0; r--, i++) board[r][c] = cells[i] || 0;
  }
}

function bombEffect(board, x, y) {
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      if (inBounds(board, x + dx, y + dy)) board[y + dy][x + dx] = 0;
}

function rayEffect(board, x, y) {
  if (inBounds(board, 0, y)) board[y].fill(0);
  for (let r = 0; r < board.length; r++) if (inBounds(board, x, r)) board[r][x] = 0;
}

// Target colour: block below, then left, then right; else the most common colour.
function tintTarget(board, x, y) {
  for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0]])
    if (inBounds(board, x + dx, y + dy) && board[y + dy][x + dx]) return board[y + dy][x + dx];
  const counts = {};
  for (const row of board) for (const v of row) if (v) counts[v] = (counts[v] || 0) + 1;
  let best = 0, bestCount = 0;
  for (const [v, n] of Object.entries(counts)) if (n > bestCount) { best = Number(v); bestCount = n; }
  return best;
}

function tintEffect(board, x, y) {
  const target = tintTarget(board, x, y);
  if (!target) return;
  for (const row of board)
    for (let c = 0; c < row.length; c++)
      if (row[c] === target) row[c] = 0;
  compactColumns(board);
}

// Returns true when the power-up is "freeze" (the caller owns the timer).
function applyPowerUp(board, kind, x, y) {
  switch (kind) {
    case 'bomb': bombEffect(board, x, y); break;
    case 'ray': rayEffect(board, x, y); break;
    case 'tint': tintEffect(board, x, y); break;
    case 'gravity': compactColumns(board); break;
    case 'freeze': return true;
  }
  return false;
}
