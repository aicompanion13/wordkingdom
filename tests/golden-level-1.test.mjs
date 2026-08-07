import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { CanonicalBoardModel } from "../game/v3/canonical-board-state.ts";
import { canonicalBoardHash, primaryZoneForPath, validateGoldenPlacement } from "../game/v3/golden-level-contract.js";
import { enumerateCompleteMoveOrders, verifyGoldenLevel } from "../tools/golden-levels/verifier.mjs";
import { auditReachableStates, verifyLevel } from "../tools/board-generator/verifier.js";

const level = JSON.parse(await readFile(new URL("../game/v3/data/golden-levels/golden_01.json", import.meta.url), "utf8"));
const report = verifyGoldenLevel(level);
const clone = (value) => JSON.parse(JSON.stringify(value));

function modelFor(source = level) {
  return new CanonicalBoardModel({
    levelId: source.levelId,
    seed: source.seed,
    initialGrid: source.initialGrid,
    authoredLevel: source,
    activatedAt: 1_000,
  });
}

function playSequence(sequence, source = level) {
  const model = modelFor(source);
  const snapshots = [model.snapshot()];
  let timestamp = 1_000;
  for (const objectiveId of sequence) {
    const objective = model.objective(objectiveId);
    assert.ok(objective, objectiveId);
    timestamp += 10;
    assert.equal(model.beginResolution(objectiveId, objective.expectedPath, timestamp), true, objectiveId);
    model.commitResolution();
    model.settleTransitions(timestamp + 1);
    snapshots.push(model.snapshot());
  }
  return { model, snapshots };
}

test("1. Golden Level 1 contains exactly eight objectives", () => {
  assert.equal(level.objectiveCount, 8);
  assert.equal(level.objectives.length, 8);
});

test("2. its initial state has exactly two playable active targets", () => {
  const snapshot = modelFor().snapshot();
  assert.equal(snapshot.currentGameState, "ACTIVE");
  assert.equal(snapshot.activeObjectives.length, 2);
  assert.deepEqual(snapshot.activeObjectives, ["a0-shore", "b0-wave"]);
});

test("3. every settled non-completed state has one or normally two active targets", () => {
  for (const state of level.states.filter((candidate) => !candidate.expectedCompletion)) {
    assert.ok(state.activeObjectives.length >= 1);
    const aDone = state.completedObjectives.filter((id) => id.startsWith("a")).length === 4;
    const bDone = state.completedObjectives.filter((id) => id.startsWith("b")).length === 4;
    assert.equal(state.activeObjectives.length, aDone || bDone ? 1 : 2, state.id);
  }
});

test("4. no state has more than two active targets", () => {
  assert.equal(level.states.some((state) => state.activeObjectives.length > 2), false);
});

test("5. every selectable target has exactly one authored successor branch", () => {
  for (const state of level.states) for (const objectiveId of state.activeObjectives) {
    assert.equal(state.branches.filter((branch) => branch.objectiveId === objectiveId).length, 1, `${state.id}:${objectiveId}`);
  }
});

test("6. both possible initial choices remain valid", () => {
  for (const objectiveId of level.activationRules.initialActiveObjectives) {
    const model = modelFor();
    const objective = model.objective(objectiveId);
    assert.ok(objective);
    assert.equal(model.beginResolution(objectiveId, objective.expectedPath, 2_000), true);
    model.commitResolution();
    model.settleTransitions(2_001);
    assert.equal(model.snapshot().currentGameState, "ACTIVE");
  }
});

test("7. all reachable move orders reach COMPLETED", () => {
  const sequences = enumerateCompleteMoveOrders(level);
  assert.equal(sequences.length, 70);
  for (const sequence of sequences) assert.equal(playSequence(sequence).model.snapshot().currentGameState, "COMPLETED", sequence.join(","));
});

test("8. completion occurs only after all eight objectives", () => {
  const { snapshots } = playSequence(enumerateCompleteMoveOrders(level)[0]);
  snapshots.slice(0, -1).forEach((snapshot) => assert.notEqual(snapshot.currentGameState, "COMPLETED"));
  assert.equal(snapshots.at(-1).completedObjectives.length, 8);
});

test("9. the final move cannot activate recovery or replanning", () => {
  const snapshot = playSequence(enumerateCompleteMoveOrders(level)[0]).model.snapshot();
  assert.equal(snapshot.currentGameState, "COMPLETED");
  assert.equal(snapshot.recoveryReason, undefined);
  assert.equal(snapshot.replanningReason, undefined);
  assert.equal(snapshot.authored.branchValidationResult, "COMPLETED");
});

test("10. every active target appears exactly once", () => {
  assert.equal(report.valid, true);
  assert.equal(report.reachableStates, 25);
});

test("11. inactive targets never appear prematurely", () => {
  assert.equal(report.errors.some((error) => /inactive target appears prematurely/i.test(error)), false);
});

test("12. completed targets cannot be collected again", () => {
  assert.equal(report.errors.some((error) => /completed target remains collectible/i.test(error)), false);
});

test("13. all target directions use the shared forward-direction contract", () => {
  level.objectives.forEach((objective) => assert.equal(validateGoldenPlacement(objective).directionMatches, true, objective.id));
});

test("14. tile IDs and coordinates remain stable across every move", () => {
  const { snapshots } = playSequence(enumerateCompleteMoveOrders(level)[12]);
  const identity = snapshots[0].tiles.map(({ id, row, col }) => ({ id, row, col }));
  snapshots.forEach((snapshot) => assert.deepEqual(snapshot.tiles.map(({ id, row, col }) => ({ id, row, col })), identity));
});

test("15. only authored letters transform", () => {
  const sequence = enumerateCompleteMoveOrders(level)[23];
  const { snapshots } = playSequence(sequence);
  for (let index = 0; index < sequence.length; index += 1) {
    const before = snapshots[index];
    const after = snapshots[index + 1];
    const branch = before.authored.availableBranches.find(({ objectiveId }) => objectiveId === sequence[index]);
    const changed = after.tiles.filter((tile, tileIndex) => tile.letter !== before.tiles[tileIndex].letter);
    assert.deepEqual(changed.map(({ row, col }) => [row, col]), branch.transformations.map(({ cell }) => cell));
  }
});

test("16. board hashes reproduce deterministically", () => {
  for (const sequence of enumerateCompleteMoveOrders(level)) {
    for (const snapshot of playSequence(sequence).snapshots) {
      assert.equal(snapshot.authored.currentBoardHash, snapshot.authored.expectedBoardHash);
      const grid = Array.from({ length: 8 }, (_, row) => snapshot.tiles.filter((tile) => tile.row === row).sort((a, b) => a.col - b.col).map(({ letter }) => letter));
      assert.equal(canonicalBoardHash(grid), snapshot.authored.currentBoardHash);
    }
  }
});

test("17. replay reproduces the exact canonical states", () => {
  const sequence = enumerateCompleteMoveOrders(level)[41];
  assert.deepEqual(playSequence(sequence).snapshots, playSequence(sequence).snapshots);
});

test("18. local-successor metadata matches transformed shared tiles", () => {
  for (const branch of level.states.flatMap((state) => state.branches).filter(({ localSuccessor }) => localSuccessor)) {
    const changed = new Set(branch.transformations.map(({ cell }) => cell.join(",")));
    assert.ok(branch.localSuccessor.sharedCells.some((cell) => changed.has(cell.join(","))), branch.id);
  }
});

test("19. remote-successor metadata matches actual board zones", () => {
  const objectives = new Map(level.objectives.map((objective) => [objective.id, objective]));
  for (const branch of level.states.flatMap((state) => state.branches).filter(({ remoteSuccessor }) => remoteSuccessor)) {
    const remote = objectives.get(branch.remoteSuccessor.objectiveId);
    assert.equal(remote.primaryZone, branch.remoteSuccessor.zone);
    assert.equal(primaryZoneForPath(remote.path).id, remote.primaryZone);
  }
});

test("20. zone history satisfies the Level 1 rotation rules", () => {
  assert.equal(report.consecutiveZoneReuse, 0);
  assert.equal(Object.values(report.zoneUsage).filter((count) => count === 1).length, 8);
});

test("21. no reachable state requires reshuffling or recovery", () => {
  assert.equal(report.recoveryUsage, 0);
  for (const sequence of enumerateCompleteMoveOrders(level)) {
    const snapshots = playSequence(sequence).snapshots;
    assert.equal(snapshots.some((snapshot) => snapshot.currentGameState === "RECOVERY"), false);
    assert.equal(JSON.stringify(snapshots).includes("reshuff"), false);
  }
});

test("22. invalid or missing authored branches prevent ACTIVE", () => {
  const invalid = clone(level);
  invalid.states.find(({ id }) => id === invalid.activationRules.initialStateId).branches.pop();
  const snapshot = modelFor(invalid).snapshot();
  assert.equal(snapshot.currentGameState, "RECOVERY");
  assert.equal(snapshot.lastValidationResult.code, "AUTHORED_BRANCH_MISSING");
});

test("23. the 25 prototype levels remain valid and unaffected", async () => {
  let states = 0;
  let branches = 0;
  for (let number = 1; number <= 25; number += 1) {
    const name = `level_${String(number).padStart(2, "0")}.json`;
    const prototype = JSON.parse(await readFile(new URL(`../game/v3/data/generated-levels/${name}`, import.meta.url), "utf8"));
    assert.equal(verifyLevel(prototype).allStagesVerified, true);
    const audit = auditReachableStates(prototype);
    states += audit.settledStates;
    branches += audit.reachableBranches;
  }
  assert.deepEqual({ states, branches }, { states: 625, branches: 1000 });
});

test("24. the exhaustive authored verifier covers all states, branches, and move orders", () => {
  assert.deepEqual(
    { states: report.reachableStates, branches: report.reachableBranches, orders: report.completeMoveOrders, duplicates: report.duplicateStates },
    { states: 25, branches: 40, orders: 70, duplicates: 16 },
  );
});
