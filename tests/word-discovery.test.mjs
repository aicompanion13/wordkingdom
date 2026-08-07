import assert from "node:assert/strict";
import test from "node:test";
import defaultPlayerJson from "../game/v3/data/default-player.json" with { type: "json" };
import { BadgeManager } from "../game/v3/badge-manager.ts";
import { CANONICAL_DIRECTIONS, normalizeCanonicalGesturePath } from "../game/v3/direction-contract.js";
import { EconomyManagerV3 } from "../game/v3/economy-manager.ts";
import { GeneratedLevelSession, GENERATED_LEVELS } from "../game/v3/generated-level-runner.ts";
import { GOLDEN_LEVEL_1, GoldenLevelSession } from "../game/v3/golden-level-session.ts";
import {
  bonusWordPoints,
  discoveryPathKey,
  normalizeDictionaryWord,
  physicalWordCandidates,
  resolveBonusWord,
} from "../game/v3/royal-dictionary.ts";
import { ScoreManager, scoringConfig } from "../game/scoring/score-manager.ts";
import {
  ACCEPTED_TILE_POP_MS,
  createBonusWordAnimationPlan,
  createObjectiveWordAnimationPlan,
  WORD_WAVE_STAGGER_MS,
} from "../game/v3/word-animation.ts";

const scoringHook = (word, matchTimestamp) => ({
  wordId: word.id,
  word: word.word,
  points: 1,
  elapsedSeconds: 0,
  speedMultiplier: 1,
  comboMultiplier: 1,
});

function idsFor(level, path) {
  return path.map(([row, column]) => `generated-${level.seed}-tile-${row}-${column}`);
}

function bonusTestLevel(seed, placements) {
  const grid = Array.from({ length: 8 }, () => Array(8).fill("Q"));
  const objectivePath = [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]];
  [..."SHORE"].forEach((letter, index) => { grid[0][index] = letter; });
  placements.forEach(({ word, path }) => {
    [...word].forEach((letter, index) => {
      const [row, column] = path[index];
      grid[row][column] = letter;
    });
  });
  return {
    generatorVersion: 2,
    seed,
    levelNumber: 900 + seed,
    localLevel: 1,
    areaId: 1,
    themeKey: "TEST",
    themeName: "Test",
    gridSize: { rows: 8, cols: 8 },
    initialGrid: grid,
    obstacles: [],
    stages: [{
      stageIndex: 0,
      activeWords: [{
        word: "SHORE",
        path: objectivePath,
        type: "STATIC",
        transmuteMap: objectivePath.map((cell, index) => ({ cell, letter: "SHORE"[index] })),
      }],
    }],
    completionWords: [{ word: "SHORE", path: objectivePath }],
    accidentalWords: [],
  };
}

test("straight gestures normalize in all four canonical axes and both physical orders", () => {
  const origin = [3, 3];
  for (const { rowStep, columnStep } of CANONICAL_DIRECTIONS) {
    const path = Array.from({ length: 5 }, (_, index) => [
      origin[0] + rowStep * index,
      origin[1] + columnStep * index,
    ]);
    assert.deepEqual(normalizeCanonicalGesturePath(path), path);
    assert.deepEqual(normalizeCanonicalGesturePath([...path].reverse()), path);
  }
});

test("bonus dictionary normalizes approved words and rejects short or non-letter strings", () => {
  assert.equal(normalizeDictionaryWord(" fish "), "FISH");
  assert.equal(normalizeDictionaryWord("SEA"), "SEA");
  assert.equal(normalizeDictionaryWord("SE"), null);
  assert.equal(normalizeDictionaryWord("F1SH"), null);
  assert.deepEqual(physicalWordCandidates("HSIF"), ["HSIF", "FISH"]);
  assert.equal(resolveBonusWord("HSIF"), "FISH");
  assert.equal(resolveBonusWord("ESROH"), "HORSE");
  assert.equal(resolveBonusWord("BOAT"), "BOAT");
  assert.equal(resolveBonusWord("UMBRELLA"), "UMBRELLA");
  assert.equal(resolveBonusWord("QZX"), null);
  assert.equal(bonusWordPoints("SEA"), 25);
  assert.equal(bonusWordPoints("FISH"), 50);
  assert.equal(bonusWordPoints("HORSE"), 75);
});

test("a path and its reverse share one discovery identity", () => {
  const path = ["a", "b", "c", "d"];
  assert.equal(discoveryPathKey(path), discoveryPathKey([...path].reverse()));
});

test("Golden Level 1 objectives accept either physical drag direction", () => {
  for (const reverse of [false, true]) {
    const session = new GoldenLevelSession(GOLDEN_LEVEL_1, 1_000);
    const shore = session.activeWords().find(({ word }) => word === "SHORE");
    assert.ok(shore);
    const tileIds = reverse ? [...shore.tileIds].reverse() : shore.tileIds;
    const result = session.acceptSelection(tileIds, 2_000, scoringHook);
    assert.equal(result.kind, "accepted");
    assert.deepEqual(result.tileIds, tileIds);
  }
});

test("a Level 1 Objective keeps its full accepted path separate from its authored transformation diff", () => {
  const session = new GoldenLevelSession(GOLDEN_LEVEL_1, 1_000);
  const shore = session.activeWords().find(({ word }) => word === "SHORE");
  const transformationDiff = session.transitionTileIdsForObjective(shore.id);
  const plan = createObjectiveWordAnimationPlan(
    [...shore.tileIds].reverse(),
    transformationDiff,
    false,
  );
  assert.equal(plan.acceptedPath.length, shore.word.length);
  assert.deepEqual(plan.acceptedPath, [...shore.tileIds].reverse());
  assert.deepEqual(plan.transformationDiff, transformationDiff);
  assert.notStrictEqual(plan.acceptedPath, plan.transformationDiff);
  assert.ok(plan.acceptedWaveMs >= ACCEPTED_TILE_POP_MS + (shore.word.length - 1) * WORD_WAVE_STAGGER_MS);
  assert.equal(plan.flipOutMs + plan.flipInMs, plan.transformationMs);
});

test("a naturally present Level 1 English word is accepted as a non-mutating Bonus Word", () => {
  const session = new GoldenLevelSession(GOLDEN_LEVEL_1, 1_000);
  const earPath = [[2, 4], [3, 4], [4, 4]];
  const tileIds = idsFor(GOLDEN_LEVEL_1, earPath);
  const beforeBoard = session.snapshot();
  const beforeDebug = session.debugSnapshot();
  const result = session.acceptSelection(tileIds, 2_000, scoringHook);
  assert.equal(result.kind, "bonus");
  assert.equal(result.word, "EAR");
  assert.equal(result.tileIds.length, 3);
  assert.deepEqual(session.snapshot(), beforeBoard);
  assert.deepEqual(session.debugSnapshot(), beforeDebug);
  assert.equal(session.acceptSelection([...tileIds].reverse(), 2_100, scoringHook).kind, "neutral");
});

test("global Bonus Words accept BOAT in every canonical direction and either drag order", () => {
  const paths = [
    [[2, 1], [2, 2], [2, 3], [2, 4]],
    [[2, 1], [3, 1], [4, 1], [5, 1]],
    [[2, 1], [3, 2], [4, 3], [5, 4]],
    [[2, 6], [3, 5], [4, 4], [5, 3]],
  ];
  paths.forEach((path, pathIndex) => {
    for (const reverse of [false, true]) {
      const level = bonusTestLevel(30 + pathIndex * 2 + Number(reverse), [{ word: "BOAT", path }]);
      const session = new GeneratedLevelSession(level, 1_000);
      const tileIds = idsFor(level, path);
      if (reverse) tileIds.reverse();
      const result = session.acceptSelection(tileIds, 2_000, scoringHook);
      assert.equal(result.kind, "bonus");
      assert.equal(result.word, "BOAT");
      assert.deepEqual(result.tileIds, tileIds);
    }
  });
});

test("UMBRELLA is recognized offline when its complete eight-tile path is present", () => {
  const path = Array.from({ length: 8 }, (_, column) => [2, column]);
  const level = bonusTestLevel(44, [{ word: "UMBRELLA", path }]);
  const session = new GeneratedLevelSession(level, 1_000);
  const before = session.snapshot();
  const result = session.acceptSelection(idsFor(level, path), 2_000, scoringHook);
  assert.equal(result.kind, "bonus");
  assert.equal(result.word, "UMBRELLA");
  assert.equal(result.tileIds.length, 8);
  assert.deepEqual(session.snapshot(), before);
});

test("a Bonus Word is rewarded once per spelling per level, not once per path", () => {
  const firstPath = [[2, 0], [2, 1], [2, 2], [2, 3]];
  const secondPath = [[4, 0], [4, 1], [4, 2], [4, 3]];
  const level = bonusTestLevel(45, [
    { word: "BOAT", path: firstPath },
    { word: "BOAT", path: secondPath },
  ]);
  const session = new GeneratedLevelSession(level, 1_000);
  assert.equal(session.acceptSelection(idsFor(level, firstPath), 2_000, scoringHook).kind, "bonus");
  assert.equal(session.acceptSelection(idsFor(level, secondPath), 2_100, scoringHook).kind, "neutral");
  assert.equal(session.acceptSelection([...idsFor(level, firstPath)].reverse(), 2_200, scoringHook).kind, "neutral");

  const nextLevel = bonusTestLevel(46, [{ word: "BOAT", path: firstPath }]);
  const nextSession = new GeneratedLevelSession(nextLevel, 1_000);
  assert.equal(nextSession.acceptSelection(idsFor(nextLevel, firstPath), 2_000, scoringHook).kind, "bonus");
});

test("Golden Level 1 horizontal, vertical and diagonal words use the shared locked resolution lifecycle", () => {
  const session = new GoldenLevelSession(GOLDEN_LEVEL_1, 1_000);
  const sequence = ["a0-shore", "a1-coral", "a2-star", "a3-reef"];
  const observedAxes = new Set();
  const initialCells = new Map(
    session.snapshot().tiles.flat().map(({ id, row, col }) => [id, `${row}:${col}`]),
  );

  sequence.forEach((objectiveId, index) => {
    const objective = session.activeWords().find(({ id }) => id === objectiveId);
    assert.ok(objective, `${objectiveId} is active`);
    const [start, end] = [objective.path[0], objective.path.at(-1)];
    observedAxes.add(
      start.row === end.row
        ? "horizontal"
        : start.col === end.col
          ? "vertical"
          : "diagonal",
    );
    const physicalTileIds = index % 2 === 0
      ? [...objective.tileIds]
      : [...objective.tileIds].reverse();
    const expectedReplacementIds = session.transitionTileIdsForObjective(objective.id);
    const accepted = session.acceptSelection(
      physicalTileIds,
      2_000 + index * 1_000,
      scoringHook,
    );
    assert.equal(accepted.kind, "accepted");
    assert.deepEqual(accepted.tileIds, physicalTileIds);
    assert.equal(session.canAcceptInput(), false, "input locks on acceptance");

    const resolution = session.solve(accepted.word, 2_100 + index * 1_000);
    assert.deepEqual(resolution.flippedTileIds, expectedReplacementIds);
    assert.equal(session.canAcceptInput(), false, "input remains locked while replacements animate");
    for (const tile of resolution.board.tiles.flat()) {
      assert.equal(initialCells.get(tile.id), `${tile.row}:${tile.col}`, "tiles transmute without moving");
    }

    session.settleTransitions(2_500 + index * 1_000);
    assert.equal(session.canAcceptInput(), true, "input unlocks only after settlement and validation");
    const visibleLetters = new Map(
      session.snapshot().tiles.flat().map(({ id, letter }) => [id, letter]),
    );
    for (const activeWord of session.activeWords()) {
      assert.equal(
        activeWord.tileIds.map((id) => visibleLetters.get(id)).join(""),
        activeWord.word,
        `${activeWord.word} is recalculated from the final visible board`,
      );
    }
  });

  assert.deepEqual([...observedAxes].sort(), ["diagonal", "horizontal", "vertical"]);
});

test("locked and completed Golden objectives remain neutral and never become bonus words", () => {
  const session = new GoldenLevelSession(GOLDEN_LEVEL_1, 1_000);
  const coral = GOLDEN_LEVEL_1.objectives.find(({ id }) => id === "a1-coral");
  const locked = session.acceptSelection(idsFor(GOLDEN_LEVEL_1, coral.path), 2_000, scoringHook);
  assert.notEqual(locked.kind, "bonus");
  const shore = session.activeWords().find(({ word }) => word === "SHORE");
  const accepted = session.acceptSelection(shore.tileIds, 2_100, scoringHook);
  assert.equal(accepted.kind, "accepted");
  session.solve(accepted.word, 2_100);
  session.settleTransitions(2_600);
  const completed = session.acceptSelection(shore.tileIds, 2_700, scoringHook);
  assert.notEqual(completed.kind, "bonus");
});

test("an audited generated Bonus Word is non-mutating in either direction and cannot be farmed", () => {
  const level = GENERATED_LEVELS.find(({ levelNumber }) => levelNumber === 5);
  const bonus = level.accidentalWords[0];
  assert.ok(level && bonus);
  for (const reverse of [false, true]) {
    const session = new GeneratedLevelSession(level, 1_000);
    const tileIds = idsFor(level, bonus.path);
    if (reverse) tileIds.reverse();
    const boardBefore = session.snapshot();
    const progressBefore = session.progress();
    const result = session.acceptSelection(tileIds, 2_000, scoringHook);
    assert.equal(result.kind, "bonus");
    assert.equal(result.word, bonus.word);
    assert.equal(result.points, bonusWordPoints(bonus.word));
    assert.deepEqual(result.tileIds, tileIds);
    assert.deepEqual(session.snapshot(), boardBefore);
    assert.deepEqual(session.progress(), progressBefore);
    const duplicate = session.acceptSelection([...tileIds].reverse(), 2_100, scoringHook);
    assert.equal(duplicate.kind, "neutral");
  }
});

test("a bonus crossing an active reward tile collects that badge exactly once", () => {
  const grid = Array.from({ length: 8 }, () => Array(8).fill("Q"));
  const objectivePath = [[3, 0], [3, 1], [3, 2], [3, 3], [3, 4]];
  const bonusPath = [[1, 2], [2, 2], [3, 2], [4, 2]];
  [..."SHORE"].forEach((letter, index) => { grid[3][index] = letter; });
  [..."LION"].forEach((letter, index) => { grid[1 + index][2] = letter; });
  const level = {
    generatorVersion: 2,
    seed: 2,
    levelNumber: 999,
    localLevel: 1,
    areaId: 1,
    themeKey: "TEST",
    themeName: "Test",
    gridSize: { rows: 8, cols: 8 },
    initialGrid: grid,
    obstacles: [],
    stages: [{
      stageIndex: 0,
      activeWords: [{
        word: "SHORE",
        path: objectivePath,
        type: "STATIC",
        transmuteMap: objectivePath.map((cell, index) => ({ cell, letter: "SHORE"[index] })),
      }],
    }],
    completionWords: [{ word: "SHORE", path: objectivePath }],
    accidentalWords: [{ word: "LION", path: bonusPath }],
  };
  const session = new GeneratedLevelSession(level, 1_000);
  const tileIds = idsFor(level, bonusPath);
  const boardBefore = session.snapshot();
  const graphBefore = session.debugSnapshot();
  const first = session.acceptSelection(tileIds, 2_000, scoringHook);
  assert.equal(first.kind, "bonus");
  assert.equal(first.rewards.length, 1);
  assert.equal(first.rewards[0].tileId, idsFor(level, [[3, 2]])[0]);
  const badgeManager = new BadgeManager();
  const collected = badgeManager.collect({ badges: first.rewards });
  assert.equal(collected.counts[first.rewards[0].type], 1);
  assert.deepEqual(session.snapshot(), boardBefore);
  assert.deepEqual(session.debugSnapshot(), graphBefore);
  const repeated = session.acceptSelection([...tileIds].reverse(), 2_100, scoringHook);
  assert.equal(repeated.kind, "neutral");
  assert.equal(badgeManager.snapshot()[first.rewards[0].type], 1);
});

test("Bonus coins and Royal Dictionary collection persist without coupling levels", () => {
  const economy = new EconomyManagerV3(structuredClone(defaultPlayerJson), 1_000);
  const before = economy.snapshot();
  const first = economy.awardBonusWord("boat", bonusWordPoints("BOAT"));
  assert.equal(first.coins, before.coins + 50);
  assert.equal(first.royalDictionary.includes("BOAT"), true);
  const secondLevelReward = economy.awardBonusWord("BOAT", bonusWordPoints("BOAT"));
  assert.equal(secondLevelReward.coins, before.coins + 100);
  assert.equal(secondLevelReward.royalDictionary.filter((word) => word === "BOAT").length, 1);
});

test("invalid selections cannot grant Bonus coins, badges, or successful-word statistics", () => {
  const path = [[2, 0], [2, 1], [2, 2]];
  const level = bonusTestLevel(47, [{ word: "QZX", path }]);
  const session = new GeneratedLevelSession(level, 1_000);
  const scoreManager = new ScoreManager({ ...scoringConfig, comboIdleTimeoutSeconds: 0 }, 1_000);
  const badgeManager = new BadgeManager();
  const economy = new EconomyManagerV3(structuredClone(defaultPlayerJson), 1_000);
  const scoreBefore = scoreManager.snapshot(2_000);
  const coinsBefore = economy.snapshot().coins;
  const result = session.acceptSelection(
    idsFor(level, path),
    2_000,
    (word, acceptedAt) => scoreManager.onWordSolved(word, acceptedAt),
  );
  assert.equal(result.kind, "invalid");
  assert.deepEqual(scoreManager.snapshot(2_000), scoreBefore);
  assert.equal(economy.snapshot().coins, coinsBefore);
  assert.deepEqual(badgeManager.snapshot(), { attack: 0, steal: 0, raid: 0, shield: 0 });
});

test("bonus scoring adds its fixed award while preserving the active combo", () => {
  const manager = new ScoreManager({ ...scoringConfig, comboIdleTimeoutSeconds: 0 }, 1_000);
  manager.onWordSolved({ id: "objective", word: "SHORE", activatedAt: 1_000 }, 2_000);
  const before = manager.snapshot(2_000);
  manager.onBonusWordSolved("bonus:horse", "HORSE", 75, 2_100);
  const after = manager.snapshot(2_100);
  assert.equal(after.score, before.score + 75);
  assert.equal(after.comboMultiplier, before.comboMultiplier);
  assert.equal(after.comboBreaks, before.comboBreaks);
});

test("accepted path animation is declared in physical selection order and respects reduced motion", async () => {
  const { readFile } = await import("node:fs/promises");
  const { resolve } = await import("node:path");
  const source = await readFile(resolve(process.cwd(), "app/v3/V3.module.css"), "utf8");
  const component = await readFile(resolve(process.cwd(), "app/v3/WordKingdomV3.tsx"), "utf8");
  const goldenSession = await readFile(resolve(process.cwd(), "game/v3/golden-level-session.ts"), "utf8");
  const generatedSession = await readFile(resolve(process.cwd(), "game/v3/generated-level-runner.ts"), "utf8");
  assert.match(source, /\.acceptedWordTile:not\(\.bonusWordTile\)[\s\S]*--word-stagger/);
  assert.match(source, /\.acceptedWordTile[\s\S]*linear-gradient\(145deg,#fff5ad,#f7bd38\)/);
  assert.match(source, /\.goldenBoard\s+\.acceptedWordTile:not\(\.bonusWordTile\)[\s\S]*animation-name:\s*goldenAcceptedTileConfirm/);
  assert.match(source, /@keyframes\s+goldenAcceptedTileConfirm[\s\S]*rotateY\(-68deg\)/);
  assert.match(source, /\.replacementLetterTile\s*>\s*span[\s\S]*replacementLetterPop/);
  assert.match(source, /\.bonusWordTile\s*>\s*span[\s\S]*bonusWordConfirm/);
  assert.match(source, /\.bonusWordTile::after[\s\S]*bonusCoinPulse/);
  assert.match(source, /prefers-reduced-motion:\s*reduce[\s\S]*\.acceptedWordTile:not\(\.bonusWordTile\)/);
  assert.match(source, /prefers-reduced-motion:\s*reduce[\s\S]*\.replacementLetterTile/);
  assert.match(component, /acceptedIndex\s*=\s*acceptedPathIds\.indexOf/);
  assert.match(component, /replacementIndex\s*=\s*transformationDiffIds\.indexOf/);
  assert.match(component, /"--word-stagger":\s*`\$\{acceptedIndex \* WORD_WAVE_STAGGER_MS\}ms`/);
  assert.match(component, /data-replacement-pop=\{isReplacementPopping/);
  assert.match(component, /setAnimating\(true\)[\s\S]*setAcceptedPathIds\(\[\.\.\.animationPlan\.acceptedPath\]\)/);
  assert.match(component, /setTransformationDiffIds\(\[\.\.\.animationPlan\.transformationDiff\]\)/);
  assert.match(component, /setAcceptedPathIds\(\[\]\)[\s\S]*setGeneratedFlipPhase\("out"\)/);
  assert.match(component, /setGeneratedFlipPhase\("in"\)[\s\S]*settleTransitions/);
  assert.match(component, /data-accepted-kind=\{acceptedIndex >= 0 \? acceptedWordKind/);
  assert.match(component, /const solveCanonicalWord\s*=\s*\(/);
  assert.doesNotMatch(component, /solveGeneratedWord/);
  assert.doesNotMatch(component, /data-golden-change/);
  const tutorialTileRule = source.match(/\.tutorialRecommendedTile\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.doesNotMatch(tutorialTileRule, /animation\s*:/);
  assert.match(goldenSession, /acceptCanonicalSelection\s*\(\s*\{/);
  assert.match(generatedSession, /acceptCanonicalSelection\s*\(\s*\{/);
});

test("Bonus animation plans preserve and animate every selected tile", () => {
  const selected = Array.from({ length: 8 }, (_, index) => `tile-${index}`);
  const plan = createBonusWordAnimationPlan(selected, false);
  assert.deepEqual(plan.acceptedPath, selected);
  assert.notStrictEqual(plan.acceptedPath, selected);
  assert.ok(plan.acceptedWaveMs > selected.length * WORD_WAVE_STAGGER_MS);
});
