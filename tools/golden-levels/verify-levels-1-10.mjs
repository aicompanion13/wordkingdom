#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditReachableStates, verifyLevel } from "../board-generator/verifier.js";
import {
  objectiveWordsFromGeneratedLevel,
  validateObjectivePlan,
  validateObjectiveRegistry,
} from "../board-generator/objective-registry.js";
import { verifyGoldenLevel } from "./verifier.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const generatedDirectory = path.join(root, "game", "v3", "data", "generated-levels");
const goldenDirectory = path.join(root, "game", "v3", "data", "golden-levels");
const fingerprints = JSON.parse(
  await readFile(path.join(goldenDirectory, "levels_02_10_fingerprints.json"), "utf8"),
);
const objectiveRegistry = JSON.parse(
  await readFile(path.join(root, "game", "v3", "data", "objective_word_registry.json"), "utf8"),
);
const registryReport = validateObjectiveRegistry(objectiveRegistry);
const golden = JSON.parse(await readFile(path.join(goldenDirectory, "golden_01.json"), "utf8"));
const goldenReport = verifyGoldenLevel(golden);
if (!goldenReport.valid) throw new Error(goldenReport.errors.join("\n"));
const goldenRegistry = objectiveRegistry.levels.find(({ levelNumber }) => levelNumber === 1);
const goldenWords = golden.objectives.map(({ word }) => word);
if (goldenWords.some((word) => !goldenRegistry.words.includes(word))) {
  throw new Error("Golden Level 1 objectives do not match the Objective Word registry.");
}

const reports = [{
  level: 1,
  title: "Find Your First Word",
  states: goldenReport.reachableStates,
  branches: goldenReport.reachableBranches,
  moveOrders: goldenReport.completeMoveOrders,
  bonuses: [],
  objectives: goldenWords,
}];

for (let levelNumber = 2; levelNumber <= 10; levelNumber += 1) {
  const filename = `level_${String(levelNumber).padStart(2, "0")}.json`;
  const serialized = await readFile(path.join(generatedDirectory, filename), "utf8");
  const expected = fingerprints.levels[String(levelNumber)];
  const actual = createHash("sha256").update(serialized).digest("hex");
  if (actual !== expected) throw new Error(`Level ${levelNumber} fingerprint mismatch.`);
  const level = JSON.parse(serialized);
  const objectives = objectiveWordsFromGeneratedLevel(level);
  validateObjectivePlan(objectiveRegistry, {
    levelNumber,
    themeKey: level.design.objectiveThemeKey,
    words: objectives,
  });
  const verification = verifyLevel(level);
  const audit = auditReachableStates(level);
  if (!verification.allStagesVerified || audit.completedStates !== 1) {
    throw new Error(`Level ${levelNumber} did not verify to completion.`);
  }
  const bonusTarget = levelNumber <= 3 ? 2 : levelNumber <= 8 ? 3 : 4;
  if (level.design?.intentionalBonusWords.length < bonusTarget) {
    throw new Error(`Level ${levelNumber} is below its Bonus Word target.`);
  }
  reports.push({
    level: levelNumber,
    title: level.design.title,
    states: audit.settledStates,
    branches: audit.reachableBranches,
    moveOrders: level.validation.completeMoveOrders,
    bonuses: level.design.intentionalBonusWords.map(({ word }) => word),
    objectives,
  });
}

console.log(JSON.stringify({
  valid: true,
  registry: registryReport,
  levels: reports,
  totals: {
    levels: reports.length,
    states: reports.reduce((sum, report) => sum + report.states, 0),
    branches: reports.reduce((sum, report) => sum + report.branches, 0),
    moveOrders: reports.reduce((sum, report) => sum + report.moveOrders, 0),
  },
}, null, 2));
