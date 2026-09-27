'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#64b5f6', // J - blue
  '#ffb74d', // L - orange
  '#f06292', // + - pink
  '#4db6ac', // U - teal
  '#dce775', // Y - lime
  '#90a4ae', // single - blue grey
  '#a1887f', // hollow 3×3 - brown
  '#b0bec5', // power-up (never merged into the board)
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[0,8,0],[8,8,8],[0,8,0]],                  // +
  [[9,0,9],[9,9,9],[0,0,0]],                  // U
  [[0,0,0,0],[10,10,10,10],[0,10,0,0],[0,0,0,0]], // Y
  [[11]],                                      // single (reward after a Tetris)
  [[12,12,12],[12,0,12],[12,12,12]],          // hollow 3×3 (challenge)
  [[13]],                                      // power-up
];

const T_TYPE = 3;
const STANDARD_COUNT = 7;
const PENTOMINO_TYPES = [8, 9, 10];
const SINGLE_TYPE = 11;
const HOLLOW_TYPE = 12;
const POWER_TYPE = 13;

const PENTOMINO_CHANCE = 0.08;
const HOLLOW_CHANCE = 0.03;

const POWERUPS = {
  bomb:    { icon: '💣', label: 'BOMBA' },
  ray:     { icon: '⚡', label: 'RAYO' },
  tint:    { icon: '🎨', label: 'TINTE' },
  gravity: { icon: '🧲', label: 'GRAVEDAD' },
  freeze:  { icon: '❄️', label: 'CONGELAR' },
};

function createPiece(type, power = null) {
  const shape = PIECES[type].map(row => [...row]);
  return { type, power, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

// Mostly the 7 standard tetrominoes; pentominoes and the hollow 3×3 show up occasionally.
function randomPiece() {
  const roll = Math.random();
  if (roll < HOLLOW_CHANCE) return createPiece(HOLLOW_TYPE);
  if (roll < HOLLOW_CHANCE + PENTOMINO_CHANCE)
    return createPiece(PENTOMINO_TYPES[Math.floor(Math.random() * PENTOMINO_TYPES.length)]);
  return createPiece(Math.floor(Math.random() * STANDARD_COUNT) + 1);
}

function randomPowerUp() {
  const kinds = Object.keys(POWERUPS);
  return createPiece(POWER_TYPE, kinds[Math.floor(Math.random() * kinds.length)]);
}
