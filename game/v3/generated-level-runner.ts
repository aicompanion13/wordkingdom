import generatedCatalogJson from "./data/generated-levels/catalog.json" with { type: "json" };
import type { BadgeAssignment, BadgeType, BoardSnapshot, Position } from "@/game/v2/types";
import {
  CanonicalBoardModel,
  type CanonicalBoardSnapshot,
  type CanonicalCell,
  type CanonicalObjective,
  type CanonicalObjectiveDefinition,
} from "./canonical-board-state";
import { acceptCanonicalSelection } from "./canonical-selection";
import { normalizeCanonicalGesturePath } from "./direction-contract.js";
import type {
  BoardSelectionResult,
  BoardSession,
  BoardSessionProgress,
  BoardSolveResult,
  SessionActiveWord,
  WordScoringHook,
} from "./board-session";

type Cell = CanonicalCell;

type GeneratedStage = {
  stageIndex: number;
  activeWords: CanonicalObjectiveDefinition[];
};

export type GeneratedLevelData = {
  generatorVersion: 2;
  seed: number;
  generationSubSeed?: number;
  generationAttempt?: number;
  levelNumber: number;
  localLevel: number;
  areaId: number;
  themeKey: string;
  themeName: string;
  gridSize: { rows: number; cols: number };
  initialGrid: string[][];
  obstacles: Array<{ cell: Cell; type: string }>;
  stages: GeneratedStage[];
  completionWords: Array<{ word: string; path: Cell[] }>;
  accidentalWords: Array<{ word: string; path: Cell[] }>;
  validation?: {
    allStagesVerified: boolean;
    solveOrderIndependent: boolean;
    stagesVerified: number;
    postTransmuteStatesVerified: number;
    reachableSettledStates?: number;
    reachableBranches?: number;
    completeMoveOrders?: number;
    deterministic?: boolean;
    forwardOnly?: boolean;
  };
  design?: {
    title: string;
    purpose: string;
    difficulty: "EASY" | "EASY_MEDIUM" | "MEDIUM" | "MEDIUM_HARD" | "HARD" | "BOSS";
    nodeKind: "STANDARD" | "HARD" | "BOSS";
    authoringVersion: number;
    objectiveCount: number;
    intentionalBonusWords: Array<{ word: string; path: Cell[] }>;
    completionPresentation: "STANDARD_VICTORY" | "HARD_VICTORY" | "GATEWAY_CELEBRATION";
  };
};

export type GeneratedRuntimeWord = SessionActiveWord;

export const GENERATED_LEVELS = [
  ...generatedCatalogJson,
] as unknown as readonly GeneratedLevelData[];

export class GeneratedLevelSession implements BoardSession {
  readonly level: GeneratedLevelData;
  readonly totalWords: number;

  private readonly canonical: CanonicalBoardModel;
  private readonly objectiveWords: Set<string>;
  private readonly rewardedBonusWords = new Set<string>();
  private readonly collectedRewardTileIds = new Set<string>();
  private activeShields = 0;
  private badgeCooldownMoves = 0;

  constructor(level: GeneratedLevelData, activatedAt = Date.now()) {
    if (
      level.generatorVersion !== 2 ||
      level.gridSize.rows !== 8 ||
      level.gridSize.cols !== 8
    ) {
      throw new Error(`Generated level ${level.seed} is not a canonical 8x8 v2 board.`);
    }
    this.level = level;
    this.canonical = new CanonicalBoardModel({
      levelId: `generated-${level.levelNumber ?? level.seed}`,
      seed: level.seed,
      initialGrid: level.initialGrid,
      stages: level.stages,
      activatedAt,
      badgeFor: (stageIndex, wordIndex) =>
        this.plannedBadgeType(stageIndex, wordIndex),
    });
    this.totalWords = this.canonical.totalObjectives;
    this.objectiveWords = new Set([
      ...level.stages.flatMap((stage) =>
        stage.activeWords.flatMap((entry) => [
          entry.word,
          ...(entry.reveals ? [entry.reveals] : []),
        ]),
      ),
      ...level.completionWords.map((entry) => entry.word),
    ]);
  }

  snapshot(): BoardSnapshot {
    return {
      size: 8,
      tiles: this.canonical.boardTiles().map((row) =>
        row.map((tile) => ({
          id: tile.id,
          letter: tile.letter,
          row: tile.row,
          col: tile.col,
        })),
      ),
    };
  }

  activeWords(): GeneratedRuntimeWord[] {
    return this.canonical.activeObjectives().map((objective) =>
      this.runtimeWord(objective),
    );
  }

  obstacleMarkers(): Array<{ tileId: string; type: string }> {
    return this.level.obstacles.map((obstacle) => ({
      tileId: this.tileId(obstacle.cell[0], obstacle.cell[1]),
      type: obstacle.type,
    }));
  }

  pathBetween(start: Position, end: Position): Position[] {
    const rowDelta = end.row - start.row;
    const colDelta = end.col - start.col;
    if (
      rowDelta !== 0 &&
      colDelta !== 0 &&
      Math.abs(rowDelta) !== Math.abs(colDelta)
    ) {
      return [];
    }
    const rowStep = Math.sign(rowDelta);
    const colStep = Math.sign(colDelta);
    const length = Math.max(Math.abs(rowDelta), Math.abs(colDelta));
    return Array.from({ length: length + 1 }, (_, index) => ({
      row: start.row + rowStep * index,
      col: start.col + colStep * index,
    }));
  }

  tileIdsForPath(path: Position[]): string[] {
    return path.map(({ row, col }) => this.tileId(row, col));
  }

  acceptSelection(
    tileIds: string[],
    matchTimestamp: number,
    onWordSolved: WordScoringHook,
  ): BoardSelectionResult {
    return acceptCanonicalSelection({
      canonical: this.canonical,
      tileIds,
      matchTimestamp,
      onWordSolved,
      objectiveWords: this.objectiveWords,
      rewardedBonusWords: this.rewardedBonusWords,
      bonusWordId: (bonusWord) => `bonus:${this.level.levelNumber}:${bonusWord}`,
      cellForTileId: (tileId) => this.cellForTileId(tileId),
      normalizeGesturePath: (path) =>
        normalizeCanonicalGesturePath(path) as Cell[] | null,
      runtimeWord: (objective, acceptedPath) =>
        this.runtimeWord(objective, acceptedPath),
      collectRewards: (selectedTileIds) =>
        this.collectPathRewards(selectedTileIds),
    });
  }

  solve(word: SessionActiveWord, _solvedAt = Date.now()): BoardSolveResult {
    const objective = this.canonical.objective(word.id);
    if (!objective) {
      throw new Error(`Generated word ${word.id} is not a canonical objective.`);
    }
    const collectedBadge = word.badges.length > 0;
    const resolution = this.canonical.commitResolution();
    if (collectedBadge) this.badgeCooldownMoves = 1;
    else if (this.badgeCooldownMoves > 0) this.badgeCooldownMoves -= 1;
    const progress = this.progress();
    return {
      ...progress,
      board: this.snapshot(),
      activeWords: this.activeWords(),
      flippedTileIds: resolution.flippedTileIds,
      revealedWord: resolution.revealedWord,
    };
  }

  settleTransitions(settledAt = Date.now()): void {
    this.canonical.settleTransitions(settledAt);
  }

  transitionTileIdsForObjective(objectiveId: string): string[] {
    return this.canonical.transformationTileIdsForObjective(objectiveId);
  }

  canAcceptInput(): boolean {
    return this.canonical.canAcceptInput();
  }

  debugSnapshot(): CanonicalBoardSnapshot {
    return this.canonical.snapshot();
  }

  progress(): BoardSessionProgress {
    return this.canonical.progress();
  }

  isComplete(): boolean {
    return this.canonical.isComplete();
  }

  shownWords(): string[] {
    const snapshot = this.canonical.snapshot();
    return snapshot.completedObjectives
      .map((id) => this.canonical.objective(id)?.definition.word)
      .filter((word): word is string => Boolean(word));
  }

  setActiveShields(activeShields: number): void {
    this.activeShields = Math.max(0, activeShields);
  }

  private runtimeWord(
    objective: CanonicalObjective,
    path = objective.expectedPath,
  ): GeneratedRuntimeWord {
    const badgeType =
      this.badgeCooldownMoves > 0
        ? undefined
        : objective.badgeType === "shield" && this.activeShields >= 3
          ? "raid"
          : objective.badgeType;
    const badgeCell = path[Math.floor(path.length / 2)];
    return {
      id: objective.id,
      word: objective.definition.word,
      path: path.map(([row, col]) => ({ row, col })),
      tileIds: path.map(([row, col]) => this.tileId(row, col)),
      badges:
        badgeType && badgeCell
          ? [
              {
                type: badgeType,
                tileId: this.tileId(badgeCell[0], badgeCell[1]),
              },
            ].filter((badge) => !this.collectedRewardTileIds.has(badge.tileId))
          : [],
      activatedAt: objective.activatedAt,
    };
  }

  private collectPathRewards(tileIds: string[]): BadgeAssignment[] {
    const selected = new Set(tileIds);
    const rewards = this.activeWords()
      .flatMap((word) => word.badges)
      .filter(
        (badge) =>
          selected.has(badge.tileId) &&
          !this.collectedRewardTileIds.has(badge.tileId),
      );
    rewards.forEach((badge) => this.collectedRewardTileIds.add(badge.tileId));
    return rewards.map((badge) => ({ ...badge }));
  }

  private plannedBadgeType(
    stageIndex: number,
    wordIndex: number,
  ): BadgeType | undefined {
    if (this.level.levelNumber === 3) {
      // Level 3 introduces Raid: one token per stage across the first three
      // stages (spread across both words so it doesn't look mechanical),
      // so the tray fills with a stage still left to play before the level ends.
      if (stageIndex > 2) return undefined;
      const badgeWordIndex = stageIndex % 2;
      return wordIndex === badgeWordIndex ? "raid" : undefined;
    }
    const stageRoll = (this.level.seed + stageIndex * 37) % 100;
    const chosenWord = (this.level.seed + stageIndex * 11) % 2;
    if (stageRoll >= 45 || wordIndex !== chosenWord) return undefined;
    const typeRoll = (this.level.seed * 13 + stageIndex * 29) % 100;
    if (typeRoll < 38) return "raid";
    if (typeRoll < 66) return "attack";
    if (typeRoll < 84) return "steal";
    return "shield";
  }

  private tileId(row: number, column: number): string {
    return `generated-${this.level.seed}-tile-${row}-${column}`;
  }

  private cellForTileId(tileId: string): Cell | null {
    const prefix = `generated-${this.level.seed}-tile-`;
    if (!tileId.startsWith(prefix)) return null;
    const [rowText, columnText, ...extra] = tileId
      .slice(prefix.length)
      .split("-");
    const row = Number(rowText);
    const column = Number(columnText);
    if (
      extra.length > 0 ||
      !Number.isInteger(row) ||
      !Number.isInteger(column) ||
      row < 0 ||
      row >= 8 ||
      column < 0 ||
      column >= 8
    ) {
      return null;
    }
    return [row, column];
  }
}
