import goldenLevelJson from "./data/golden-levels/golden_01.json" with { type: "json" };
import type { BoardSnapshot, Position } from "@/game/v2/types";
import {
  CanonicalBoardModel,
  type CanonicalBoardSnapshot,
  type CanonicalCell,
  type CanonicalObjective,
} from "./canonical-board-state";
import { acceptCanonicalSelection } from "./canonical-selection";
import { normalizeCanonicalGesturePath } from "./direction-contract.js";
import type { AuthoredGoldenLevel } from "./golden-level-types";
import type {
  BoardSelectionResult,
  BoardSession,
  BoardSessionProgress,
  BoardSolveResult,
  SessionActiveWord,
  WordScoringHook,
} from "./board-session";

export const GOLDEN_LEVEL_1 = goldenLevelJson as unknown as AuthoredGoldenLevel;

export class GoldenLevelSession implements BoardSession {
  readonly totalWords: number;
  readonly level: AuthoredGoldenLevel;
  private readonly canonical: CanonicalBoardModel;
  private readonly objectiveWords: Set<string>;
  private readonly rewardedBonusWords = new Set<string>();

  constructor(level: AuthoredGoldenLevel, activatedAt = Date.now()) {
    this.level = level;
    this.canonical = new CanonicalBoardModel({
      levelId: level.levelId,
      seed: level.seed,
      initialGrid: level.initialGrid,
      authoredLevel: level,
      activatedAt,
    });
    this.totalWords = this.canonical.totalObjectives;
    this.objectiveWords = new Set(level.objectives.map(({ word }) => word));
  }

  snapshot(): BoardSnapshot {
    return {
      size: 8,
      tiles: this.canonical.boardTiles().map((row) => row.map((tile) => ({
        id: tile.id,
        letter: tile.letter,
        row: tile.row,
        col: tile.col,
      }))),
    };
  }

  activeWords(): SessionActiveWord[] {
    return this.canonical.activeObjectives().map((objective) => this.runtimeWord(objective));
  }

  pathBetween(start: Position, end: Position): Position[] {
    const rowDelta = end.row - start.row;
    const colDelta = end.col - start.col;
    if (rowDelta !== 0 && colDelta !== 0 && Math.abs(rowDelta) !== Math.abs(colDelta)) return [];
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
      bonusWordId: (bonusWord) => `bonus:${this.level.levelId}:${bonusWord}`,
      cellForTileId: (tileId) => this.cellForTileId(tileId),
      normalizeGesturePath: (path) =>
        normalizeCanonicalGesturePath(path) as CanonicalCell[] | null,
      runtimeWord: (objective, acceptedPath) =>
        this.runtimeWord(objective, acceptedPath),
      collectRewards: () => [],
    });
  }

  solve(word: SessionActiveWord, _solvedAt = Date.now()): BoardSolveResult {
    const resolution = this.canonical.commitResolution();
    return {
      ...this.progress(),
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

  obstacleMarkers(): Array<{ tileId: string; type: string }> {
    return [];
  }

  shownWords(): string[] {
    return this.canonical.snapshot().completedObjectives
      .map((id) => this.canonical.objective(id)?.definition.word)
      .filter((word): word is string => Boolean(word));
  }

  setActiveShields(_activeShields: number): void {
    // Golden Level 1 intentionally has no badges or defense mechanics.
  }

  private runtimeWord(
    objective: CanonicalObjective,
    path = objective.expectedPath,
  ): SessionActiveWord {
    return {
      id: objective.id,
      word: objective.definition.word,
      path: path.map(([row, col]) => ({ row, col })),
      tileIds: path.map(([row, col]) => this.tileId(row, col)),
      badges: [],
      activatedAt: objective.activatedAt,
    };
  }

  private tileId(row: number, column: number): string {
    return `generated-${this.level.seed}-tile-${row}-${column}`;
  }

  private cellForTileId(tileId: string): CanonicalCell | null {
    const prefix = `generated-${this.level.seed}-tile-`;
    if (!tileId.startsWith(prefix)) return null;
    const parts = tileId.slice(prefix.length).split("-");
    if (parts.length !== 2) return null;
    const row = Number(parts[0]);
    const column = Number(parts[1]);
    return Number.isInteger(row) && Number.isInteger(column) && row >= 0 && row < 8 && column >= 0 && column < 8
      ? [row, column]
      : null;
  }
}
