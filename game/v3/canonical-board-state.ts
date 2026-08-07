import {
  canonicalDirectionForPath,
  isCanonicalForwardPath,
  pathSpellsWord,
  scanCanonicalWord,
} from "./direction-contract.js";
import { canonicalBoardHash } from "./golden-level-contract.js";
import type {
  AuthoredGoldenLevel,
  GoldenAuthoredBranch,
  GoldenReachableState,
} from "./golden-level-types";

export type CanonicalCell = [number, number];
export type CanonicalGameState =
  | "VALIDATING"
  | "ACTIVE"
  | "RESOLVING"
  | "TRANSFORMING"
  | "REPLANNING"
  | "RECOVERY"
  | "COMPLETED";
export type CanonicalValidationCode =
  | "VALIDATING"
  | "ACTIVE"
  | "COMPLETED"
  | "STALE_BRANCH"
  | "DUPLICATE_TARGET"
  | "MISSING_ACTIVE_PATH"
  | "RECOVERY_REQUIRED"
  | "BOARD_UNSETTLED"
  | "AUTHORED_BRANCH_AVAILABLE"
  | "AUTHORED_BRANCH_MISSING"
  | "CANONICAL_GRID_MISMATCH"
  | "TRANSFORMATION_MISMATCH";
export type CanonicalTransitionStatus = "SETTLED" | "FLIP_OUT" | "FLIP_IN";

export type CanonicalReplacement = {
  cell: CanonicalCell;
  letter: string;
};

export type CanonicalObjectiveDefinition = {
  word: string;
  path: CanonicalCell[];
  type: "STATIC" | "REVEAL_TRIGGER" | "SIDE_REVEAL";
  reveals?: string;
  revealsPath?: CanonicalCell[];
  transmuteMap: CanonicalReplacement[];
};

export type CanonicalStage = {
  stageIndex: number;
  activeWords: CanonicalObjectiveDefinition[];
};

export type CanonicalObjective = {
  id: string;
  stageIndex: number;
  definition: CanonicalObjectiveDefinition;
  expectedPath: CanonicalCell[];
  expectedRevealPath?: CanonicalCell[];
  activatedAt: number;
  badgeType?: "attack" | "steal" | "raid" | "shield";
};

export type CanonicalTile = {
  id: string;
  row: number;
  col: number;
  letter: string;
  transition: CanonicalTransitionStatus;
};

export type TargetPathValidation = {
  objectiveId: string;
  word: string;
  appearanceCount: number;
  appearances: Array<{
    path: CanonicalCell[];
    direction: string;
    directionLabel: string;
    matchesRegisteredPath: boolean;
  }>;
  hasValidatedConsequence: boolean;
};

export type PlannedSuccessorBranch = {
  objectiveId: string;
  sourcePath: CanonicalCell[];
  transmutePath: CanonicalCell[];
  replacementLetters: string[];
  successorObjectiveId?: string;
  successorPath?: CanonicalCell[];
};

export type CanonicalMoveRecord = {
  move: number;
  objectiveId: string;
  word: string;
  acceptedPath: CanonicalCell[];
  transmutedTileIds: string[];
  beforeLetters: string;
  afterLetters: string;
  acceptedAt: number;
  settledAt?: number;
};

export type CanonicalValidationResult = {
  code: CanonicalValidationCode;
  message: string;
  validationRevision: number;
};

export type CanonicalBoardSnapshot = {
  levelId: string;
  levelSeed: number;
  currentGameState: CanonicalGameState;
  settled: boolean;
  tiles: CanonicalTile[];
  activeObjectives: string[];
  queuedObjectives: string[];
  completedObjectives: string[];
  remainingObjectives: string[];
  validatedActiveTargetPaths: TargetPathValidation[];
  plannedSuccessorBranches: PlannedSuccessorBranch[];
  moveHistory: CanonicalMoveRecord[];
  lastValidationResult: CanonicalValidationResult;
  branchMismatch?: {
    objectiveId: string;
    word: string;
    expectedPath: CanonicalCell[];
    actualPath: CanonicalCell[];
  };
  replanningReason?: string;
  recoveryReason?: string;
  authored?: {
    levelId: string;
    version: number;
    currentBoardHash: string;
    expectedBoardHash?: string;
    reachableStateId?: string;
    availableBranches: GoldenAuthoredBranch[];
    selectedBranch?: GoldenAuthoredBranch;
    transformationMap: CanonicalReplacement[];
    localSuccessor?: GoldenAuthoredBranch["localSuccessor"];
    remoteSuccessor?: GoldenAuthoredBranch["remoteSuccessor"];
    currentPrimaryZones: string[];
    zoneHistory: string[];
    branchValidationResult: string;
    authoredDataMismatch?: string;
    replayMoveOrders: string[][];
  };
};

type PendingResolution = {
  objectiveId: string;
  acceptedPath: CanonicalCell[];
  acceptedAt: number;
};

type CanonicalBoardOptions = {
  levelId: string;
  seed: number;
  initialGrid: string[][];
  stages?: CanonicalStage[];
  authoredLevel?: AuthoredGoldenLevel;
  activatedAt?: number;
  badgeFor?: (
    stageIndex: number,
    wordIndex: number,
  ) => "attack" | "steal" | "raid" | "shield" | undefined;
};

function cellKey([row, column]: CanonicalCell): string {
  return `${row},${column}`;
}

function clonePath(path: CanonicalCell[]): CanonicalCell[] {
  return path.map(([row, column]) => [row, column]);
}

function samePath(left: CanonicalCell[], right: CanonicalCell[]): boolean {
  return (
    left.length === right.length &&
    left.every(
      ([row, column], index) =>
        row === right[index][0] && column === right[index][1],
    )
  );
}

function cloneObjective(objective: CanonicalObjective): CanonicalObjective {
  return {
    ...objective,
    definition: {
      ...objective.definition,
      path: clonePath(objective.definition.path),
      revealsPath: objective.definition.revealsPath
        ? clonePath(objective.definition.revealsPath)
        : undefined,
      transmuteMap: objective.definition.transmuteMap.map((replacement) => ({
        cell: [...replacement.cell],
        letter: replacement.letter,
      })),
    },
    expectedPath: clonePath(objective.expectedPath),
    expectedRevealPath: objective.expectedRevealPath
      ? clonePath(objective.expectedRevealPath)
      : undefined,
  };
}

export class CanonicalBoardModel {
  readonly levelId: string;
  readonly seed: number;
  readonly totalObjectives: number;

  private readonly objectivesById = new Map<string, CanonicalObjective>();
  private readonly objectivesByStage: CanonicalObjective[][];
  private readonly tiles: CanonicalTile[];
  private currentGameState: CanonicalGameState = "VALIDATING";
  private settled = true;
  private activeObjectiveIds: string[] = [];
  private queuedObjectiveIds: string[] = [];
  private completedObjectiveIds: string[] = [];
  private validations: TargetPathValidation[] = [];
  private successorBranches: PlannedSuccessorBranch[] = [];
  private history: CanonicalMoveRecord[] = [];
  private lastValidation: CanonicalValidationResult = {
    code: "VALIDATING",
    message: "Initial canonical board validation is pending.",
    validationRevision: 0,
  };
  private mismatch?: CanonicalBoardSnapshot["branchMismatch"];
  private replanningReason?: string;
  private recoveryReason?: string;
  private pendingResolution?: PendingResolution;
  private readonly authoredLevel?: AuthoredGoldenLevel;
  private readonly authoredStates = new Map<string, GoldenReachableState>();
  private currentAuthoredStateId?: string;
  private selectedAuthoredBranch?: GoldenAuthoredBranch;
  private authoredDataMismatch?: string;
  private branchValidationResult = "NOT_AUTHORED";
  private zoneHistory: string[] = [];
  private readonly replayMoveOrders: string[][] = [];

  constructor(options: CanonicalBoardOptions) {
    if (
      options.initialGrid.length !== 8 ||
      options.initialGrid.some(
        (row) =>
          row.length !== 8 ||
          row.some((letter) => !/^[A-Z]$/.test(letter)),
      )
    ) {
      throw new Error("The canonical Word Kingdom board must be an 8x8 uppercase grid.");
    }
    this.levelId = options.levelId;
    this.seed = options.seed;
    this.authoredLevel = options.authoredLevel;
    this.tiles = options.initialGrid.flatMap((row, rowIndex) =>
      row.map((letter, columnIndex) => ({
        id: `generated-${options.seed}-tile-${rowIndex}-${columnIndex}`,
        row: rowIndex,
        col: columnIndex,
        letter,
        transition: "SETTLED" as const,
      })),
    );
    const activatedAt = options.activatedAt ?? Date.now();
    if (this.authoredLevel) {
      if (this.authoredLevel.seed !== options.seed) {
        throw new Error("The authored level seed does not match the canonical session seed.");
      }
      for (const state of this.authoredLevel.states) {
        this.authoredStates.set(state.id, state);
      }
      this.objectivesByStage = [this.authoredLevel.objectives.map((authoredObjective) => {
        if (!isCanonicalForwardPath(authoredObjective.path)) {
          throw new Error(`Authored objective ${authoredObjective.id} uses an unsupported direction.`);
        }
        const objective: CanonicalObjective = {
          id: authoredObjective.id,
          stageIndex: authoredObjective.chainIndex,
          definition: {
            word: authoredObjective.word,
            path: clonePath(authoredObjective.path),
            type: "STATIC",
            transmuteMap: [],
          },
          expectedPath: clonePath(authoredObjective.path),
          activatedAt,
        };
        this.objectivesById.set(objective.id, objective);
        return objective;
      })];
      this.totalObjectives = this.authoredLevel.objectives.length;
      this.currentAuthoredStateId = this.authoredLevel.activationRules.initialStateId;
      const initialState = this.requireAuthoredState(this.currentAuthoredStateId);
      this.activeObjectiveIds = [...initialState.activeObjectives];
      this.queuedObjectiveIds = [...initialState.queuedObjectives];
      this.completedObjectiveIds = [...initialState.completedObjectives];
      this.replayMoveOrders = this.enumerateAuthoredMoveOrders();
      this.evaluateSettledBoard();
      return;
    }
    if (!options.stages?.length) {
      throw new Error("A canonical board requires generated stages or an authored golden level.");
    }
    this.objectivesByStage = options.stages.map((stage) =>
      stage.activeWords.map((definition, wordIndex) => {
        if (!isCanonicalForwardPath(definition.path)) {
          throw new Error(
            `Objective ${definition.word} uses an unsupported target direction.`,
          );
        }
        if (
          definition.revealsPath &&
          !isCanonicalForwardPath(definition.revealsPath)
        ) {
          throw new Error(
            `Successor ${definition.reveals} uses an unsupported target direction.`,
          );
        }
        const objective: CanonicalObjective = {
          id: `generated-${options.seed}-s${stage.stageIndex}-w${wordIndex}`,
          stageIndex: stage.stageIndex,
          definition: {
            ...definition,
            path: clonePath(definition.path),
            revealsPath: definition.revealsPath
              ? clonePath(definition.revealsPath)
              : undefined,
            transmuteMap: definition.transmuteMap.map((replacement) => ({
              cell: [...replacement.cell],
              letter: replacement.letter,
            })),
          },
          expectedPath: clonePath(definition.path),
          expectedRevealPath: definition.revealsPath
            ? clonePath(definition.revealsPath)
            : undefined,
          activatedAt,
          badgeType: options.badgeFor?.(stage.stageIndex, wordIndex),
        };
        this.objectivesById.set(objective.id, objective);
        return objective;
      }),
    );
    this.totalObjectives = this.objectivesByStage.flat().length;
    this.activeObjectiveIds = this.objectivesByStage[0]?.map(({ id }) => id) ?? [];
    this.evaluateSettledBoard();
  }

  grid(): string[][] {
    return Array.from({ length: 8 }, (_, row) =>
      Array.from({ length: 8 }, (_, col) => this.tileAt(row, col).letter),
    );
  }

  boardTiles(): CanonicalTile[][] {
    return Array.from({ length: 8 }, (_, row) =>
      Array.from({ length: 8 }, (_, col) => ({ ...this.tileAt(row, col) })),
    );
  }

  activeObjectives(): CanonicalObjective[] {
    return this.activeObjectiveIds.map((id) =>
      cloneObjective(this.requireObjective(id)),
    );
  }

  objective(objectiveId: string): CanonicalObjective | undefined {
    const objective = this.objectivesById.get(objectiveId);
    return objective ? cloneObjective(objective) : undefined;
  }

  canAcceptInput(): boolean {
    return (
      this.currentGameState === "ACTIVE" &&
      this.settled &&
      this.activeObjectiveIds.length > 0 &&
      this.validations.every(
        (validation) =>
          validation.appearanceCount === 1 &&
          validation.hasValidatedConsequence,
      )
    );
  }

  isComplete(): boolean {
    return this.completedObjectiveIds.length === this.totalObjectives;
  }

  progress(): { solved: number; total: number; complete: boolean } {
    return {
      solved: this.completedObjectiveIds.length,
      total: this.totalObjectives,
      complete: this.isComplete(),
    };
  }

  validationFor(objectiveId: string): TargetPathValidation | undefined {
    return this.validations.find(
      (validation) => validation.objectiveId === objectiveId,
    );
  }

  beginResolution(
    objectiveId: string,
    acceptedPath: CanonicalCell[],
    acceptedAt: number,
  ): boolean {
    if (!this.canAcceptInput() || !isCanonicalForwardPath(acceptedPath)) {
      return false;
    }
    const objective = this.objectivesById.get(objectiveId);
    const validation = this.validationFor(objectiveId);
    if (
      !objective ||
      !validation ||
      !validation.appearances.some((appearance) =>
        samePath(appearance.path, acceptedPath),
      )
    ) {
      return false;
    }
    if (this.authoredLevel) {
      const state = this.currentAuthoredStateId
        ? this.authoredStates.get(this.currentAuthoredStateId)
        : undefined;
      const branches = state?.branches.filter(
        (branch) => branch.objectiveId === objectiveId,
      ) ?? [];
      if (branches.length !== 1 || !samePath(branches[0].sourcePath, acceptedPath)) {
        this.authoredDataMismatch = `Authored branch for ${objective.definition.word} is missing or does not match the accepted path.`;
        this.branchValidationResult = "AUTHORED_BRANCH_MISSING";
        this.enterRecovery("AUTHORED_BRANCH_MISSING", this.authoredDataMismatch);
        return false;
      }
      this.selectedAuthoredBranch = branches[0];
    }
    this.pendingResolution = {
      objectiveId,
      acceptedPath: clonePath(acceptedPath),
      acceptedAt,
    };
    this.currentGameState = "RESOLVING";
    this.settled = false;
    for (const cell of acceptedPath) {
      this.tileAt(cell[0], cell[1]).transition = "FLIP_OUT";
    }
    return true;
  }

  commitResolution(): {
    flippedTileIds: string[];
    revealedWord?: string;
  } {
    if (this.authoredLevel) return this.commitAuthoredResolution();
    const pending = this.pendingResolution;
    if (!pending || this.currentGameState !== "RESOLVING") {
      throw new Error("No accepted canonical word is waiting to resolve.");
    }
    const objective = this.requireObjective(pending.objectiveId);
    const branch = this.buildConsequence(objective, pending.acceptedPath);
    if (!branch) {
      this.pendingResolution = undefined;
      this.settled = true;
      this.replanningReason = `Accepted path for ${objective.definition.word} no longer has a safe consequence.`;
      this.evaluateSettledBoard();
      throw new Error(this.recoveryReason ?? this.replanningReason);
    }
    const beforeLetters = this.lettersForPath(branch.transmutePath);
    branch.transmutePath.forEach(([row, col], index) => {
      const tile = this.tileAt(row, col);
      tile.letter = branch.replacementLetters[index];
      tile.transition = "FLIP_IN";
    });
    const afterLetters = this.lettersForPath(branch.transmutePath);
    this.activeObjectiveIds = this.activeObjectiveIds.filter(
      (id) => id !== objective.id,
    );
    this.completedObjectiveIds.push(objective.id);
    let revealedWord: string | undefined;
    if (objective.definition.reveals && branch.successorObjectiveId) {
      const successor = this.requireObjective(branch.successorObjectiveId);
      successor.expectedPath = clonePath(branch.successorPath ?? successor.expectedPath);
      if (successor.definition.revealsPath) {
        successor.expectedRevealPath = this.transformPath(
          successor.definition.path,
          successor.expectedPath,
          successor.definition.revealsPath,
        ) ?? clonePath(successor.definition.revealsPath);
      }
      successor.activatedAt = Date.now();
      if (!this.activeObjectiveIds.includes(successor.id)) {
        this.activeObjectiveIds.push(successor.id);
      }
      revealedWord = objective.definition.reveals;
    }
    const flippedTileIds = branch.transmutePath.map(([row, col]) =>
      this.tileAt(row, col).id,
    );
    this.history.push({
      move: this.history.length + 1,
      objectiveId: objective.id,
      word: objective.definition.word,
      acceptedPath: clonePath(pending.acceptedPath),
      transmutedTileIds: [...flippedTileIds],
      beforeLetters,
      afterLetters,
      acceptedAt: pending.acceptedAt,
    });
    this.pendingResolution = undefined;
    this.currentGameState = "TRANSFORMING";
    return { flippedTileIds, revealedWord };
  }

  settleTransitions(settledAt = Date.now()): CanonicalGameState {
    for (const tile of this.tiles) tile.transition = "SETTLED";
    const latest = this.history.at(-1);
    if (latest && latest.settledAt === undefined) latest.settledAt = settledAt;
    this.settled = true;
    this.evaluateSettledBoard();
    return this.currentGameState;
  }

  evaluateSettledBoard(): CanonicalGameState {
    if (this.authoredLevel) return this.evaluateAuthoredSettledBoard();
    if (this.completedObjectiveIds.length === this.totalObjectives) {
      this.currentGameState = "COMPLETED";
      this.activeObjectiveIds = [];
      this.queuedObjectiveIds = [];
      this.pendingResolution = undefined;
      this.successorBranches = [];
      this.recoveryReason = undefined;
      this.lastValidation = {
        code: "COMPLETED",
        message: "All canonical objectives are complete.",
        validationRevision: this.lastValidation.validationRevision + 1,
      };
      return this.currentGameState;
    }
    if (!this.settled) {
      this.currentGameState = "VALIDATING";
      this.lastValidation = {
        code: "BOARD_UNSETTLED",
        message: "Validation is deferred until every tile transition settles.",
        validationRevision: this.lastValidation.validationRevision,
      };
      return this.currentGameState;
    }

    this.currentGameState = "VALIDATING";
    const grid = this.grid();
    const validations = this.activeObjectiveIds.map((objectiveId) => {
      const objective = this.requireObjective(objectiveId);
      const matches = scanCanonicalWord(grid, objective.definition.word);
      const appearances = matches.map((match) => ({
        path: clonePath(match.path as CanonicalCell[]),
        direction: match.direction,
        directionLabel: match.directionLabel,
        matchesRegisteredPath: samePath(
          match.path as CanonicalCell[],
          objective.expectedPath,
        ),
      }));
      return {
        objectiveId,
        word: objective.definition.word,
        appearanceCount: appearances.length,
        appearances,
        hasValidatedConsequence:
          appearances.length === 1 &&
          Boolean(this.buildConsequence(objective, appearances[0].path)),
      } satisfies TargetPathValidation;
    });
    this.validations = validations;
    this.successorBranches = [];

    const duplicate = validations.find(
      (validation) => validation.appearanceCount > 1,
    );
    if (duplicate) {
      return this.enterRecovery(
        "DUPLICATE_TARGET",
        `${duplicate.word} has ${duplicate.appearanceCount} legal forward appearances.`,
      );
    }
    const missing = validations.find(
      (validation) => validation.appearanceCount === 0,
    );
    if (missing) {
      this.currentGameState = "REPLANNING";
      this.replanningReason = `${missing.word} has no legal appearance on the settled board.`;
      return this.enterRecovery(
        "MISSING_ACTIVE_PATH",
        `Controlled replanning cannot continue because ${missing.word} is absent.`,
      );
    }

    const stale = validations.find(
      (validation) => !validation.appearances[0].matchesRegisteredPath,
    );
    if (stale) {
      this.currentGameState = "REPLANNING";
      const objective = this.requireObjective(stale.objectiveId);
      const actualPath = stale.appearances[0].path;
      this.mismatch = {
        objectiveId: stale.objectiveId,
        word: stale.word,
        expectedPath: clonePath(objective.expectedPath),
        actualPath: clonePath(actualPath),
      };
      this.replanningReason = `Discarded stale path for ${stale.word} and replanned from canonical letters.`;
      const consequence = this.buildConsequence(objective, actualPath);
      if (!consequence) {
        return this.enterRecovery(
          "RECOVERY_REQUIRED",
          `The stale ${stale.word} branch could not be safely replanned.`,
        );
      }
      objective.expectedPath = clonePath(actualPath);
      if (consequence.successorPath) {
        objective.expectedRevealPath = clonePath(consequence.successorPath);
      }
      return this.evaluateAfterReplan("STALE_BRANCH");
    }

    if (
      validations.length > 0 &&
      validations.every(
        (validation) =>
          validation.appearanceCount === 1 &&
          validation.hasValidatedConsequence,
      )
    ) {
      this.successorBranches = validations.map((validation) =>
        this.buildConsequence(
          this.requireObjective(validation.objectiveId),
          validation.appearances[0].path,
        ),
      ).filter((branch): branch is PlannedSuccessorBranch => Boolean(branch));
      this.currentGameState = "ACTIVE";
      this.recoveryReason = undefined;
      this.lastValidation = {
        code: "ACTIVE",
        message: "Every selectable target has one path and a validated consequence.",
        validationRevision: this.lastValidation.validationRevision + 1,
      };
      return this.currentGameState;
    }

    this.currentGameState = "REPLANNING";
    this.replanningReason = "One or more active targets lack a validated consequence.";
    return this.enterRecovery(
      "RECOVERY_REQUIRED",
      "Controlled replanning failed on the settled canonical board.",
    );
  }

  snapshot(): CanonicalBoardSnapshot {
    const remaining = [...this.objectivesById.keys()].filter(
      (id) => !this.completedObjectiveIds.includes(id),
    );
    return {
      levelId: this.levelId,
      levelSeed: this.seed,
      currentGameState: this.currentGameState,
      settled: this.settled,
      tiles: this.tiles.map((tile) => ({ ...tile })),
      activeObjectives: [...this.activeObjectiveIds],
      queuedObjectives: [...this.queuedObjectiveIds],
      completedObjectives: [...this.completedObjectiveIds],
      remainingObjectives: remaining,
      validatedActiveTargetPaths: this.validations.map((validation) => ({
        ...validation,
        appearances: validation.appearances.map((appearance) => ({
          ...appearance,
          path: clonePath(appearance.path),
        })),
      })),
      plannedSuccessorBranches: this.successorBranches.map((branch) => ({
        ...branch,
        sourcePath: clonePath(branch.sourcePath),
        transmutePath: clonePath(branch.transmutePath),
        replacementLetters: [...branch.replacementLetters],
        successorPath: branch.successorPath
          ? clonePath(branch.successorPath)
          : undefined,
      })),
      moveHistory: this.history.map((move) => ({
        ...move,
        acceptedPath: clonePath(move.acceptedPath),
        transmutedTileIds: [...move.transmutedTileIds],
      })),
      lastValidationResult: { ...this.lastValidation },
      branchMismatch: this.mismatch
        ? {
            ...this.mismatch,
            expectedPath: clonePath(this.mismatch.expectedPath),
            actualPath: clonePath(this.mismatch.actualPath),
          }
        : undefined,
      replanningReason: this.replanningReason,
      recoveryReason: this.recoveryReason,
      authored: this.authoredLevel ? this.authoredSnapshot() : undefined,
    };
  }

  debugSetExpectedPath(objectiveId: string, path: CanonicalCell[]): void {
    this.requireObjective(objectiveId).expectedPath = clonePath(path);
  }

  debugSetTileLetter(row: number, col: number, letter: string): void {
    if (!/^[A-Z]$/.test(letter)) throw new Error("Debug letter must be A-Z.");
    this.tileAt(row, col).letter = letter;
  }

  transformationTileIdsForObjective(objectiveId: string): string[] {
    if (!this.authoredLevel || !this.currentAuthoredStateId) return [];
    const branch = this.authoredStates
      .get(this.currentAuthoredStateId)
      ?.branches.find((candidate) => candidate.objectiveId === objectiveId);
    return branch?.transformations.map(({ cell }) =>
      this.tileAt(cell[0], cell[1]).id,
    ) ?? [];
  }

  private evaluateAuthoredSettledBoard(): CanonicalGameState {
    if (!this.settled) {
      this.currentGameState = "VALIDATING";
      this.lastValidation = {
        code: "BOARD_UNSETTLED",
        message: "Authored-branch validation waits for every letter flip to settle.",
        validationRevision: this.lastValidation.validationRevision,
      };
      return this.currentGameState;
    }
    const state = this.currentAuthoredStateId
      ? this.authoredStates.get(this.currentAuthoredStateId)
      : undefined;
    if (!state) {
      this.authoredDataMismatch = `Authored reachable state ${this.currentAuthoredStateId ?? "(missing)"} is unavailable.`;
      this.branchValidationResult = "AUTHORED_BRANCH_MISSING";
      return this.enterRecovery("AUTHORED_BRANCH_MISSING", this.authoredDataMismatch);
    }
    const currentHash = canonicalBoardHash(this.grid());
    if (currentHash !== state.expectedBoardHash) {
      this.authoredDataMismatch = `Canonical grid hash ${currentHash} does not match ${state.expectedBoardHash} for ${state.id}.`;
      this.branchValidationResult = "CANONICAL_GRID_MISMATCH";
      return this.enterRecovery("CANONICAL_GRID_MISMATCH", this.authoredDataMismatch);
    }
    this.activeObjectiveIds = [...state.activeObjectives];
    this.queuedObjectiveIds = [...state.queuedObjectives];
    this.completedObjectiveIds = [...state.completedObjectives];
    if (state.expectedCompletion) {
      if (
        state.id !== this.authoredLevel?.expectedCompletionStateId ||
        state.completedObjectives.length !== this.totalObjectives ||
        state.activeObjectives.length !== 0 ||
        state.branches.length !== 0
      ) {
        this.authoredDataMismatch = `${state.id} is marked complete but its authored completion contract is invalid.`;
        return this.enterRecovery("RECOVERY_REQUIRED", this.authoredDataMismatch);
      }
      this.currentGameState = "COMPLETED";
      this.successorBranches = [];
      this.recoveryReason = undefined;
      this.authoredDataMismatch = undefined;
      this.branchValidationResult = "COMPLETED";
      this.lastValidation = {
        code: "COMPLETED",
        message: "The authored completion state and canonical board hash match.",
        validationRevision: this.lastValidation.validationRevision + 1,
      };
      return this.currentGameState;
    }
    if (
      state.activeObjectives.length === 0 ||
      state.activeObjectives.length > (this.authoredLevel?.activationRules.maximumActiveObjectives ?? 2)
    ) {
      this.authoredDataMismatch = `${state.id} has an invalid active-objective count.`;
      return this.enterRecovery("AUTHORED_BRANCH_MISSING", this.authoredDataMismatch);
    }

    const grid = this.grid();
    const validations: TargetPathValidation[] = [];
    for (const objectiveId of state.activeObjectives) {
      const objective = this.requireObjective(objectiveId);
      const matches = scanCanonicalWord(grid, objective.definition.word);
      const branches = state.branches.filter(
        (branch) => branch.objectiveId === objectiveId,
      );
      const branchError = branches.length === 1
        ? this.validateAuthoredBranch(state, branches[0], grid)
        : `Expected one authored branch for ${objective.definition.word}, found ${branches.length}.`;
      const appearances = matches.map((match) => ({
        path: clonePath(match.path as CanonicalCell[]),
        direction: match.direction,
        directionLabel: match.directionLabel,
        matchesRegisteredPath: samePath(
          match.path as CanonicalCell[],
          objective.expectedPath,
        ),
      }));
      validations.push({
        objectiveId,
        word: objective.definition.word,
        appearanceCount: appearances.length,
        appearances,
        hasValidatedConsequence:
          appearances.length === 1 &&
          appearances[0].matchesRegisteredPath &&
          !branchError,
      });
      if (appearances.length !== 1 || !appearances[0]?.matchesRegisteredPath) {
        this.authoredDataMismatch = appearances.length === 0
          ? `${objective.definition.word} is missing from its exact authored path in ${state.id}.`
          : `${objective.definition.word} has ${appearances.length} appearances or a canonical-grid path mismatch in ${state.id}.`;
        this.validations = validations;
        this.branchValidationResult = "CANONICAL_GRID_MISMATCH";
        return this.enterRecovery(
          appearances.length > 1 ? "DUPLICATE_TARGET" : "CANONICAL_GRID_MISMATCH",
          this.authoredDataMismatch,
        );
      }
      if (branchError) {
        this.authoredDataMismatch = branchError;
        this.validations = validations;
        this.branchValidationResult = /transform/i.test(branchError)
          ? "TRANSFORMATION_MISMATCH"
          : "AUTHORED_BRANCH_MISSING";
        return this.enterRecovery(
          /transform/i.test(branchError) ? "TRANSFORMATION_MISMATCH" : "AUTHORED_BRANCH_MISSING",
          branchError,
        );
      }
    }

    for (const objective of this.objectivesById.values()) {
      if (state.activeObjectives.includes(objective.id)) continue;
      const appearances = scanCanonicalWord(grid, objective.definition.word);
      if (appearances.length > 0) {
        const completed = state.completedObjectives.includes(objective.id);
        this.authoredDataMismatch = completed
          ? `Completed objective ${objective.definition.word} remains collectible in ${state.id}.`
          : `Inactive objective ${objective.definition.word} appears prematurely in ${state.id}.`;
        this.validations = validations;
        this.branchValidationResult = "CANONICAL_GRID_MISMATCH";
        return this.enterRecovery("CANONICAL_GRID_MISMATCH", this.authoredDataMismatch);
      }
    }

    this.validations = validations;
    this.successorBranches = state.branches.map((branch) => ({
      objectiveId: branch.objectiveId,
      sourcePath: clonePath(branch.sourcePath),
      transmutePath: branch.transformations.map(({ cell }) => [...cell]),
      replacementLetters: branch.transformations.map(({ to }) => to),
      successorObjectiveId: branch.localSuccessor?.objectiveId,
      successorPath: branch.localSuccessor
        ? clonePath(this.requireObjective(branch.localSuccessor.objectiveId).expectedPath)
        : undefined,
    }));
    this.currentGameState = "ACTIVE";
    this.recoveryReason = undefined;
    this.authoredDataMismatch = undefined;
    this.branchValidationResult = "AUTHORED_BRANCH_AVAILABLE";
    this.lastValidation = {
      code: "AUTHORED_BRANCH_AVAILABLE",
      message: `All ${state.branches.length} selectable authored branches match the canonical grid.`,
      validationRevision: this.lastValidation.validationRevision + 1,
    };
    return this.currentGameState;
  }

  private validateAuthoredBranch(
    state: GoldenReachableState,
    branch: GoldenAuthoredBranch,
    grid: string[][],
  ): string | undefined {
    const objective = this.objectivesById.get(branch.objectiveId);
    if (!objective || branch.sourceStateId !== state.id) {
      return `${branch.id} references the wrong authored source state or objective.`;
    }
    if (!samePath(branch.sourcePath, objective.expectedPath)) {
      return `${branch.id} does not match the exact canonical target path.`;
    }
    const nextState = this.authoredStates.get(branch.nextStateId);
    if (!nextState) return `${branch.id} references missing state ${branch.nextStateId}.`;
    const nextGrid = grid.map((row) => [...row]);
    const changed = new Set<string>();
    for (const transformation of branch.transformations) {
      const key = cellKey(transformation.cell);
      if (changed.has(key)) return `${branch.id} transforms ${key} more than once.`;
      changed.add(key);
      const [row, col] = transformation.cell;
      if (nextGrid[row]?.[col] !== transformation.from) {
        return `${branch.id} transformation mismatch at ${key}: expected ${transformation.from}.`;
      }
      if (!/^[A-Z]$/.test(transformation.to)) {
        return `${branch.id} has an invalid transformed letter at ${key}.`;
      }
      nextGrid[row][col] = transformation.to;
    }
    const nextHash = canonicalBoardHash(nextGrid);
    if (nextHash !== branch.expectedBoardHash || nextHash !== nextState.expectedBoardHash) {
      return `${branch.id} transformation produces ${nextHash}, not its authored successor hash.`;
    }
    if (
      JSON.stringify(branch.expectedNextActiveObjectives) !==
      JSON.stringify(nextState.activeObjectives)
    ) {
      return `${branch.id} has stale next-active objective data.`;
    }
    return undefined;
  }

  private commitAuthoredResolution(): {
    flippedTileIds: string[];
    revealedWord?: string;
  } {
    const pending = this.pendingResolution;
    const branch = this.selectedAuthoredBranch;
    const sourceState = this.currentAuthoredStateId
      ? this.authoredStates.get(this.currentAuthoredStateId)
      : undefined;
    if (!pending || !branch || !sourceState || this.currentGameState !== "RESOLVING") {
      throw new Error("No validated authored branch is waiting to resolve.");
    }
    const branchError = this.validateAuthoredBranch(sourceState, branch, this.grid());
    if (branchError) {
      this.pendingResolution = undefined;
      this.settled = true;
      this.authoredDataMismatch = branchError;
      this.branchValidationResult = "TRANSFORMATION_MISMATCH";
      this.enterRecovery("TRANSFORMATION_MISMATCH", branchError);
      throw new Error(branchError);
    }
    const objective = this.requireObjective(pending.objectiveId);
    const beforeLetters = branch.transformations
      .map(({ cell }) => this.tileAt(cell[0], cell[1]).letter)
      .join("");
    for (const transformation of branch.transformations) {
      const tile = this.tileAt(transformation.cell[0], transformation.cell[1]);
      tile.letter = transformation.to;
      tile.transition = "FLIP_IN";
    }
    const afterLetters = branch.transformations
      .map(({ cell }) => this.tileAt(cell[0], cell[1]).letter)
      .join("");
    const nextState = this.requireAuthoredState(branch.nextStateId);
    const priorActive = [...sourceState.activeObjectives];
    this.currentAuthoredStateId = nextState.id;
    this.activeObjectiveIds = [...nextState.activeObjectives];
    this.queuedObjectiveIds = [...nextState.queuedObjectives];
    this.completedObjectiveIds = [...nextState.completedObjectives];
    this.zoneHistory.push(
      this.authoredLevel?.objectives.find(({ id }) => id === objective.id)?.primaryZone ?? "UNKNOWN",
    );
    const flippedTileIds = branch.transformations.map(({ cell }) =>
      this.tileAt(cell[0], cell[1]).id,
    );
    this.history.push({
      move: this.history.length + 1,
      objectiveId: objective.id,
      word: objective.definition.word,
      acceptedPath: clonePath(pending.acceptedPath),
      transmutedTileIds: [...flippedTileIds],
      beforeLetters,
      afterLetters,
      acceptedAt: pending.acceptedAt,
    });
    const revealedObjectiveId = nextState.activeObjectives.find(
      (id) => !priorActive.includes(id),
    );
    const revealedWord = revealedObjectiveId
      ? this.requireObjective(revealedObjectiveId).definition.word
      : undefined;
    this.pendingResolution = undefined;
    this.currentGameState = "TRANSFORMING";
    this.branchValidationResult = "SELECTED_BRANCH_TRANSFORMING";
    return { flippedTileIds, revealedWord };
  }

  private authoredSnapshot(): NonNullable<CanonicalBoardSnapshot["authored"]> {
    const state = this.currentAuthoredStateId
      ? this.authoredStates.get(this.currentAuthoredStateId)
      : undefined;
    const availableBranches = state?.branches ?? [];
    const selected = this.selectedAuthoredBranch;
    const objectiveMap = new Map(
      this.authoredLevel?.objectives.map((objective) => [objective.id, objective]) ?? [],
    );
    return {
      levelId: this.authoredLevel?.levelId ?? this.levelId,
      version: this.authoredLevel?.version ?? 0,
      currentBoardHash: canonicalBoardHash(this.grid()),
      expectedBoardHash: state?.expectedBoardHash,
      reachableStateId: state?.id,
      availableBranches: availableBranches.map((branch) => structuredClone(branch)),
      selectedBranch: selected ? structuredClone(selected) : undefined,
      transformationMap: (selected?.transformations ?? []).map(({ cell, to }) => ({
        cell: [...cell],
        letter: to,
      })),
      localSuccessor: selected?.localSuccessor
        ? structuredClone(selected.localSuccessor)
        : undefined,
      remoteSuccessor: selected?.remoteSuccessor
        ? structuredClone(selected.remoteSuccessor)
        : undefined,
      currentPrimaryZones: state?.activeObjectives
        .map((id) => objectiveMap.get(id)?.primaryZone)
        .filter((zone): zone is string => Boolean(zone)) ?? [],
      zoneHistory: [...this.zoneHistory],
      branchValidationResult: this.branchValidationResult,
      authoredDataMismatch: this.authoredDataMismatch,
      replayMoveOrders: this.replayMoveOrders.map((sequence) => [...sequence]),
    };
  }

  private requireAuthoredState(stateId: string): GoldenReachableState {
    const state = this.authoredStates.get(stateId);
    if (!state) throw new Error(`Unknown authored reachable state ${stateId}.`);
    return state;
  }

  private enumerateAuthoredMoveOrders(): string[][] {
    if (!this.authoredLevel) return [];
    const sequences: string[][] = [];
    const visit = (stateId: string, moves: string[]) => {
      const state = this.authoredStates.get(stateId);
      if (!state) return;
      if (state.expectedCompletion) {
        sequences.push(moves);
        return;
      }
      for (const branch of state.branches) {
        visit(branch.nextStateId, [...moves, branch.objectiveId]);
      }
    };
    visit(this.authoredLevel.activationRules.initialStateId, []);
    return sequences;
  }

  private evaluateAfterReplan(code: CanonicalValidationCode): CanonicalGameState {
    const validations = this.activeObjectiveIds.map((objectiveId) => {
      const objective = this.requireObjective(objectiveId);
      const matches = scanCanonicalWord(this.grid(), objective.definition.word);
      const appearances = matches.map((match) => ({
        path: clonePath(match.path as CanonicalCell[]),
        direction: match.direction,
        directionLabel: match.directionLabel,
        matchesRegisteredPath: samePath(
          match.path as CanonicalCell[],
          objective.expectedPath,
        ),
      }));
      return {
        objectiveId,
        word: objective.definition.word,
        appearanceCount: appearances.length,
        appearances,
        hasValidatedConsequence:
          appearances.length === 1 &&
          Boolean(this.buildConsequence(objective, appearances[0].path)),
      } satisfies TargetPathValidation;
    });
    this.validations = validations;
    if (
      validations.length > 0 &&
      validations.every(
        (validation) =>
          validation.appearanceCount === 1 &&
          validation.appearances[0].matchesRegisteredPath &&
          validation.hasValidatedConsequence,
      )
    ) {
      this.successorBranches = validations.map((validation) =>
        this.buildConsequence(
          this.requireObjective(validation.objectiveId),
          validation.appearances[0].path,
        ),
      ).filter((branch): branch is PlannedSuccessorBranch => Boolean(branch));
      this.currentGameState = "ACTIVE";
      this.recoveryReason = undefined;
      this.lastValidation = {
        code,
        message: this.replanningReason ?? "Controlled replanning succeeded.",
        validationRevision: this.lastValidation.validationRevision + 1,
      };
      return this.currentGameState;
    }
    return this.enterRecovery(
      "RECOVERY_REQUIRED",
      "Controlled replanning did not produce a safe active state.",
    );
  }

  private enterRecovery(
    code: CanonicalValidationCode,
    reason: string,
  ): CanonicalGameState {
    this.currentGameState = "RECOVERY";
    this.recoveryReason = reason;
    this.lastValidation = {
      code,
      message: reason,
      validationRevision: this.lastValidation.validationRevision + 1,
    };
    return this.currentGameState;
  }

  private buildConsequence(
    objective: CanonicalObjective,
    sourcePath: CanonicalCell[],
  ): PlannedSuccessorBranch | null {
    if (
      !isCanonicalForwardPath(sourcePath) ||
      !pathSpellsWord(this.grid(), objective.definition.word, sourcePath)
    ) {
      return null;
    }
    const replacementByCell = new Map(
      objective.definition.transmuteMap.map((replacement) => [
        cellKey(replacement.cell),
        replacement.letter,
      ]),
    );
    const replacementLetters = objective.definition.path.map((cell) =>
      replacementByCell.get(cellKey(cell)),
    );
    if (
      replacementLetters.some(
        (letter): letter is undefined => letter === undefined,
      )
    ) {
      return null;
    }
    const safeReplacementLetters = replacementLetters as string[];
    let successorPath = objective.expectedRevealPath
      ? clonePath(objective.expectedRevealPath)
      : undefined;
    if (!samePath(sourcePath, objective.expectedPath) && successorPath) {
      successorPath = this.transformPath(
        objective.expectedPath,
        sourcePath,
        successorPath,
      ) ?? undefined;
    }
    let successorObjectiveId: string | undefined;
    if (objective.definition.reveals) {
      if (!successorPath || !isCanonicalForwardPath(successorPath)) return null;
      const nextGrid = this.grid();
      sourcePath.forEach(([row, col], index) => {
        nextGrid[row][col] = safeReplacementLetters[index];
      });
      if (
        !pathSpellsWord(
          nextGrid,
          objective.definition.reveals,
          successorPath,
        )
      ) {
        return null;
      }
      successorObjectiveId = this.objectivesByStage[objective.stageIndex + 1]?.find(
        (candidate) =>
          candidate.definition.word === objective.definition.reveals,
      )?.id;
      if (!successorObjectiveId && objective.stageIndex + 1 < this.objectivesByStage.length) {
        return null;
      }
    }
    return {
      objectiveId: objective.id,
      sourcePath: clonePath(sourcePath),
      transmutePath: clonePath(sourcePath),
      replacementLetters: safeReplacementLetters,
      successorObjectiveId,
      successorPath,
    };
  }

  private transformPath(
    sourcePath: CanonicalCell[],
    destinationPath: CanonicalCell[],
    targetPath: CanonicalCell[],
  ): CanonicalCell[] | null {
    const sourceDirection = canonicalDirectionForPath(sourcePath);
    const destinationDirection = canonicalDirectionForPath(destinationPath);
    if (
      !sourceDirection ||
      !destinationDirection ||
      sourcePath.length !== destinationPath.length
    ) {
      return null;
    }
    const sourceStep: CanonicalCell = [
      sourceDirection.rowStep,
      sourceDirection.columnStep,
    ];
    const destinationStep: CanonicalCell = [
      destinationDirection.rowStep,
      destinationDirection.columnStep,
    ];
    const sourceLengthSquared = sourceStep[0] ** 2 + sourceStep[1] ** 2;
    const destinationLengthSquared =
      destinationStep[0] ** 2 + destinationStep[1] ** 2;
    if (sourceLengthSquared !== destinationLengthSquared) return null;
    const sourcePerpendicular: CanonicalCell = [-sourceStep[1], sourceStep[0]];
    const destinationPerpendicular: CanonicalCell = [
      -destinationStep[1],
      destinationStep[0],
    ];
    const transformed = targetPath.map(([row, column]) => {
      const deltaRow = row - sourcePath[0][0];
      const deltaColumn = column - sourcePath[0][1];
      const along =
        (deltaRow * sourceStep[0] + deltaColumn * sourceStep[1]) /
        sourceLengthSquared;
      const across =
        (deltaRow * sourcePerpendicular[0] +
          deltaColumn * sourcePerpendicular[1]) /
        sourceLengthSquared;
      return [
        destinationPath[0][0] +
          along * destinationStep[0] +
          across * destinationPerpendicular[0],
        destinationPath[0][1] +
          along * destinationStep[1] +
          across * destinationPerpendicular[1],
      ] as CanonicalCell;
    });
    return transformed.every(
      ([row, column]) =>
        Number.isInteger(row) &&
        Number.isInteger(column) &&
        row >= 0 &&
        row < 8 &&
        column >= 0 &&
        column < 8,
    ) && isCanonicalForwardPath(transformed)
      ? transformed
      : null;
  }

  private lettersForPath(path: CanonicalCell[]): string {
    return path.map(([row, col]) => this.tileAt(row, col).letter).join("");
  }

  private tileAt(row: number, col: number): CanonicalTile {
    const tile = this.tiles[row * 8 + col];
    if (!tile) throw new Error(`Canonical tile ${row},${col} is out of bounds.`);
    return tile;
  }

  private requireObjective(objectiveId: string): CanonicalObjective {
    const objective = this.objectivesById.get(objectiveId);
    if (!objective) throw new Error(`Unknown canonical objective ${objectiveId}.`);
    return objective;
  }
}
