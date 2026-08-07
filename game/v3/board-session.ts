import type {
  ActiveWord,
  BadgeAssignment,
  BoardSnapshot,
  Position,
} from "@/game/v2/types";
import type {
  ScoringWord,
  WordScoreEvent,
} from "@/game/scoring/types";
import type { CanonicalBoardSnapshot } from "./canonical-board-state";

export type SessionActiveWord = ActiveWord & ScoringWord;

export type WordScoringHook = (
  word: SessionActiveWord,
  matchTimestamp: number,
) => WordScoreEvent;

export type BoardSelectionResult =
  | {
      kind: "accepted";
      word: SessionActiveWord;
      score: WordScoreEvent;
      tileIds: string[];
      rewards: BadgeAssignment[];
    }
  | {
      kind: "bonus";
      word: string;
      wordId: string;
      points: number;
      tileIds: string[];
      rewards: BadgeAssignment[];
    }
  | {
      kind: "neutral";
      word: string;
      tileIds: string[];
    }
  | {
      kind: "invalid";
      tileIds: string[];
    };

export type BoardSessionProgress = {
  solved: number;
  total: number;
  complete: boolean;
};

export type BoardSolveResult = BoardSessionProgress & {
  board: BoardSnapshot;
  activeWords: SessionActiveWord[];
  flippedTileIds: string[];
  revealedWord?: string;
  suppressedShieldConversions?: number;
};

export type BoardObstacleMarker = {
  tileId: string;
  type: string;
};

export interface BoardSession {
  readonly totalWords: number;

  snapshot(): BoardSnapshot;
  activeWords(): SessionActiveWord[];
  pathBetween(start: Position, end: Position): Position[];
  tileIdsForPath(path: Position[]): string[];
  acceptSelection(
    tileIds: string[],
    matchTimestamp: number,
    onWordSolved: WordScoringHook,
  ): BoardSelectionResult;
  solve(word: SessionActiveWord, solvedAt: number): BoardSolveResult;
  settleTransitions(settledAt?: number): void;
  transitionTileIdsForObjective(objectiveId: string): string[];
  canAcceptInput(): boolean;
  debugSnapshot(): CanonicalBoardSnapshot | null;
  progress(): BoardSessionProgress;
  isComplete(): boolean;
  obstacleMarkers(): BoardObstacleMarker[];
  shownWords(): string[];
  setActiveShields(activeShields: number): void;
}
