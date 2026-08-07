import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalBoardHash,
  goldenBranchId,
  goldenStateId,
  primaryZoneForPath,
} from "../../game/v3/golden-level-contract.js";
import { canonicalDirectionForPath } from "../../game/v3/direction-contract.js";

const here = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(here, "../../game/v3/data/golden-levels/golden_01.json");

const paths = {
  shore: [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5]],
  coral: [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]],
  star: [[4, 1], [4, 2], [4, 3], [4, 4]],
  reef: [[4, 3], [5, 2], [6, 1], [7, 0]],
  wave: [[5, 3], [5, 4], [5, 5], [5, 6]],
  pearl: [[1, 4], [2, 4], [3, 4], [4, 4], [5, 4]],
  ocean: [[0, 3], [1, 4], [2, 5], [3, 6], [4, 7]],
  fin: [[3, 5], [3, 6], [3, 7]],
};

const objectiveBlueprints = [
  ["a0-shore", "SHORE", paths.shore, "A", 0, [{ cueId: "first-drag", kind: "DRAG", message: "Drag straight across SHORE", showOnce: true }]],
  ["a1-coral", "CORAL", paths.coral, "A", 1, [{ cueId: "first-transform", kind: "TRANSFORM", message: "One letter flipped to reveal CORAL", showOnce: true }]],
  ["a2-star", "STAR", paths.star, "A", 2, []],
  ["a3-reef", "REEF", paths.reef, "A", 3, [{ cueId: "gentle-diagonal", kind: "REVEAL", message: "Follow the gentle diagonal to REEF", showOnce: true }]],
  ["b0-wave", "WAVE", paths.wave, "B", 0, [{ cueId: "second-choice", kind: "DRAG", message: "WAVE is another valid first choice", showOnce: true }]],
  ["b1-pearl", "PEARL", paths.pearl, "B", 1, [{ cueId: "attention-shift", kind: "ATTENTION_SHIFT", message: "The Current moved to a different board area", showOnce: true }]],
  ["b2-ocean", "OCEAN", paths.ocean, "B", 2, [{ cueId: "first-down-diagonal", kind: "REVEAL", message: "OCEAN introduces a clear diagonal", showOnce: true }]],
  ["b3-fin", "FIN", paths.fin, "B", 3, []],
];

const objectives = objectiveBlueprints.map(([id, word, path, chain, chainIndex, tutorialCues]) => ({
  id,
  word,
  path,
  direction: canonicalDirectionForPath(path).key,
  primaryZone: primaryZoneForPath(path).id,
  chain,
  chainIndex,
  tutorialCues,
}));

const chains = {
  A: objectives.filter((objective) => objective.chain === "A"),
  B: objectives.filter((objective) => objective.chain === "B"),
};

const transformations = {
  "a0-shore": [{ cell: [0, 1], from: "S", to: "C" }],
  "a1-coral": [{ cell: [4, 1], from: "L", to: "S" }],
  "a2-star": [{ cell: [4, 3], from: "A", to: "R" }],
  "a3-reef": [{ cell: [4, 3], from: "R", to: "X" }],
  "b0-wave": [{ cell: [5, 4], from: "A", to: "L" }],
  "b1-pearl": [{ cell: [1, 4], from: "P", to: "C" }],
  "b2-ocean": [{ cell: [3, 6], from: "A", to: "I" }],
  "b3-fin": [{ cell: [3, 6], from: "I", to: "X" }],
};

const initialGrid = [
  ["Q", "S", "H", "O", "R", "E", "X", "Z"],
  ["Z", "O", "Q", "X", "P", "K", "J", "Y"],
  ["J", "R", "Z", "Q", "E", "E", "K", "X"],
  ["X", "A", "Q", "Z", "A", "F", "A", "N"],
  ["Q", "L", "T", "A", "R", "Z", "X", "N"],
  ["J", "Q", "E", "W", "A", "V", "E", "Z"],
  ["X", "E", "Q", "J", "K", "Z", "Y", "Q"],
  ["F", "Z", "X", "Q", "J", "K", "Y", "X"],
];

function cloneGrid(grid) {
  return grid.map((row) => [...row]);
}

function apply(grid, objectiveId) {
  for (const change of transformations[objectiveId]) {
    const [row, column] = change.cell;
    if (grid[row][column] !== change.from) {
      throw new Error(`${objectiveId} expected ${change.from} at ${row},${column}, found ${grid[row][column]}`);
    }
    grid[row][column] = change.to;
  }
}

function gridForCounts(completedA, completedB) {
  const grid = cloneGrid(initialGrid);
  chains.A.slice(0, completedA).forEach((objective) => apply(grid, objective.id));
  chains.B.slice(0, completedB).forEach((objective) => apply(grid, objective.id));
  return grid;
}

function completedForCounts(completedA, completedB) {
  return [
    ...chains.A.slice(0, completedA).map(({ id }) => id),
    ...chains.B.slice(0, completedB).map(({ id }) => id),
  ];
}

function activeForCounts(completedA, completedB) {
  return [chains.A[completedA]?.id, chains.B[completedB]?.id].filter(Boolean);
}

const allIds = objectives.map(({ id }) => id);
const states = [];
for (let completedA = 0; completedA <= 4; completedA += 1) {
  for (let completedB = 0; completedB <= 4; completedB += 1) {
    const id = goldenStateId(completedA, completedB);
    const grid = gridForCounts(completedA, completedB);
    const completedObjectives = completedForCounts(completedA, completedB);
    const activeObjectives = activeForCounts(completedA, completedB);
    const queuedObjectives = allIds.filter((objectiveId) =>
      !completedObjectives.includes(objectiveId) && !activeObjectives.includes(objectiveId));
    const branches = activeObjectives.map((objectiveId) => {
      const objective = objectives.find((candidate) => candidate.id === objectiveId);
      const nextA = completedA + (objective.chain === "A" ? 1 : 0);
      const nextB = completedB + (objective.chain === "B" ? 1 : 0);
      const nextStateId = goldenStateId(nextA, nextB);
      const nextActive = activeForCounts(nextA, nextB);
      const local = chains[objective.chain][objective.chainIndex + 1] ?? null;
      const remote = nextActive
        .map((candidateId) => objectives.find((candidate) => candidate.id === candidateId))
        .find((candidate) => candidate && candidate.chain !== objective.chain) ?? null;
      const nextGrid = cloneGrid(grid);
      apply(nextGrid, objectiveId);
      return {
        id: goldenBranchId(id, objectiveId),
        objectiveId,
        sourceStateId: id,
        nextStateId,
        sourcePath: objective.path,
        transformations: transformations[objectiveId],
        expectedBoardHash: canonicalBoardHash(nextGrid),
        expectedNextActiveObjectives: nextActive,
        localSuccessor: local ? {
          objectiveId: local.id,
          zone: local.primaryZone,
          sharedCells: objective.path.filter(([row, column]) =>
            local.path.some(([otherRow, otherColumn]) => row === otherRow && column === otherColumn)),
          transformedCells: transformations[objectiveId].map(({ cell }) => cell),
          purpose: `The changed letter reveals ${local.word} locally.`,
        } : null,
        remoteSuccessor: remote ? {
          objectiveId: remote.id,
          zone: remote.primaryZone,
          purpose: `${remote.word} remains available in a different board zone.`,
        } : null,
        successorPurpose: local
          ? `Reveal ${local.word} through the solved path while preserving a remote choice.`
          : remote
            ? `Finish the ${objective.chain} continuity chain and hand attention to ${remote.word}.`
            : "Complete the final objective without activating a successor.",
      };
    });
    states.push({
      id,
      completedObjectives,
      activeObjectives,
      queuedObjectives,
      expectedBoardHash: canonicalBoardHash(grid),
      branches,
      expectedCompletion: completedA === 4 && completedB === 4,
    });
  }
}

const level = {
  schemaVersion: 1,
  levelId: "golden-coral-01",
  version: 1,
  displayName: "Find Your First Word",
  themeKey: "OCEAN_ABYSS",
  themeName: "Coral Conquest",
  seed: 11001,
  gridSize: { rows: 8, cols: 8 },
  initialGrid,
  objectiveCount: 8,
  objectives,
  activationRules: {
    kind: "AUTHORED_STATE_GRAPH",
    initialStateId: "a0-b0",
    initialActiveObjectives: ["a0-shore", "b0-wave"],
    queuedObjectives: allIds.filter((id) => !["a0-shore", "b0-wave"].includes(id)),
    maximumActiveObjectives: 2,
  },
  zoneContract: {
    rowBands: [[0, 1, 2], [3, 4], [5, 6, 7]],
    columnBands: [[0, 1, 2], [3, 4], [5, 6, 7]],
    centreTieBreak: "LOWER_NUMBERED_BAND",
  },
  states,
  expectedCompletionStateId: "a4-b4",
  replayMetadata: {
    expectedReachableStates: 25,
    expectedReachableBranches: 40,
    expectedCompleteMoveOrders: 70,
    deterministic: true,
  },
  auditMetadata: {
    authoredBy: "Word Kingdom Golden Core",
    purpose: "Teach straight dragging, local transmutation, revealed objectives, and board-wide attention travel.",
    prototypeLevelsUnaffected: true,
  },
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(level, null, 2)}\n`, "utf8");
process.stdout.write(`${outputPath}\n`);
