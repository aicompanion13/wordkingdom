# Codex Creative Handoff — Unified Top Bar System v1

## CRITICAL: canonical branch, route, and shared-agent workflow

Work on **Word Kingdom `/v3` only** unless the owner explicitly requests another version. The production Worker is **`wordkingdom-prod`** and the canonical player URL is **https://wordkingdom-prod.inspectorkush1.workers.dev/v3**. The shared repository is **`aicompanion13/wordkingdom`**; the shared deployment branch is **`claude/game-access-5fn1b6`**. Codex and Claude share this branch—inspect the latest remote head and reconcile before every edit; never force-push, reset away, or silently overwrite newer collaborator commits. After validation, commit and push the complete intended change so both agents use the same canonical source, then confirm the `wordkingdom-prod` `/v3` deployment.

This folder is a **creative-only handoff**. No game code or live public asset was changed by Codex. Claude should integrate the new resource bar into `/v3`.

## Art-direction decision

The new resource bar is the anchor piece. Its blue side rails, gold corner caps, cream readout plates, turquoise gems, top-left lighting, and rounded construction now match the already-live kingdom banner and word tray.

The existing banner and tray passed the zero-gap seam test without modification, so their production artwork is carried forward unchanged. This avoids unnecessary drift in assets already integrated and validated.

## Production assets

### New resource HUD

- `word-kingdom-topbar-unified-v1.png` — 1819×276, preserving the current ~6.59:1 contract.
- Six live regions remain in order: circular profile, coins, shop `+`, energy/hearts, stars, settings.
- Resource readout fields are blank. All values remain runtime text.
- The top and sides are fully finished for standalone hub use.
- The bottom has a continuous gold rivet rail and centered turquoise connector. It reads as a finished stopping edge on the hub and as the upper seam connector on the board.

### Carried forward unchanged

- `kingdom-identity-banner-calm.png` — 2048×256.
- `kingdom-identity-banner-urgent.png` — 2048×256.
- `word-tray-frame.png` — 2038×527.
- `word-slot-idle.png` — 1800×506.
- `word-slot-found.png` — 1800×506.
- `word-slot-directed.png` — 1800×506.

These copies are included only to give Claude a self-contained unified-system package. The currently integrated banner and tray do not need replacement if they are byte-equivalent after WebP conversion.

## Mocks

- `mock-hub-resource-bar-390px.png` — standalone hub treatment with illustrative runtime values.
- `mock-board-full-stack-390px.png` — resource bar, banner, and tray stacked at zero visual gap in calm and urgent states.
- Mock text and values are illustrative only and are not baked into the production textures.

## Technical QA

- All seven production PNGs have real alpha.
- Alpha values are strictly **0 or 255**; there are no semi-transparent edges.
- `alpha-report.json` contains width, height, and alpha histograms for every production asset.
- `qa-magenta/` contains `#ff00ff` composites for edge inspection.
- No runtime text, numbers, resource values, or labels are baked into production assets.
- Icons and the prince portrait are intentionally illustrated into the resource HUD, matching the existing implementation contract.

## Claude integration guidance

1. Reconcile the latest `origin/claude/game-access-5fn1b6` before editing.
2. Convert `word-kingdom-topbar-unified-v1.png` to WebP using the same lossless/alpha-safe process as the current topbar.
3. Replace only `/public/topbar/word-kingdom-topbar-v2.webp` or introduce a versioned v3 filename and update `/v3` references.
4. Keep all resource values as runtime DOM text and preserve current hit areas/accessibility labels.
5. On the board, stack resource bar → kingdom banner → word tray with zero CSS gap. Do not merge them into one texture.
6. On the hub/map, render the resource bar alone; do not add a filler seam below it.
7. Align all three pieces to the same rendered outer width. Avoid independently applying horizontal padding to the middle segment.
8. Verify 360×740 and 390px phone widths plus the existing 920px desktop cap.
9. Verify calm and urgent banner switching, 1–8 tray slots, long resource values, and settings/profile hit targets.
10. Commit and push the complete integration to `claude/game-access-5fn1b6`, then confirm https://wordkingdom-prod.inspectorkush1.workers.dev/v3.

## Generation record

Mode: built-in ImageGen, `ui-mockup` production-raster workflow. Reference inputs: the previous topbar, current live kingdom banner, current live word tray, Level Complete panel, and closed chest. The final prompt preserved the six functional regions and iconography while matching the live banner/tray rails, palette, rounded construction, turquoise seam motif, blank runtime fields, and top-left lighting. ImageGen's backdrop was deterministically extracted, the output was normalized to 1819×276, and alpha was hardened to exactly 0/255.

