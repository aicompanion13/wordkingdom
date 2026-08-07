import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { CanonicalBoardModel } from "../game/v3/canonical-board-state.ts";
import {
  canonicalDirectionForPath,
  normalizeCanonicalGesturePath,
  scanCanonicalWord,
} from "../game/v3/direction-contract.js";
import {
  acceptGoldenTutorialWord,
  beginGoldenTutorialDrag,
  completeFtue,
  completeGoldenTutorialCue,
  createFtueProgress,
  createGoldenTutorialState,
  FTUE_HINT_LIMIT,
  ftueGuidanceEnabled,
  ftueStallStage,
  goldenTransitionPresentation,
  isUsefulActivePath,
  markFtueBeat,
  parseFtueProgress,
  revealGoldenTutorialTransformation,
  serializeFtueProgress,
  showGoldenCauseExplanation,
  showGoldenDragInstruction,
  skipFtue,
} from "../game/v3/golden-tutorial-state.ts";
import { enumerateCompleteMoveOrders, verifyGoldenLevel } from "../tools/golden-levels/verifier.mjs";
import { auditReachableStates, verifyLevel } from "../tools/board-generator/verifier.js";

const level = JSON.parse(await readFile(
  new URL("../game/v3/data/golden-levels/golden_01.json", import.meta.url),
  "utf8",
));

function modelFor() {
  return new CanonicalBoardModel({
    levelId: level.levelId,
    seed: level.seed,
    initialGrid: level.initialGrid,
    authoredLevel: level,
    activatedAt: 1_000,
  });
}

function settleObjective(model, objectiveId, timestamp) {
  const objective = model.objective(objectiveId);
  assert.ok(objective);
  assert.equal(model.beginResolution(objectiveId, objective.expectedPath, timestamp), true);
  model.commitResolution();
  model.settleTransitions(timestamp + 1);
}

test("either physical drag order resolves the same canonical path", () => {
  const forwardModel = modelFor();
  const reverseModel = modelFor();
  const objective = forwardModel.objective("a0-shore");
  const forward = normalizeCanonicalGesturePath(objective.expectedPath);
  const reverse = normalizeCanonicalGesturePath([...objective.expectedPath].reverse());
  assert.deepEqual(reverse, forward);
  assert.equal(forwardModel.beginResolution(objective.id, forward, 2_000), true);
  assert.equal(reverseModel.beginResolution(objective.id, reverse, 2_000), true);
  forwardModel.commitResolution();
  reverseModel.commitResolution();
  forwardModel.settleTransitions(2_001);
  reverseModel.settleTransitions(2_001);
  assert.deepEqual(reverseModel.snapshot(), forwardModel.snapshot());
});

test("reversed gesture input does not create a reverse target", () => {
  const model = modelFor();
  const objective = model.objective("a0-shore");
  const reversed = [...objective.expectedPath].reverse();
  assert.equal(canonicalDirectionForPath(reversed), null);
  assert.deepEqual(normalizeCanonicalGesturePath(reversed), objective.expectedPath);
  const appearances = scanCanonicalWord(model.grid(), objective.definition.word);
  assert.equal(appearances.length, 1);
  assert.deepEqual(appearances[0].path, objective.expectedPath);
});

test("hints retain canonical forward coordinates", () => {
  const model = modelFor();
  for (const objective of model.activeObjectives()) {
    assert.ok(canonicalDirectionForPath(objective.expectedPath));
  }
});

test("input remains locked throughout transformation", () => {
  const model = modelFor();
  const objective = model.objective("a0-shore");
  assert.equal(model.beginResolution(objective.id, objective.expectedPath, 2_000), true);
  assert.equal(model.canAcceptInput(), false);
  model.commitResolution();
  assert.equal(model.canAcceptInput(), false);
  model.settleTransitions(2_500);
  assert.equal(model.canAcceptInput(), true);
});

test("duplicate input cannot complete an objective twice", () => {
  const model = modelFor();
  const objective = model.objective("a0-shore");
  assert.equal(model.beginResolution(objective.id, objective.expectedPath, 2_000), true);
  assert.equal(model.beginResolution(objective.id, objective.expectedPath, 2_001), false);
  model.commitResolution();
  model.settleTransitions(2_500);
  assert.equal(model.beginResolution(objective.id, objective.expectedPath, 2_600), false);
  assert.equal(model.snapshot().completedObjectives.filter((id) => id === objective.id).length, 1);
});

test("inactive and completed targets cannot be collected", () => {
  const model = modelFor();
  const inactive = model.objective("a1-coral");
  assert.equal(model.beginResolution(inactive.id, inactive.expectedPath, 2_000), false);
  settleObjective(model, "a0-shore", 2_100);
  const completed = model.objective("a0-shore");
  assert.equal(model.beginResolution(completed.id, completed.expectedPath, 2_200), false);
});

for (const firstObjectiveId of ["a0-shore", "b0-wave"]) {
  test(`tutorial flow works if ${firstObjectiveId === "a0-shore" ? "SHORE" : "WAVE"} is selected first`, () => {
    let tutorial = createGoldenTutorialState();
    tutorial = acceptGoldenTutorialWord(tutorial, firstObjectiveId);
    assert.equal(tutorial.phase, "FIRST_WORD_ACCEPTED");
    assert.equal(tutorial.message, null);
    assert.equal(tutorial.firstSolvedObjectiveId, firstObjectiveId);
    tutorial = revealGoldenTutorialTransformation(
      tutorial,
      firstObjectiveId === "a0-shore" ? "a1-coral" : "b1-pearl",
    );
    assert.equal(tutorial.phase, "FIRST_TRANSFORMATION");
    assert.equal(tutorial.message, "The board changed.");
    tutorial = completeGoldenTutorialCue(tutorial);
    assert.equal(tutorial.phase, "UNDERSTOOD");
    assert.equal(tutorial.message, null);
  });
}

test("tutorial state does not affect the canonical board hash", () => {
  const model = modelFor();
  const before = model.snapshot().authored.currentBoardHash;
  let tutorial = createGoldenTutorialState();
  tutorial = acceptGoldenTutorialWord(tutorial, "a0-shore");
  tutorial = revealGoldenTutorialTransformation(tutorial, "a1-coral");
  assert.equal(tutorial.phase, "FIRST_TRANSFORMATION");
  assert.equal(model.snapshot().authored.currentBoardHash, before);
});

test("reduced-motion presentation preserves logical timing and state", () => {
  const full = goldenTransitionPresentation(false);
  const reduced = goldenTransitionPresentation(true);
  assert.equal(full.confirmationMs, reduced.confirmationMs);
  assert.equal(full.transformationMs, reduced.transformationMs);
  assert.equal(full.totalInputLockMs, reduced.totalInputLockMs);
  assert.equal(full.visualMode, "FLIP");
  assert.equal(reduced.visualMode, "CROSSFADE");
});

test("FTUE progress serializes, restores, and ignores invalid storage", () => {
  let progress = createFtueProgress();
  progress = markFtueBeat(progress, "FIRST_DRAG");
  progress = markFtueBeat(progress, "FIRST_DRAG");
  progress = markFtueBeat(progress, "FIRST_CHANGE");
  assert.deepEqual(progress.completedBeats, ["FIRST_DRAG", "FIRST_CHANGE"]);
  assert.deepEqual(parseFtueProgress(serializeFtueProgress(progress)), progress);
  assert.deepEqual(parseFtueProgress("not-json"), createFtueProgress());
});

test("drag instruction dismisses on useful forward or reverse progress", () => {
  const shore = modelFor().objective("a0-shore");
  const tileIds = shore.expectedPath.map(([row, col]) => `generated-${level.seed}-tile-${row}-${col}`);
  let tutorial = showGoldenDragInstruction(createGoldenTutorialState());
  assert.equal(tutorial.message, "Swipe across the letters to find SHORE.");
  assert.equal(isUsefulActivePath(tileIds.slice(0, 2), [tileIds]), true);
  assert.equal(isUsefulActivePath([...tileIds].reverse().slice(0, 2), [tileIds]), true);
  assert.equal(isUsefulActivePath([tileIds[0], tileIds[2]], [tileIds]), false);
  tutorial = beginGoldenTutorialDrag(tutorial);
  assert.equal(tutorial.phase, "FIRST_DRAG");
  assert.equal(tutorial.message, null);
});

test("first-change explanation is optional and dismissible", () => {
  let tutorial = createGoldenTutorialState();
  tutorial = beginGoldenTutorialDrag(tutorial);
  tutorial = acceptGoldenTutorialWord(tutorial, "a0-shore");
  tutorial = revealGoldenTutorialTransformation(tutorial, "a1-coral");
  assert.equal(tutorial.message, "The board changed.");
  tutorial = showGoldenCauseExplanation(tutorial);
  assert.equal(tutorial.message, "A new word appeared.");
  tutorial = completeGoldenTutorialCue(tutorial);
  assert.equal(tutorial.phase, "UNDERSTOOD");
  assert.equal(tutorial.message, null);
});

test("stall assistance escalates without exceeding the three-hint rule", () => {
  const progress = createFtueProgress();
  assert.equal(ftueStallStage(6_999, 0, progress), "NONE");
  assert.equal(ftueStallStage(7_000, 0, progress), "OBJECTIVES");
  assert.equal(ftueStallStage(18_000, 0, progress), "SUGGESTION");
  assert.equal(ftueStallStage(23_000, 0, progress), "HINT");
  assert.equal(ftueStallStage(23_000, FTUE_HINT_LIMIT, progress), "SUGGESTION");
});

test("skip and completion persist separately from canonical state", () => {
  const model = modelFor();
  const hash = model.snapshot().authored.currentBoardHash;
  const skipped = skipFtue(createFtueProgress());
  assert.equal(skipped.hasCompletedFTUE, true);
  assert.equal(skipped.skipped, true);
  assert.equal(ftueGuidanceEnabled(skipped), false);
  assert.equal(createGoldenTutorialState(skipped).phase, "UNDERSTOOD");
  const completed = completeFtue(createFtueProgress());
  assert.equal(completed.hasCompletedFTUE, true);
  assert.equal(completed.skipped, false);
  assert.equal(model.snapshot().authored.currentBoardHash, hash);
});

test("reload and replay reproduce the same canonical states", () => {
  const sequence = enumerateCompleteMoveOrders(level)[34];
  const play = () => {
    const model = modelFor();
    const hashes = [model.snapshot().authored.currentBoardHash];
    sequence.forEach((objectiveId, index) => {
      settleObjective(model, objectiveId, 3_000 + index * 10);
      hashes.push(model.snapshot().authored.currentBoardHash);
    });
    return hashes;
  };
  assert.deepEqual(play(), play());
});

test("golden verifier still reports 25 states, 40 branches and 70 move orders", () => {
  const report = verifyGoldenLevel(level);
  assert.deepEqual(
    [report.reachableStates, report.reachableBranches, report.completeMoveOrders],
    [25, 40, 70],
  );
});

test("the 25 prototype levels remain unchanged and valid", async () => {
  let states = 0;
  let branches = 0;
  for (let number = 1; number <= 25; number += 1) {
    const name = `level_${String(number).padStart(2, "0")}.json`;
    const prototype = JSON.parse(await readFile(
      new URL(`../game/v3/data/generated-levels/${name}`, import.meta.url),
      "utf8",
    ));
    assert.equal(verifyLevel(prototype).allStagesVerified, true);
    const audit = auditReachableStates(prototype);
    states += audit.settledStates;
    branches += audit.reachableBranches;
  }
  assert.deepEqual([states, branches], [625, 1000]);
});
