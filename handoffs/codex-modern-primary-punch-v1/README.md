# Codex Creative Handoff — Modern Primary Punch Restyle v1

## CRITICAL: canonical branch, route, and shared-agent workflow

Work on **Word Kingdom `/v3` only** unless the owner explicitly requests another version. The production Worker is **`wordkingdom-prod`** and the canonical player URL is **https://wordkingdom-prod.inspectorkush1.workers.dev/v3**. The shared repository is **`aicompanion13/wordkingdom`**; the shared deployment branch is **`claude/game-access-5fn1b6`**. Codex and Claude share this branch—inspect the latest remote head and reconcile before every edit; never force-push, reset away, or silently overwrite newer collaborator commits. After validation, commit and push the complete intended change so both agents use the same canonical source, then confirm the `wordkingdom-prod` `/v3` deployment.

This is a **creative-only handoff**. Codex did not modify game code or live public assets. Claude should integrate into `/v3`.

## Direction implemented

The medieval royal-blue/gold/parchment chrome is replaced with the approved **Primary Punch** system from `optioncmodernreference.png`:

- Saturated blue gradients (`#2F6BFF` → `#1B4FDB`).
- Glossy red controls (`#FF3B3B` → `#E82A2A`).
- Glossy gold-yellow badges (`#FFC72C` → `#FFB23D`).
- White and very-light-blue readout surfaces.
- Multi-stop gradients and upper-left glass highlights.
- Soft-looking diffuse elevation rendered into opaque pixels.
- Generous smooth rounding and thin/no hard outlines.
- No parchment, heraldry, crown icons, gems, filigree, rivets or medieval rails.
- No flat retro shapes, thick uniform cartoon outlines or hard offset sticker shadows.

The top stack remains three independent pieces with normal spacing; nothing is welded.

## Part 1 — Modern chrome assets

All files are under `chrome/`.

### Resource bars

- `resource-bar-primary-hub.png` — 1819×276; six regions: profile, coins, shop `+`, energy, stars, settings.
- `resource-bar-primary-board.png` — 1819×276; adds the red back button before the profile.
- Resource fields are blank. Portrait and icons are intentionally illustrated; all values remain runtime text.
- Recommended runtime value color: `#123A9C`.

### Kingdom identity

- `kingdom-banner-primary-calm.png` — 2048×256.
- `kingdom-banner-primary-urgent.png` — identical geometry with a deeper urgent-red timer treatment.
- Runtime name sits in the blue pill, level in the yellow sphere, timer in the red pill.
- Suggested text: name `#FFFFFF`, level `#8F5600`, timer `#FFFFFF`.
- No back button; navigation lives in the board resource bar.

### Word tray and pills

- `word-tray-primary.png` — 2038×527; uninterrupted pale-blue scrolling runway.
- `word-pill-idle.png` — 1800×506; white/light-blue.
- `word-pill-found.png` — 1800×506; saturated blue with checkmark.
- `word-pill-directed.png` — 1800×506; white/light-blue with focused cyan edge.
- Use deep blue runtime text on idle/directed and white on found.

## Part 2 — Localization-safe announcement banners

All files are under `announcement-banners/`, standardized to **1200×480 (2.5:1)**:

- `great-word.png` — yellow checkmark burst.
- `royal-combo.png` — interlocking chain links.
- `bonus-found.png` — gift/coin motif.
- `keep-going.png` — forward chevrons.
- `on-fire.png` — flame motif.
- `one-more.png` — single star flag; runtime copy should be **“One Last Word!”**.
- `hurry-up.png` — urgent alarm-clock treatment.

The production images are blank. All messages must render as runtime text.

### Shared runtime text-safe zone

- Position: **x 22%, y 22%**.
- Size: **72% width × 56% height**.
- At 1200×480: **x 264px, y 106px, width 864px, height 269px**.
- The safe zone is the white inner pill and is unobstructed in every variant.
- Recommended text color: `#123A9C`.
- Center horizontally and vertically; allow up to two lines for long translations.
- Keep at least 8% internal text padding within this safe box when calculating dynamic font size.
- `announcement-safe-zone.json` contains the same values for implementation.

The existing `level-up` and `shield-ready` kinds were outside this brief and are intentionally not replaced here.

## Phone mocks

- `mock-hub-primary-390px.png` — hub resource bar with sample runtime values.
- `mock-board-primary-390px.png` — board resource bar, identity banner and word tray with normal spacing.
- `mock-announcements-runtime-text-390px.png` — Great Word, Bonus Found and Hurry Up with sample runtime text.

Mock copy is illustrative only and is not baked into production assets.

## Technical QA

- 15 production PNGs.
- Every production asset has real alpha.
- Every alpha histogram contains exactly `0` and `255`; no semi-transparent pixels.
- `alpha-report.json` contains per-file dimensions and alpha histograms.
- `qa-magenta/` contains `#FF00FF` composites for all 15 assets.
- No production file contains baked text, numbers, labels or pseudo-text.

## Claude integration guidance

1. Reconcile `origin/claude/game-access-5fn1b6` before editing.
2. Integrate into `/v3` only.
3. Convert PNGs to WebP with alpha-safe settings; do not flatten over white.
4. Preserve three independent layout pieces with normal responsive spacing; do not weld them.
5. Preserve all existing hit targets and accessibility labels.
6. Keep all values and labels as runtime DOM text.
7. Move the board navigation hit target to the far-left red back control.
8. Preserve horizontal scrolling for 1–8 word pills.
9. Replace the six listed announcement textures and add `hurry-up`; render localized copy within the shared safe zone.
10. Rename the runtime `one-more` English message to “One Last Word!”.
11. Test long German/Finnish strings using two-line fitting inside the safe zone.
12. Verify at 360×740 and 390px phones plus the desktop cap.
13. Commit and push integration to `claude/game-access-5fn1b6`, then confirm https://wordkingdom-prod.inspectorkush1.workers.dev/v3.

## Generation record

Mode: built-in ImageGen with `ui-mockup` production-raster prompts and targeted `precise-object-edit` passes for the neutral coin icons. Primary style reference: `optioncmodernreference.png`. Functional references: current live resource bar, the previous independent top-stack handoff and current announcement motifs. Outputs were normalized, separated, cleaned, masked where needed and hardened to binary alpha.

