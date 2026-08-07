import type { CanonicalCell } from "./canonical-board-state";

export type GoldenZone = {
  id: string;
  rowBand: number;
  columnBand: number;
  centre: CanonicalCell;
};

export type GoldenTutorialCue = {
  cueId: string;
  kind: "DRAG" | "TRANSFORM" | "REVEAL" | "ATTENTION_SHIFT";
  message: string;
  showOnce: boolean;
};

export type GoldenObjective = {
  id: string;
  word: string;
  path: CanonicalCell[];
  direction: "H" | "V" | "D" | "A";
  primaryZone: string;
  chain: "A" | "B";
  chainIndex: number;
  tutorialCues: GoldenTutorialCue[];
};

export type GoldenTransformation = {
  cell: CanonicalCell;
  from: string;
  to: string;
};

export type GoldenSuccessorRelationship = {
  objectiveId: string;
  zone: string;
  sharedCells?: CanonicalCell[];
  transformedCells?: CanonicalCell[];
  purpose: string;
};

export type GoldenAuthoredBranch = {
  id: string;
  objectiveId: string;
  sourceStateId: string;
  nextStateId: string;
  sourcePath: CanonicalCell[];
  transformations: GoldenTransformation[];
  expectedBoardHash: string;
  expectedNextActiveObjectives: string[];
  localSuccessor: GoldenSuccessorRelationship | null;
  remoteSuccessor: GoldenSuccessorRelationship | null;
  successorPurpose: string;
};

export type GoldenReachableState = {
  id: string;
  completedObjectives: string[];
  activeObjectives: string[];
  queuedObjectives: string[];
  expectedBoardHash: string;
  branches: GoldenAuthoredBranch[];
  expectedCompletion: boolean;
};

export type AuthoredGoldenLevel = {
  schemaVersion: 1;
  levelId: string;
  version: number;
  displayName: string;
  themeKey: string;
  themeName: string;
  seed: number;
  gridSize: { rows: 8; cols: 8 };
  initialGrid: string[][];
  objectiveCount: 8;
  objectives: GoldenObjective[];
  activationRules: {
    kind: "AUTHORED_STATE_GRAPH";
    initialStateId: string;
    initialActiveObjectives: string[];
    queuedObjectives: string[];
    maximumActiveObjectives: 2;
  };
  zoneContract: {
    rowBands: number[][];
    columnBands: number[][];
    centreTieBreak: "LOWER_NUMBERED_BAND";
  };
  states: GoldenReachableState[];
  expectedCompletionStateId: string;
  replayMetadata: {
    expectedReachableStates: number;
    expectedReachableBranches: number;
    expectedCompleteMoveOrders: number;
    deterministic: true;
  };
  auditMetadata: {
    authoredBy: string;
    purpose: string;
    prototypeLevelsUnaffected: true;
  };
};
