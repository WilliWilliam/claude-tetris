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

Key conventions that span multiple functions:

- **Cell values are piece types.** `board` is a `ROWS × COLS` matrix of `0` (empty) or `1–7`. The numbers inside each `PIECES` shape matrix are that piece's type, which doubles as the index into `COLORS`. `merge()` copies shape values straight into the board, so adding/reordering pieces requires keeping `PIECES` and `COLORS` indices aligned (and `randomPiece()` hardcodes `* 7`).
- **`collide(shape, ox, oy)`** is the single source of truth for movement, rotation, gravity, ghost projection (`ghostY`), and game-over detection (a freshly `spawn()`ed piece that already collides triggers `endGame()`). Cells with negative `y` are allowed.
- **Game loop and game over:** `endGame()` cancels the pending frame, but `loop()` must also stop itself: it bails out early when `gameOver || paused`, and returns without re-scheduling when a gravity lock triggers game over. Otherwise the loop keeps locking the colliding spawn and stacks pieces behind the overlay.

## Coupled constants

If you change `COLS`, `ROWS`, or `BLOCK` in `game.js`, update the `<canvas id="board">` `width`/`height` in `index.html` to `COLS × BLOCK` by `ROWS × BLOCK`. The `#next-canvas` (120×120) assumes a 4×4 grid of 30px cells (`NB` in `drawNext`).

Controls are documented both in `index.html` (side panel) and `README.md`; keep them in sync with the `keydown` handler.

## CI

GitHub Actions in `.github/workflows/` all use `anthropics/claude-code-action@v1` with the `CLAUDE_CODE_OAUTH_TOKEN` secret: `claude.yml` (`@claude` mentions), `claude-code-review.yml` (PR review), and `claude-issue-triage.yml` (on issue opened/edited, Claude writes `triage/labels.txt` + `triage/diagnosis.md`; a shell step applies only labels in `ALLOWED_LABELS` and upserts a single comment marked `<!-- claude-triage -->`). New labels must be added to `ALLOWED_LABELS` and created in the repo.
