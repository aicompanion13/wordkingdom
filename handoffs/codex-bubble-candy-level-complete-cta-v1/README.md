# Codex Creative Handoff — Bubble Candy Kingdom Level Complete + CTA v1

## Critical routing note

Integrate into **Word Kingdom `/v3` only**. Production Worker: `wordkingdom-prod`.
Canonical player URL: https://wordkingdom-prod.inspectorkush1.workers.dev/v3
Repository: `aicompanion13/wordkingdom`. Shared deployment branch:
`claude/game-access-5fn1b6`. Reconcile the latest remote head before integration;
never force-push, reset away, or silently overwrite newer collaborator commits.

This is a **creative-only delivery**. No files under `app/` or `game/` were changed.

## Production assets

- `panel.png` — 923×1521 blank Level Complete panel body.
- `star-gold.png` — 448×477 single earned-star icon, matching the existing tall socket ratio.
- `reward-coin.png` — 452×485 blank/runtime reward-row coin icon.
- `reward-hint.png` — 1254×1254 royal hint lightbulb icon.
- `reward-card.png` — 455×567 card-pack reward icon.
- `chest-closed.png` and `chest-open.png` — 582×642 paired states with a common canvas and bottom alignment; open state contains nothing.
- `primary-cta-idle.png` and `primary-cta-pressed.png` — 1200×360 blank CTA states with the same canvas contract.
- `mock-level-complete-cta-390px.png` — 390px-wide runtime-text context sheet showing the requested states.
- `qa-magenta/` — magenta composites for every production asset.
- `alpha-report.json` — exact dimensions and alpha histograms.
- `GENERATION-PROMPTS.txt` — built-in ImageGen production prompt set.

## Panel geometry

The production panel retains the existing runtime layout contract closely:

- title: centered around y `21.4%`
- star row: y `31.74%`, x `26.06 / 50.11 / 74.21%`
- stat header rows: y `42.5%` and `56.9%`
- hints header: y `71.2%`
- reward ribbon: y `83%`
- reward cells: x `25.5 / 49.7 / 74.2%`, row centered near y `90%`

Claude should verify the live runtime text against the new socket contours, but the existing
percentage coordinates are the intended starting point. No CSS or TSX was changed here.

## Integration notes for Claude

- Convert the PNGs to WebP without changing canvas dimensions or alpha bounds.
- Keep all titles, labels, values, amounts, and CTA copy as runtime text.
- The empty star sockets are intentionally complete-looking at 0–2 stars.
- When the reward row is hidden, leave the panel artwork unchanged; the blank ribbon/cells
  remain a deliberate structural footer rather than a broken state.
- `chest-open.png` is empty by design. Runtime rewards clear the chest and reveal separately.
- CTA pressed state is already compressed and darkened; do not add a second baked press offset.
- All production textures use binary alpha only (`0` or `255`).

## Visual direction

The panel uses glossy white/ice surfaces, saturated candy-blue structure, multicolor stat
chips, restrained warm-yellow accents, broad top-left sheen, and soft toy-like elevation.
The primary CTA is coral/cherry red so it remains the single dominant action against the
blue interface family. The medieval crown shell, parchment field, dense gold brackets, and
micro-bevel metal finish were intentionally removed.
