import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import defaultPlayerJson from "../game/v3/data/default-player.json" with { type: "json" };
import fingerprintsJson from "../game/v3/data/golden-levels/levels_02_10_fingerprints.json" with { type: "json" };
import trackDataJson from "../game/v3/data/track_data.json" with { type: "json" };
import areasJson from "../game/v2/data/areas.json" with { type: "json" };
import objectiveRegistryJson from "../game/v3/data/objective_word_registry.json" with { type: "json" };
import { EconomyManagerV3 } from "../game/v3/economy-manager.ts";
import { GENERATED_LEVELS, GeneratedLevelSession } from "../game/v3/generated-level-runner.ts";
import { TrackManager } from "../game/v3/track-manager.ts";
import { auditReachableStates, verifyLevel } from "../tools/board-generator/verifier.js";
import {
  objectiveWordsFromGeneratedLevel,
  validateObjectivePlan,
  validateObjectiveRegistry,
} from "../tools/board-generator/objective-registry.js";

const track = new TrackManager(trackDataJson, areasJson);
const scoringHook = (word) => ({
  wordId: word.id,
  word: word.word,
  points: 1,
  elapsedSeconds: 0,
  speedMultiplier: 1,
  comboMultiplier: 1,
});

function level(number) {
  return GENERATED_LEVELS.find(({ levelNumber }) => levelNumber === number);
}

function idsFor(source, path) {
  return path.map(([row, column]) => `generated-${source.seed}-tile-${row}-${column}`);
}

test("Levels 2 through 10 load as eight-objective verified canonical boards", () => {
  for (let number = 2; number <= 10; number += 1) {
    const source = level(number);
    assert.ok(source, `Level ${number} is loaded from the catalog`);
    const session = new GeneratedLevelSession(source, 1_000);
    const audit = auditReachableStates(source);
    assert.equal(session.totalWords, 8);
    assert.equal(verifyLevel(source).allStagesVerified, true);
    assert.deepEqual([audit.settledStates, audit.reachableBranches, audit.completedStates], [25, 40, 1]);
    assert.equal(source.validation.completeMoveOrders, 70);
  }
});

test("the central registry contains 80 unique, theme-approved Objective Words", () => {
  assert.deepEqual(validateObjectiveRegistry(objectiveRegistryJson), {
    objectiveCount: 80,
    uniqueCount: 80,
  });
  for (let number = 2; number <= 10; number += 1) {
    const source = level(number);
    const registered = objectiveRegistryJson.levels.find(
      ({ levelNumber }) => levelNumber === number,
    );
    assert.deepEqual(objectiveWordsFromGeneratedLevel(source), registered.words);
    assert.equal(source.design.objectiveThemeKey, registered.themeKey);
    assert.deepEqual(
      validateObjectivePlan(objectiveRegistryJson, {
        levelNumber: number,
        themeKey: source.design.objectiveThemeKey,
        words: objectiveWordsFromGeneratedLevel(source),
      }),
      registered.words,
    );
  }
});

test("the Objective Word registry rejects duplicates, unrelated words, and simple variations", () => {
  const repeatedWithinLevel = structuredClone(objectiveRegistryJson);
  repeatedWithinLevel.levels[1].words[1] = repeatedWithinLevel.levels[1].words[0];
  assert.throws(
    () => validateObjectiveRegistry(repeatedWithinLevel),
    /repeats objective SAILOR/,
  );

  const unrelated = structuredClone(objectiveRegistryJson);
  unrelated.levels[1].words[0] = "DESERT";
  assert.throws(
    () => validateObjectiveRegistry(unrelated),
    /DESERT is unrelated to Sailing and Harbours/,
  );

  const futureVariation = structuredClone(objectiveRegistryJson);
  const futureWords = [
    "SAILORS", "CAPTAIN", "RUDDER", "MARINA",
    "PIER", "CABIN", "CANAL", "FERRY",
  ];
  futureVariation.expectedObjectiveCount = 88;
  futureVariation.themes.SAILING_HARBORS.approvedWords.push(...futureWords);
  futureVariation.levels.push({
    levelNumber: 11,
    themeKey: "SAILING_HARBORS",
    theme: "Sailing and Harbours",
    words: futureWords,
  });
  assert.throws(
    () => validateObjectiveRegistry(futureVariation),
    /SAILORS is too similar to SAILOR from Level 2/,
  );

  const futureDuplicate = structuredClone(futureVariation);
  futureDuplicate.levels.at(-1).words[0] = "ANCHOR";
  assert.throws(
    () => validateObjectiveRegistry(futureDuplicate),
    /ANCHOR is already used by Level 2/,
  );
});

test("protected fingerprints match every authored Level 2 through 10 file", async () => {
  for (let number = 2; number <= 10; number += 1) {
    const serialized = await readFile(
      resolve(process.cwd(), `game/v3/data/generated-levels/level_${String(number).padStart(2, "0")}.json`),
      "utf8",
    );
    assert.equal(
      createHash("sha256").update(serialized).digest("hex"),
      fingerprintsJson.levels[String(number)],
    );
  }
});

test("normal progression unlocks sequentially, persists, and allows replay without regression", () => {
  const economy = new EconomyManagerV3(structuredClone(defaultPlayerJson), 1_000);
  for (let number = 1; number <= 5; number += 1) economy.completeNode(track.node(number), 0, 1);
  let snapshot = economy.snapshot();
  assert.equal(snapshot.currentLevel, 6);
  assert.equal(snapshot.unlockedChapterIds.includes("chapter_forest"), true);
  assert.deepEqual(snapshot.completedLevels, [1, 2, 3, 4, 5]);
  const restored = new EconomyManagerV3(JSON.parse(JSON.stringify(snapshot)), 2_000);
  for (let number = 6; number <= 10; number += 1) restored.completeNode(track.node(number), 0, 1);
  snapshot = restored.snapshot();
  assert.equal(snapshot.currentLevel, 11);
  assert.equal(snapshot.completedLevels.includes(10), true);
  restored.completeNode(track.node(3), 0, 1);
  assert.equal(restored.snapshot().currentLevel, 11);
});

test("Hard and Boss nodes are marked at Levels 4, 5, 9 and 10", () => {
  assert.deepEqual([4, 5, 9, 10].map((number) => track.node(number).kind), ["HARD", "BOSS", "HARD", "BOSS"]);
  assert.equal(track.node(5).gatewayTo, "chapter_forest");
  assert.equal(track.node(10).title, "Guardian of the Grove");
});

test("multiple Ocean and Forest objectives accept their reverse physical path", () => {
  for (const number of [2, 5, 6, 10]) {
    const source = level(number);
    const session = new GeneratedLevelSession(source, 1_000);
    const objective = session.activeWords()[0];
    const result = session.acceptSelection([...objective.tileIds].reverse(), 2_000, scoringHook);
    assert.equal(result.kind, "accepted", `Level ${number} reverse objective`);
    assert.deepEqual(result.tileIds, [...objective.tileIds].reverse());
  }
});

test("each new level meets its intentional hidden Bonus Word target", () => {
  for (let number = 2; number <= 10; number += 1) {
    const source = level(number);
    const target = number <= 3 ? 2 : number <= 8 ? 3 : 4;
    assert.ok(source.design.intentionalBonusWords.length >= target);
    assert.ok(source.design.intentionalBonusWords.every(({ word }) => word.length >= 4));
  }
});

test("Ocean and Forest Bonus Words preserve the board and reject reverse duplicates", () => {
  for (const number of [2, 6]) {
    const source = level(number);
    const bonus = source.design.intentionalBonusWords[0];
    const session = new GeneratedLevelSession(source, 1_000);
    const beforeBoard = session.snapshot();
    const beforeProgress = session.progress();
    const ids = idsFor(source, bonus.path);
    const first = session.acceptSelection(ids, 2_000, scoringHook);
    assert.equal(first.kind, "bonus");
    assert.deepEqual(session.snapshot(), beforeBoard);
    assert.deepEqual(session.progress(), beforeProgress);
    const duplicate = session.acceptSelection([...ids].reverse(), 2_100, scoringHook);
    assert.equal(duplicate.kind, "neutral");
  }
});

test("locked objective vocabulary is reserved from Bonus Word collection", () => {
  for (const number of [3, 8, 10]) {
    const source = level(number);
    const session = new GeneratedLevelSession(source, 1_000);
    const locked = source.stages[1].activeWords[0];
    const result = session.acceptSelection(idsFor(source, locked.path), 2_000, scoringHook);
    assert.notEqual(result.kind, "bonus");
  }
});
