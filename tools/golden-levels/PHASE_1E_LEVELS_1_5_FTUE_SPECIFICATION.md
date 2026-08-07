# Phase 1E — Levels 1–5 FTUE Experience Specification

## 2026-08-03 authoritative progression override

This section is the current source of truth and supersedes the historical Level 1 reward flow retained below for audit context.

- Tutorial information messages pause their sequence until the player dismisses them with the visible close control or the outside dismissal layer. Dismissal never clicks through to the guided control, messages never stack, and the pointer/finger appears only after the message is closed.
- Level 1 opens directly into the protected Golden Level board. It teaches word selection and the first in-place transformation only. It contains no Pack, Album, stickers, Energy, Shop, Raid, or kingdom-completion lesson.
- Level 1 accepts every protected valid first move. SHORE is recommended visually but never forced. The transformation explanation resumes play only after explicit dismissal.
- Level 1 ends on a results-only `LEVEL 1 COMPLETE` screen with one `CONTINUE` action. Continue returns to the hub, unlocks Level 2, and shows a dismissible `Level 2 is ready` message. The real Level 2 button remains stationary and receives only a subtle outline after dismissal. The first Level 2 attempt costs no Energy.
- Level 2 introduces the deterministic Ocean Discovery Pack after gameplay. The fixed stickers are Coral Castle, Pearl, and Sea Turtle. The Pack cannot open until its explanation is dismissed, and the reward transaction cannot duplicate after reload or replay.
- After the three reveals, the Album is activated. Its explanation is dismissible; afterward the real Album navigation target is guided. The first Ocean Album page shows `3 of 12` and remains incomplete.
- The configured Ocean progression is: Level 2 (Coral Castle, Pearl, Sea Turtle), Level 3 (Dancing Dolphin, Golden Anchor, Reef Gate), Level 4 (Whale Song, Triton Mark, Sunken Throne), and Level 5 (Coral Crown, Ocean Palace, Sunken Crown). Only Level 5 may complete Ocean Kingdom and unlock Forest Kingdom.
- Levels 3–5 in this section specify future sticker/FTUE progression only. Their existing protected gameplay remains unchanged until separately approved for implementation.
- Album notification counts derive from unseen unlocked pages. Tutorial state remains separate from canonical boards and protected hashes.

## Historical Level 1 reward proposal (superseded)

## Authoritative Level 1 reward and completion override

This section supersedes every earlier Level 1 instruction that awards or previews Coral Castle, Pearl, Sea Turtle, an Album, or a discovery tracker while the board is active.

The required Level 1 learning order is:

> **Find words → see the board change → finish the level → receive stickers → open the Album.**

- Gameplay teaches only the validated SHORE gesture, the in-place board transformation, and normal word finding. WAVE and every other protected active first move remain valid.
- No sticker, Album explanation, card flight, or `1/3`–`3/3` discovery tracker appears during gameplay.
- The first transformation uses **The board is alive!** and explains that finding words changes letters and reveals new possibilities. A second solve occurs before any reward explanation.
- Completing all eight objectives records one deterministic Level 1 Discovery Pack transaction containing Coral Castle, Pearl, and Sea Turtle. It cannot duplicate on reload or replay.
- One combined, non-stacked completion experience presents **CONQUEST COMPLETE!**, **Coral Gardens discovered**, **Stage 1 of 5**, a partially discovered Kingdom visual, compact performance results, and the unopened Discovery Pack.
- The player must tap the real pack. Its three predetermined stickers reveal one by one and move visually toward an Album tray. Only then may the UI say **Your Album is now active!** and offer **OPEN ALBUM**.
- `OPEN ALBUM` returns to the real hub, reveals and spotlights the real Album button, and waits for the player to tap it.
- The Coral Gardens Album scene assembles Coral Castle, Pearl, and Sea Turtle, displays `1/5` Kingdom progress, and says **Coral Gardens complete! Complete four more stages to discover the full Coral Kingdom.**
- Continuing returns to the hub and points to Level 2 without starting it.
- Reload resumes the persisted completion phase and the next unrevealed sticker. Existing accounts that already completed the legacy Level 1 Album lesson do not replay the mandatory reward tutorial.

Each of Levels 1–5 represents one scene in Coral Kingdom. Each completed level discovers one area and awards its own predetermined end-of-level sticker set. Overall Kingdom progress advances from `0/5` to `5/5`; only Level 5 may present a complete-Kingdom celebration. Levels 1–4 must never say the Kingdom is restored or fully discovered.

## 1. Executive FTUE recommendation

The first-time player experience should teach one four-part mental model within the first minute:

> **Find a word → watch one letter change → notice the new opportunity → keep playing.**

The experience should feel discovered rather than explained. Level 1 establishes trust and the causal loop. Level 2 repeats it with low-load straight paths. Level 3 makes vertical and gentle diagonal dragging feel normal. Level 4 teaches the player to move attention between board zones and make a low-risk choice. Level 5 combines those skills and closes the FTUE with a Coral Conquest gateway moment.

Use visual attention, not text volume. Keep two targets visibly available, recommend SHORE without forcing it, accept a registered word from either physical end, and lock input only while the result is resolving. The current first-transition timing—approximately 180 ms of confirmation plus 320 ms of letter change, about 500 ms total—should remain the provisional baseline until browser testing is possible.

Tutorial state must remain separate from canonical board state, gameplay decisions, hashes, and authored branches. Completing or skipping the FTUE changes guidance only; it must never change which words are valid or how the board evolves.

## 2. Current verified and blocked state

### Protected Golden Level 1

- 25 reachable states, 40 authored branches, and 70 valid complete move orders.
- Eight fixed objectives: SHORE, CORAL, STAR, REEF, WAVE, PEARL, OCEAN, FIN.
- Two fixed chains:
  - `SHORE → CORAL → STAR → REEF`
  - `WAVE → PEARL → OCEAN → FIN`
- Initial active objectives are SHORE and WAVE.
- Every valid choice is prevalidated and completes deterministically.
- Letters transform in place; tiles do not fall, refill, or routinely reshuffle.
- The grid, words, paths, branches, transformations, zones, hashes, successor relationships, and active-objective rules are protected.

### Implemented and automatically verified

- 62 automated tests pass.
- TypeScript and the exhaustive Golden Level verifier pass.
- Either physical drag direction safely normalizes to one forward-only canonical path.
- First-word and first-change tutorial state exists independently of canonical state.
- Input remains logically locked during resolution.
- Reduced-motion and rapid-input protection are logically covered.
- Golden Level 1 and the prototype catalog remain unchanged.

### Outstanding environmental verification

Browser, real touch, responsive-layout, visual-timing, reduced-motion presentation, and animation verification remain outstanding because the restricted work laptop cannot start a reachable local preview. This specification does not retry that work and does not treat the blocker as evidence that Golden Level 1 needs redesign.

## 3. FTUE principles

1. **One need, one cue.** Never explain a behavior before the player needs it.
2. **Show more than tell.** Use restrained emphasis, path feedback, changed-cell focus, and objective state before adding words.
3. **Keep copy conversational.** No technical language, diagrams, large panels, or multi-sentence instructions.
4. **Preserve agency.** SHORE may be recommended, but WAVE must remain equally valid. All active choices remain safe.
5. **Dismiss on demonstrated intent.** A drag cue disappears when a valid drag begins, not after the player completes an arbitrary forced action.
6. **Do not teach every direction at once.** Level 1 permits all authored directions; Level 3 is where diagonal confidence receives explicit attention.
7. **Make cause visible.** The completed path, changed letter, and newly active objective should read as one short sequence.
8. **Never reveal the answer path.** Successor emphasis should point to the opportunity, not trace the full word.
9. **Protect thinking time.** Stall assistance escalates gradually and resets on useful interaction. It must not interrupt productive searching.
10. **No early pressure.** No timer, draining combo, penalty, move limit, fail state, energy cost, or reward economy belongs in this FTUE.
11. **Mobile first.** Cues stay outside selectable cells, fit at 390×844, and remain readable under a finger.
12. **Accessibility preserves meaning.** Reduced motion changes presentation, not order, lock duration, target validity, or state.
13. **Teach once.** Completed beats do not replay across reloads or restarts unless the player deliberately resets guidance.
14. **Skip affects guidance only.** Returning or confident players can dismiss tips without changing level content or progression.

## 4. Levels 1–5 teaching journey

### Journey overview

| Level | FTUE role | Single primary lesson | Tutorial intensity | Emotional goal |
|---:|---|---|---|---|
| 1 | Trust | A solved word changes the board and creates the next opportunity | High but brief: three short moments | Competence, surprise, trust |
| 2 | Reinforcement | Straight-path cause and effect is predictable | Minimal, reactive only | Fluency |
| 3 | Direction confidence | Vertical and gentle diagonal dragging are comfortable | One just-in-time cue | Discovery |
| 4 | Attention and choice | Look across the board and choose either safe active target | One attention cue and one optional choice cue | Agency |
| 5 | FTUE capstone | Combine selection, change-reading, direction, and attention without coaching | No instructional cue; celebration only | Mastery and anticipation |

This sequence intentionally moves Level 4 slightly beyond Phase 1D’s pure zone-rotation focus: the choice is low-risk and uses only already-known rules. Level 5 remains the first combined test, not the first time the player is asked to choose.

### Level 1 — Trust, selection, and first transformation

| Requirement | Specification |
|---|---|
| Player knowledge on entry | None. The player may understand word searches but must not be assumed to understand active targets or the living board. |
| Primary learning objective | Solve one available word and connect its changed letter to a newly available word. |
| Reinforced | Two visible choices, straight drag, either physical drag direction, active versus locked objective states. |
| Tutorial moments | Opening objective cue, drag cue if needed, first-change cue, light second-solve celebration. |
| Provisional copy | “Find a word.” → if needed, “Drag through the letters.” → “The board changed.” → “A new word appeared.” → “Nice — two in a row!” |
| Trigger | Opening cue on board readiness; drag cue only after brief non-action; change cue on first accepted solve; relationship cue after changed cell resolves; celebration after second solve. |
| Dismissal | Opening/drag guidance disappears when a valid active-word drag begins; change/relationship guidance clears on the next useful interaction; celebration self-dismisses quickly. |
| If player acts early | Accept the action immediately, suppress any no-longer-needed cue, and continue from the demonstrated step. Never delay input to show tutorial copy. |
| Stall assistance | Progressive assistance begins only after about 10 seconds without useful interaction; see Section 9. |
| Success feedback | Selected path confirms, one changed tile receives focus, local successor objective softly emphasizes, second solve gets a small positive pop. |
| Emotional goal | “I can do this” followed by “Oh—the board made something new.” |
| Comprehension question | Can the player explain why a new objective became possible without moderator help? |
| Evidence | First interaction/solve time, failed drags, changed-letter notice, causal explanation, active/locked distinction, continuation intent. |
| Advancement | Complete all eight fixed objectives. No tutorial action is mandatory beyond normal valid play. |
| Must not introduce | Failure, move limits, timers, power-ups, badges, economy, or forced selection of SHORE. |

### Level 2 — Straight-path fluency

| Requirement | Specification |
|---|---|
| Player knowledge on entry | Active words are searchable; a solve can change a letter and create a new opportunity. |
| Primary learning objective | Repeat the cause-and-effect loop confidently on readable horizontal and vertical paths. |
| Reinforced | Two safe choices, local succession, reverse drag, completed/locked objective states. |
| Tutorial moment | None by default. Use a reactive reminder only if the player stalls or repeatedly searches locked objectives. |
| Provisional copy | Reactive only: “Find either word.” Mobile: “Pick a word.” |
| Trigger | Approximately 10 seconds without useful interaction, or two clearly attempted locked-objective searches, subject to browser/playtest validation. |
| Dismissal | Any valid active-word drag begins; do not wait for completion. |
| If player acts early | No cue appears. Normal play proceeds uninterrupted. |
| Stall assistance | Same progressive ladder as Level 1, but begin with objective emphasis rather than drag instruction. |
| Success feedback | Normal word confirmation and changed-cell focus; no repeated “board changed” text if Level 1 comprehension was demonstrated. |
| Emotional goal | Fluency and trust: “I know what will happen.” |
| Comprehension question | Does the player recognize the next active word without the Level 1 explanation? |
| Evidence | Faster first solve, fewer failed drags, successor acquired without copy, no “random” description. |
| Advancement | Complete the level without moderator intervention; hint use is allowed and non-punitive. |
| Must not introduce | Diagonal teaching, remote-attention instruction, meaningful planning pressure, or any excluded system. |

### Level 3 — Vertical and gentle diagonal confidence

| Requirement | Specification |
|---|---|
| Player knowledge on entry | Straight dragging, active targets, in-place change, and local succession. |
| Primary learning objective | Recognize and comfortably drag vertical and gentle diagonal words. |
| Reinforced | Cause and effect, reverse drag, two choices, straight paths as a relief option. |
| Tutorial moment | One cue on the first active diagonal target only if the player does not begin useful interaction naturally. |
| Provisional copy | “Try the diagonal.” Mobile: “Go diagonal.” |
| Trigger | First diagonal target remains active for roughly 6 seconds without a useful gesture toward either active word. |
| Dismissal | Valid drag begins on either active word. If the player chooses the straight alternative, postpone rather than repeat immediately. |
| If player acts early | Suppress the cue. Successful diagonal play permanently marks this lesson demonstrated. |
| Stall assistance | Emphasize the diagonal objective chip first; later offer the normal voluntary hint. Do not draw the whole diagonal path. |
| Success feedback | Slightly stronger path confirmation on the first diagonal success, with no extra copy unless evidence shows it is needed. |
| Emotional goal | Discovery: “Words can run this way too.” |
| Comprehension question | Can the player complete both diagonal orientations without believing them to be bent paths? |
| Evidence | Slow/fast and reverse diagonal success, failed path count, finger occlusion observations, no false bent-path acceptance. |
| Advancement | Demonstrate at least one diagonal through normal completion; exact authored criteria remain future work. |
| Must not introduce | Remote-zone tutorial, planning consequence, failure pressure, obstacles, or timed combo behavior. |

### Level 4 — Attention movement and low-risk choice

| Requirement | Specification |
|---|---|
| Player knowledge on entry | Four-direction search is possible; changed letters reveal intentional opportunities; either active word can be valid. |
| Primary learning objective | Shift attention to another board zone and consciously choose between two safe active targets. |
| Reinforced | Mixed directions, local succession, reverse dragging, active versus locked states. |
| Tutorial moments | One remote-attention cue; one optional choice cue only if hesitation shows fear of choosing incorrectly. |
| Provisional copy | Attention: “Look across the board.” Mobile: “Look around.” Choice: “Either word works.” Mobile: “Your choice.” |
| Trigger | Attention copy appears only after a remote successor activates and the player continues searching the old zone. Choice copy appears only after extended hesitation between two visible active targets. |
| Dismissal | Useful interaction in the newly relevant zone, or a valid drag on either active target. |
| If player acts early | Never show the cue retroactively. Treat the behavior as learned. |
| Stall assistance | Emphasize the appropriate active objective chip, then its broad board zone—not the full word path—before offering a voluntary hint. |
| Success feedback | A subtle travel-confirmation pulse on the newly active objective; no reward difference between choices. |
| Emotional goal | Agency: “The board moved my attention, and I chose what to do.” |
| Comprehension question | Does the player understand that a distant active word is intentional and that neither active choice is a trap? |
| Evidence | Time to acquire remote target, hesitation between choices, verbal trust, branch variety, search restricted to active words. |
| Advancement | Complete using any valid order; no preferred branch is required. |
| Must not introduce | “Best choice” messaging, scoring optimization, branch rewards, move limits, obstacles, or economy. |

### Level 5 — Coral Conquest gateway

| Requirement | Specification |
|---|---|
| Player knowledge on entry | Active/locked distinction, four directions, reverse drag, changed-letter causality, local/remote attention, safe choice. |
| Primary learning objective | Combine all FTUE skills without instructional support. |
| Reinforced | Every core behavior taught in Levels 1–4. |
| Tutorial moment | No new instruction. A short completion message confirms mastery. |
| Provisional copy | Completion: “Coral Conquest begins!” Mobile: “Conquest begins!” |
| Trigger | Level 5 completion after all authored objectives resolve. |
| Dismissal | Self-dismiss after the completion presentation or on the player’s continue action. |
| If player acts early | No tutorial intervenes. Normal input remains available whenever the board is not resolving. |
| Stall assistance | Progressive objective emphasis and voluntary hint remain available; no new explanatory copy. |
| Success feedback | Strongest non-economic celebration of the FTUE: objective completion sequence, clear final board state, short gateway message. |
| Emotional goal | Mastery, closure, and desire to see what comes next. |
| Comprehension question | Can the player independently explain and use the full living-board loop? |
| Evidence | Moderator-free completion, causal explanation, low locked-objective confusion, willingness to continue after Level 5. |
| Advancement | Completing Level 5 conceptually sets `hasCompletedFTUE = true`; it does not award or spend resources in this specification. |
| Must not introduce | Any excluded system, a surprise fail condition, or a new mechanic during the capstone. |

## 5. Moment-by-moment Level 1 flow

| Moment | Experience | Input | Provisional timing | Exit condition |
|---|---|---|---|---|
| Board ready | SHORE and WAVE are bright, readable, and clearly distinct from completed/locked slots. SHORE receives one restrained recommendation. Copy: “Find a word.” | Fully enabled | Immediate | Valid active-word drag begins |
| Drag guidance | If the player has not made useful contact, a subtle gesture cue demonstrates straight dragging without choosing a required start end. | Fully enabled | Consider after 2.5–4s; browser-test | Valid drag begins or player dismisses tips |
| Selection | Touched cells remain visibly selected under the pointer/finger. Either physical direction is accepted. | Continuous drag | Real-time | Release submits selection |
| Confirmation | Accepted path remains readable and receives a brief, small confirmation treatment. | Locked | About 180 ms; acceptable target range 150–250 ms | Focus moves to changed cell |
| Changed-cell focus | Only the authored changed cell becomes the visual focus. The letter changes in place; no tile movement or unrelated effects. Copy: “The board changed.” | Locked | About 320 ms; acceptable target range 250–450 ms | Letter is legible in its new state |
| Successor relationship | Changed cell holds a brief residual highlight while the newly active objective chip softly emphasizes. Do not trace the successor path. Copy, only if needed: “A new word appeared.” | Unlock immediately after state is valid | Begin immediately after change; residual focus 500–700 ms without blocking input | Useful interaction or short self-dismiss |
| Next search | Both valid active choices are playable. Inactive names remain concealed. | Fully enabled | No delay | Second valid solve |
| Momentum feedback | Small positive pop and copy: “Nice — two in a row!” No timer, meter drain, multiplier requirement, or reward. | Fully enabled except normal solve lock | 600–900 ms nonblocking | Self-dismiss |
| Independent play | No repeated tutorial text. Stall ladder remains available if needed. | Normal game rules | Rest of level | Eight objectives complete |

The total first-solve lock should remain close to 500 ms and preferably below 900 ms under every presentation mode. Final values are provisional until desktop, touch, and reduced-motion browser checks.

## 6. Exact provisional tutorial-copy table

| Tutorial moment | Trigger | Primary copy | Short mobile copy | Visual cue | Expected action | Dismissal rule | Replay rule | Accessibility / reduced motion |
|---|---|---|---|---|---|---|---|---|
| Level 1 opening | Initial board is ready and FTUE guidance is active | “Find a word.” | “Find one.” | Restrained SHORE chip/tile emphasis; WAVE stays equally playable | Drag either active word | Valid active drag begins | Once per new FTUE; not on routine restart after demonstrated | Static high-contrast outline replaces breathing motion |
| Drag nudge | No useful interaction after provisional 2.5–4s | “Drag through the letters.” | “Drag the word.” | Short directional gesture cue over SHORE, without forcing start end | Drag across a straight active word | Valid drag begins; immediate | Repeat only after interruption before any successful word | Static start/end markers or short opacity crossfade; no moving hand required |
| First change | First word accepted | “The board changed.” | “It changed!” | Completed path holds; only changed cell flips/crossfades | Watch the changed letter | Clear after state settles or next useful interaction | Once per FTUE unless QA reset | Crossfade/highlight with the same logical timing and lock |
| Cause and effect | First changed letter settles and local successor activates | “A new word appeared.” | “New word!” | Residual changed-cell ring plus soft successor-chip emphasis; no path reveal | Search for the newly active word or choose the other active word | Useful interaction or short self-dismiss | Once if needed; suppress if player immediately acts correctly | Static ring and objective border; relationship must remain understandable without sound |
| Second success | Second valid word completes | “Nice — two in a row!” | “Nice — two!” | Small objective/score pop; no timer | Continue | Self-dismiss; never block | Once during Level 1 FTUE | Opacity/scale limited to comfortable motion; text remains sufficient |
| Level 2 reminder | Player stalls or searches locked objectives | “Find either word.” | “Pick a word.” | Emphasize both active chips, not locked slots | Choose either active target | Valid drag begins | Reactive; never show if not needed | Static outline and state labels |
| First diagonal | Level 3 diagonal is available and player has not acted usefully | “Try the diagonal.” | “Go diagonal.” | Emphasize objective chip and path orientation only; do not reveal every tile | Drag the diagonal active word | Any valid active drag begins; postpone if other target chosen | Until one diagonal is successfully demonstrated | Static start/end orientation markers; no sweeping animation |
| Remote attention | Level 4 remote successor is active and player remains in prior zone | “Look across the board.” | “Look around.” | Broad, gentle emphasis in the relevant zone and objective chip | Move attention to a valid remote target | Useful interaction in that zone or valid solve elsewhere | Once after demonstrated | Static zone halo; no camera movement |
| Safe choice | Level 4 player hesitates as if one active word is wrong | “Either word works.” | “Your choice.” | Equal emphasis on both active chips | Select either target | Valid drag begins | Once; do not repeat if player already chooses freely | Equal non-color-only treatment |
| Level 5 completion | Final FTUE level completes | “Coral Conquest begins!” | “Conquest begins!” | Clear completion treatment, no economic reward | Continue | Continue action or self-dismiss | Once when `hasCompletedFTUE` becomes true | Static celebratory framing and readable text; no flashing |
| Voluntary hint | Stall ladder reaches final stage and a hint remains | “Need a clue?” | “Need help?” | Nonblocking hint action near objective rail | Choose hint or keep searching | Dismiss, continue searching, or use hint | Up to existing three-hints-per-level allowance | Control has accessible name, focus state, and no motion requirement |

Copy remains provisional until first-time-player browser testing. Do not add technical terms such as transformation, successor, canonical, state, or graph.

## 7. Active, completed, and locked objective presentation

### Currently playable

- Use the strongest contrast, readable word label, and a non-color-only active treatment such as a raised border or active marker.
- Keep both active targets visually equal except for the single, temporary SHORE recommendation at the start of a new FTUE.
- Active chips must remain legible at 390×844 without shrinking the board’s touch area.
- A recommendation must not look like the only valid choice.

### Completed

- Replace active styling with a stable completion mark plus the completed word.
- Use both shape/icon and color so completion remains understandable with color-vision differences.
- Completed objectives may be reviewed but must not appear selectable or pulse for attention.

### Not yet active

- Show unnamed locked placeholders only; do not expose future word names.
- Use a clear lock symbol and neutral treatment distinct from active and completed states.
- Never animate a locked slot as if it needs attention.
- If the player touches a locked slot, give no punitive error; an optional accessible label may state “Not ready yet.” Do not tell the player to search for it.

The rail should communicate a simple hierarchy: **bright words are playable; checked words are done; locked blanks will come later**. It should never imply that all eight hidden words must already be found on the current board.

## 8. Transformation and successor-clarity requirements

1. Preserve the accepted path visually for the confirmation period.
2. Change only authored cells and keep every tile anchored.
3. Make the changed letter the sole transformation focus; avoid board shake, screen flash, particles, unrelated pulses, gravity, or refill imagery.
4. Preserve input lock from acceptance until canonical state and visible board are synchronized.
5. Reveal the successor objective immediately after the changed letter becomes legible.
6. Connect cause and effect with a short residual highlight on the changed cell and a matching, restrained emphasis on the successor objective chip.
7. Do not draw the successor’s entire board path, spell it over the grid, or automatically select its letters.
8. Keep the other active word playable and visually stable so choice remains trustworthy.
9. Unlock promptly after the new state is valid; residual nonblocking emphasis may continue.
10. Ensure the relationship works without sound and in reduced motion.

The intended interpretation is: “That letter changed, and now this word is available.” If players notice the animation but cannot explain the relationship, the issue is not solved by making the effect larger; test focus order, residual link, objective activation clarity, and copy first.

## 9. Hint and stall behavior

The stall system protects productive thinking and escalates only when there is no useful interaction.

### Conceptual idle ladder

| Stage | Provisional trigger | Response | Reset condition |
|---|---:|---|---|
| Thinking | 0–10s | No intervention | Any useful interaction or solve |
| Gentle | About 10s | One soft pulse/outline on currently active objective chips | Useful contact with an active target, valid drag, solve, or explicit dismissal |
| Stronger | About 15–18s | Emphasize one active objective and its broad board zone; do not reveal the path | Same as above |
| Voluntary hint | About 20–25s, or after repeated failed garbage paths | Show nonblocking “Need a clue?” action | Hint used, dismissed, useful interaction, or solve |

“Useful interaction” means behavior plausibly advancing understanding: beginning a valid active path, tracing meaningful consecutive letters for an active word, selecting another valid active target, or completing a word. Random taps should not indefinitely suppress help, but the system must tolerate pauses and slow searching.

The existing allowance of three hints per level is preserved as a design constraint. This phase does not change its implementation. A hint must remain voluntary, non-punitive, and free of timer/combo/economy consequences during FTUE. Stall timing, threshold definitions, and visual intensity require browser and external playtest validation.

## 10. Skip, replay, and conceptual persistence behavior

`hasCompletedFTUE` is a conceptual guidance flag, not canonical board state. Future storage details are outside this phase.

| Situation | Expected guidance behavior |
|---|---|
| New player | `hasCompletedFTUE = false`; begin at Level 1 opening beat and record demonstrated tutorial milestones separately from board state. |
| Returning before Level 5 completion | Resume only guidance not yet demonstrated. Do not replay already-completed beats merely because the app reopened. |
| Returning after FTUE completion | `hasCompletedFTUE = true`; no automatic Levels 1–5 tutorial cues. Normal stall hints may remain available as a player aid. |
| Level restart | Reset the level’s canonical session normally, but do not replay globally demonstrated tutorial beats. If the player interrupted before demonstrating the current lesson, resume that lesson. |
| Page reload | Restore the same conceptual FTUE milestone and canonical level state independently. Reload must not duplicate a solve, reset a learned cue, or change hashes. |
| Interrupted tutorial | On return, show only the shortest still-relevant cue. Never replay a completed animation solely for instruction. |
| Reduced-motion preference | Preserve cue order, copy, lock, validity, and milestone progression; replace flips/movement with crossfade, outline, and static focus. |
| Tutorial skip | A visible but unobtrusive “Skip tips” action disables instructional cues across Levels 1–5 and conceptually sets `hasCompletedFTUE = true`; it does not complete levels or change board state. |
| Development/QA reset | Reset only FTUE flags and tutorial milestones. Do not reset player progression, authored data, canonical hashes, or unrelated save state unless a separate explicit QA action says so. |

The future implementation should keep at least three conceptual values separate: canonical board/session state, FTUE completion, and per-beat demonstration state. No tutorial flag may participate in hash calculation or branch selection.

## 11. Reduced-motion requirements

- Detect the player’s reduced-motion preference and honor it from the first board render.
- Replace tile flip/rotation with a short crossfade or two-state highlight.
- Replace breathing, sweeping, or travel animation with static high-contrast outlines and brief opacity changes.
- Preserve the same logical sequence: confirm word → focus changed cell → show new letter → activate successor → unlock.
- Preserve approximately the same logical lock duration unless browser evidence shows reduced-motion clarity requires a documented adjustment.
- Never use flashing, full-screen motion, camera movement, or sound as the sole carrier of meaning.
- Ensure selected, changed, active, completed, and locked states remain distinct through text, shape, icon, and contrast.
- Reduced motion must produce the same canonical state, expected hash, tutorial milestone, and replay result.

## 12. Embedded comprehension-test plan

### Participants and setup

- Recruit 5–8 people who have not seen the game or its rules.
- Prefer a mix of casual word-game familiarity and at least two common mobile device sizes.
- Include reduced-motion verification with a participant who uses it when possible; otherwise perform a dedicated accessibility pass.
- Start each participant at Level 1 with a clean FTUE guidance state.
- Give only the neutral prompt: “Please play as you normally would.” Do not explain the living board.
- Record the screen and touches/pointer where consent and tools permit; otherwise use timestamped observation notes.

### Session sequence

1. Observe Level 1 without coaching.
2. After its first transformation, do not ask a leading question; note spontaneous reaction.
3. After Level 1, ask: “What happened when you found a word?” and “Which words could you look for?”
4. Continue through Levels 2–5 if the participant is willing.
5. Ask after Level 5: “Did anything feel random or unfair?” and “Would you keep playing?”
6. Do not expose QA terminology, hashes, branches, or intended answers to participants.

### Measures to capture

- Time to first interaction and first valid word.
- Number and type of failed drag attempts, including partial/bent paths.
- Physical drag direction chosen and whether reverse dragging feels natural.
- Whether the first changed letter is visually noticed.
- Whether the player connects the changed letter to the next opportunity.
- Active-versus-locked objective confusion and locked-word searching.
- Time and context for each stall stage and hint use.
- Completion without moderator help.
- Statements that the board feels random, unfair, forced, or trustworthy.
- Voluntary continuation after Level 1 and Level 5.
- Mobile occlusion, accidental release, cue overlap, and reduced-motion clarity.

No analytics or production event tracking should be built for this test. A standardized observation sheet and recordings/notes are sufficient.

## 13. FTUE success criteria

For a 5–8-person directional test, use percentages as decision guides rather than statistically conclusive proof.

| Outcome | Approval target |
|---|---|
| Finds first valid word without moderator help | At least 75% and preferably 6 of 8 within 10 seconds |
| Completes first drag comfortably | At least 75%; most within two attempts |
| Notices first board change | At least 75% without being told where to look |
| Connects change to next opportunity | At least 75% can explain the relationship in their own words by Level 1 completion |
| Understands playable versus locked objectives | At least 85%; no repeated locked-objective searching |
| Reverse drag feels natural | No systematic rejection/confusion; both physical directions succeed when attempted |
| Avoids “random/unfair” interpretation | No more than one participant repeatedly uses either description after Level 2 |
| Stall assistance respects thinking | No participant is repeatedly interrupted while making useful progress |
| Completes without moderator help | Most complete Level 1; at least 75% of those continuing complete Level 5 |
| Wants to continue | At least 75% after Level 1 and a clear majority after Level 5 |
| Tutorial obstructs play | Zero cases where a cue blocks a needed tile or interaction |
| Reduced motion | Same logical clarity, state, and successful completion as standard motion |

Do not approve the FTUE solely because players finish. They must understand the board’s causal behavior and trust their choices.

## 14. Failure-classification framework

| Failure class | Diagnostic evidence | Correct response | Graph impact |
|---|---|---|---|
| Presentation-only | Player understands after attention is directed but misses contrast, rail state, changed-cell focus, or mobile placement | Adjust visual hierarchy, focus treatment, or layout only | None |
| Tutorial-copy | Player sees the relevant elements but misreads or waits because wording is unclear | Shorten, retime, or remove copy; retest without adding explanation panels | None |
| Timing | Player notices only when replayed/slowed, or lock feels unresponsive after understanding is intact | Tune confirmation/change/successor timing and input-return moment | None |
| Input | Intended straight/reverse/diagonal gesture visibly matches a valid target but is rejected, cancelled, or obscured | Fix hit testing, pointer capture, path feedback, or gesture tolerance without changing targets | None |
| Level-design rule | Players understand Level 1 but later levels stack direction, choice, or zone load too quickly | Revise FTUE teaching order, candidate vocabulary, direction mix, or attention demands | Level 1 remains protected |
| Potential graph comprehension failure | Across repeated first-time tests, players still cannot connect the fixed changed cell to its successor after presentation, copy, timing, and input problems have been corrected | Document device, viewport, state/hash, branch, recordings, quotes, attempted fixes, and repeated outcome; request explicit review | Graph reconsideration is last option only |

A single preference, one failed gesture, a browser limitation, or an animation complaint is never sufficient to alter the protected graph. Reconsideration requires repeated causal-comprehension failure and evidence that non-graph solutions were tested first.

## 15. Dependencies and open decisions

### Dependencies

1. Phase 1C browser verification on desktop and narrow mobile.
2. Real touch testing, including both physical drag directions and diagonals.
3. First-time-player comprehension sessions with 5–8 participants.
4. Confirmation that objective-rail states remain readable without reducing tile touch space.
5. Separate future authoring and exhaustive verification for Levels 2–5.

### Open decisions pending evidence

- Exact delay before the drag nudge appears.
- Whether “A new word appeared.” is needed or visual linking is sufficient.
- Final confirmation, change, residual-highlight, and unlock timings.
- Whether the second-solve message should say “two in a row” or rely on visual celebration only.
- Stall thresholds and what precisely counts as useful interaction.
- Whether the voluntary hint action appears automatically or remains permanently available but quiet.
- Whether Level 3 needs orientation markers or objective-chip emphasis alone.
- Whether Level 4’s safe-choice copy is necessary or overexplains agency.
- Level 5’s exact non-economic gateway presentation.
- Future storage model for `hasCompletedFTUE`, beat milestones, skip, and QA reset.

## 16. Future implementation checklist

- [ ] Complete Phase 1C browser verification first.
- [ ] Approve exact copy and timings from observation, not preference alone.
- [ ] Define tutorial state independently from canonical session state.
- [ ] Ensure tutorial state never enters board hashes, branches, target validity, scoring, or replay determinism.
- [ ] Implement new-player, returning, restart, reload, skip, completion, and QA-reset behavior exactly as specified.
- [ ] Preserve SHORE recommendation while allowing WAVE immediately.
- [ ] Dismiss drag guidance at valid drag start.
- [ ] Keep input locked through canonical/visual synchronization and unlock promptly.
- [ ] Link changed-cell focus to successor-objective emphasis without revealing the path.
- [ ] Add nonblocking second-solve feedback with no timed combo mechanics.
- [ ] Preserve the three-hints-per-level rule and implement progressive stall presentation only after approval.
- [ ] Add accessible labels, keyboard/focus behavior, color-independent states, and reduced-motion equivalents.
- [ ] Write automated tests for all tutorial milestones, skip/replay/persistence concepts, idle escalation, and canonical isolation.
- [ ] Author Levels 2–5 only after FTUE evidence and separate authoring approval.
- [ ] Exhaustively verify every future authored graph before browser playtesting it.

## 17. Browser-verification checklist

When an unrestricted environment is available:

- [ ] Test Level 1 at 1280×900 and 390×844, plus at least one real phone.
- [ ] Confirm SHORE and WAVE are both readable and selectable; SHORE cue does not imply WAVE is invalid.
- [ ] Test mouse, touch, slow/fast drag, reverse drag, slight outside start/end, cancellation, and partial release.
- [ ] Verify horizontal, vertical, falling-diagonal, and rising-diagonal selections.
- [ ] Confirm opening and drag cues never cover playable cells.
- [ ] Capture first valid selection, confirmation, changed cell, successor emphasis, second-solve feedback, and Level 5 completion.
- [ ] Measure confirmation, change, successor reveal, and total lock timing.
- [ ] Attempt rapid repeated input and selection during resolution; ensure no double solve or early unlock.
- [ ] Verify active, completed, and locked objective states at narrow width and with color-independent cues.
- [ ] Verify stall stages do not appear during useful interaction and dismiss correctly.
- [ ] Verify three-hint limit behavior without redesigning the hint system.
- [ ] Test reload, restart, interrupted tutorial, returning-before-Level-5, completed FTUE, skip, and QA reset.
- [ ] Enable reduced motion and confirm identical logical sequence, state, hash, and clarity.
- [ ] Keep Royal QA open during representative runs; confirm current and expected hashes match.
- [ ] Confirm no relevant browser-console errors, layout shifts, gravity/refill/recovery visuals, or hidden-word leakage.
- [ ] Record all presentation, copy, timing, input, and comprehension issues under the failure framework before proposing changes.

## 18. Recommendation for the next phase

Do not implement this specification or author Levels 2–5 yet. The next allowed step should be Phase 1C browser verification in an unrestricted Codex environment, followed by the 5–8-person first-time-player comprehension test. Use those findings to approve or revise this FTUE specification.

Only after the FTUE’s causal understanding, mobile input, objective hierarchy, stall behavior, and continuation intent meet the success criteria should a separate implementation phase be authorized. Golden Level 1’s protected graph must remain unchanged unless repeated, documented comprehension failure survives presentation, copy, timing, and input corrections.
# Visual-guidance override — Level 1 implementation and Levels 1–10 authority

This section supersedes earlier guidance that minimized explicit FTUE messaging. Levels 1–10 form a contextual, tutorial-heavy onboarding journey. Only Level 1 is implemented in this checkpoint; Levels 2–10 remain specification-only until separately approved.

## Reusable visual pattern

Every new feature follows the same sequence: show its production icon or artwork, name it with a short title and one sentence, spotlight the real interactive target, demonstrate the real gesture with an animated finger, wait for the player’s action, remove guidance immediately after success, then explain the activation once. Guidance never performs the action for the player. Tap targets remain real UI controls and swipe paths come from validated board coordinates. Reduced motion replaces travel with a static hand and pulsing target.

The reusable presentation layer consists of an icon-and-message coachmark, spotlight target, tap finger, validated-path swipe finger, non-blocking activation message, persisted completion step, and reduced-motion mode. Tutorial state remains separate from canonical board state and protected hashes.

## Level 1 authoritative visual journey

1. Before the first interaction, show the production word-selection visual with **“Find your first word!”** and “Swipe across the letters to find SHORE.” Spotlight SHORE’s authoritative path and animate a finger along it. SHORE is recommended, never forced; WAVE and every protected valid first move remain accepted, including reverse physical drag.
2. Cancel the finger as soon as a useful valid gesture begins. The player must solve the real word.
3. After the first authored transformation finishes, show the transformed-tile visual with **“The board is alive!”** and “Every word you find can change the letters and reveal new words.” It dismisses automatically once.
4. Present the real Coral Castle artwork with **“Discovery found!”** and “Coral Castle is now part of your Ocean collection.” Animate it into the real 1/3 discovery tracker.
5. When PEARL is solved, present the real Pearl artwork with **“New discovery!”** and “You found the Pearl. 2/3”.
6. On the final solve, present the real Sea Turtle artwork with **“Discovery Set complete!”** and “You found the Sea Turtle. 3/3”. Its animation must settle before completion begins.
7. Completion shows Coral Castle, Pearl, and Sea Turtle together with **“Coral Gardens discovered!”**, “Your first Ocean scene is ready.”, and one CONTINUE action.
8. On the hub, use the real Album artwork, bubbles, spotlight, and tap finger with **“New Album unlocked!”** and “Tap the Album to see your discoveries come alive.” Unrelated controls are unavailable and the Album is never opened automatically.
9. In the Album, assemble Coral Castle, then the glowing Pearl, then the swimming Sea Turtle. After assembly, show **“Your first scene is complete!”** and “Keep discovering cards to reveal the Ocean Kingdom.” The finger targets the real CONTINUE button.
10. After CONTINUE, return to the hub, persist Album completion, pulse the real Level 2 control, and point to it. Level 2 never starts automatically.

Replays suppress completed messages and finger animations. Reload restores persisted visual steps and pending Album/Level 2 actions without duplicating the first-card credit. The development reset may safely reset tutorial presentation state without modifying the canonical Level 1 graph.

## Future Levels 2–10 coverage — not implemented in this checkpoint

One primary system is introduced per level, with connected steps allowed: selecting a word and living transformation; Discovery Cards and Sticker Album; Kingdom path; Hint; Royal Dictionary; first obstacle; Boss completion; badge collection; Raid activation and first Raid. Every new icon is named once. Raid remains absent from Levels 1–3. Future tap demonstrations include Album, next level, Hint, completed Discovery Set, Royal Dictionary, Raid meter, Raid start, Raid target, obstacles, and powers. All use production artwork and the player’s real action.
