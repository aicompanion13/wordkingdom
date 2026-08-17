# Codex Creative Handoff — Universal Kingdom Banner + Word Tray v1

## CRITICAL: canonical branch, route, and shared-agent workflow

Work on **Word Kingdom `/v3` only** unless the owner explicitly requests another version. The production Worker is **`wordkingdom-prod`** and the canonical player URL is **https://wordkingdom-prod.inspectorkush1.workers.dev/v3**. The shared repository is **`aicompanion13/wordkingdom`**; the shared deployment branch is **`claude/game-access-5fn1b6`**. Codex and Claude share this branch—inspect the latest remote head and reconcile before every edit; never force-push, reset away, or silently overwrite newer collaborator commits. After validation, commit and push the complete intended change so both agents use the same canonical source, then confirm the `wordkingdom-prod` `/v3` deployment.

This folder is a **creative-only handoff**. It does not change game code or replace live assets. Claude should integrate from this folder into `/v3`.

## Approved direction

One universal banner system and one universal tray system for all kingdoms. Runtime UI supplies all kingdom names, level numbers, countdown values, and word text. None of that text is baked into the production textures.

## Production assets

### Kingdom identity banner

- `kingdom-identity-banner-calm.png` — default/calm state, 2048×256 (8:1).
- `kingdom-identity-banner-urgent.png` — identical geometry with the timer readout in urgent red, 2048×256.
- The banner includes the back-arrow affordance, blank kingdom-name plate, blank level socket, and integrated blank timer field.
- Use one asset at a time; switch to the urgent asset at the existing low-time threshold. Keep the current runtime timer pulse if desired.
- Runtime name examples: `Coral Kingdom`, `Forest Kingdom`.
- Runtime level supports 1–25; center one- or two-digit values inside the circular cream socket.
- Recommended phone render width: container width minus 10–20px, capped by the existing 920px layout. At 360px wide, the asset renders 45px tall.

### Word tray

- `word-tray-frame.png` — fixed tray viewport shell, 2038×527 (matches the current 3.87:1 contract).
- The deep-blue inner runway is deliberately uninterrupted. It should be the clipped viewport for the existing horizontal slot scroller.
- Keep slot count behavior at 1–8. Do not paint or stretch wells into the shell.

### Repeatable word-slot states

- `word-slot-idle.png` — cream/parchment idle state, 1800×506.
- `word-slot-found.png` — gold illuminated found state, 1800×506.
- `word-slot-directed.png` — cream state with cyan/gold directed highlight, 1800×506.
- All three assets have identical geometry and blank centers. Runtime text remains separate.
- Use the directed state for the tutorial/attention target. It is visually distinct from the completed found state.

## Mocks (reference only)

- `mock-banner-phone-390px.png` — calm and urgent examples with runtime text/values.
- `mock-word-tray-phone-390px.png` — idle and found examples with runtime word text.
- Text in the mocks is illustrative only; mocks are not production textures.

## Technical QA

- Production PNGs have real alpha.
- Every production pixel is alpha **0 or 255**; there are no semi-transparent edge columns.
- `alpha-report.json` contains the measured dimensions and alpha counts.
- `qa-magenta/` composites each production asset over `#ff00ff` for edge inspection.
- No production texture contains text, letters, numbers, labels, or pseudo-text.
- Lighting is consistently top-left and the palette follows the current Level Complete panel, chest, and topbar family.

## Integration notes

1. Reconcile the latest `origin/claude/game-access-5fn1b6` before editing.
2. Integrate into the existing `/v3` banner and `ObjectiveTray` components only.
3. Preserve runtime text and existing accessibility labels.
4. Preserve the current scroll behavior for 3–8 slots and the compact behavior for 1–2 slots.
5. Verify at 360×740 and at the 920px desktop cap.
6. Verify calm/urgent switching, levels 1, 9, 10, and 25, and a long kingdom name.
7. Verify idle, found, and directed slot states with 1–8 words.
8. Commit and push the complete integration to `claude/game-access-5fn1b6`, then confirm `https://wordkingdom-prod.inspectorkush1.workers.dev/v3`.

## Generation record

Mode: ImageGen create, followed by ImageGen background-removal attempts and deterministic production extraction/ratio normalization. References: the live `/v3` Level Complete panel, closed chest, topbar, and existing objective tray system. Final prompts enforced a universal bright Royal Match-like cream/blue/gold style, no kingdom-specific motifs, no baked text, top-left lighting, and transparent isolated raster assets.
