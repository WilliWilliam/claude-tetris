# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Classic Tetris in vanilla JavaScript + HTML5 Canvas + CSS. No dependencies, no `package.json`, no build step, no tests, no linter. The UI text and README are in Spanish — keep user-facing strings in Spanish.

## Running

Open `index.html` directly, or serve the folder statically (preferred):

```bash
python3 -m http.server 8000   # then http://localhost:8000
```

There is no test suite; verify changes by playing the game in a browser.

## Architecture

Three files: `index.html` (DOM, two canvases, HUD, overlay), `style.css` (dark/retro theme), and `game.js` (all logic, loaded as a classic non-module script with `'use strict'`).

`game.js` uses module-level mutable globals (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `animId`, …) that `init()` resets; the restart button just calls `init()`.

Key conventions that span multiple functions:

- **Cell values are piece types.** `board` is a `ROWS × COLS` matrix of `0` (empty) or `1–7`. The numbers inside each `PIECES` shape matrix are that piece's type, which doubles as the index into `COLORS`. `merge()` copies shape values straight into the board, so adding/reordering pieces requires keeping `PIECES` and `COLORS` indices aligned (and `randomPiece()` hardcodes `* 7`).
- **Pieces** are `{ type, shape, x, y }`; `shape` is a square matrix rotated by `rotateCW` (transpose + reverse). `tryRotate` applies simple horizontal wall kicks `[0, -1, 1, -2, 2]` — not SRS.
- **`collide(shape, ox, oy)`** is the single source of truth for movement, rotation, gravity, ghost projection (`ghostY`), and game-over detection (a freshly `spawn()`ed piece that already collides triggers `endGame()`). Cells with negative `y` are allowed.
- **Lock sequence:** `lockPiece()` → `merge()` → `clearLines()` (updates lines, score, level, and `dropInterval = max(100, 1000 − (level−1)·90)`) → `spawn()`.
- **Game loop:** `loop()` runs on `requestAnimationFrame`, accumulates `dt` into `dropAccum`, and drops one row per `dropInterval`. Pause/game-over stop it via `cancelAnimationFrame(animId)`. Note: when a gravity lock inside `loop()` causes game over, `endGame()` cancels the frame but `loop()` then re-schedules itself afterwards — be aware of this when touching loop/game-over logic.
- **Rendering** is full redraw each frame (`draw()`: grid → board → ghost at `alpha 0.2` → current piece) via the shared `drawBlock(context, x, y, colorIndex, size, alpha)`, also used by `drawNext()` for the 4×4 preview canvas.

## Coupled constants

If you change `COLS`, `ROWS`, or `BLOCK` in `game.js`, update the `<canvas id="board">` `width`/`height` in `index.html` to `COLS × BLOCK` by `ROWS × BLOCK`. The `#next-canvas` (120×120) assumes a 4×4 grid of 30px cells (`NB` in `drawNext`).

Controls are documented both in `index.html` (side panel) and `README.md`; keep them in sync with the `keydown` handler.
