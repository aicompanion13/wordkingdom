# Codex Creative Handoff — Bubble Candy Kingdom Tile Board v1

## Critical routing note

Integrate into **Word Kingdom `/v3` only**. Production Worker: `wordkingdom-prod`.
Canonical player URL: https://wordkingdom-prod.inspectorkush1.workers.dev/v3
Repository: `aicompanion13/wordkingdom`. Shared deployment branch:
`claude/game-access-5fn1b6`. Reconcile the latest remote head before integration;
never force-push or overwrite newer collaborator commits.

This folder is a **creative-only delivery**. No files under `app/` or `game/` were
changed.

## Deliverables

- `board-card-frame.png` — 1024×1536 glossy pale-blue card body with blue rim and
  cyan side badges. Opaque interior; transparent exterior.
- `grid-frame-overlay.png` — 1536×1536 transparent overlay. The required center
  opening is explicitly cleared at x `49–1487`, y `77–1439`.
- `tile-idle.png` — 512×512 reusable idle tile sprite.
- `tile-selected.png` — 512×512 matching selected/drag-state sprite.
- `mock-board-390px.png` — 390px-wide context mock with the existing resource bar,
  kingdom banner, word tray, full 8×7 (56-tile) grid, and selected path.
- `qa-magenta/` — magenta composites for edge/transparency review.
- `alpha-report.json` — dimensions and alpha histograms.
- `GENERATION-PROMPTS.txt` — final built-in ImageGen prompt set.

## Integration notes for Claude

- Keep all letters and instructional copy live. The delivered production assets contain
  no baked text.
- Use `grid-frame-overlay.png` above the real grid; do not place it inside the tile flow.
- The overlay opening contract matches the current 1536px frame geometry.
- Use `tile-idle.png` and `tile-selected.png` as repeating backgrounds. Continue to
  render attack, steal, raid, shield, and hint states in CSS.
- Suggested new power accents: attack `#ff4b55`, steal `#9b62e8`, raid `#ffc43f`,
  shield `#32a7f0`, hint focus `#6de3ff`.
- Every production asset has binary alpha only (`0` or `255`).

## Visual direction

Glossy modern candy-cartoon construction: saturated blue, clean white/ice-blue faces,
small warm-gold accents, cyan glass gems, soft visual elevation, and top-left lighting.
The set intentionally avoids medieval filigree, parchment, heavy gold framing, and flat
sticker rendering.
