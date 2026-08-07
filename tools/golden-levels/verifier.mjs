import {
  canonicalBoardHash,
  primaryZoneForPath,
  validateGoldenPlacement,
} from "../../game/v3/golden-level-contract.js";
import { scanCanonicalWord } from "../../game/v3/direction-contract.js";

function samePath(left, right) {
  return left.length === right.length && left.every(
    ([row, column], index) => row === right[index][0] && column === right[index][1],
  );
}

function cloneGrid(grid) {
  return grid.map((row) => [...row]);
}

function applyBranch(grid, branch, errors) {
  const next = cloneGrid(grid);
  for (const transformation of branch.transformations) {
    const [row, column] = transformation.cell;
    if (next[row]?.[column] !== transformation.from) {
      errors.push(`${branch.id}: expected ${transformation.from} at ${row},${column}, found ${next[row]?.[column] ?? "out-of-bounds"}`);
      continue;
    }
    if (!/^[A-Z]$/.test(transformation.to)) {
      errors.push(`${branch.id}: invalid replacement letter ${transformation.to}`);
      continue;
    }
    next[row][column] = transformation.to;
  }
  return next;
}

export function enumerateCompleteMoveOrders(level) {
  const states = new Map(level.states.map((state) => [state.id, state]));
  const sequences = [];
  const visit = (stateId, moves) => {
    const state = states.get(stateId);
    if (!state) return;
    if (state.expectedCompletion) {
      sequences.push(moves);
      return;
    }
    for (const branch of state.branches) {
      visit(branch.nextStateId, [...moves, branch.objectiveId]);
    }
  };
  visit(level.activationRules.initialStateId, []);
  return sequences;
}

export function verifyGoldenLevel(level) {
  const errors = [];
  const stateMap = new Map(level.states.map((state) => [state.id, state]));
  const objectiveMap = new Map(level.objectives.map((objective) => [objective.id, objective]));
  const stateVisits = new Map();
  const seenStateHashes = new Map();
  const queue = [{
    stateId: level.activationRules.initialStateId,
    grid: cloneGrid(level.initialGrid),
    sequence: [],
    zoneHistory: [],
  }];
  let reachableBranches = 0;
  let recoveryUsage = 0;
  let consecutiveZoneReuse = 0;
  const directionUsage = { H: 0, V: 0, D: 0, A: 0 };
  const placementAxes = { rows: {}, columns: {}, diagonals: {} };
  const zoneUsage = Object.fromEntries(
    Array.from({ length: 3 }, (_, row) =>
      Array.from({ length: 3 }, (_, column) => [`R${row + 1}C${column + 1}`, 0]),
    ).flat(),
  );

  if (level.objectives.length !== 8 || level.objectiveCount !== 8) {
    errors.push("Golden Level 1 must contain exactly eight objectives.");
  }
  if (new Set(level.objectives.map(({ id }) => id)).size !== level.objectives.length) {
    errors.push("Objective IDs must be unique.");
  }
  if (new Set(level.states.map(({ id }) => id)).size !== level.states.length) {
    errors.push("Reachable-state IDs must be unique.");
  }
  if (level.activationRules.initialActiveObjectives.length !== 2) {
    errors.push("The initial state must expose exactly two objectives.");
  }

  for (const objective of level.objectives) {
    const placement = validateGoldenPlacement(objective);
    if (!placement.directionMatches) errors.push(`${objective.id}: direction does not match its path.`);
    if (!placement.zoneMatches) errors.push(`${objective.id}: primary zone does not match its geometric centre.`);
    directionUsage[objective.direction] += 1;
    zoneUsage[objective.primaryZone] = (zoneUsage[objective.primaryZone] ?? 0) + 1;
    if (objective.direction === "H") {
      const row = String(objective.path[0][0]);
      placementAxes.rows[row] = (placementAxes.rows[row] ?? 0) + 1;
    } else if (objective.direction === "V") {
      const column = String(objective.path[0][1]);
      placementAxes.columns[column] = (placementAxes.columns[column] ?? 0) + 1;
    } else {
      const [row, column] = objective.path[0];
      const diagonal = objective.direction === "D" ? String(row - column) : String(row + column);
      placementAxes.diagonals[`${objective.direction}:${diagonal}`] =
        (placementAxes.diagonals[`${objective.direction}:${diagonal}`] ?? 0) + 1;
    }
  }
  if (Object.values(directionUsage).some((count) => count === 0)) {
    errors.push("Golden Level 1 must use all four canonical directions.");
  }
  if (new Set(level.objectives.map(({ primaryZone }) => primaryZone)).size !== 8) {
    errors.push("Golden Level 1 placements must occupy eight distinct primary zones.");
  }

  while (queue.length > 0) {
    const current = queue.shift();
    const state = stateMap.get(current.stateId);
    if (!state) {
      errors.push(`Missing authored state ${current.stateId}.`);
      continue;
    }
    const hash = canonicalBoardHash(current.grid);
    const priorHash = seenStateHashes.get(state.id);
    if (priorHash && priorHash !== hash) {
      errors.push(`${state.id}: determinism failure (${priorHash} versus ${hash}).`);
    }
    seenStateHashes.set(state.id, hash);
    stateVisits.set(state.id, (stateVisits.get(state.id) ?? 0) + 1);
    if ((stateVisits.get(state.id) ?? 0) > 1) continue;

    if (hash !== state.expectedBoardHash) {
      errors.push(`${state.id}: expected board hash ${state.expectedBoardHash}, found ${hash}.`);
    }
    if (state.activeObjectives.length > 2) {
      errors.push(`${state.id}: more than two active objectives.`);
    }
    if (!state.expectedCompletion && state.activeObjectives.length === 0) {
      errors.push(`${state.id}: dead board.`);
    }
    if (state.expectedCompletion !== (state.completedObjectives.length === level.objectives.length)) {
      errors.push(`${state.id}: incorrect completion state.`);
    }
    if (state.expectedCompletion && state.id !== level.expectedCompletionStateId) {
      errors.push(`${state.id}: unexpected completion identifier.`);
    }

    for (const objective of level.objectives) {
      const appearances = scanCanonicalWord(current.grid, objective.word);
      const isActive = state.activeObjectives.includes(objective.id);
      const isCompleted = state.completedObjectives.includes(objective.id);
      if (isActive && appearances.length !== 1) {
        errors.push(`${state.id}:${objective.id}: active target has ${appearances.length} appearances.`);
      }
      if (isActive && appearances.length === 1 && !samePath(appearances[0].path, objective.path)) {
        errors.push(`${state.id}:${objective.id}: active target is not on its registered path.`);
      }
      if (!isActive && !isCompleted && appearances.length > 0) {
        errors.push(`${state.id}:${objective.id}: inactive target appears prematurely.`);
      }
      if (isCompleted && appearances.length > 0) {
        errors.push(`${state.id}:${objective.id}: completed target remains collectible.`);
      }
    }

    const branchIds = state.branches.map(({ objectiveId }) => objectiveId);
    for (const activeId of state.activeObjectives) {
      if (branchIds.filter((id) => id === activeId).length !== 1) {
        errors.push(`${state.id}:${activeId}: missing or duplicate authored branch.`);
      }
    }
    for (const branch of state.branches) {
      reachableBranches += 1;
      const objective = objectiveMap.get(branch.objectiveId);
      if (!objective || !state.activeObjectives.includes(branch.objectiveId)) {
        errors.push(`${branch.id}: branch objective is not active.`);
        continue;
      }
      if (branch.sourceStateId !== state.id || !samePath(branch.sourcePath, objective.path)) {
        errors.push(`${branch.id}: source state or path mismatch.`);
      }
      const nextGrid = applyBranch(current.grid, branch, errors);
      const nextHash = canonicalBoardHash(nextGrid);
      if (nextHash !== branch.expectedBoardHash) {
        errors.push(`${branch.id}: incorrect successor board hash.`);
      }
      const nextState = stateMap.get(branch.nextStateId);
      if (!nextState) {
        errors.push(`${branch.id}: missing successor state ${branch.nextStateId}.`);
        continue;
      }
      if (nextHash !== nextState.expectedBoardHash) {
        errors.push(`${branch.id}: successor state hash mismatch.`);
      }
      if (JSON.stringify(branch.expectedNextActiveObjectives) !== JSON.stringify(nextState.activeObjectives)) {
        errors.push(`${branch.id}: next active-objective list mismatch.`);
      }
      if (branch.localSuccessor) {
        const local = objectiveMap.get(branch.localSuccessor.objectiveId);
        const changedKeys = new Set(branch.transformations.map(({ cell }) => cell.join(",")));
        const sharedKeys = new Set(objective.path
          .filter(([row, column]) => local?.path.some(([r, c]) => r === row && c === column))
          .map((cell) => cell.join(",")));
        if (!local || local.primaryZone !== branch.localSuccessor.zone) {
          errors.push(`${branch.id}: local-successor zone mismatch.`);
        }
        if (![...sharedKeys].some((key) => changedKeys.has(key))) {
          errors.push(`${branch.id}: local successor does not use a transformed shared tile.`);
        }
        if (local?.primaryZone === objective.primaryZone) {
          consecutiveZoneReuse += 1;
          errors.push(`${branch.id}: consecutive local successor reuses ${objective.primaryZone}.`);
        }
      }
      if (branch.remoteSuccessor) {
        const remote = objectiveMap.get(branch.remoteSuccessor.objectiveId);
        if (!remote || remote.primaryZone !== branch.remoteSuccessor.zone) {
          errors.push(`${branch.id}: remote-successor zone mismatch.`);
        }
        if (remote?.primaryZone === objective.primaryZone) {
          errors.push(`${branch.id}: remote successor does not move attention.`);
        }
      }
      const nextObjective = nextState.activeObjectives
        .map((id) => objectiveMap.get(id))
        .find((candidate) => candidate && !state.activeObjectives.includes(candidate.id));
      const nextZoneHistory = nextObjective
        ? [...current.zoneHistory, nextObjective.primaryZone]
        : [...current.zoneHistory];
      if (nextZoneHistory.length >= 2 && nextZoneHistory.at(-1) === nextZoneHistory.at(-2)) {
        consecutiveZoneReuse += 1;
        errors.push(`${branch.id}: newly activated targets reuse a primary zone consecutively.`);
      }
      queue.push({
        stateId: branch.nextStateId,
        grid: nextGrid,
        sequence: [...current.sequence, branch.objectiveId],
        zoneHistory: nextZoneHistory,
      });
    }
  }

  const completeMoveOrders = enumerateCompleteMoveOrders(level);
  const duplicateStates = [...stateVisits.values()].filter((visits) => visits > 1).length;
  const unreachableStates = level.states.filter((state) => !stateVisits.has(state.id)).map(({ id }) => id);
  if (unreachableStates.length > 0) errors.push(`Unreachable states: ${unreachableStates.join(", ")}.`);
  if (stateVisits.size !== level.replayMetadata.expectedReachableStates) {
    errors.push(`Expected ${level.replayMetadata.expectedReachableStates} states, reached ${stateVisits.size}.`);
  }
  if (reachableBranches !== level.replayMetadata.expectedReachableBranches) {
    errors.push(`Expected ${level.replayMetadata.expectedReachableBranches} branches, reached ${reachableBranches}.`);
  }
  if (completeMoveOrders.length !== level.replayMetadata.expectedCompleteMoveOrders) {
    errors.push(`Expected ${level.replayMetadata.expectedCompleteMoveOrders} move orders, found ${completeMoveOrders.length}.`);
  }

  const countErrors = (pattern) => errors.filter((error) => pattern.test(error)).length;
  const rowColumnDiagonalReuse = Object.values(placementAxes)
    .flatMap((usage) => Object.values(usage))
    .filter((count) => count > 1)
    .reduce((sum, count) => sum + count - 1, 0);
  const report = {
    valid: errors.length === 0,
    errors,
    reachableStates: stateVisits.size,
    reachableBranches,
    completeMoveOrders: completeMoveOrders.length,
    duplicateStates,
    missingBranches: errors.filter((error) => /branch/i.test(error)).length,
    recoveryUsage,
    invalidTransformations: countErrors(/transform|replacement/i),
    incorrectBoardHashes: countErrors(/hash/i),
    missingTargets: countErrors(/active target has 0 appearances/i),
    duplicateTargets: countErrors(/active target has [2-9]\d* appearances/i),
    prematureInactiveTargets: countErrors(/inactive target appears prematurely/i),
    remainingCompletedTargets: countErrors(/completed target remains collectible/i),
    unsupportedDirections: countErrors(/direction/i),
    deadBoards: countErrors(/dead board/i),
    determinismFailures: countErrors(/determinism/i),
    incorrectCompletionStates: countErrors(/completion/i),
    directionUsage,
    placementAxes,
    rowColumnDiagonalReuse,
    zoneUsage,
    consecutiveZoneReuse,
    deterministic: !errors.some((error) => /determinism|hash/i.test(error)),
    completionState: level.expectedCompletionStateId,
  };
  if (!report.valid) {
    throw new Error(`Golden-level verification failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  }
  return report;
}
