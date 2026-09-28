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

Classic `<script>` files (no ES modules, so `file://` still works) loaded in order by `index.html`, sharing the global scope: `pieces.js` (board constants, `COLORS`, `PIECES`, `createPiece`/`randomPiece`) → `audio.js` (Web Audio `sfx`, lazy `AudioContext`, `muted`) → `scoring.js` (pure `evaluateClear`, no DOM — testable with Node `vm`) → `powerups.js` (pure board effects, mutate the board passed in) → `modes.js` (`MODES` config + pure goal/garbage helpers) → `abilities.js` (energy constants + `ABILITIES` list) → `records.js` (pure local high-score helpers over `localStorage` key `tetris-records`, every access in try/catch — testable with Node `vm`) → `game.js` (state, loop, input, drawing).

Key conventions that span multiple functions:

- **Cell values are piece types.** `board` is a `ROWS × COLS` matrix of `0` (empty) or `1–7`. The numbers inside each `PIECES` shape matrix are that piece's type, which doubles as the index into `COLORS`. `merge()` copies shape values straight into the board, so adding/reordering pieces requires keeping `PIECES` and `COLORS` indices aligned (`T_TYPE`, `SINGLE_TYPE`, `HOLLOW_TYPE`, `POWER_TYPE`, `PENTOMINO_TYPES` and `STANDARD_COUNT` in `pieces.js` name the indices; `randomPiece()` only draws 1–7 plus occasional 8–10/12 — the single (11) is only queued after a Tetris and the power-up (13) every `POWERUP_EVERY` lines, both via `nextPiece()`). All shapes must fit in 4×4 for the previews.
- **`collide(shape, ox, oy)`** is the single source of truth for movement, rotation, gravity, ghost projection (`ghostY`), and game-over detection (a freshly `spawn()`ed piece that already collides triggers `endGame()`). Cells with negative `y` are allowed while moving, but a piece that locks with cells above row 0 (possible when garbage pushes it up) ends the game via `lockedOut()` — `merge()` would otherwise write to `board[-1]`.
- **Game loop and game over:** `endGame()` cancels the pending frame, but `loop()` must also stop itself: it bails out early when `gameOver || paused`, and returns without re-scheduling when a gravity lock triggers game over. Otherwise the loop keeps locking the colliding spawn and stacks pieces behind the overlay.
- **`lockPiece()` is the single place scoring happens:** it checks `isTSpin()` before `merge()`, captures `level` before `clearLines()` (which now only updates lines/level/speed and returns the count), calls `evaluateClear()`, then resets `holdUsed`, redraws hold and calls `updateHUD()` (gravity locks don't go through the keydown handler).
- **Power-ups:** a piece with `power` set (type `POWER_TYPE`, 1×1) is **never merged**; `lockPiece()` calls `applyPowerUp(board, kind, x, y)` instead, then clears lines and scores as usual. Freeze sets `freezeUntil`, which `loop()` honours by zeroing `dropAccum`, and `togglePause()` shifts it by the paused time.
- **Upcoming pieces:** `queue` (length `QUEUE_SIZE`) replaces a single `next`; `queue[0]` is the NEXT preview. `spawn()` shifts it, puts a pending power-up/single at the front, and refills with `randomPiece()`.
- **Startup & menus:** the game doesn't start on load; `showModeMenu()` runs first and `selectMode()` calls `init()`. While `modeMenuOpen`/`abilityMenuOpen`, the keydown handler only handles menu keys. The ability menu sets `paused` and uses `suspend()`/`resume()`; `resume()` shifts every `*Until` timer (`freezeUntil`, `slowUntil`, `previewUntil`) by the suspended time — add new timed effects there.
- **Goals:** `checkGoalNow()` runs after each lock and every frame in `loop()` (time-based goals); it ends the game via `endGame(title, won)`, and `loop()` returns without re-scheduling when that happens.
- **Undo:** `lockPiece()` calls `takeSnapshot()` first (board copy, score/lines/level, hold, queue as `{type, power}` specs…); `restoreSnapshot()` rebuilds pieces with `createPiece()`. Rising garbage clears the snapshot. Energy is not part of the snapshot.
- **Garbage cells** are `GARBAGE_TYPE` (14): a `COLORS` entry with no `PIECES` entry. Tint never targets them.
- **Hold:** `hold` stores `{ type, power }` (not a bare type) so power-ups survive a hold. `holdUsed` is reset in `lockPiece()`, not `spawn()`, because `holdPiece()` also calls `spawn()`. A piece out of hold is rebuilt with `createPiece()` (spawn position/rotation).
- **Records:** `tetris-records` stores `{ top: [{name, score, lines, mode, date}] (max `RECORDS_MAX`, desc), bestCombo, maxLines }`. `maxCombo` is tracked per run in `lockPiece()`. `endGame()` (guarded against running twice) calls `showEndRecords()`: best combo / max lines are saved immediately; if `recordRank()` ≥ 0 (score > 0, ties go below) it sets `pendingRecord` and shows the name form, which `submitRecord()` saves (also called from `init()`/`showModeMenu()` so leaving the screen keeps the score). The keydown handler ignores events whose target is an `<input>`. `togglePause()` reuses `#overlay`, so it calls `hideEndRecords()`. Names are rendered only via `textContent`.
- **T-spin flag:** `lastMoveRotate` is set by a successful rotation and cleared by any lateral move, gravity/soft-drop step, or a hard drop that descends ≥1 row.

## Coupled constants

If you change `COLS`, `ROWS`, or `BLOCK` in `game.js`, update the `<canvas id="board">` `width`/`height` in `index.html` to `COLS × BLOCK` by `ROWS × BLOCK`. `#next-canvas` and `#hold-canvas` (120×120) assume a 4×4 grid of 30px cells (`size` 30 in `drawPreview`). `#queue-canvas` (60×240) is 4 pieces × a 4×4 box of 15px cells.

Controls are documented both in `index.html` (side panel) and `README.md`; keep them in sync with the `keydown` handler.

## CI

GitHub Actions in `.github/workflows/` all use `anthropics/claude-code-action@v1` with the `CLAUDE_CODE_OAUTH_TOKEN` secret: `claude.yml` (`@claude` mentions), `claude-code-review.yml` (PR review), and `claude-issue-triage.yml` (on issue opened/edited, Claude writes `triage/labels.txt` + `triage/diagnosis.md`; a shell step applies only labels in `ALLOWED_LABELS` and upserts a single comment marked `<!-- claude-triage -->`). New labels must be added to `ALLOWED_LABELS` and created in the repo.
