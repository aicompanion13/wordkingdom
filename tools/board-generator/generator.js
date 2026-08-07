import { cellKey, occurrenceKey, pathKey } from "./grid.js";
import {
  CANONICAL_DIRECTIONS,
  allCanonicalPaths,
} from "../../game/v3/direction-contract.js";
import {
  deriveSubSeed,
  SeededRandom,
  weightedEnglishLetter,
} from "./random.js";
import { verifyLevel } from "./verifier.js";

const MAX_GENERATION_ATTEMPTS = 500;
class GenerationError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = "GenerationError";
    this.context = context;
  }
}

function normalizeWord(word) {
  return String(word).trim().toUpperCase();
}

function assertInteger(value, label, minimum) {
  if (!Number.isInteger(value) || value < minimum) {
    throw new GenerationError(
      `${label} must be an integer greater than or equal to ${minimum}.`,
    );
  }
}

function allPathsForLength(length, gridSize) {
  return allCanonicalPaths(length, gridSize.rows, gridSize.cols).map(
    ({ path }) => path,
  );
}

export function validateConfig(rawConfig) {
  if (!rawConfig || typeof rawConfig !== "object") {
    throw new GenerationError("Generation config must be a JSON object.");
  }

  assertInteger(rawConfig.seed, "seed", 0);
  assertInteger(rawConfig.gridSize?.rows, "gridSize.rows", 4);
  assertInteger(rawConfig.gridSize?.cols, "gridSize.cols", 4);
  assertInteger(rawConfig.stageCount, "stageCount", 1);

  const rows = rawConfig.gridSize.rows;
  const cols = rawConfig.gridSize.cols;
  const activeRange = rawConfig.activeWordsPerStage;
  if (
    !activeRange ||
    !Number.isInteger(activeRange.min) ||
    !Number.isInteger(activeRange.max) ||
    activeRange.min > 2 ||
    activeRange.max < 2
  ) {
    throw new GenerationError(
      "activeWordsPerStage must permit two active words.",
    );
  }

  if (
    typeof rawConfig.chainRevealRatio !== "number" ||
    rawConfig.chainRevealRatio < 0.4 ||
    rawConfig.chainRevealRatio > 0.6 ||
    Math.abs(rawConfig.chainRevealRatio - 0.5) > 0.1
  ) {
    throw new GenerationError(
      "chainRevealRatio must be within 0.1 of the transmutation plan's 0.5 ratio.",
    );
  }

  const wordPool = [
    ...new Set((rawConfig.wordPool ?? []).map(normalizeWord)),
  ].filter(Boolean);
  const requiredUniqueWords = rawConfig.stageCount * 2 + 1;
  if (wordPool.length < requiredUniqueWords) {
    throw new GenerationError(
      `wordPool must contain at least ${requiredUniqueWords} unique words for this stage plan.`,
    );
  }
  for (const word of wordPool) {
    if (!/^[A-Z]{4,}$/.test(word)) {
      throw new GenerationError(
        `Word pool entry ${JSON.stringify(word)} must contain 4+ A–Z letters.`,
      );
    }
    if (
      allPathsForLength(word.length, { rows, cols }).length === 0
    ) {
      throw new GenerationError(
        `${word} cannot fit the configured grid and directions.`,
      );
    }
  }

  let stageWordPlan;
  if (rawConfig.stageWordPlan) {
    const chainWords = rawConfig.stageWordPlan.chainWords?.map(normalizeWord);
    const staticWords = rawConfig.stageWordPlan.staticWords?.map(normalizeWord);
    if (
      !Array.isArray(chainWords) ||
      chainWords.length !== rawConfig.stageCount + 1 ||
      !Array.isArray(staticWords) ||
      staticWords.length !== rawConfig.stageCount
    ) {
      throw new GenerationError(
        "stageWordPlan must provide stageCount + 1 chain words and stageCount static words.",
      );
    }
    const plannedWords = [...chainWords, ...staticWords];
    if (
      new Set(plannedWords).size !== plannedWords.length ||
      plannedWords.some((word) => !wordPool.includes(word))
    ) {
      throw new GenerationError(
        "stageWordPlan words must be unique members of wordPool.",
      );
    }
    stageWordPlan = { chainWords, staticWords };
  }

  const obstacleConfig = rawConfig.obstacleConfig ?? {
    count: 0,
    types: ["ICE"],
  };
  assertInteger(obstacleConfig.count, "obstacleConfig.count", 0);
  if (
    !Array.isArray(obstacleConfig.types) ||
    obstacleConfig.types.length === 0 ||
    obstacleConfig.types.some(
      (type) => !/^[A-Z][A-Z0-9_]*$/.test(String(type)),
    )
  ) {
    throw new GenerationError(
      "obstacleConfig.types must contain uppercase identifiers.",
    );
  }

  if (
    typeof rawConfig.dictionaryPath !== "string" ||
    rawConfig.dictionaryPath.trim() === ""
  ) {
    throw new GenerationError("dictionaryPath must be a non-empty path.");
  }

  return {
    ...rawConfig,
    seed: rawConfig.seed >>> 0,
    gridSize: { rows, cols },
    wordPool,
    stageWordPlan,
    stageCount: rawConfig.stageCount,
    activeWordsPerStage: {
      min: activeRange.min,
      max: activeRange.max,
    },
    obstacleConfig: {
      count: obstacleConfig.count,
      types: obstacleConfig.types.map(String),
    },
  };
}

function chooseBalanced(candidates, usage, random) {
  const shuffled = random.shuffle(candidates);
  shuffled.sort((left, right) => usage.get(left) - usage.get(right));
  return shuffled[0];
}

function planWords(config, random) {
  if (config.stageWordPlan) {
    return {
      chainWords: [...config.stageWordPlan.chainWords],
      staticWords: [...config.stageWordPlan.staticWords],
    };
  }
  const usage = new Map(config.wordPool.map((word) => [word, 0]));
  const chainWords = [];
  for (let index = 0; index <= config.stageCount; index += 1) {
    const candidates = config.wordPool.filter(
      (word) => !chainWords.includes(word),
    );
    const word = chooseBalanced(candidates, usage, random);
    chainWords.push(word);
    usage.set(word, usage.get(word) + 1);
  }

  const staticWords = [];
  function placeStaticWord(stageIndex) {
    if (stageIndex === config.stageCount) {
      return true;
    }
    const unavailableChainWords = new Set(chainWords);
    const candidates = random
      .shuffle(
        config.wordPool.filter(
          (word) =>
            !staticWords.includes(word) &&
            !unavailableChainWords.has(word),
        ),
      )
      .sort((left, right) => usage.get(left) - usage.get(right));

    for (const word of candidates) {
      staticWords.push(word);
      usage.set(word, usage.get(word) + 1);
      if (placeStaticWord(stageIndex + 1)) {
        return true;
      }
      usage.set(word, usage.get(word) - 1);
      staticWords.pop();
    }
    return false;
  }

  if (!placeStaticWord(0)) {
    throw new GenerationError(
      "Could not plan static words without simultaneous duplicate placements.",
    );
  }

  return { chainWords, staticWords };
}

function sharedCellDetails(leftPath, rightPath) {
  const leftIndexes = new Map(
    leftPath.map((coordinate, index) => [cellKey(coordinate), index]),
  );
  const shared = [];
  rightPath.forEach((coordinate, rightIndex) => {
    const leftIndex = leftIndexes.get(cellKey(coordinate));
    if (leftIndex !== undefined) {
      shared.push({ coordinate, leftIndex, rightIndex });
    }
  });
  return shared;
}

function planChainPaths(words, config, random) {
  const pathOptions = words.map((word) =>
    allPathsForLength(word.length, config.gridSize),
  );
  const selected = [];
  const usedCells = new Set();

  function place(index) {
    if (index === words.length) {
      return true;
    }

    let candidates = random.shuffle(pathOptions[index]);
    if (index > 0) {
      const previousPath = selected[index - 1];
      const previousWord = words[index - 1];
      candidates = candidates.filter((candidate) => {
        const sharedWithPrevious = sharedCellDetails(previousPath, candidate);
        if (sharedWithPrevious.length !== 1) {
          return false;
        }
        const sharedWithAllPrior = candidate.filter((coordinate) =>
          usedCells.has(cellKey(coordinate)),
        );
        if (sharedWithAllPrior.length !== 1) {
          return false;
        }
        const shared = sharedWithPrevious[0];
        return (
          previousWord[shared.leftIndex] !== words[index][shared.rightIndex]
        );
      });
    }

    for (const candidate of candidates) {
      const newKeys = candidate
        .map(cellKey)
        .filter((key) => !usedCells.has(key));
      selected.push(candidate);
      newKeys.forEach((key) => usedCells.add(key));
      if (place(index + 1)) {
        return true;
      }
      newKeys.forEach((key) => usedCells.delete(key));
      selected.pop();
    }
    return false;
  }

  if (!place(0)) {
    throw new GenerationError(
      "Could not place a fresh-cell transmutation chain on the configured grid.",
    );
  }
  return selected;
}

function planStaticPaths(words, config, random, chainPaths) {
  const usedStaticCells = new Set();
  const selected = [];

  function place(index) {
    if (index === words.length) {
      return true;
    }
    const candidates = random.shuffle(
      allPathsForLength(words[index].length, config.gridSize),
    ).filter((path) => {
      if (path.some((coordinate) => usedStaticCells.has(cellKey(coordinate)))) {
        if (index === 0) return false;
      }
      if (
        chainPaths.some(
          (chainPath) => sharedCellDetails(chainPath, path).length !== 0,
        )
      ) {
        return false;
      }
      if (index === 0) return true;
      const sharedWithPrevious = sharedCellDetails(selected[index - 1], path);
      const sharedWithAllPrior = path.filter((coordinate) =>
        usedStaticCells.has(cellKey(coordinate)),
      );
      if (sharedWithPrevious.length !== 1 || sharedWithAllPrior.length !== 1) {
        return false;
      }
      const shared = sharedWithPrevious[0];
      return (
        words[index][shared.rightIndex] !==
          words[index - 1][shared.leftIndex]
      );
    });

    for (const candidate of candidates) {
      const keys = candidate.map(cellKey);
      selected.push(candidate);
      keys.forEach((key) => usedStaticCells.add(key));
      if (place(index + 1)) {
        return true;
      }
      keys.forEach((key) => usedStaticCells.delete(key));
      selected.pop();
    }
    return false;
  }

  if (!place(0)) {
    throw new GenerationError(
      "Could not place non-overlapping static words around the chain.",
    );
  }
  return selected;
}

function createGrid(rows, cols, random) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => weightedEnglishLetter(random)),
  );
}

function placeWord(grid, word, path) {
  path.forEach(([row, column], index) => {
    grid[row][column] = word[index];
  });
}

function differentWeightedLetter(random, currentLetter) {
  let letter = weightedEnglishLetter(random);
  while (letter === currentLetter) {
    letter = weightedEnglishLetter(random);
  }
  return letter;
}

function buildTriggerMap({
  currentWord,
  currentPath,
  revealWord,
  revealPath,
  additionalReveals = [],
  random,
}) {
  const requiredLetters = new Map(
    revealPath.map((coordinate, index) => [cellKey(coordinate), revealWord[index]]),
  );
  for (const additional of additionalReveals) {
    additional.path.forEach((coordinate, index) => {
      const key = cellKey(coordinate);
      if (currentPath.some((current) => cellKey(current) === key)) {
        const existing = requiredLetters.get(key);
        const letter = additional.word[index];
        if (existing && existing !== letter) {
          throw new GenerationError(`Conflicting reveal letters at ${key}.`);
        }
        requiredLetters.set(key, letter);
      }
    });
  }
  return currentPath.map((coordinate, index) => {
    const requiredLetter = requiredLetters.get(cellKey(coordinate));
    return {
      cell: [...coordinate],
      letter:
        requiredLetter === undefined
          ? differentWeightedLetter(random, currentWord[index])
          : requiredLetter,
    };
  });
}

function buildStaticMap(word, path, random) {
  return path.map((coordinate, index) => ({
    cell: [...coordinate],
    letter: differentWeightedLetter(random, word[index]),
  }));
}

function placeObstacles(config, random, plannedPaths) {
  const plannedCells = new Set(plannedPaths.flat().map(cellKey));
  const candidates = [];
  for (let row = 0; row < config.gridSize.rows; row += 1) {
    for (let column = 0; column < config.gridSize.cols; column += 1) {
      const coordinate = [row, column];
      if (!plannedCells.has(cellKey(coordinate))) {
        candidates.push(coordinate);
      }
    }
  }
  if (config.obstacleConfig.count > candidates.length) {
    throw new GenerationError(
      `Requested ${config.obstacleConfig.count} obstacles but only ` +
        `${candidates.length} non-word cells are available.`,
    );
  }

  return random
    .shuffle(candidates)
    .slice(0, config.obstacleConfig.count)
    .map((cell) => ({
      cell,
      type: random.pick(config.obstacleConfig.types),
    }))
    .sort((left, right) => cellKey(left.cell).localeCompare(cellKey(right.cell)));
}

function buildCandidate(config, baseSeed, subSeed, attempt) {
  const random = new SeededRandom(subSeed);
  const { chainWords, staticWords } = planWords(config, random);
  const chainPaths = planChainPaths(chainWords, config, random);
  const staticPaths = planStaticPaths(
    staticWords,
    config,
    random,
    chainPaths,
  );
  const grid = createGrid(
    config.gridSize.rows,
    config.gridSize.cols,
    random,
  );

  placeWord(grid, chainWords[0], chainPaths[0]);
  for (let index = 1; index < chainWords.length; index += 1) {
    const previousCells = new Set(chainPaths[index - 1].map(cellKey));
    chainPaths[index].forEach((coordinate, letterIndex) => {
      if (!previousCells.has(cellKey(coordinate))) {
        const [row, column] = coordinate;
        grid[row][column] = chainWords[index][letterIndex];
      }
    });
  }
  placeWord(grid, staticWords[0], staticPaths[0]);
  for (let index = 1; index < staticWords.length; index += 1) {
    const previousCells = new Set(staticPaths[index - 1].map(cellKey));
    staticPaths[index].forEach((coordinate, letterIndex) => {
      if (!previousCells.has(cellKey(coordinate))) {
        const [row, column] = coordinate;
        grid[row][column] = staticWords[index][letterIndex];
      }
    });
  }

  const stages = Array.from(
    { length: config.stageCount },
    (_, stageIndex) => {
      const chainWord = chainWords[stageIndex];
      const revealWord = chainWords[stageIndex + 1];
      const staticWord = staticWords[stageIndex];
      return {
        stageIndex,
        activeWords: [
          {
            word: chainWord,
            path: chainPaths[stageIndex],
            type: "REVEAL_TRIGGER",
            reveals: revealWord,
            revealsPath: chainPaths[stageIndex + 1],
            transmuteMap: buildTriggerMap({
              currentWord: chainWord,
              currentPath: chainPaths[stageIndex],
            revealWord,
            revealPath: chainPaths[stageIndex + 1],
            random,
          }),
          },
          {
            word: staticWord,
            path: staticPaths[stageIndex],
            type:
              stageIndex + 1 < staticWords.length
                ? "SIDE_REVEAL"
                : "STATIC",
            ...(stageIndex + 1 < staticWords.length
              ? {
                  reveals: staticWords[stageIndex + 1],
                  revealsPath: staticPaths[stageIndex + 1],
                }
              : {}),
            transmuteMap:
              stageIndex + 1 < staticWords.length
                ? buildTriggerMap({
                    currentWord: staticWord,
                    currentPath: staticPaths[stageIndex],
                    revealWord: staticWords[stageIndex + 1],
                    revealPath: staticPaths[stageIndex + 1],
                    random,
                  })
                : buildStaticMap(
                    staticWord,
                    staticPaths[stageIndex],
                    random,
                  ),
          },
        ],
      };
    },
  );
  const completionWords = [
    {
      word: chainWords.at(-1),
      path: chainPaths.at(-1),
    },
  ];
  const obstacles = placeObstacles(
    config,
    random,
    [...chainPaths, ...staticPaths],
  );

  return {
    generatorVersion: 2,
    seed: baseSeed,
    generationSubSeed: subSeed,
    generationAttempt: attempt,
    gridSize: { ...config.gridSize },
    chainRevealRatioActual: 0.5,
    initialGrid: grid,
    obstacles,
    stages,
    completionWords,
    accidentalWords: [],
    validation: {
      allStagesVerified: false,
      solveOrderIndependent: false,
      stagesVerified: 0,
      postTransmuteStatesVerified: 0,
    },
  };
}

function plannedOccurrenceInfo(level) {
  const keys = new Set();
  const activationStagesByKey = new Map();

  for (const stage of level.stages) {
    for (const entry of stage.activeWords) {
      const key = occurrenceKey(entry.word, entry.path);
      keys.add(key);
      const stages = activationStagesByKey.get(key) ?? [];
      stages.push(stage.stageIndex);
      activationStagesByKey.set(key, stages);
      if (entry.reveals) {
        keys.add(occurrenceKey(entry.reveals, entry.revealsPath));
      }
    }
  }
  for (const entry of level.completionWords) {
    const key = occurrenceKey(entry.word, entry.path);
    keys.add(key);
    const stages = activationStagesByKey.get(key) ?? [];
    stages.push(level.stages.length);
    activationStagesByKey.set(key, stages);
  }
  return { keys, activationStagesByKey };
}

function plannedActivationStages(level) {
  const activations = new Map();
  for (const stage of level.stages) {
    for (const entry of stage.activeWords) {
      const stages = activations.get(entry.word) ?? [];
      stages.push(stage.stageIndex);
      activations.set(entry.word, stages);
    }
  }
  for (const entry of level.completionWords) {
    const stages = activations.get(entry.word) ?? [];
    stages.push(level.stages.length);
    activations.set(entry.word, stages);
  }
  return activations;
}

function scanGrid(grid, dictionary, maximumWordLength) {
  const rows = grid.length;
  const cols = grid[0].length;
  const found = new Map();

  for (let startRow = 0; startRow < rows; startRow += 1) {
    for (let startColumn = 0; startColumn < cols; startColumn += 1) {
      for (const { rowStep, columnStep } of CANONICAL_DIRECTIONS) {
        let word = "";
        const path = [];
        for (let offset = 0; offset < maximumWordLength; offset += 1) {
          const row = startRow + rowStep * offset;
          const column = startColumn + columnStep * offset;
          if (row < 0 || row >= rows || column < 0 || column >= cols) {
            break;
          }
          word += grid[row][column];
          path.push([row, column]);
          if (word.length >= 4 && dictionary.has(word)) {
            found.set(occurrenceKey(word, path), {
              word,
              path: path.map((coordinate) => [...coordinate]),
            });
          }
        }
      }
    }
  }
  return [...found.values()];
}

function auditAccidentalWords(level, auditedStates, dictionary) {
  const planned = plannedOccurrenceInfo(level);
  const activationStages = plannedActivationStages(level);
  const plannedWords = new Set(activationStages.keys());
  const maximumWordLength = Math.max(
    4,
    ...[...dictionary].map((word) => word.length),
  );
  const accidental = new Map();

  for (const state of auditedStates) {
    const activeKeys = new Set(
      state.activeWords.map((entry) => occurrenceKey(entry.word, entry.path)),
    );
    const occurrences = scanGrid(
      state.grid,
      dictionary,
      maximumWordLength,
    );
    for (const word of plannedWords) {
      const placements = occurrences.filter(
        (occurrence) => occurrence.word === word,
      );
      if (placements.length > 1) {
        throw new GenerationError(
          `Planned word ${word} has ${placements.length} findable placements.`,
          {
            stageIndex: state.stageIndex,
            transmutedWords: state.transmutedWords,
            word,
            paths: placements.map((occurrence) => occurrence.path),
          },
        );
      }
    }

    for (const occurrence of occurrences) {
      const key = occurrenceKey(occurrence.word, occurrence.path);
      if (planned.keys.has(key)) {
        if (activeKeys.has(key)) {
          continue;
        }
        const plannedStages = planned.activationStagesByKey.get(key) ?? [];
        if (plannedStages.some((stageIndex) => stageIndex > state.stageIndex)) {
          throw new GenerationError(
            `Future planned word ${occurrence.word} formed too early.`,
            {
              stageIndex: state.stageIndex,
              transmutedWords: state.transmutedWords,
              word: occurrence.word,
              path: occurrence.path,
            },
          );
        }
      }

      const wordStages = activationStages.get(occurrence.word) ?? [];
      if (wordStages.some((stageIndex) => stageIndex > state.stageIndex)) {
        throw new GenerationError(
          `Future planned word ${occurrence.word} appeared at an unintended path.`,
          {
            stageIndex: state.stageIndex,
            transmutedWords: state.transmutedWords,
            word: occurrence.word,
            path: occurrence.path,
          },
        );
      }
      accidental.set(`${occurrence.word}|${pathKey(occurrence.path)}`, occurrence);
    }
  }

  return [...accidental.values()].sort((left, right) => {
    const byWord = left.word.localeCompare(right.word);
    return byWord || pathKey(left.path).localeCompare(pathKey(right.path));
  });
}

export function generateLevel(
  rawConfig,
  dictionaryWords,
  baseSeed = rawConfig.seed,
  options = {},
) {
  const config = validateConfig({ ...rawConfig, seed: baseSeed });
  const dictionary = new Set(
    [...dictionaryWords, ...config.wordPool]
      .map(normalizeWord)
      .filter((word) => /^[A-Z]{4,}$/.test(word)),
  );
  let lastError = null;

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const subSeed = deriveSubSeed(config.seed, attempt);
    try {
      const level = buildCandidate(config, config.seed, subSeed, attempt);
      const initialVerification = verifyLevel(level, { collectStates: true });
      const initialState = {
        stageIndex: 0,
        transmutedWords: [],
        activeWords: level.stages[0].activeWords.map((entry) => ({
          word: entry.word,
          path: entry.path.map((coordinate) => [...coordinate]),
        })),
        grid: level.initialGrid.map((row) => [...row]),
      };
      level.accidentalWords = auditAccidentalWords(
        level,
        [initialState, ...initialVerification.postTransmuteStates],
        dictionary,
      );
      level.validation = {
        allStagesVerified: true,
        solveOrderIndependent: true,
        stagesVerified: initialVerification.stagesVerified,
        postTransmuteStatesVerified:
          initialVerification.postTransmuteStatesVerified,
        reachableSettledStates:
          initialVerification.reachableAudit.settledStates,
        reachableBranches:
          initialVerification.reachableAudit.reachableBranches,
        deterministic: initialVerification.reachableAudit.deterministic,
        forwardOnly: initialVerification.reachableAudit.forwardOnly,
      };

      const serialized = `${JSON.stringify(level, null, 2)}\n`;
      const loadedLevel = JSON.parse(serialized);
      const loadedVerification = verifyLevel(loadedLevel);
      if (
        loadedVerification.stagesVerified !==
          level.validation.stagesVerified ||
        loadedVerification.postTransmuteStatesVerified !==
          level.validation.postTransmuteStatesVerified ||
        loadedVerification.reachableAudit.settledStates !==
          level.validation.reachableSettledStates ||
        loadedVerification.reachableAudit.reachableBranches !==
          level.validation.reachableBranches
      ) {
        throw new GenerationError(
          "Serialized level produced different verification counts.",
        );
      }
      return { level: loadedLevel, serialized };
    } catch (error) {
      lastError = error;
      options.onRetry?.({
        attempt,
        subSeed,
        message: error.message,
        context: error.context ?? {},
      });
    }
  }

  throw new GenerationError(
    `Unable to produce seed ${config.seed} after ${MAX_GENERATION_ATTEMPTS} attempts. ` +
      `Last error: ${lastError?.message ?? "unknown failure"}`,
    lastError?.context ?? {},
  );
}
