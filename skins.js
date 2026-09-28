'use strict';

// Visual skins. Depends on pieces.js (COLORS). Each skin's `colors` array is
// indexed by cell/piece type exactly like COLORS (0 = empty … 13 power-up,
// 14 garbage), so it must stay aligned with COLORS/PIECES. `draw` paints one
// cell at pixel (px, py) with side `size`; globalAlpha is set by the caller.
// Board background / grid colour overrides live in style.css
// (body[data-skin="…"]); skins without them keep the theme's CSS vars.

const SKIN_KEY = 'tetris-skin';
const DEFAULT_SKIN = 'retro';

function skinRoundRect(context, x, y, w, h, r) {
  context.beginPath();
  if (context.roundRect) {
    context.roundRect(x, y, w, h, r);
    return;
  }
  // fallback for browsers without CanvasRenderingContext2D.roundRect
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

const SKINS = {
  retro: {
    name: 'Retro',
    colors: COLORS,
    // flat square with a thin top highlight (the original look)
    draw(context, px, py, size, color) {
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(px + 1, py + 1, size - 2, 4);
    },
  },

  neon: {
    name: 'Neon',
    colors: [
      null,
      '#00f5ff', // I
      '#fff200', // O
      '#d400ff', // T
      '#39ff14', // S
      '#ff073a', // Z
      '#1f51ff', // J
      '#ff8c00', // L
      '#ff2bd6', // +
      '#00ffc3', // U
      '#c6ff00', // Y
      '#9ec9ff', // single
      '#ff9e5e', // hollow
      '#ffffff', // power-up
      '#5a5a78', // garbage
    ],
    // glowing outline with a dark core; save/restore keeps the shadow local
    draw(context, px, py, size, color) {
      context.save();
      context.shadowColor = color;
      context.shadowBlur = size * 0.5;
      context.fillStyle = color;
      context.fillRect(px + 2, py + 2, size - 4, size - 4);
      context.shadowBlur = 0;
      const inset = Math.max(3, Math.round(size * 0.18));
      context.fillStyle = 'rgba(0,0,0,0.55)';
      context.fillRect(px + inset, py + inset, size - inset * 2, size - inset * 2);
      context.restore();
    },
  },

  pastel: {
    name: 'Pastel',
    colors: [
      null,
      '#a8e6ef', // I
      '#fdf0a6', // O
      '#d7b8e8', // T
      '#b9e4c0', // S
      '#f5b7b1', // Z
      '#aecbfa', // J
      '#fcd3a8', // L
      '#f8bbd9', // +
      '#a8dcd4', // U
      '#e6efb0', // Y
      '#cfd8dc', // single
      '#d7c4bb', // hollow
      '#eceff1', // power-up
      '#b8b8c4', // garbage
    ],
    // rounded tile with a soft light border
    draw(context, px, py, size, color) {
      const r = size * 0.25;
      skinRoundRect(context, px + 1.5, py + 1.5, size - 3, size - 3, r);
      context.fillStyle = color;
      context.fill();
      context.lineWidth = Math.max(1, size / 15);
      context.strokeStyle = 'rgba(255,255,255,0.75)';
      context.stroke();
    },
  },

  pixel: {
    name: 'Pixel art',
    colors: [
      null,
      '#3cbcfc', // I
      '#f8b800', // O
      '#9c27b0', // T
      '#00a800', // S
      '#d82800', // Z
      '#0058f8', // J
      '#e45c10', // L
      '#e40058', // +
      '#008888', // U
      '#88d800', // Y
      '#7c7c7c', // single
      '#ac7c00', // hollow
      '#bcbcbc', // power-up
      '#585858', // garbage
    ],
    // base fill + chunky bevel (light top/left, dark bottom/right) + dither dots
    draw(context, px, py, size, color) {
      const p = Math.max(1, Math.floor(size / 10)); // 3 px at 30, 1 px at 15
      const n = Math.floor(size / p);
      context.fillStyle = color;
      context.fillRect(px, py, size, size);
      context.fillStyle = 'rgba(255,255,255,0.45)';
      context.fillRect(px, py, size - p, p);
      context.fillRect(px, py, p, size - p);
      context.fillStyle = 'rgba(0,0,0,0.4)';
      context.fillRect(px + p, py + size - p, size - p, p);
      context.fillRect(px + size - p, py + p, p, size - p);
      context.fillStyle = 'rgba(0,0,0,0.18)';
      for (let i = 2; i < n - 2; i += 2)
        for (let j = 2; j < n - 2; j += 2)
          if ((i + j) % 4 === 0) context.fillRect(px + i * p, py + j * p, p, p);
      context.fillStyle = 'rgba(255,255,255,0.6)';
      context.fillRect(px + p * 2, py + p * 2, p, p);
      context.strokeStyle = 'rgba(0,0,0,0.6)';
      context.lineWidth = 1;
      context.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
    },
  },
};

const SKIN_ORDER = Object.keys(SKINS);

function loadSkin() {
  try {
    const saved = localStorage.getItem(SKIN_KEY);
    return SKINS[saved] ? saved : DEFAULT_SKIN;
  } catch {
    return DEFAULT_SKIN;
  }
}

function saveSkin(id) {
  try {
    localStorage.setItem(SKIN_KEY, id);
  } catch {
    // storage unavailable (private mode, blocked cookies): keep it in memory
  }
}
