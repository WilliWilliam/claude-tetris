'use strict';

// Pure scoring logic: no DOM access, no global game state.

const LINE_SCORES = [0, 100, 300, 500, 800];
const TSPIN_SCORES = [400, 800, 1200, 1600];
const PC_BONUS = [0, 800, 1200, 1800, 2000];
const B2B_MULT = 1.5;
const CLEAR_NAMES = ['', 'SENCILLO', 'DOBLE', 'TRIPLE', 'TETRIS'];

// combo: consecutive placements that cleared lines so far (0 = none).
// b2b: whether the last line clear was "difficult" (Tetris or T-spin with lines).
function evaluateClear({ cleared, tspin, perfect, combo, b2b, level }) {
  const labels = [];

  if (!cleared) {
    const points = tspin ? TSPIN_SCORES[0] * level : 0;
    if (tspin) labels.push('T-SPIN');
    return { points, combo: 0, b2b, labels };
  }

  // Power-ups (gravity, tint) can clear more than 4 lines at once: score them as a Tetris.
  const n = Math.min(cleared, 4);
  const difficult = n === 4 || tspin;
  const isB2B = difficult && b2b;
  const newCombo = combo + 1;

  let base = tspin ? (TSPIN_SCORES[n] || 0) : LINE_SCORES[n];
  if (isB2B) base *= B2B_MULT;
  base *= Math.max(1, newCombo);
  const pc = perfect ? PC_BONUS[n] : 0;
  const points = Math.round((base + pc) * level);

  if (tspin) labels.push(`T-SPIN ${CLEAR_NAMES[n]}`);
  else if (n === 4) labels.push('TETRIS');
  if (isB2B) labels.push('B2B');
  if (newCombo >= 2) labels.push(`COMBO x${newCombo}`);
  if (perfect) labels.push('PERFECT CLEAR');

  return { points, combo: newCombo, b2b: difficult, labels };
}
