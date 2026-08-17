# Codex Creative Handoff — Three-Piece Top Stack v2

## CRITICAL: canonical branch, route, and shared-agent workflow

Work on **Word Kingdom `/v3` only** unless the owner explicitly requests another version. The production Worker is **`wordkingdom-prod`** and the canonical player URL is **https://wordkingdom-prod.inspectorkush1.workers.dev/v3**. The shared repository is **`aicompanion13/wordkingdom`**; the shared deployment branch is **`claude/game-access-5fn1b6`**. Codex and Claude share this branch—inspect the latest remote head and reconcile before every edit; never force-push, reset away, or silently overwrite newer collaborator commits. After validation, commit and push the complete intended change so both agents use the same canonical source, then confirm the `wordkingdom-prod` `/v3` deployment.

This is a **creative-only handoff**. Codex did not modify game code or live public assets. Claude should integrate these files into `/v3`.

## Direction implemented

The fused-bar approach from v1 is retired. The resource HUD, kingdom banner, and word tray are now three independent cards:

- Each piece is fully finished on all four sides.
- Each has its own rounded silhouette and contained illustrated shadow.
- No connector gem, crown tab, seam rail, or ornament expects a neighboring piece.
- The board mock uses **13px spacing at 390px width** between the three cards.
- Palette, lighting, materials and casual royal construction remain consistent across the family.

## Production assets

### Resource bars

- `resource-bar-hub-v2.png` — 1819×276. This is the currently live approved hub resource bar, exported into the package with hardened 0/255 alpha. Six regions: profile, coins, shop `+`, energy, stars, settings.
- `resource-bar-board-v2.png` — 1819×276. New independent board variant with a seventh back button before the circular profile.
- Both contain blank runtime-value fields. Icons and portrait are intentionally illustrated into the texture.

### Independent kingdom banner

- `kingdom-banner-independent-calm-v2.png` — 2048×256.
- `kingdom-banner-independent-urgent-v2.png` — 2048×256, identical geometry with urgent red timer treatment.
- Contains only the large blank kingdom-name field, blank circular level socket, and blank timer field.
- The back button has been removed and the name field expanded.
- The circular level medal is fully contained; no top or bottom connector tabs remain.

### Independent word tray and bubbles

- `word-tray-independent-v2.png` — 2038×527. Blank uninterrupted runway; no crown or gem protruding above the top edge.
- `word-bubble-idle-v2.png` — 1800×506.
- `word-bubble-found-v2.png` — 1800×506.
- `word-bubble-directed-v2.png` — 1800×506.
- All bubble states share identical geometry and blank centers for runtime words.

## Phone mocks

- `mock-hub-independent-390px.png` — hub resource bar alone.
- `mock-board-three-independent-pieces-390px.png` — board resource bar, banner and tray with normal card spacing, shown in calm and urgent timer states.
- Text and values in mocks are illustrative runtime overlays only.

## Technical QA

- Every production asset uses real alpha.
- Every alpha value is exactly **0 or 255**.
- `alpha-report.json` contains per-file dimensions and alpha histograms.
- `qa-magenta/` contains `#ff00ff` composites for all eight production assets.
- No baked text, resource values, level numbers, timer values or word labels exist in production textures.
- Checkerboard fragments and disconnected pixel islands were removed during production cleanup.

## Claude integration guidance

1. Reconcile the latest `origin/claude/game-access-5fn1b6` before editing.
2. Integrate into `/v3` only; do not restore the reverted welded-header implementation.
3. Keep the current hub bar behavior and use the hub variant without a back button on hub/map screens.
4. Use the board variant on gameplay screens; wire the new far-left back control to the existing kingdom/map navigation.
5. Remove the back button DOM layer from the kingdom banner because it is now represented in the board resource bar.
6. Keep all numeric and textual content as runtime DOM text with existing accessibility labels.
7. Stack the board pieces as separate layout items with approximately **12–14px visual gap at 390px**. Scale the gap responsively; do not use zero gap or negative overlap.
8. Do not merge the three cards into a single texture.
9. Preserve the current 1–8 horizontal slot behavior inside the tray runway.
10. Switch calm/urgent banner images at the existing timer threshold.
11. Verify 360×740 and 390px phones plus the existing desktop cap; test long values, levels 1/9/10/25, long kingdom names, and all three bubble states.
12. Commit and push the complete integration to `claude/game-access-5fn1b6`, then confirm https://wordkingdom-prod.inspectorkush1.workers.dev/v3.

## Generation record

Mode: built-in ImageGen, using `ui-mockup` production-raster prompts and one targeted `precise-object-edit` for the banner medal. References: current live hub topbar, previous approved banner/tray family, Level Complete panel and chest. ImageGen outputs were extracted from their generated backdrop, normalized to the implementation dimensions, cleaned of disconnected pixel islands, and hardened to binary alpha. The urgent banner is a geometry-preserving timer-color variant of the approved calm banner.

