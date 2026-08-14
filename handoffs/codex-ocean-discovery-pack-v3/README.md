# Ocean Discovery Pack v3 — creative handoff

## Critical routing note

Work on **Word Kingdom `/v3` only**. The production Worker is **`wordkingdom-prod`** and the canonical player URL is **https://wordkingdom-prod.inspectorkush1.workers.dev/v3**. The shared repository is **`aicompanion13/wordkingdom`** and the shared deployment branch is **`claude/game-access-5fn1b6`**. Codex and Claude share this branch: inspect and reconcile the latest remote head before edits; never force-push, reset away, or silently overwrite newer collaborator commits. Validate, commit, push, and confirm the `wordkingdom-prod` `/v3` deployment after integration.

## Scope

Creative-only replacement for `public/tutorial/ocean-discovery-pack-v2.png`. Claude owns integration. Do not use this handoff to modify another game version.

## Files

- `ocean-discovery-pack-v3.png` — flat production PNG, `1207×1303`, transparent background.
- `ocean-pack-vs-chest-phone-178x196.png` — true phone-scale side-by-side comparison; both assets rendered in `178×196` boxes.

## Verified production properties

- Canvas: `1207×1303`.
- Visible pouch ratio: `0.9302` width/height.
- Alpha extrema: `0–255`.
- Every nontransparent pixel is exactly alpha `255`; no partially transparent edge columns.
- Verified over `#ff00ff` magenta.
- No embedded text.
- Closed pack only; no open animation state.
- Top-left key light.
- Motifs retained: pearl, scallop shell, coral, teal seaweed, bubbles.
- Wrapper crimping and zigzag seams removed.

## Integration note

Replace the current discovery-pack visual only after owner approval. Preserve the existing runtime footprint and interaction. Convert to WebP during integration if desired, then re-check alpha after conversion.
