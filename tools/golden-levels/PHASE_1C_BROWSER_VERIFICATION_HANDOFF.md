# Phase 1C browser-verification handoff

## Recorded status

> Implementation and automated verification complete; browser, touch, responsive-layout and animation verification outstanding due to the restricted work-laptop environment.

Preserve the current verified state. Do not publish, deploy, start Golden Levels 2–10, or begin a later development phase before this browser verification is completed in an unrestricted Codex environment.

## Launch and open

1. From the project root, run the normal preview command: `npm run dev`.
2. Use the exact Local URL printed by Vite and open `<Local URL>/v3`.
3. Open **Royal QA**, choose a **Golden replay sequence**, and select **Load Golden Level 1**. Golden Level 1 currently uses the `/v3` route and Royal QA loader; it does not have a separate deep-link route.
4. Test desktop at **1280 × 900** and narrow mobile at **390 × 844**. Also switch between those sizes during an active run.

## Representative move orders

The two authored chains are:

- Chain A: `SHORE → CORAL → STAR → REEF`
- Chain B: `WAVE → PEARL → OCEAN → FIN`

Manually exercise these representative orders:

1. A then B: `SHORE, CORAL, STAR, REEF, WAVE, PEARL, OCEAN, FIN`.
2. B then A: `WAVE, PEARL, OCEAN, FIN, SHORE, CORAL, STAR, REEF`.
3. Alternating: `SHORE, WAVE, CORAL, PEARL, STAR, OCEAN, REEF, FIN`.
4. Two A, two B: `SHORE, CORAL, WAVE, PEARL, STAR, OCEAN, REEF, FIN`.
5. Two B, two A: `WAVE, PEARL, SHORE, CORAL, OCEAN, STAR, FIN, REEF`.
6. Complete either chain early, then finish the remaining chain alone.
7. Reload and repeat one identical order; confirm identical states and hashes.
8. Repeat representative sequences with the Royal QA **Replay next authored move** control.

## Interaction checklist

- Use mouse drag and real touch or mobile-device emulation in all four canonical directions: horizontal (`SHORE`/`WAVE`/`STAR`/`FIN`), vertical (`CORAL`/`PEARL`), down-diagonal (`OCEAN`), and up-diagonal (`REEF`).
- Trace registered paths from both physical ends. Both gesture orders must resolve the same forward-only canonical target; hints and QA direction data must remain canonical.
- Test slow and fast drags, starting slightly outside a tile, releasing slightly outside the last tile, release midway, and interrupted/cancelled gestures.
- Confirm the opening shows `SHORE` and `WAVE`, gently recommends `SHORE`, displays “Find a word.”, and still permits `WAVE` first. The first instruction must disappear after the first valid interaction.
- After the first solve, keep the completed path readable briefly; animate only the changed letter; show “The board changed.”; then reveal/emphasize the local successor. Verify both `SHORE → CORAL` and `WAVE → PEARL`.
- Verify approximately **180 ms** confirmation plus **320 ms** transformation (**500 ms total input lock**). With reduced motion enabled, expect a crossfade/highlight with identical logical timing and state.
- During the lock, attempt another selection and rapid repeated drags. Also click completed words, inactive accidental words, garbage/bent paths, and partial paths. None may mutate the board, skip/duplicate an objective, break canonical synchronization, or release input early. Inactive valid dictionary words should gently dismiss without a combo break; garbage remains invalid.
- Confirm tiles never move, only authored cells change, inactive word names stay hidden, successors activate locally, and no gravity/refill/recovery/replanning/reshuffle appears.
- Reload mid-level, replay after completion, and complete all eight objectives. Confirm deterministic replay, completion only after objective eight, and no relevant browser-console errors.

## Royal QA and hash comparison

For every tested move:

1. Keep Royal QA open and confirm `STATE` advances to the expected authored state.
2. Confirm `branchValidationResult` remains valid.
3. Compare `HASH` with `EXPECTED`; they must match exactly.
4. Confirm the selected branch, changed cell (`from → to`), local/remote successor, zones, history, and visible board agree.
5. Confirm no `AUTHORED DATA MISMATCH` is shown.
6. Restart the same selected replay and confirm the same hashes recur.

## Required evidence

Capture screenshots of:

1. Initial desktop state at 1280 × 900.
2. Initial mobile state at 390 × 844.
3. First-word selection.
4. First letter transformation.
5. Local successor reveal.
6. A diagonal selection.
7. One-chain-completed state.
8. Final completed state.
9. Royal QA showing matching `HASH` and `EXPECTED` for the visible board.

Capture one short recording of the first-word confirmation, changed-letter transformation, and successor reveal when the environment supports recording. If recording is unavailable, record that limitation without installing extra software.

## Acceptance baseline and graph guard

- Expected exhaustive verifier result: **25 reachable states, 40 branches, 70 complete move orders**.
- Expected automated result: **62 passing tests, 0 failures**, with TypeScript, verifier, protected hashes, and prototype-byte checks passing.
- No Golden Level 1 board-graph modification is permitted during verification unless a genuine player-comprehension failure is first observed and documented with viewport, reproduction steps, expected/actual behavior, screenshots or recording, and the affected canonical state/hash. Visual or timing issues must be fixed without changing the protected graph.

