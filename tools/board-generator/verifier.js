import {
  applyTransmuteMaps,
  cellKey,
  cloneGrid,
  occurrenceKey,
  pathMatches,
  pathsOverlap,
} from "./grid.js";
import {
  canonicalDirectionForPath,
  scanCanonicalWord,
} from "../../game/v3/direction-contract.js";

export class VerificationError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = "VerificationError";
    this.context = context;
  }
}

function fail(message, context = {}) {
  throw new VerificationError(message, context);
}

function assertInteger(value, label, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) {
    fail(`${label} must be an integer greater than or equal to ${minimum}.`);
  }
}

function directionOf(path) {
  return canonicalDirectionForPath(path)?.key ?? null;
}

function assertCoordinate(coordinate, gridSize, label) {
  if (
    !Array.isArray(coordinate) ||
    coordinate.length !== 2 ||
    !Number.isInteger(coordinate[0]) ||
    !Number.isInteger(coordinate[1])
  ) {
    fail(`${label} must be a [row, column] integer pair.`);
  }

  const [row, column] = coordinate;
  if (
    row < 0 ||
    row >= gridSize.rows ||
    column < 0 ||
    column >= gridSize.cols
  ) {
    fail(`${label} leaves the grid at [${row},${column}].`);
  }
}

function assertPath(path, word, gridSize, label) {
  if (!Array.isArray(path) || path.length !== word.length) {
    fail(`${label} path length must equal the word length.`);
  }

  const seen = new Set();
  path.forEach((coordinate, index) => {
    assertCoordinate(coordinate, gridSize, `${label}.path[${index}]`);
    const key = cellKey(coordinate);
    if (seen.has(key)) {
      fail(`${label} path repeats cell ${key}.`);
    }
    seen.add(key);
  });

  const direction = directionOf(path);
  if (!direction) {
    fail(`${label} path is not a contiguous straight line.`);
  }
  return direction;
}

function assertWord(word, label) {
  if (!/^[A-Z]{4,}$/.test(word)) {
    fail(`${label} must contain four or more uppercase A–Z letters.`);
  }
}

function assertTransmuteMap(entry, gridSize, label) {
  if (
    !Array.isArray(entry.transmuteMap) ||
    entry.transmuteMap.length !== entry.path.length
  ) {
    fail(`${label}.transmuteMap must replace every cleared cell exactly once.`);
  }

  const expectedCells = new Set(entry.path.map(cellKey));
  const mappedCells = new Set();
  entry.transmuteMap.forEach((replacement, index) => {
    if (!replacement || typeof replacement !== "object") {
      fail(`${label}.transmuteMap[${index}] must be an object.`);
    }
    assertCoordinate(
      replacement.cell,
      gridSize,
      `${label}.transmuteMap[${index}].cell`,
    );
    if (!/^[A-Z]$/.test(replacement.letter)) {
      fail(`${label}.transmuteMap[${index}].letter must be one uppercase letter.`);
    }

    const key = cellKey(replacement.cell);
    if (!expectedCells.has(key)) {
      fail(`${label}.transmuteMap replaces a cell outside the cleared word.`);
    }
    if (mappedCells.has(key)) {
      fail(`${label}.transmuteMap replaces cell ${key} more than once.`);
    }
    mappedCells.add(key);
  });

  if (
    expectedCells.size !== mappedCells.size ||
    [...expectedCells].some((key) => !mappedCells.has(key))
  ) {
    fail(`${label}.transmuteMap does not cover the cleared path exactly.`);
  }
}

function assertActiveEntry(entry, gridSize, label) {
  if (!entry || typeof entry !== "object") {
    fail(`${label} must be an object.`);
  }
  assertWord(entry.word, `${label}.word`);
  if (
    entry.type !== "STATIC" &&
    entry.type !== "REVEAL_TRIGGER" &&
    entry.type !== "SIDE_REVEAL"
  ) {
    fail(`${label}.type must be STATIC, REVEAL_TRIGGER, or SIDE_REVEAL.`);
  }

  assertPath(entry.path, entry.word, gridSize, label);
  assertTransmuteMap(entry, gridSize, label);

  if (entry.type === "REVEAL_TRIGGER" || entry.type === "SIDE_REVEAL") {
    assertWord(entry.reveals, `${label}.reveals`);
    assertPath(
      entry.revealsPath,
      entry.reveals,
      gridSize,
      `${label}.reveals`,
    );
    const transmutedCells = new Set(entry.path.map(cellKey));
    const revealCells = entry.revealsPath.map(cellKey);
    const sharedCount = revealCells.filter((key) =>
      transmutedCells.has(key),
    ).length;
    if (sharedCount < 1) {
      fail(`${label} reveal must use at least one transmuted cell.`);
    }
    if (sharedCount >= entry.revealsPath.length) {
      fail(`${label} reveal must also use at least one latent, unchanged cell.`);
    }
  }
}

function validateLevelShape(level) {
  if (!level || typeof level !== "object") {
    fail("Level must be an object.");
  }
  if (level.generatorVersion !== 2) {
    fail(`Unsupported generatorVersion: ${level.generatorVersion}.`);
  }
  assertInteger(level.seed, "seed");
  assertInteger(level.gridSize?.rows, "gridSize.rows", 1);
  assertInteger(level.gridSize?.cols, "gridSize.cols", 1);

  const { rows, cols } = level.gridSize;
  if (
    !Array.isArray(level.initialGrid) ||
    level.initialGrid.length !== rows ||
    level.initialGrid.some(
      (row) =>
        !Array.isArray(row) ||
        row.length !== cols ||
        row.some((letter) => !/^[A-Z]$/.test(letter)),
    )
  ) {
    fail("initialGrid does not match gridSize or contains invalid letters.");
  }
  if ("refillQueues" in level) {
    fail("generatorVersion 2 levels must not contain refillQueues.");
  }

  if (!Array.isArray(level.obstacles)) {
    fail("obstacles must be an array.");
  }
  const obstacleCells = new Set();
  level.obstacles.forEach((obstacle, index) => {
    if (!obstacle || typeof obstacle !== "object") {
      fail(`obstacles[${index}] must be an object.`);
    }
    assertCoordinate(obstacle.cell, level.gridSize, `obstacles[${index}].cell`);
    if (!/^[A-Z][A-Z0-9_]*$/.test(obstacle.type)) {
      fail(`obstacles[${index}].type must be an uppercase identifier.`);
    }
    const key = cellKey(obstacle.cell);
    if (obstacleCells.has(key)) {
      fail(`Multiple obstacles occupy cell ${key}.`);
    }
    obstacleCells.add(key);
  });

  if (!Array.isArray(level.stages) || level.stages.length === 0) {
    fail("stages must contain at least one stage.");
  }
  level.stages.forEach((stage, stageIndex) => {
    if (stage.stageIndex !== stageIndex) {
      fail(`Stage ${stageIndex} has a mismatched stageIndex.`);
    }
    if (
      !Array.isArray(stage.activeWords) ||
      stage.activeWords.length < 2 ||
      stage.activeWords.length > 3
    ) {
      fail(`Stage ${stageIndex} must contain 2–3 active words.`);
    }

    const usedCells = new Set();
    stage.activeWords.forEach((entry, wordIndex) => {
      const label = `stages[${stageIndex}].activeWords[${wordIndex}]`;
      assertActiveEntry(entry, level.gridSize, label);
      for (const coordinate of entry.path) {
        const key = cellKey(coordinate);
        if (usedCells.has(key)) {
          fail(`Stage ${stageIndex} active words overlap at cell ${key}.`);
        }
        usedCells.add(key);
      }
    });

    const triggers = stage.activeWords.filter((entry) => entry.reveals);
    for (const trigger of triggers) {
      for (const other of stage.activeWords) {
        if (
          other !== trigger &&
          pathsOverlap(trigger.revealsPath, other.path)
        ) {
          fail(
            `Stage ${stageIndex} reveal ${trigger.reveals} overlaps ` +
              `still-active word ${other.word}.`,
          );
        }
      }
    }
    for (let leftIndex = 0; leftIndex < triggers.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < triggers.length;
        rightIndex += 1
      ) {
        if (
          pathsOverlap(
            triggers[leftIndex].revealsPath,
            triggers[rightIndex].revealsPath,
          )
        ) {
          fail(`Stage ${stageIndex} planned reveals overlap each other.`);
        }
      }
    }
  });

  if (
    !Array.isArray(level.completionWords) ||
    level.completionWords.length < 1
  ) {
    fail("completionWords must contain at least one terminal reveal.");
  }
  level.completionWords.forEach((entry, index) => {
    assertWord(entry.word, `completionWords[${index}].word`);
    assertPath(
      entry.path,
      entry.word,
      level.gridSize,
      `completionWords[${index}]`,
    );
  });
}

function activeMap(entries) {
  return new Map(
    entries.map((entry) => [
      occurrenceKey(entry.word, entry.path),
      { word: entry.word, path: entry.path },
    ]),
  );
}

function serializeActive(active) {
  return [...active.values()].map((entry) => ({
    word: entry.word,
    path: entry.path.map((coordinate) => [...coordinate]),
  }));
}

function sortedActiveKeys(active) {
  return [...active.keys()].sort();
}

function sameActiveSet(left, right) {
  return (
    JSON.stringify(sortedActiveKeys(left)) ===
    JSON.stringify(sortedActiveKeys(right))
  );
}

function assertActiveWordsPresent(grid, active, context) {
  for (const entry of active.values()) {
    if (!pathMatches(grid, entry.word, entry.path)) {
      fail(
        `Active word ${entry.word} does not exist at its planned path.`,
        context,
      );
    }
  }
}

function nonEmptySubsets(entries) {
  const subsets = [];
  const subsetCount = 2 ** entries.length;
  for (let mask = 1; mask < subsetCount; mask += 1) {
    subsets.push(
      entries.filter((_, index) => (mask & (1 << index)) !== 0),
    );
  }
  return subsets;
}

function assertReplacementCreatesReveal(grid, entry, context) {
  if (!pathMatches(grid, entry.reveals, entry.revealsPath)) {
    fail(
      `Transmuting ${entry.word} did not reveal ${entry.reveals} at its planned path.`,
      context,
    );
  }
}

function assertRevealReadsAsCaused(startingGrid, entry, context) {
  const revealIndexes = new Map(
    entry.revealsPath.map((coordinate, index) => [cellKey(coordinate), index]),
  );
  let changedSharedCell = false;

  for (const replacement of entry.transmuteMap) {
    const key = cellKey(replacement.cell);
    const revealIndex = revealIndexes.get(key);
    if (revealIndex === undefined) {
      continue;
    }
    if (replacement.letter !== entry.reveals[revealIndex]) {
      fail(
        `Transmuted cell ${key} does not contain its required reveal letter.`,
        context,
      );
    }
    const [row, column] = replacement.cell;
    if (startingGrid[row][column] !== replacement.letter) {
      changedSharedCell = true;
    }
  }

  if (!changedSharedCell) {
    fail(
      `Reveal ${entry.reveals} has no visibly changed transmuted tile.`,
      context,
    );
  }
}

function samePath(left, right) {
  return (
    left.length === right.length &&
    left.every(
      ([row, column], index) =>
        row === right[index][0] && column === right[index][1],
    )
  );
}

function reachableEntries(level) {
  return level.stages.flatMap((stage) =>
    stage.activeWords.map((definition, wordIndex) => ({
      id: `s${stage.stageIndex}w${wordIndex}`,
      stageIndex: stage.stageIndex,
      definition,
      expectedPath: definition.path.map((coordinate) => [...coordinate]),
    })),
  );
}

function reachableStateKey(state) {
  return JSON.stringify({
    grid: state.grid,
    active: [...state.active].sort(),
    pending: [...state.pending],
    completed: [...state.completed].sort(),
  });
}

function cloneReachableState(state) {
  return {
    grid: cloneGrid(state.grid),
    active: [...state.active],
    pending: [...state.pending],
    completed: [...state.completed],
    history: [...state.history],
    tileIds: [...state.tileIds],
  };
}

function assertReachableState(level, state, entries, entryById) {
  const completed = new Set(state.completed);
  const active = new Set(state.active);
  const allWords = new Set(entries.map((entry) => entry.definition.word));
  const appearances = new Map(
    [...allWords].map((word) => [word, scanCanonicalWord(state.grid, word)]),
  );

  for (const entry of entries) {
    const matches = appearances.get(entry.definition.word) ?? [];
    if (active.has(entry.id)) {
      if (matches.length === 0) {
        fail(`Active target ${entry.definition.word} has no legal forward appearance.`, {
          history: state.history,
          targetId: entry.id,
          activeIds: state.active,
        });
      }
      if (matches.length > 1) {
        fail(`Active target ${entry.definition.word} has ${matches.length} legal appearances.`, {
          history: state.history,
          targetId: entry.id,
          paths: matches.map((match) => match.path),
        });
      }
      if (!samePath(matches[0].path, entry.expectedPath)) {
        fail(`Active target ${entry.definition.word} does not match its planned path.`, {
          history: state.history,
          expected: entry.expectedPath,
          actual: matches[0].path,
        });
      }
    } else if (completed.has(entry.id)) {
      if (matches.length > 0) {
        fail(`Completed target ${entry.definition.word} remains collectible.`, {
          history: state.history,
          targetId: entry.id,
          paths: matches.map((match) => match.path),
        });
      }
    } else if (matches.length > 0) {
      fail(`Inactive target ${entry.definition.word} appears before activation.`, {
        history: state.history,
        targetId: entry.id,
        paths: matches.map((match) => match.path),
      });
    }
  }

  if (completed.size === entries.length) {
    if (state.active.length > 0 || state.pending.length > 0) {
      fail("Completed reachable state still has active or pending objectives.", {
        history: state.history,
      });
    }
    for (const terminal of level.completionWords) {
      const matches = scanCanonicalWord(state.grid, terminal.word);
      if (matches.length !== 1 || !samePath(matches[0].path, terminal.path)) {
        fail(`Terminal reveal ${terminal.word} is not uniquely present at completion.`, {
          history: state.history,
          matches,
        });
      }
    }
    return;
  }

  if (state.active.length === 0) {
    fail("Reachable branch reached a dead board with objectives remaining.", {
      history: state.history,
      pending: state.pending,
    });
  }

  const activeCells = new Set();
  for (const id of state.active) {
    const entry = entryById.get(id);
    for (const coordinate of entry.expectedPath) {
      const key = cellKey(coordinate);
      if (activeCells.has(key)) {
        fail("Reachable active objectives overlap.", {
          history: state.history,
          targetId: id,
          cell: key,
        });
      }
      activeCells.add(key);
    }
  }
}

function solveReachableChoice(level, source, entry, entriesByStage) {
  const next = cloneReachableState(source);
  const beforeGrid = cloneGrid(next.grid);
  next.grid = applyTransmuteMaps(next.grid, [entry.definition.transmuteMap]);
  next.active = next.active.filter((id) => id !== entry.id);
  next.completed.push(entry.id);
  next.history.push(entry.id);

  const mappedCells = new Set(entry.definition.transmuteMap.map((item) => cellKey(item.cell)));
  for (let row = 0; row < next.grid.length; row += 1) {
    for (let column = 0; column < next.grid[row].length; column += 1) {
      if (
        beforeGrid[row][column] !== next.grid[row][column] &&
        !mappedCells.has(cellKey([row, column]))
      ) {
        fail("A reachable transition changed a letter outside its transmute map.", {
          history: next.history,
          row,
          column,
        });
      }
    }
  }
  if (JSON.stringify(next.tileIds) !== JSON.stringify(source.tileIds)) {
    fail("Tile IDs or coordinates changed during transmutation.", {
      history: next.history,
    });
  }

  if (entry.definition.reveals) {
    const nextStage = entriesByStage[entry.stageIndex + 1];
    if (nextStage) {
      const trigger = nextStage.find(
        (candidate) =>
          candidate.definition.word === entry.definition.reveals &&
          samePath(candidate.definition.path, entry.definition.revealsPath),
      );
      if (!trigger) {
        fail(`No successor branch exists for ${entry.definition.reveals}.`, {
          history: next.history,
        });
      }
      next.active.push(trigger.id);
    }
  }
  return next;
}

export function auditReachableStates(level) {
  validateLevelShape(level);
  const entriesByStage = level.stages.map((stage) =>
    stage.activeWords.map((definition, wordIndex) => ({
      id: `s${stage.stageIndex}w${wordIndex}`,
      stageIndex: stage.stageIndex,
      definition,
      expectedPath: definition.path.map((coordinate) => [...coordinate]),
    })),
  );
  const entries = entriesByStage.flat();
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const tileIds = Array.from({ length: 64 }, (_, index) => {
    const row = Math.floor(index / 8);
    const column = index % 8;
    return `tile-${row}-${column}@${row},${column}`;
  });
  const initial = {
    grid: cloneGrid(level.initialGrid),
    active: entriesByStage[0].map((entry) => entry.id),
    pending: [],
    completed: [],
    history: [],
    tileIds,
  };
  const stack = [initial];
  const visited = new Set();
  let reachableBranches = 0;
  let completedStates = 0;

  while (stack.length > 0) {
    const state = stack.pop();
    const key = reachableStateKey(state);
    if (visited.has(key)) continue;
    visited.add(key);
    assertReachableState(level, state, entries, entryById);
    if (state.completed.length === entries.length) {
      completedStates += 1;
      continue;
    }

    for (const activeId of state.active) {
      const entry = entryById.get(activeId);
      const first = solveReachableChoice(level, state, entry, entriesByStage);
      const repeated = solveReachableChoice(level, state, entry, entriesByStage);
      if (reachableStateKey(first) !== reachableStateKey(repeated)) {
        fail("The same seed and move history produced different states.", {
          history: [...state.history, activeId],
        });
      }
      reachableBranches += 1;
      stack.push(first);
    }
  }

  return {
    reachableBranches,
    settledStates: visited.size,
    completedStates,
    totalObjectives: entries.length,
    deterministic: true,
    forwardOnly: true,
  };
}

export function verifyLevel(level, options = {}) {
  validateLevelShape(level);
  const collectStates = options.collectStates === true;
  let canonicalGrid = cloneGrid(level.initialGrid);
  let carriedReveals = null;
  const postTransmuteStates = [];
  let statesVerified = 0;

  for (const stage of level.stages) {
    const stageContext = { stageIndex: stage.stageIndex };
    const stageActive = activeMap(stage.activeWords);
    if (carriedReveals) {
      for (const key of carriedReveals.keys()) {
        if (!stageActive.has(key)) {
          fail(
            `Stage ${stage.stageIndex} does not activate carried reveal ${key}.`,
            stageContext,
          );
        }
      }
    }
    assertActiveWordsPresent(canonicalGrid, stageActive, stageContext);

    for (let leftIndex = 0; leftIndex < stage.activeWords.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < stage.activeWords.length;
        rightIndex += 1
      ) {
        const left = stage.activeWords[leftIndex];
        const right = stage.activeWords[rightIndex];
        if (pathsOverlap(left.path, right.path)) {
          fail(
            `Stage ${stage.stageIndex} active words ${left.word} and ${right.word} overlap.`,
            stageContext,
          );
        }
      }
    }

    const subsets = nonEmptySubsets(stage.activeWords);
    let fullStageGrid = null;
    let fullStageActive = null;

    for (const solvedEntries of subsets) {
      const solvedKeys = new Set(
        solvedEntries.map((entry) => occurrenceKey(entry.word, entry.path)),
      );
      const resultGrid = applyTransmuteMaps(
        canonicalGrid,
        solvedEntries.map((entry) => entry.transmuteMap),
      );
      const active = new Map(
        [...stageActive].filter(([key]) => !solvedKeys.has(key)),
      );
      const context = {
        stageIndex: stage.stageIndex,
        transmutedWords: solvedEntries.map((entry) => entry.word),
      };

      for (const entry of solvedEntries) {
        if (entry.reveals) {
          assertRevealReadsAsCaused(canonicalGrid, entry, context);
          assertReplacementCreatesReveal(resultGrid, entry, context);
          active.set(occurrenceKey(entry.reveals, entry.revealsPath), {
            word: entry.reveals,
            path: entry.revealsPath,
          });
        }
      }
      assertActiveWordsPresent(resultGrid, active, context);
      statesVerified += 1;

      if (collectStates) {
        postTransmuteStates.push({
          stageIndex: stage.stageIndex,
          transmutedWords: solvedEntries.map((entry) => entry.word),
          activeWords: serializeActive(active),
          grid: cloneGrid(resultGrid),
        });
      }

      if (solvedEntries.length === stage.activeWords.length) {
        fullStageGrid = resultGrid;
        fullStageActive = active;
      }
    }

    canonicalGrid = fullStageGrid;
    carriedReveals = fullStageActive;
  }

  const expectedCompletion = activeMap(level.completionWords);
  if (!sameActiveSet(carriedReveals, expectedCompletion)) {
    fail("Final reveals do not match completionWords.", {
      expected: sortedActiveKeys(expectedCompletion),
      actual: sortedActiveKeys(carriedReveals),
    });
  }

  const reachableAudit = auditReachableStates(level);
  return {
    allStagesVerified: true,
    solveOrderIndependent: true,
    stagesVerified: level.stages.length,
    postTransmuteStatesVerified: statesVerified,
    postTransmuteStates,
    reachableAudit,
  };
}
