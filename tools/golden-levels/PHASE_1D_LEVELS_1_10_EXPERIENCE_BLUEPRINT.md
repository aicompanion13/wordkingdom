# Phase 1D — Levels 1–10 Experience and Retention Blueprint

## 1. Executive recommendation

The first ten levels should teach one promise: **solving a word changes the board in a way the player can understand and use**. The sequence should begin with immediate competence, add direction and attention demands gradually, introduce the first real planning choice at Level 5, deliberately relax at Level 6, and finish with anticipation and mastery rather than failure pressure.

The proposed curve refines the initial progression in three ways:

1. Level 1 already demonstrates vertical and diagonal paths, so Levels 2–3 should **practise and name** those skills rather than claim to introduce them.
2. Level 6 should not introduce an obstacle. It should be a confidence-restoring relief level after the first planning challenge.
3. Hints may become a quiet safety net during the first ten levels, but limited moves, obstacles, combo pressure, and power-ups should wait until the living-board cause-and-effect model is proven in browser and external playtests.

Levels 2–10 below are experience concepts only. Their vocabulary, direction mixes, timings, and decision counts remain provisional until the Phase 1C and external comprehension gates pass. No candidate word set is assumed technically authorable before exact-board authoring and exhaustive verification.

## 2. Current verified and blocked state

### Existing verified capabilities

- Golden Level 1, **Find Your First Word**, has 25 reachable states, 40 authored branches, and 70 valid complete move orders.
- Its eight objectives and two chains are fixed:
  - `SHORE → CORAL → STAR → REEF`
  - `WAVE → PEARL → OCEAN → FIN`
- All paths complete deterministically without gravity, refill, reshuffling, recovery, or random repair.
- Automated coverage passes: 62 tests, TypeScript, the exhaustive verifier, protected hashes, and prototype integrity.
- Reverse physical gestures normalize to the registered forward-only canonical path.
- Tutorial state, transformation input lock, reduced-motion presentation, and rapid-input protection exist and are logically verified.

### Existing but browser-unverified capabilities

- Mouse and touchscreen comfort in both physical drag directions.
- Desktop and narrow-mobile layout, tile sizing, objective-rail readability, and responsive behavior.
- First-word cue clarity, first-transformation noticeability, animation timing, reduced-motion presentation, and input-lock feel.
- Visual agreement between the board, Royal QA state, and expected canonical hash during real interaction.

### Proposed future design

- Every Level 2–10 concept, word list, tutorial cue, pacing target, and difficulty estimate in this document.
- Optional just-in-time hint surfacing after early comprehension is established.
- Any future authored board, path, branch, transformation, zone assignment, or hash.

### Deliberately outside Levels 1–10

- Limited-move failure pressure.
- Obstacles and obstacle-clearing rules.
- Combo pressure as a teaching or progression requirement.
- Power-ups, economy, monetization, kingdom-map progression, and analytics implementation.

**Recorded Phase 1C status:** Implementation and automated verification complete; browser, touch, responsive-layout and animation verification outstanding due to the restricted work-laptop environment.

## 3. First-10-level design principles

1. **One main lesson per level.** Reinforcement may combine known skills, but only one idea receives tutorial attention.
2. **Success within seconds.** The first active pair should contain familiar, visually distinct words with at least one obvious path.
3. **Cause before complexity.** A changed letter and its local successor must remain easier to understand than the rest of the board.
4. **Choice without traps.** Either active word must remain a valid, deterministic decision; no choice may create an unwinnable state.
5. **Two visible targets are enough.** Keep inactive names concealed and avoid three simultaneous targets during the first ten levels.
6. **Use the whole 8×8 board deliberately.** Rotate attention between zones, but avoid repeated cross-board jumps until Level 4 teaches that behavior.
7. **Difficulty comes from reasoning.** Increase direction variety, transformation anticipation, and choice consequences—not filler noise or visual ambiguity.
8. **Tutorials leave immediately.** Use one short cue only when needed, and remove it as soon as the player demonstrates the behavior.
9. **No early punishment.** No move cost, fail state, timing penalty, or mandatory optimization before the core rule is understood.
10. **Alternate effort and relief.** Level 6 must lower cognitive load after Level 5; Level 10 should feel celebratory, not merely harder.
11. **Determinism remains visible.** Every successor should read as caused by the solved word; recovery systems must never conceal weak authoring.
12. **Mastery means explanation.** By Level 10, a player should be able to predict likely change locations and explain why a new word appeared.

## 4. Levels 1–10 blueprint

### Progression overview

| Level | Working title | Coral Conquest sub-theme | Main learning goal | New emphasis | Difficulty | Time | Decisions | Status |
|---:|---|---|---|---|---:|---:|---:|---|
| 1 | Find Your First Word | Castle Shore | Trust the living board | First understandable transformation | 1/10 | 60–90s | 2–3 | Verified logically; browser blocked |
| 2 | The Reef Responds | Shallow Reef | Repeat straight-path cause and effect | Predictable local succession | 2/10 | 55–80s | 2–3 | Proposed; authoring blocked by Gates A–C |
| 3 | Cross the Current | Tide Pools | Search confidently in four directions | Explicit diagonal practice | 3/10 | 60–85s | 3–4 | Proposed; authoring blocked by Gates A–C |
| 4 | Across the Lagoon | Blue Lagoon | Follow attention between board zones | Intentional remote succession | 4/10 | 65–90s | 4 | Proposed; authoring blocked by Gates A–C |
| 5 | Choose the Tide | Turtle Crossing | Make a meaningful two-choice plan | Choice with readable consequences | 6/10 | 75–105s | 5–6 | Proposed; authoring blocked by Gates A–C |
| 6 | Calm Waters | Sunny Cove | Consolidate without new pressure | Relief and fluency | 3/10 | 50–75s | 3 | Proposed; authoring blocked by Gates A–C |
| 7 | Four Currents | Pirate Shoals | Combine direction and zone skills | Mixed-rule fluency | 6/10 | 75–105s | 5–6 | Proposed; authoring blocked by Gates A–C |
| 8 | See the Change | Sunken Jewels | Anticipate a transformation outcome | Pre-solve reasoning | 7/10 | 80–110s | 6 | Proposed; authoring blocked by Gates A–C |
| 9 | Into the Deep | Ancient Ruins | Perform without tutorial support | Controlled mastery challenge | 8/10 | 90–120s | 7 | Proposed; authoring blocked by Gates A–C |
| 10 | Crown of Coral | Coral Palace | Demonstrate complete first-chapter mastery | Celebratory capstone | 9/10 | 95–125s | 7–8 | Proposed; authoring blocked by Gates A–C |

### Level 1 — Find Your First Word

| Blueprint field | Design intention |
|---|---|
| Sub-theme | Castle Shore |
| Primary learning objective | Find a word immediately, trust the selection, and understand that a solved path can create a successor. |
| Mechanic introduced | In-place letter transformation with two simultaneously valid targets. |
| Mechanics reinforced | Horizontal, vertical, falling/rising diagonal paths; local and remote successors; zone travel; reverse-drag comfort. |
| Eight target words | **Fixed:** SHORE, CORAL, STAR, REEF, WAVE, PEARL, OCEAN, FIN. |
| Direction mix | **Fixed authored mix:** horizontal, vertical, falling diagonal, rising diagonal. |
| Active-objective presentation | Two active words; completed words marked; inactive objectives remain unnamed locked slots. |
| Board evolution | One changed letter is visually attributable to the solved path and reveals the next chain word while the other choice remains valid. |
| Local-successor purpose | Teach “my solve caused this nearby word.” |
| Remote-successor purpose | Preserve choice and begin board-wide attention without requiring an explanation. |
| Zone travel | Gentle alternation across authored zones; fixed by the verified graph. |
| Difficulty / time / decisions | 1/10; 60–90 seconds; 2–3 decisions that feel meaningful even though all paths are safe. |
| Tutorial cue | “Find a word.” Then, once only: “The board changed.” SHORE is recommended, WAVE remains valid. |
| Emotional beat | Immediate competence followed by a small, trustworthy surprise. |
| Retention hypothesis | If the first transformation is noticed and understood, curiosity will carry the player into Level 2. |
| Comprehension risk | The player may interpret the new word as coincidence, miss the changed letter, or search locked names. |
| Required playtest evidence | Time to first word; cue rereads; changed-letter notice; explanation of successor; mobile drag comfort; voluntary next-level start. |
| Implementation dependency | Phase 1C browser verification and small external comprehension playtest. No graph change permitted without documented failure. |
| Status | Logic verified; browser, touch, responsive-layout, and animation verification blocked by the current environment. |

### Level 2 — The Reef Responds

| Blueprint field | Design intention |
|---|---|
| Sub-theme | Shallow Reef |
| Primary learning objective | Repeat the solve–change–successor loop until it feels dependable. |
| Mechanic introduced | None; predictable straight-path local succession receives focus. |
| Mechanics reinforced | Horizontal and vertical paths, two active choices, in-place transformations, reverse dragging. |
| Provisional words | SAND, TIDE, SHELL, BOAT, FISH, PALM, COVE, ROCK. |
| Direction mix | Approximately five horizontal and three vertical; no required diagonal search. |
| Active-objective presentation | Two readable targets throughout; inactive names concealed. |
| Board evolution | Most successors share one clearly changed cell with the completed path; transformations stay near the solved area. |
| Local / remote successor purpose | Local: establish reliability. Remote: keep the second safe choice visible without pulling attention aggressively. |
| Zone travel | Mostly neighboring zones with one gentle late shift. |
| Difficulty / time / decisions | 2/10; 55–80 seconds; 2–3 meaningful choices. |
| Tutorial cue | None by default; a short “Find either word.” fallback only if Level 1 evidence shows uncertainty. |
| Emotional beat | “I know how this works.” |
| Retention hypothesis | Repetition without punishment converts surprise into trust. |
| Comprehension risk | Too much similarity to Level 1 could feel flat; vary path locations and word lengths without adding rules. |
| Required playtest evidence | First-word time improves; transformed cell is noticed without the second tutorial; player starts Level 3 voluntarily. |
| Implementation dependency | Gates A–C; verifier must prove both choices and all orders deterministic before authoring approval. |
| Status | Proposed. |

### Level 3 — Cross the Current

| Blueprint field | Design intention |
|---|---|
| Sub-theme | Tide Pools |
| Primary learning objective | Search confidently beyond straight rows and columns. |
| Mechanic introduced | No new canonical direction—the falling and rising diagonals already exist in Level 1—but diagonal practice becomes explicit. |
| Mechanics reinforced | Straight paths, local transformations, reverse dragging, two-choice play. |
| Provisional words | CRAB, KELP, DOLPHIN, RAY, SURF, BEACH, FOAM, SWIM. |
| Direction mix | Two horizontal, two vertical, two falling diagonals, two rising diagonals; diagonal paths should remain visually gentle. |
| Active-objective presentation | Two targets; the first diagonal target may receive a single restrained path-orientation cue. |
| Board evolution | A straight solve reveals a diagonal successor, then a diagonal solve reveals a familiar straight successor. |
| Local / remote successor purpose | Local: connect changed cell to a diagonal. Remote: preserve a simple straight alternative. |
| Zone travel | Moderate; keep first diagonal near the player’s last focus before widening travel. |
| Difficulty / time / decisions | 3/10; 60–85 seconds; 3–4 meaningful choices. |
| Tutorial cue | Once only: “Try the diagonal.” Remove on valid drag. |
| Emotional beat | Discovery followed by competence. |
| Retention hypothesis | Direction variety makes the same core rule feel newly expressive without adding systems. |
| Comprehension risk | A diagonal may be visually unreadable under a finger or mistaken for a bent path. |
| Required playtest evidence | Both diagonal directions found; slow/fast touch drags succeed; reverse gesture remains natural; no bent-path false positives. |
| Implementation dependency | Browser/touch validation of tile hit areas and path feedback; exact paths require verifier proof. |
| Status | Proposed. |

### Level 4 — Across the Lagoon

| Blueprint field | Design intention |
|---|---|
| Sub-theme | Blue Lagoon |
| Primary learning objective | Deliberately move attention between distant board zones after a solve. |
| Mechanic introduced | Remote succession is taught intentionally rather than merely present. |
| Mechanics reinforced | All path directions, local successors, two active choices. |
| Provisional words | ANCHOR, ISLAND, SEAGULL, HARBOR, CLIFF, CAVE, STORM, LIGHT. |
| Direction mix | Balanced horizontal/vertical with two diagonals; avoid consecutive hard diagonals. |
| Active-objective presentation | Two targets in visibly separated zones; the objective rail must not reveal inactive names. |
| Board evolution | Alternate local payoff with an authored cross-board attention handoff. |
| Local / remote successor purpose | Local: retain causal clarity. Remote: teach that the living board can redirect attention without randomness. |
| Zone travel | First intentional rotation through top, center, and lower bands. |
| Difficulty / time / decisions | 4/10; 65–90 seconds; about 4 meaningful choices. |
| Tutorial cue | Once only: “Look across the board.” Use only after the first remote reveal, not before. |
| Emotional beat | The board feels larger and alive. |
| Retention hypothesis | Controlled attention travel creates anticipation for where the next word will appear. |
| Comprehension risk | The player may continue searching locally and assume the level stalled. |
| Required playtest evidence | Time from transformation to remote-target acquisition; gaze/gesture shift; no search for locked objectives; hint need after idle. |
| Implementation dependency | Mobile objective-rail and changed-letter visibility validated at 390×844; hint policy decided after playtest. |
| Status | Proposed. |

### Level 5 — Choose the Tide

| Blueprint field | Design intention |
|---|---|
| Sub-theme | Turtle Crossing |
| Primary learning objective | Make the first consciously meaningful choice between two safe active words. |
| Mechanic introduced | Two-choice planning with readable short-term consequences; neither choice is wrong. |
| Mechanics reinforced | Mixed directions, local/remote successors, zone rotation, deterministic transformations. |
| Provisional words | TURTLE, OCTOPUS, WHALE, SQUID, EEL, SEAL, MANTA, ORCA. |
| Direction mix | Balanced mix with one longer diagonal and several short recovery targets. |
| Active-objective presentation | Two targets with distinct length/location profiles; no reward labels or “best” answer. |
| Board evolution | One choice continues locally while the other shifts zones; both rejoin a valid completion structure later. |
| Local / remote successor purpose | Local: offer continuity. Remote: offer exploration. The choice should feel personal, not mathematically mandatory. |
| Zone travel | Player-controlled early branch, converging into an understandable mid-board rhythm. |
| Difficulty / time / decisions | 6/10; 75–105 seconds; 5–6 meaningful decisions. |
| Tutorial cue | Once only: “Choose your path.” Do not rank the choices. |
| Emotional beat | Ownership: “I chose how the board unfolded.” |
| Retention hypothesis | Safe agency increases replay curiosity and investment more than a passive difficulty spike. |
| Comprehension risk | Players may believe one choice can cause failure or may not perceive any consequence. |
| Required playtest evidence | Players choose both branches across sessions; can describe the visible consequence; do not hesitate from fear; replay interest. |
| Implementation dependency | External trust test, branch-comparison evidence, and exhaustive proof that every order completes. |
| Status | Proposed. |

### Level 6 — Calm Waters

| Blueprint field | Design intention |
|---|---|
| Sub-theme | Sunny Cove |
| Primary learning objective | Consolidate the core loop fluently after Level 5’s planning demand. |
| Mechanic introduced | None. Specifically, no obstacle or failure pressure. |
| Mechanics reinforced | Straight and gentle diagonal search, local succession, one predictable remote shift. |
| Provisional words | LAGOON, BREEZE, FLOAT, SUNNY, WATER, PEBBLE, CANOE, DOCK. |
| Direction mix | Mostly horizontal/vertical with two easy diagonals. |
| Active-objective presentation | Two familiar targets with generous visual separation. |
| Board evolution | Short, legible transformation chains with fewer cross-zone jumps. |
| Local / remote successor purpose | Local: reward fluency. Remote: one late reminder of board-wide attention. |
| Zone travel | Low-to-moderate; return attention smoothly rather than zigzagging. |
| Difficulty / time / decisions | 3/10; 50–75 seconds; about 3 meaningful decisions. |
| Tutorial cue | None. |
| Emotional beat | Relief and flow. |
| Retention hypothesis | A deliberate easy win prevents Level 5 from becoming an early churn wall and makes mastery feel real. |
| Comprehension risk | Relief may feel repetitive if animations are slow; pacing must remain brisk. |
| Required playtest evidence | Faster completion, lower hesitation, no tutorial demand, strong voluntary Level 7 start. |
| Implementation dependency | Level 5 difficulty evidence; maintain a clearly lower measured cognitive load. |
| Status | Proposed. |

### Level 7 — Four Currents

| Blueprint field | Design intention |
|---|---|
| Sub-theme | Pirate Shoals |
| Primary learning objective | Combine known directions, transformations, and zone travel without new instruction. |
| Mechanic introduced | None; this is the first broad combination level. |
| Mechanics reinforced | Four directions, reverse dragging, local/remote succession, two-choice planning. |
| Provisional words | PIRATE, SAILOR, CHEST, GOLD, MAP, SHIP, ROPE, MAST. |
| Direction mix | Two of each canonical direction across the complete objective set. |
| Active-objective presentation | Two targets; alternate short and long words so visual search has a rhythm. |
| Board evolution | Known patterns combine in new sequences, including one local-to-remote-to-local passage. |
| Local / remote successor purpose | Local: confirm causal reading under mixed directions. Remote: test attention movement without a cue. |
| Zone travel | Full-board rotation, but never more than two consecutive distant shifts. |
| Difficulty / time / decisions | 6/10; 75–105 seconds; 5–6 meaningful decisions. |
| Tutorial cue | None; a just-in-time hint may remain available after sustained idle. |
| Emotional beat | Competence under variety. |
| Retention hypothesis | Recombining mastered rules provides challenge without breaking trust. |
| Comprehension risk | Mixed direction and zone demands may stack into visual overload. |
| Required playtest evidence | Stable accuracy across all directions; no repeated rail-to-board confusion; no sudden completion-time spike. |
| Implementation dependency | Levels 3–6 evidence and validated mobile path visibility. |
| Status | Proposed. |

### Level 8 — See the Change

| Blueprint field | Design intention |
|---|---|
| Sub-theme | Sunken Jewels |
| Primary learning objective | Anticipate what a changed letter may create before the transformation finishes. |
| Mechanic introduced | Transformation prediction as a reasoning task, without adding a new system. |
| Mechanics reinforced | Mixed directions, local succession, two-choice planning, zone rotation. |
| Provisional words | SPARKLE, JEWEL, GEM, SHINE, BRIGHT, GLASS, RING, RUBY. |
| Direction mix | Mixed; transformed cells should sit at legible intersections, not visually dense clusters. |
| Active-objective presentation | Two targets; no preview of the answer and no extra iconography. |
| Board evolution | Successors use visible latent letter runs so a careful player can infer the likely changed cell. |
| Local / remote successor purpose | Local: reward prediction immediately. Remote: preserve choice while preventing tunnel vision. |
| Zone travel | Moderate; anticipation is the main load, so avoid maximum travel complexity. |
| Difficulty / time / decisions | 7/10; 80–110 seconds; about 6 meaningful decisions. |
| Tutorial cue | Once only: “Watch what changes.” Do not explain the resulting word. |
| Emotional beat | Cleverness: “I saw that coming.” |
| Retention hypothesis | Anticipation turns the transformation from spectacle into a learnable mastery loop. |
| Comprehension risk | If latent letters are too noisy, prediction feels like guessing and damages trust. |
| Required playtest evidence | Player points to likely change area; changed letter noticed; successor explanation improves; no increase in “random” descriptions. |
| Implementation dependency | Validated transformation readability and authorability review before exact-board work. |
| Status | Proposed. |

### Level 9 — Into the Deep

| Blueprint field | Design intention |
|---|---|
| Sub-theme | Ancient Ruins |
| Primary learning objective | Demonstrate independent mastery under a controlled difficulty peak. |
| Mechanic introduced | None. |
| Mechanics reinforced | Every core direction, transformation anticipation, remote attention, and two-choice planning. |
| Provisional words | KRAKEN, TEMPLE, RUINS, DEPTH, ABYSS, DIVER, HELMET, TORCH. |
| Direction mix | Balanced four-direction mix with longer words distributed between simpler shorter paths. |
| Active-objective presentation | Two active targets; no tutorial decoration. |
| Board evolution | More alternating zones and less immediately obvious latent runs, while every cause remains authored and readable. |
| Local / remote successor purpose | Local: verify transformation comprehension. Remote: test autonomous board scanning. |
| Zone travel | Highest sustained travel of the first ten levels, followed by a simple final handoff. |
| Difficulty / time / decisions | 8/10; 90–120 seconds; about 7 meaningful decisions. |
| Tutorial cue | None; optional hint remains an unpunishing escape valve. |
| Emotional beat | Focused challenge and earned confidence. |
| Retention hypothesis | A fair mastery test increases commitment to finish Coral Conquest. |
| Comprehension risk | Primary predicted churn point: direction complexity, attention travel, and anticipation could combine into fatigue. |
| Required playtest evidence | Completion without explanation; limited idle spikes; hint use by state; no loss of causal trust; immediate willingness to try Level 10. |
| Implementation dependency | Difficulty telemetry must remain observational only for now; simplify authoring if external tests show stacked-load failure. |
| Status | Proposed. |

### Level 10 — Crown of Coral

| Blueprint field | Design intention |
|---|---|
| Sub-theme | Coral Palace |
| Primary learning objective | Demonstrate full Coral Conquest mastery and finish with a memorable payoff. |
| Mechanic introduced | None; the capstone recombines the proven core. |
| Mechanics reinforced | Four directions, reverse dragging, in-place transformations, local/remote successors, zone rotation, anticipation, and safe planning. |
| Provisional words | KING, QUEEN, CASTLE, GATE, THRONE, ROYAL, CROWN, VICTORY. |
| Direction mix | Balanced; early readable path, mid-level mixed-direction choice, and a clear final word. |
| Active-objective presentation | Two active targets until the closing authored handoff; final target may stand alone for ceremony. |
| Board evolution | A readable recap of the chapter’s skills culminating in a final transformation that visually completes the Coral Palace idea. |
| Local / remote successor purpose | Local: deliver the final “I understand this” transformation. Remote: make the board feel fully conquered before the closing target. |
| Zone travel | Deliberate whole-board tour ending in a stable visual focal area. |
| Difficulty / time / decisions | 9/10; 95–125 seconds; 7–8 meaningful decisions. |
| Tutorial cue | None. Completion presentation should celebrate mastery without introducing economy or progression systems. |
| Emotional beat | Triumph, closure, and appetite for the next chapter. |
| Retention hypothesis | A legible capstone plus visible chapter completion creates stronger continuation intent than an arbitrary difficulty wall. |
| Comprehension risk | Excess length or visual ceremony may obscure the final causal transformation. |
| Required playtest evidence | Independent completion; player can explain the living-board rule; final transformation noticed; voluntary next-chapter intent. |
| Implementation dependency | All earlier gates, Level 9 churn review, and a separate future decision about non-economic completion presentation. |
| Status | Proposed. |

## 5. Provisional vocabulary summary

| Level | Candidate words |
|---:|---|
| 1 | SHORE, CORAL, STAR, REEF, WAVE, PEARL, OCEAN, FIN — fixed and protected |
| 2 | SAND, TIDE, SHELL, BOAT, FISH, PALM, COVE, ROCK |
| 3 | CRAB, KELP, DOLPHIN, RAY, SURF, BEACH, FOAM, SWIM |
| 4 | ANCHOR, ISLAND, SEAGULL, HARBOR, CLIFF, CAVE, STORM, LIGHT |
| 5 | TURTLE, OCTOPUS, WHALE, SQUID, EEL, SEAL, MANTA, ORCA |
| 6 | LAGOON, BREEZE, FLOAT, SUNNY, WATER, PEBBLE, CANOE, DOCK |
| 7 | PIRATE, SAILOR, CHEST, GOLD, MAP, SHIP, ROPE, MAST |
| 8 | SPARKLE, JEWEL, GEM, SHINE, BRIGHT, GLASS, RING, RUBY |
| 9 | KRAKEN, TEMPLE, RUINS, DEPTH, ABYSS, DIVER, HELMET, TORCH |
| 10 | KING, QUEEN, CASTLE, GATE, THRONE, ROYAL, CROWN, VICTORY |

Except for protected Level 1, these are nonbinding design candidates. They favor familiar, visually distinct vocabulary, mostly 3–7 letters, and avoid cross-level repetition. `VICTORY` is intentionally seven letters; no exact board promise is implied.

## 6. Mechanics introduction matrix

Legend: **D** demonstrated, **P** practised, **C** combined, **M** mastery-tested, **—** not intentionally surfaced.

| Mechanic | L1 | L2 | L3 | L4 | L5 | L6 | L7 | L8 | L9 | L10 | Recommendation |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| Horizontal paths | D | P | C | C | C | P | C | C | M | M | Core from the first interaction. |
| Vertical paths | D | P | P | C | C | P | C | C | M | M | Practise explicitly before adding attention load. |
| Falling diagonals | D | — | P | C | C | P | C | C | M | M | Level 1 exposes it; Level 3 teaches it intentionally. |
| Rising diagonals | D | — | P | C | C | P | C | C | M | M | Same pacing as falling diagonals. |
| Reverse-drag normalization | D | P | P | P | C | P | C | C | M | M | Quiet comfort feature, never a separate reverse target. |
| In-place transformations | D | P | P | C | C | P | C | M | M | M | The defining core mechanic. |
| Local successors | D | P | P | C | C | P | C | M | M | M | Maintain obvious causality throughout. |
| Remote successors | D | — | — | P | C | P | C | C | M | M | Teach intentionally at Level 4 after trust forms. |
| Zone rotation | D | — | — | P | C | P | C | C | M | M | Increase gradually; never randomize. |
| Two-choice planning | D | P | P | P | D | P | C | C | M | M | Level 5 is the first explicit planning lesson. |
| Hints | — | — | Optional | Optional | Optional | Optional | Optional | Optional | Optional | Optional | Permit as a quiet, unlimited escape valve after sustained idle; never require or mastery-test it in Levels 1–10. Final surfacing awaits playtest. |
| Limited moves | — | — | — | — | — | — | — | — | — | — | Delay until after Level 10. Failure pressure would contaminate comprehension data. |
| Obstacles | — | — | — | — | — | — | — | — | — | — | Delay until after Level 10. Level 6 should be relief, not friction. |
| Combos | — | — | — | — | — | — | — | — | — | — | Exclude as teaching/pressure in the first ten. Existing scoring capability may remain technically separate, but should not direct early decisions until the core is proven. |
| Power-ups | — | — | — | — | — | — | — | — | — | — | Delay until after Level 10; they can mask whether authored transformations are understandable. |

## 7. Difficulty and emotional curve

Scale: 1 is minimal, 10 is highest within the first chapter. Confidence is the expected player feeling, not a difficulty value.

| Level | Search | Transform | Choice | Direction | Attention travel | Failure pressure | Tutorial dependence | Expected confidence | Emotional role |
|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| 1 | 1 | 2 | 2 | 2 | 2 | 0 | 3 | Growing | Immediate competence and first surprise |
| 2 | 2 | 2 | 2 | 2 | 2 | 0 | 1 | High | Trust through repetition |
| 3 | 3 | 3 | 2 | 4 | 3 | 0 | 2 | Growing | Discovery of directional fluency |
| 4 | 3 | 3 | 3 | 4 | 5 | 0 | 2 | Stable | Board-wide curiosity |
| 5 | 4 | 4 | 6 | 5 | 5 | 0 | 2 | Tested | Ownership through choice |
| 6 | 2 | 2 | 3 | 3 | 3 | 0 | 0 | Very high | Relief and flow |
| 7 | 5 | 5 | 5 | 6 | 6 | 0 | 0 | High | Combined-skill competence |
| 8 | 5 | 7 | 6 | 6 | 5 | 0 | 1 | Clever | First anticipation mastery |
| 9 | 7 | 7 | 7 | 8 | 8 | 0 | 0 | Challenged | Controlled mastery test |
| 10 | 7 | 8 | 8 | 8 | 7 | 0 | 0 | Triumphant | Rewarding chapter conclusion |

The curve intentionally dips at Level 6. Level 9 is the largest predicted churn point because it combines direction complexity, transformation anticipation, and cross-board attention. Its mitigation is not a new helper system: use familiar words, alternate demanding targets with short readable ones, preserve two safe choices, and end with a simple handoff. If playtests show repeated idle spikes or “the board is random” explanations, reduce stacked complexity before changing any core rule.

## 8. Retention framework and observable signals

| Level | Primary retention purpose | Observable future playtest signals |
|---:|---|---|
| 1 | Immediate competence and curiosity | First valid word found quickly; cue not reread; changed letter noticed; player can say why a successor appeared; voluntarily starts Level 2. |
| 2 | Trust through repeatability | Faster first solve; successor understood without tutorial; no suspicion of randomness. |
| 3 | Expanding capability | Both diagonals completed comfortably; either physical drag direction used naturally; no bent-path confusion. |
| 4 | Anticipation across the board | Player relocates attention after a remote reveal without asking what to do; searches only active words. |
| 5 | Ownership through meaningful choice | Player deliberately chooses between targets, describes the consequence, and shows interest in the alternate order. |
| 6 | Visible progress and relief | Completion time falls; hesitation and hint demand fall; player promptly starts Level 7. |
| 7 | Developing fluency | Stable accuracy across directions; no tutorial request; mixed succession remains explainable. |
| 8 | Anticipatory mastery | Player identifies likely change areas before completion; describes transformation as causal, not lucky. |
| 9 | Commitment under fair challenge | Completes without external explanation; idle spikes remain bounded; does not abandon before Level 10. |
| 10 | Desire to continue Coral Conquest | Player explains the core loop accurately, recognizes mastery, and voluntarily seeks the next chapter. |

The most important hypothesis is: **players who notice and correctly explain the first changed letter and local successor will trust later board evolution and voluntarily continue**. Until this is observed, later complexity and retention systems should not be used to compensate.

## 9. Churn risks

1. **Level 1 causal miss — highest strategic risk.** If the changed letter is not noticed, every later transformation can feel random. Validate timing and presentation before authoring Level 2.
2. **Level 4 attention loss.** A remote successor may be interpreted as a stall. Keep one active alternative visible and measure acquisition time.
3. **Level 5 false-risk perception.** Players may fear choosing the “wrong” word. Both choices must visibly remain safe and consequential.
4. **Level 7 stacked visual load.** Four directions plus zone travel may overwhelm narrow screens. Reduce sequence density before adding assistance.
5. **Level 9 mastery wall — highest immediate churn point.** Provide familiar vocabulary, rhythmic relief inside the level, and an optional non-punitive hint. Do not add failure pressure.
6. **Level 10 anticlimax.** A capstone that is only longer will feel like work. Its final transformation and completion presentation must communicate closure without introducing an economy system.

## 10. Reusable Golden-level pre-authoring template

Copy and complete this section before any exact Golden Level is authored.

### Identity and purpose

- Proposed level number and working title:
- Theme/sub-theme:
- Single primary level purpose:
- Player knowledge assumed on entry:
- New learning objective:
- Emotional beat:
- Retention hypothesis:

### Vocabulary and active-target design

- Candidate words and familiarity rationale:
- Potential visual/letter ambiguity:
- Intended active-target count and presentation:
- Intended meaningful decision count:
- Direction progression:
- Physical reverse-drag expectations:

### Living-board experience

- Transformation concept:
- Why the changed cell should be noticeable:
- Local-successor intention:
- Remote-successor intention:
- Zone-rotation intention:
- How player choice remains deterministic and safe:
- How the level avoids recovery, random repair, gravity, and refill:

### Pacing and comprehension

- Difficulty target by search / transformation / choice / direction / attention:
- Expected completion time:
- Tutorial requirement and removal condition:
- Likely confusion points:
- Churn risk and planned relief:
- Playtest questions:
- Observable success/failure evidence:

### Dependencies and gates

- Existing capability relied upon:
- Browser-unverified capability relied upon:
- Proposed capability required:
- Technical authoring/verifier dependency:
- Browser viewport, mouse, touch, reverse-drag, reduced-motion, race, reload, replay, and completion checks:
- Conditions that must pass before exact board authoring begins:
  1. Phase 1C browser verification complete.
  2. Small external comprehension playtest complete.
  3. Blueprint updated from observed evidence.
  4. Candidate vocabulary reviewed for familiarity and duplication.
  5. Direction, choice, zone, and difficulty goals approved.
  6. Exact authored graph can then be created and exhaustively verified.

This template is a design intake document. It does not replace the authored golden-level schema or verifier.

## 11. Validation gates

### Gate A — Phase 1C browser verification

Complete the existing handoff at `tools/golden-levels/PHASE_1C_BROWSER_VERIFICATION_HANDOFF.md`. Verify desktop and 390×844 mobile layout, mouse/touch/reverse drag, tutorial comprehension, transformation timing, reduced motion, input locking, rapid-input protection, deterministic replay, completion, Royal QA/hash agreement, and console health.

### Gate B — Small external comprehension playtest

Use several first-time players on real mobile devices where possible. Observe without coaching whether they:

- find the first word without help;
- notice the transformed letter;
- explain that the transformation created another word;
- trust that either active choice is safe;
- understand active, completed, and unnamed locked objectives;
- drag comfortably from either physical end;
- voluntarily continue.

### Gate C — Blueprint adjustment

Change the blueprint only from observed patterns, not isolated preference. Record the viewport/device, state, word, gesture, expected behavior, actual behavior, and player explanation for every material issue.

### Gate D — Golden Level 2 authoring

Only after Gates A–C pass may exact grids, paths, transformations, branches, successors, zones, hashes, and executable level data be authored. Golden Level 2 must then pass its own deterministic exhaustive verifier before browser testing.

### How findings route to changes

| Finding | Correct response |
|---|---|
| Player understands the rule but confirmation/flip feels too fast or slow | Change tutorial/transition timing only; preserve graph and logical lock. |
| Player understands after prompting but misses changed-cell or objective-state visuals | Change visual presentation only; preserve graph, words, paths, and transformations. |
| Multiple players understand Level 1 but later proposed load is too steep | Revise learning order, vocabulary, direction mix, zone travel, or decision targets in this blueprint. |
| Multiple players still cannot understand why the successor exists after timing and visual fixes | Document a genuine comprehension failure with reproducible evidence; review the protected graph only as the last option. |

Any Golden Level 1 graph change requires a documented comprehension failure and explicit approval. A browser limitation, animation preference, layout issue, or single-player opinion is not sufficient.

## 12. Open design decisions

1. Whether hints should remain invisible until sustained idle, appear as a persistent optional control, or stay out of Golden Levels entirely.
2. The measured time-to-first-word target after real mobile testing.
3. Whether the eight-slot objective rail remains readable at 390×844 without reducing touch space.
4. Whether Level 4’s remote-attention cue is necessary once Level 1 behavior is observed.
5. How strongly Level 5 should communicate consequence without implying a correct choice.
6. Whether Level 8 prediction is understandable without preview UI.
7. The acceptable completion-time and idle-spike limits for Level 9.
8. The non-economic visual form of Level 10’s chapter-completion payoff.
9. Which candidate words survive technical authorability and accidental-word audits.

All remain provisional pending Golden Level 1 browser and external comprehension evidence.

## 13. Recommendation once browser access is available

1. Complete the Phase 1C browser-verification handoff without modifying the protected graph.
2. Run the small external Level 1 comprehension test and record observable behavior, not opinions alone.
3. Adjust tutorial timing or visual presentation first; adjust this learning curve only when confusion patterns justify it.
4. Reconfirm the 25-state, 40-branch, 70-order graph and all 62 automated tests after any permitted presentation change.
5. Approve or revise this blueprint.
6. Begin Golden Level 2 pre-authoring with the reusable template—only then create exact authored data and a new exhaustive verification target.

Until those steps occur, preserve the current verified state. Do not author Levels 2–10, add later mechanics, start a later phase, or publish.

