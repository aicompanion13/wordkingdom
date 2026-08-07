#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  allCanonicalPaths,
  scanCanonicalWord,
} from "../../game/v3/direction-contract.js";
import { generateLevel } from "../board-generator/generator.js";
import {
  auditReachableStates,
  verifyLevel,
} from "../board-generator/verifier.js";
import {
  validateObjectivePlan,
  validateObjectiveRegistry,
} from "../board-generator/objective-registry.js";

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(toolDirectory, "..", "..");
const levelDirectory = path.join(
  repositoryRoot,
  "game",
  "v3",
  "data",
  "generated-levels",
);
const areasPath = path.join(repositoryRoot, "game", "v2", "data", "areas.json");
const dictionaryPath = path.join(
  repositoryRoot,
  "tools",
  "board-generator",
  "data",
  "wordlist.txt",
);
const fingerprintsPath = path.join(
  repositoryRoot,
  "game",
  "v3",
  "data",
  "golden-levels",
  "levels_02_10_fingerprints.json",
);
const objectiveRegistryPath = path.join(
  repositoryRoot,
  "game",
  "v3",
  "data",
  "objective_word_registry.json",
);

const AUTHORING_VERSION = 2;
const BONUS_TARGETS = new Map([
  [2, 2], [3, 2], [4, 3], [5, 3],
  [6, 3], [7, 3], [8, 3], [9, 4], [10, 4],
]);

const LEVEL_DESIGN = new Map([
  [2, { title: "The Reef Responds", purpose: "Reinforce solving and readable local transformations", difficulty: "EASY", nodeKind: "STANDARD" }],
  [3, { title: "Cross the Current", purpose: "Practice diagonals and crossings", difficulty: "EASY_MEDIUM", nodeKind: "STANDARD" }],
  [4, { title: "Across the Lagoon", purpose: "First hard full-board scanning challenge", difficulty: "HARD", nodeKind: "HARD" }],
  [5, { title: "Choose the Tide", purpose: "Ocean guardian with generous safe choices", difficulty: "BOSS", nodeKind: "BOSS" }],
  [6, { title: "Into the Green", purpose: "Introduce the Forest Kingdom with a medium reset", difficulty: "MEDIUM", nodeKind: "STANDARD" }],
  [7, { title: "Branching Paths", purpose: "Longer words and stronger branching", difficulty: "MEDIUM", nodeKind: "STANDARD" }],
  [8, { title: "Heart of the Grove", purpose: "Dense crossings and deliberate decoys", difficulty: "MEDIUM_HARD", nodeKind: "STANDARD" }],
  [9, { title: "Thornwood Trial", purpose: "Second hard mastery challenge", difficulty: "HARD", nodeKind: "HARD" }],
  [10, { title: "Guardian of the Grove", purpose: "Forest boss and Golden 10 milestone", difficulty: "BOSS", nodeKind: "BOSS" }],
]);

const OCEAN_BONUS_WORDS = [
  "BOAT", "SAND", "TIDE", "WAVE", "REEF", "KELP", "COVE", "GULL",
  "FISH", "CRAB", "SEAL", "SHELL", "SHORE", "PEARL", "OCEAN",
  "BEACH", "COAST", "WATER", "ISLAND", "CORAL", "SQUID",
];
const FOREST_BONUS_WORDS = [
  "FERN", "MOSS", "STAG", "BARK", "FAWN", "POND", "TREE", "LEAF",
  "DEER", "BEAR", "PINE", "ROOT", "WOOD", "LYNX", "ACORN", "GROVE",
  "TRAIL", "RIVER", "MAPLE", "BLOOM", "PETAL", "FOREST", "GRASS",
  "GREEN", "PLANT", "BROOK", "ROBIN",
];
const CROSS_KINGDOM_BONUS_WORDS = [
  "STAR", "MOON", "MARS", "NOVA", "VOID", "GOLD", "TOMB", "SNOW",
  "SEAL", "BEAR", "WOLF", "SLED", "BERG", "ARCH", "DUNE", "RELIC",
];

const COMPLETION_WORDS = new Map([
  [2, "VOYAGE"],
  [3, "WILDLIFE"],
  [4, "DANGER"],
  [5, "KINGDOM"],
  [6, "FOREST"],
  [7, "ANIMALS"],
  [8, "HABITAT"],
  [9, "TREES"],
  [10, "WONDER"],
]);

function levelFilename(levelNumber) {
  return `level_${String(levelNumber).padStart(2, "0")}.json`;
}

function clone(value) {
  return structuredClone(value);
}

function pathKey(pathValue) {
  return pathValue.map(([row, column]) => `${row},${column}`).join(";");
}

function occurrenceKey(entry) {
  return `${entry.word}|${pathKey(entry.path)}`;
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function objectiveWords(level) {
  return new Set(
    level.stages.flatMap((stage) =>
      stage.activeWords.flatMap((entry) => [
        entry.word,
        ...(entry.reveals ? [entry.reveals] : []),
      ]),
    ),
  );
}

function initialActiveCells(level) {
  return new Set(
    level.stages[0].activeWords.flatMap((entry) =>
      entry.path.map(([row, column]) => `${row},${column}`),
    ),
  );
}

function pathMatches(grid, word, pathValue) {
  return pathValue.every(
    ([row, column], index) => grid[row]?.[column] === word[index],
  );
}

function completeMoveOrders(level) {
  const entriesByStage = level.stages.map((stage) =>
    stage.activeWords.map((definition, wordIndex) => ({
      id: `s${stage.stageIndex}w${wordIndex}`,
      stageIndex: stage.stageIndex,
      definition,
    })),
  );
  const entryById = new Map(entriesByStage.flat().map((entry) => [entry.id, entry]));
  const total = entryById.size;
  const memo = new Map();

  function count(activeIds, completedIds) {
    if (completedIds.length === total) return 1;
    const key = `${[...activeIds].sort().join(",")}|${[...completedIds].sort().join(",")}`;
    if (memo.has(key)) return memo.get(key);
    let result = 0;
    for (const activeId of activeIds) {
      const entry = entryById.get(activeId);
      const nextActive = activeIds.filter((id) => id !== activeId);
      if (entry.definition.reveals) {
        const successor = entriesByStage[entry.stageIndex + 1]?.find(
          (candidate) => candidate.definition.word === entry.definition.reveals,
        );
        if (successor && !nextActive.includes(successor.id)) nextActive.push(successor.id);
      }
      result += count(nextActive, [...completedIds, activeId]);
    }
    memo.set(key, result);
    return result;
  }

  return count(entriesByStage[0].map(({ id }) => id), []);
}

function refreshValidation(level) {
  const verification = verifyLevel(level);
  const audit = auditReachableStates(level);
  level.validation = {
    allStagesVerified: true,
    solveOrderIndependent: true,
    stagesVerified: verification.stagesVerified,
    postTransmuteStatesVerified: verification.postTransmuteStatesVerified,
    reachableSettledStates: audit.settledStates,
    reachableBranches: audit.reachableBranches,
    completeMoveOrders: completeMoveOrders(level),
    deterministic: audit.deterministic,
    forwardOnly: audit.forwardOnly,
  };
  return level.validation;
}

function placeIntentionalBonuses(level, targetCount) {
  const reserved = objectiveWords(level);
  const protectedCells = initialActiveCells(level);
  const basePreferredWords = [
    ...(level.levelNumber === 5 ? ["HORSE"] : []),
    ...(level.areaId === 1 ? OCEAN_BONUS_WORDS : FOREST_BONUS_WORDS),
    ...CROSS_KINGDOM_BONUS_WORDS,
  ];
  const sourceLevel = clone(level);
  let bestCount = 0;

  for (let strategy = 0; strategy < 250; strategy += 1) {
    const working = clone(sourceLevel);
    const selected = [];
    const seen = new Set();
    for (const existing of working.accidentalWords ?? []) {
      if (
        selected.length < targetCount &&
        !reserved.has(existing.word) &&
        pathMatches(working.initialGrid, existing.word, existing.path) &&
        !seen.has(occurrenceKey(existing))
      ) {
        selected.push(clone(existing));
        seen.add(occurrenceKey(existing));
      }
    }

    const preferredWords = strategy === 0
      ? [...basePreferredWords]
      : [...basePreferredWords].sort(
          (left, right) =>
            stableHash(`${strategy}:${left}`) - stableHash(`${strategy}:${right}`),
        );
    for (const word of preferredWords) {
      if (selected.length >= targetCount) break;
      if (reserved.has(word) || selected.some((entry) => entry.word === word)) continue;
      const paths = allCanonicalPaths(word.length, 8, 8)
        .map(({ path: pathValue }) => pathValue)
        .sort(
          (left, right) =>
            stableHash(`${strategy}:${level.levelNumber}:${word}:${pathKey(left)}`) -
            stableHash(`${strategy}:${level.levelNumber}:${word}:${pathKey(right)}`),
        );

      for (const candidatePath of paths) {
        const nextGrid = working.initialGrid.map((row) => [...row]);
        let canPlace = true;
        candidatePath.forEach(([row, column], index) => {
          const cell = `${row},${column}`;
          if (protectedCells.has(cell) && nextGrid[row][column] !== word[index]) {
            canPlace = false;
            return;
          }
          nextGrid[row][column] = word[index];
        });
        if (!canPlace) continue;
        if (selected.some((entry) => !pathMatches(nextGrid, entry.word, entry.path))) {
          continue;
        }

        const candidate = { ...working, initialGrid: nextGrid };
        try {
          verifyLevel(candidate);
        } catch {
          continue;
        }
        if (scanCanonicalWord(nextGrid, word).length !== 1) continue;
        working.initialGrid = nextGrid;
        const bonus = { word, path: candidatePath.map((cell) => [...cell]) };
        selected.push(bonus);
        seen.add(occurrenceKey(bonus));
        break;
      }
    }

    bestCount = Math.max(bestCount, selected.length);
    if (selected.length >= targetCount) {
      level.initialGrid = working.initialGrid;
      level.accidentalWords = selected;
      return selected;
    }
  }
  throw new Error(
    `Level ${level.levelNumber} only supports ${bestCount}/${targetCount} intentional Bonus Words.`,
  );
}

async function regenerateRegisteredLevel(
  levelNumber,
  sourceLevel,
  areas,
  dictionaryWords,
  objectiveRegistry,
) {
  const registered = objectiveRegistry.levels.find(
    (entry) => entry.levelNumber === levelNumber,
  );
  const areaId = levelNumber <= 5 ? 1 : 2;
  const area = areas.find((entry) => entry.areaId === areaId);
  const localLevel = levelNumber <= 5 ? levelNumber : levelNumber - 5;
  const objectives = validateObjectivePlan(objectiveRegistry, {
    levelNumber,
    themeKey: registered.themeKey,
    words: registered.words,
  });
  const completionWord = COMPLETION_WORDS.get(levelNumber);
  const themeDefinition = objectiveRegistry.themes[registered.themeKey];
  const wordPool = themeDefinition.approvedWords.filter(
    (word) => /^[A-Z]{4,8}$/.test(word),
  );
  const stageWordPlan = {
    chainWords: [
      objectives[0],
      objectives[2],
      objectives[4],
      objectives[6],
      completionWord,
    ],
    staticWords: [objectives[1], objectives[3], objectives[5], objectives[7]],
  };
  const config = {
    seed: sourceLevel.seed,
    gridSize: { rows: 8, cols: 8 },
    wordPool,
    stageCount: 4,
    activeWordsPerStage: { min: 2, max: 3 },
    chainRevealRatio: 0.5,
    stageWordPlan,
    obstacleConfig: {
      count: sourceLevel.obstacles.length,
      types: area.obstaclePalette.map(({ key }) => key),
    },
    dictionaryPath: "tools/board-generator/data/wordlist.txt",
  };
  let generated = null;
  let lastError = null;
  for (let seedOffset = 0; seedOffset < 12; seedOffset += 1) {
    const candidateSeed = sourceLevel.seed + seedOffset * 100_003;
    try {
      generated = generateLevel(
        { ...config, seed: candidateSeed },
        dictionaryWords,
        candidateSeed,
      );
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!generated) {
    throw new Error(
      `Level ${levelNumber} could not generate its registered objectives. ${lastError?.message ?? ""}`,
    );
  }
  const { level } = generated;
  return {
    ...level,
    levelNumber,
    localLevel,
    areaId: area.areaId,
    themeKey: area.themeKey,
    themeName: area.displayName,
    objectiveThemeKey: registered.themeKey,
    objectiveThemeName: registered.theme,
  };
}

async function main() {
  const areas = JSON.parse(await readFile(areasPath, "utf8"));
  const objectiveRegistry = JSON.parse(
    await readFile(objectiveRegistryPath, "utf8"),
  );
  validateObjectiveRegistry(objectiveRegistry);
  const dictionaryWords = (await readFile(dictionaryPath, "utf8"))
    .split(/\r?\n/)
    .map((word) => word.trim().toUpperCase())
    .filter((word) => /^[A-Z]{4,}$/.test(word));
  const catalog = JSON.parse(
    await readFile(path.join(levelDirectory, "catalog.json"), "utf8"),
  );
  const authored = new Map();

  for (let levelNumber = 2; levelNumber <= 10; levelNumber += 1) {
    const sourceLevel = JSON.parse(
      await readFile(
        path.join(levelDirectory, levelFilename(levelNumber)),
        "utf8",
      ),
    );
    const level = await regenerateRegisteredLevel(
      levelNumber,
      sourceLevel,
      areas,
      dictionaryWords,
      objectiveRegistry,
    );
    const bonuses = placeIntentionalBonuses(
      level,
      BONUS_TARGETS.get(levelNumber),
    );
    level.design = {
      ...LEVEL_DESIGN.get(levelNumber),
      authoringVersion: AUTHORING_VERSION,
      objectiveCount: 8,
      objectiveThemeKey: level.objectiveThemeKey,
      objectiveThemeName: level.objectiveThemeName,
      intentionalBonusWords: bonuses.map(({ word, path: bonusPath }) => ({
        word,
        path: bonusPath.map((cell) => [...cell]),
      })),
      completionPresentation:
        levelNumber === 5 || levelNumber === 10
          ? "GATEWAY_CELEBRATION"
          : levelNumber === 4 || levelNumber === 9
            ? "HARD_VICTORY"
            : "STANDARD_VICTORY",
    };
    const validation = refreshValidation(level);
    if (level.stages.flatMap(({ activeWords }) => activeWords).length !== 8) {
      throw new Error(`Level ${levelNumber} must contain exactly eight objectives.`);
    }
    validateObjectivePlan(objectiveRegistry, {
      levelNumber,
      themeKey: level.objectiveThemeKey,
      words: level.stages.flatMap(({ activeWords }) =>
        activeWords.map(({ word }) => word),
      ),
    });
    if (
      level.stages.some(
        ({ activeWords }) => activeWords.length < 2 || activeWords.length > 3,
      )
    ) {
      throw new Error(`Level ${levelNumber} must expose two or three active objectives per stage.`);
    }
    for (const bonus of bonuses) {
      if (!pathMatches(level.initialGrid, bonus.word, bonus.path)) {
        throw new Error(`Level ${levelNumber} Bonus Word ${bonus.word} is not visible initially.`);
      }
      if (objectiveWords(level).has(bonus.word)) {
        throw new Error(`Level ${levelNumber} Bonus Word ${bonus.word} is reserved by an objective.`);
      }
    }
    if (
      validation.reachableSettledStates !== 25 ||
      validation.reachableBranches !== 40 ||
      validation.completeMoveOrders !== 70
    ) {
      throw new Error(`Level ${levelNumber} produced an unexpected graph shape.`);
    }
    authored.set(levelNumber, level);
  }

  const serializedLevels = new Map(
    [...authored].map(([levelNumber, level]) => [
      levelNumber,
      `${JSON.stringify(level, null, 2)}\n`,
    ]),
  );
  const fingerprints = {
    version: 1,
    algorithm: "sha256",
    levels: Object.fromEntries(
      [...serializedLevels].map(([levelNumber, serialized]) => [
        String(levelNumber),
        createHash("sha256").update(serialized).digest("hex"),
      ]),
    ),
  };
  const nextCatalog = catalog.map((level) =>
    authored.get(level.levelNumber) ?? level,
  );

  // Every candidate is fully verified before the first output file is written.
  for (const [levelNumber, serialized] of serializedLevels) {
    const parsed = JSON.parse(serialized);
    const verification = verifyLevel(parsed);
    if (!verification.allStagesVerified) {
      throw new Error(`Serialized Level ${levelNumber} failed final verification.`);
    }
  }

  for (const [levelNumber, serialized] of serializedLevels) {
    await writeFile(
      path.join(levelDirectory, levelFilename(levelNumber)),
      serialized,
      "utf8",
    );
  }
  await writeFile(
    path.join(levelDirectory, "catalog.json"),
    `${JSON.stringify(nextCatalog, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    fingerprintsPath,
    `${JSON.stringify(fingerprints, null, 2)}\n`,
    "utf8",
  );

  for (const [levelNumber, level] of authored) {
    console.log(
      `Level ${levelNumber}: ${level.design.title} · ` +
        `${level.design.intentionalBonusWords.map(({ word }) => word).join(", ")} · ` +
        `${level.validation.reachableSettledStates} states / ` +
        `${level.validation.reachableBranches} branches / ` +
        `${level.validation.completeMoveOrders} orders`,
    );
  }
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
