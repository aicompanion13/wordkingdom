# Phase 1C baseline — 2026-07-27

- Automated tests: 49 passed, 0 failed.
- Authored verifier: 25 reachable states, 40 branches, 70 complete move orders.
- TypeScript release check: passed.
- Production build: blocked only by the documented managed-sandbox `spawn EPERM` restriction.
- Temporary development preview: the same `spawn EPERM` restriction prevented launch; the escalation request was rejected because of the workspace's earlier server-process restriction.

Protected SHA-256 hashes before Phase 1C changes:

- `game/v3/data/golden-levels/golden_01.json`: `07FA9B60DDC1D069A9541CAD94619E4DC88BA6920A62980161C0444F1FC0B98E`
- `game/v3/golden-level-contract.js`: `DDB6BB6327F2973D7F20B08DB8115CE5A9915FC55E919AA8CEFC003A2E6F2E46`
- `game/v3/canonical-board-state.ts`: `DAF6CF7E545CD2F596797E4C6D29A03D165B5B82F5052D25E50999BA8863B672`

The 31 normal prototype catalog files also matched the Phase 1C backup byte-for-byte at baseline.
