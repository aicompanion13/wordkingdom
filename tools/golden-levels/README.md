# Authored golden levels

Golden levels are explicit, deterministic state graphs played by the Phase 1A `CanonicalBoardModel`. They do not generate, retry, reshuffle, refill, or repair branches at runtime.

`build-golden-level-1.mjs` compiles the deliberately authored Level 1 blueprint into `game/v3/data/golden-levels/golden_01.json`. Board hashes are derived with the shared FNV-1a canonical-grid hash; authors do not enter them manually.

Every settled state stores its exact active, queued and completed objectives, expected board hash, and one branch for every selectable objective. Every branch records its exact path, minimal transformation map, successor state, local continuity, remote attention target, and expected successor hash.

## 3×3 zone contract

Rows and columns use the same hard `3-2-3` bands:

- band 1: cells `0–2`
- band 2: cells `3–4`
- band 3: cells `5–7`

A placement's primary zone is calculated from the arithmetic centre of its path. A centre exactly on a boundary (`2.5` or `4.5`) belongs to the lower-numbered band. This rule is implemented once in `game/v3/golden-level-contract.js` and shared by authoring, runtime diagnostics, verification and tests.

Run `tools/golden-levels/verify-golden-level-1.mjs` to exhaustively traverse the authored state graph. Verification fails on missing branches, stale hashes, invalid transformations, missing or duplicate targets, premature inactive targets, completed targets that remain collectible, unsupported directions, dead boards, recovery use, zone-rule violations, determinism failures, and incorrect completion.
