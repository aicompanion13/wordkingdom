import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CanonicalBoardModel,
} from "../game/v3/canonical-board-state.ts";
import {
  CANONICAL_DIRECTIONS,
  canonicalDirectionForPath,
  isCanonicalForwardPath,
  scanCanonicalWord,
} from "../game/v3/direction-contract.js";
import { generateLevel } from "../tools/board-generator/generator.js";
import {
  auditReachableStates,
  verifyLevel,
} from "../tools/board-generator/verifier.js";

const NODE_NOW = 1_000;
const HORIZONTAL = [[0, 0], [0, 1], [0, 2], [0, 3]];

function emptyGrid(letter = "Q") {
  return Array.from({ length: 8 }, () => Array(8).fill(letter));
}

function place(grid, word, path) {
  path.forEach(([row, column], index) => {
    grid[row][column] = word[index];
  });
}

function definition(word, path, replacement = "X") {
  return {
    word,
    path,
    type: "STATIC",
    transmuteMap: path.map((cell) => ({ cell, letter: replacement })),
  };
}

function modelFor({
  word = "WORD",
  path = HORIZONTAL,
  duplicatePath,
  omitWord = false,
  seed = 77,
} = {}) {
  const grid = emptyGrid();
  if (!omitWord) place(grid, word, path);
  if (duplicatePath) place(grid, word, duplicatePath);
  return new CanonicalBoardModel({
    levelId: "test-level",
    seed,
    initialGrid: grid,
    stages: [{ stageIndex: 0, activeWords: [definition(word, path)] }],
    activatedAt: NODE_NOW,
  });
}

function solveOnlyObjective(model, acceptedAt = NODE_NOW + 1) {
  const objective = model.activeObjectives()[0];
  assert.ok(objective);
  assert.equal(model.beginResolution(objective.id, objective.expectedPath, acceptedAt), true);
  const result = model.commitResolution();
  model.settleTransitions(acceptedAt + 10);
  return result;
}

test("zero remaining objectives always produces COMPLETED", () => {
  const model = modelFor();
  solveOnlyObjective(model);
  assert.equal(model.snapshot().currentGameState, "COMPLETED");
  assert.equal(model.snapshot().remainingObjectives.length, 0);
});

test("completion can never trigger recovery or reshuffling", () => {
  const model = modelFor();
  solveOnlyObjective(model);
  model.evaluateSettledBoard();
  const snapshot = model.snapshot();
  assert.equal(snapshot.currentGameState, "COMPLETED");
  assert.equal(snapshot.lastValidationResult.code, "COMPLETED");
  assert.equal(snapshot.recoveryReason, undefined);
  assert.equal(JSON.stringify(snapshot).includes("reshuff"), false);
});

test("playable paths with valid consequences produce ACTIVE", () => {
  const snapshot = modelFor().snapshot();
  assert.equal(snapshot.currentGameState, "ACTIVE");
  assert.equal(snapshot.validatedActiveTargetPaths[0].appearanceCount, 1);
  assert.equal(snapshot.validatedActiveTargetPaths[0].hasValidatedConsequence, true);
});

test("a stale branch triggers controlled replanning, not reshuffling", () => {
  const model = modelFor();
  const objective = model.activeObjectives()[0];
  model.debugSetExpectedPath(objective.id, [[7, 0], [7, 1], [7, 2], [7, 3]]);
  model.evaluateSettledBoard();
  const snapshot = model.snapshot();
  assert.equal(snapshot.currentGameState, "ACTIVE");
  assert.equal(snapshot.lastValidationResult.code, "STALE_BRANCH");
  assert.equal(snapshot.branchMismatch?.word, "WORD");
  assert.match(snapshot.replanningReason ?? "", /stale path/i);
  assert.equal(JSON.stringify(snapshot).includes("reshuff"), false);
});

test("an unsettled animation cannot trigger solvability validation", () => {
  const model = modelFor();
  const objective = model.activeObjectives()[0];
  assert.equal(model.beginResolution(objective.id, objective.expectedPath, NODE_NOW), true);
  const revision = model.snapshot().lastValidationResult.validationRevision;
  model.evaluateSettledBoard();
  const snapshot = model.snapshot();
  assert.equal(snapshot.currentGameState, "VALIDATING");
  assert.equal(snapshot.lastValidationResult.code, "BOARD_UNSETTLED");
  assert.equal(snapshot.lastValidationResult.validationRevision, revision);
});

test("recovery cannot occur while a valid playable path exists", () => {
  const model = modelFor();
  model.evaluateSettledBoard();
  assert.equal(model.snapshot().currentGameState, "ACTIVE");
  assert.equal(model.snapshot().recoveryReason, undefined);
});

test("tile IDs and coordinates never change when letters transform", () => {
  const model = modelFor();
  const before = model.snapshot().tiles.map(({ id, row, col }) => ({ id, row, col }));
  solveOnlyObjective(model);
  const after = model.snapshot().tiles.map(({ id, row, col }) => ({ id, row, col }));
  assert.deepEqual(after, before);
});

test("word completion performs no gravity or column collapse", () => {
  const model = modelFor();
  const before = model.snapshot().tiles;
  solveOnlyObjective(model);
  const after = model.snapshot().tiles;
  for (const tile of after) {
    const original = before.find((candidate) => candidate.id === tile.id);
    assert.deepEqual(
      { row: tile.row, col: tile.col },
      { row: original.row, col: original.col },
    );
  }
  assert.equal(after.filter((tile) => tile.letter === "X").length, 4);
});

test("the scanner detects all four canonical directions", () => {
  const cases = [
    ["WORD", [[0, 0], [0, 1], [0, 2], [0, 3]], "H"],
    ["TREE", [[1, 0], [2, 0], [3, 0], [4, 0]], "V"],
    ["LION", [[1, 1], [2, 2], [3, 3], [4, 4]], "D"],
    ["STAR", [[1, 7], [2, 6], [3, 5], [4, 4]], "A"],
  ];
  for (const [word, path, direction] of cases) {
    const grid = emptyGrid();
    place(grid, word, path);
    const matches = scanCanonicalWord(grid, word);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].direction, direction);
  }
});

test("the scanner and straight-path validation reject reverse directions", () => {
  const reverseHorizontal = [[0, 3], [0, 2], [0, 1], [0, 0]];
  const reverseVertical = [[3, 0], [2, 0], [1, 0], [0, 0]];
  assert.equal(canonicalDirectionForPath(reverseHorizontal), null);
  assert.equal(canonicalDirectionForPath(reverseVertical), null);
  assert.equal(isCanonicalForwardPath(reverseHorizontal), false);
});

test("duplicate active-target appearances prevent ACTIVE", () => {
  const model = modelFor({
    duplicatePath: [[1, 0], [1, 1], [1, 2], [1, 3]],
  });
  const snapshot = model.snapshot();
  assert.equal(snapshot.currentGameState, "RECOVERY");
  assert.equal(snapshot.lastValidationResult.code, "DUPLICATE_TARGET");
  assert.equal(model.canAcceptInput(), false);
});

test("input remains locked through resolution, transformation, and validation", () => {
  const model = modelFor();
  const objective = model.activeObjectives()[0];
  assert.equal(model.canAcceptInput(), true);
  model.beginResolution(objective.id, objective.expectedPath, NODE_NOW);
  assert.equal(model.canAcceptInput(), false);
  model.commitResolution();
  assert.equal(model.canAcceptInput(), false);
  model.settleTransitions(NODE_NOW + 10);
  assert.equal(model.snapshot().currentGameState, "COMPLETED");
  assert.equal(model.canAcceptInput(), false);
});

test("the same seed and move history reproduce the same canonical state", () => {
  const first = modelFor({ seed: 991 });
  const second = modelFor({ seed: 991 });
  solveOnlyObjective(first, 2_000);
  solveOnlyObjective(second, 2_000);
  assert.deepEqual(first.snapshot(), second.snapshot());
});

test("a completed level cannot accept further moves or mutate the board", () => {
  const model = modelFor();
  const objective = model.activeObjectives()[0];
  solveOnlyObjective(model);
  const before = model.snapshot();
  assert.equal(model.beginResolution(objective.id, objective.expectedPath, 9_999), false);
  assert.deepEqual(model.snapshot(), before);
});

test("the generator can never emit an unsupported target direction", async () => {
  const config = JSON.parse(
    await readFile(new URL("../tools/board-generator/gen_config.json", import.meta.url), "utf8"),
  );
  const dictionary = (
    await readFile(new URL("../tools/board-generator/data/wordlist.txt", import.meta.url), "utf8")
  ).split(/\r?\n/).filter(Boolean);
  const { level } = generateLevel(config, dictionary, config.seed);
  for (const entry of level.stages.flatMap((stage) => stage.activeWords)) {
    assert.ok(canonicalDirectionForPath(entry.path));
    if (entry.revealsPath) assert.ok(canonicalDirectionForPath(entry.revealsPath));
  }
});

test("all 25 generated levels contain only forward target placements", async () => {
  for (let levelNumber = 1; levelNumber <= 25; levelNumber += 1) {
    const name = `level_${String(levelNumber).padStart(2, "0")}.json`;
    const level = JSON.parse(
      await readFile(new URL(`../game/v3/data/generated-levels/${name}`, import.meta.url), "utf8"),
    );
    for (const entry of level.stages.flatMap((stage) => stage.activeWords)) {
      assert.ok(canonicalDirectionForPath(entry.path), `${name}:${entry.word}`);
    }
  }
});

test("runtime scanning and generation import the same direction contract", async () => {
  assert.deepEqual(CANONICAL_DIRECTIONS.map(({ key }) => key), ["H", "V", "D", "A"]);
  const generatorSource = await readFile(
    new URL("../tools/board-generator/generator.js", import.meta.url),
    "utf8",
  );
  const runnerSource = await readFile(
    new URL("../game/v3/generated-level-runner.ts", import.meta.url),
    "utf8",
  );
  assert.match(generatorSource, /game\/v3\/direction-contract\.js/);
  assert.match(runnerSource, /\.\/direction-contract\.js/);
});

test("hint paths use canonical forward coordinates", () => {
  const model = modelFor();
  for (const objective of model.activeObjectives()) {
    assert.equal(isCanonicalForwardPath(objective.expectedPath), true);
  }
});

test("the canonical model rejects a raw reverse path before gesture normalization", () => {
  const model = modelFor();
  const objective = model.activeObjectives()[0];
  assert.equal(
    model.beginResolution(objective.id, [...objective.expectedPath].reverse(), NODE_NOW),
    false,
  );
  assert.equal(model.snapshot().currentGameState, "ACTIVE");
});

test("every regenerated level passes the complete reachable-state audit", async () => {
  let levels = 0;
  let branches = 0;
  let states = 0;
  for (let levelNumber = 1; levelNumber <= 25; levelNumber += 1) {
    const name = `level_${String(levelNumber).padStart(2, "0")}.json`;
    const level = JSON.parse(
      await readFile(new URL(`../game/v3/data/generated-levels/${name}`, import.meta.url), "utf8"),
    );
    const verification = verifyLevel(level);
    const audit = auditReachableStates(level);
    assert.equal(verification.allStagesVerified, true);
    assert.equal(audit.forwardOnly, true);
    assert.equal(audit.deterministic, true);
    levels += 1;
    branches += audit.reachableBranches;
    states += audit.settledStates;
  }
  assert.deepEqual({ levels, branches, states }, { levels: 25, branches: 1000, states: 625 });
});

test("the canonical runtime completes every regenerated level without recovery", async () => {
  for (let levelNumber = 1; levelNumber <= 25; levelNumber += 1) {
    const name = `level_${String(levelNumber).padStart(2, "0")}.json`;
    const level = JSON.parse(
      await readFile(new URL(`../game/v3/data/generated-levels/${name}`, import.meta.url), "utf8"),
    );
    const model = new CanonicalBoardModel({
      levelId: name,
      seed: level.seed,
      initialGrid: level.initialGrid,
      stages: level.stages,
      activatedAt: NODE_NOW,
    });
    let timestamp = NODE_NOW;
    while (!model.isComplete()) {
      assert.equal(model.snapshot().currentGameState, "ACTIVE", name);
      const objective = model.activeObjectives()[0];
      assert.ok(objective, name);
      timestamp += 10;
      assert.equal(
        model.beginResolution(objective.id, objective.expectedPath, timestamp),
        true,
        `${name}:${objective.definition.word}`,
      );
      model.commitResolution();
      model.settleTransitions(timestamp + 1);
    }
    assert.equal(model.snapshot().currentGameState, "COMPLETED", name);
    assert.equal(model.snapshot().moveHistory.length, 8, name);
  }
});

test("legacy V1/V2 movement systems cannot be invoked by normal V3 gameplay", async () => {
  const v3Source = await readFile(
    new URL("../app/v3/WordKingdomV3.tsx", import.meta.url),
    "utf8",
  );
  const factorySource = await readFile(
    new URL("../game/v3/board-session-factory.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(v3Source, /createLegacyBoardSession|LegacyBoardSession|BoardController|DirectorSystem/);
  assert.match(v3Source, /createGeneratedBoardSession/);
  assert.match(factorySource, /createGeneratedBoardSession/);
});
