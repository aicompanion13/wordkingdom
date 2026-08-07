import { BoardController } from "@/game/v2/board-controller";
import { DirectorSystem } from "@/game/v2/director-system";
import type {
  ActiveWord,
  AreaDefinition,
  BadgeAssignment,
  Position,
} from "@/game/v2/types";
import type {
  BoardSelectionResult,
  BoardSession,
  BoardSessionProgress,
  BoardSolveResult,
  SessionActiveWord,
  WordScoringHook,
} from "./board-session";
import { normalizeCanonicalGesturePath } from "./direction-contract.js";
import {
  bonusWordPoints,
  physicalWordCandidates,
  resolveBonusWord,
} from "./royal-dictionary";

export type LegacyBoardSessionOptions = {
  area: AreaDefinition;
  seed: number;
  recentWords: string[];
  activeShields: number;
  maxBadgedWords: number;
  activatedAt?: number;
  totalWords?: number;
};

function samePath(first: string[], second: string[]): boolean {
  return (
    first.length === second.length &&
    (first.every((id, index) => id === second[index]) ||
      first.every(
        (id, index) => id === second[second.length - index - 1],
      ))
  );
}

function timestampWords(
  words: ActiveWord[],
  activatedAt: number,
): SessionActiveWord[] {
  return words.map((word) => ({ ...word, activatedAt }));
}

export class LegacyBoardSession implements BoardSession {
  readonly totalWords: number;

  private readonly board: BoardController;
  private readonly director: DirectorSystem;
  private readonly sessionId: string;
  private readonly objectiveWords: Set<string>;
  private readonly rewardedBonusWords = new Set<string>();
  private readonly collectedRewardTileIds = new Set<string>();
  private currentWords: SessionActiveWord[];
  private solvedWords = 0;

  constructor(options: LegacyBoardSessionOptions) {
    this.totalWords = options.totalWords ?? 5;
    this.sessionId = `${options.area.areaId}:${options.seed}`;
    this.objectiveWords = new Set(
      options.area.themeDictionary.map((word) => word.toUpperCase()),
    );
    this.board = new BoardController(8, options.seed);
    this.director = new DirectorSystem(
      options.area,
      options.seed,
      options.recentWords,
      options.activeShields,
      options.maxBadgedWords,
    );
    const decision = this.director.activate(this.board, 0, "initial");
    const activatedAt = options.activatedAt ?? Date.now();
    this.currentWords = timestampWords(
      decision.activeWords,
      activatedAt,
    );
  }

  snapshot() {
    return this.board.snapshot();
  }

  activeWords(): SessionActiveWord[] {
    return this.currentWords.map((word) => ({
      ...word,
      path: word.path.map((position) => ({ ...position })),
      tileIds: [...word.tileIds],
      badges: word.badges
        .filter((badge) => !this.collectedRewardTileIds.has(badge.tileId))
        .map((badge) => ({ ...badge })),
    }));
  }

  pathBetween(start: Position, end: Position): Position[] {
    return this.board.pathBetween(start, end);
  }

  tileIdsForPath(path: Position[]): string[] {
    return this.board.tileIdsForPath(path).filter(Boolean);
  }

  acceptSelection(
    tileIds: string[],
    matchTimestamp: number,
    onWordSolved: WordScoringHook,
  ): BoardSelectionResult {
    const tilesById = new Map(
      this.board.snapshot().tiles.flat().map((tile) => [tile.id, tile]),
    );
    const physicalTiles = tileIds
      .map((tileId) => tilesById.get(tileId))
      .filter((tile): tile is NonNullable<typeof tile> => Boolean(tile));
    const physicalPath = physicalTiles.map(({ row, col }) => [row, col]);
    if (
      physicalTiles.length !== tileIds.length ||
      !normalizeCanonicalGesturePath(physicalPath)
    ) {
      return { kind: "invalid", tileIds: [...tileIds] };
    }
    const word = this.currentWords.find((candidate) =>
      samePath(tileIds, candidate.tileIds),
    );
    if (word) {
      return {
        kind: "accepted",
        word,
        score: onWordSolved(word, matchTimestamp),
        tileIds: [...tileIds],
        rewards: this.collectPathRewards(tileIds),
      };
    }

    const physicalWord = physicalTiles.map((tile) => tile.letter).join("");
    const candidates = physicalWordCandidates(physicalWord);
    const reservedObjective = candidates.find((candidate) => this.objectiveWords.has(candidate));
    if (reservedObjective) {
      return { kind: "neutral", word: reservedObjective, tileIds: [...tileIds] };
    }
    const bonusWord = resolveBonusWord(physicalWord);
    if (!bonusWord) return { kind: "invalid", tileIds: [...tileIds] };
    if (this.rewardedBonusWords.has(bonusWord)) {
      return { kind: "neutral", word: bonusWord, tileIds: [...tileIds] };
    }
    this.rewardedBonusWords.add(bonusWord);
    return {
      kind: "bonus",
      word: bonusWord,
      wordId: `bonus:${this.sessionId}:${bonusWord}`,
      points: bonusWordPoints(bonusWord),
      tileIds: [...tileIds],
      rewards: this.collectPathRewards(tileIds),
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

  solve(
    word: SessionActiveWord,
    _solvedAt: number,
  ): BoardSolveResult {
    this.board.clearPath(word.path);
    this.director.notifyWordCleared(word);
    this.solvedWords += 1;

    let suppressedShieldConversions: number | undefined;
    if (!this.isComplete()) {
      const decision = this.director.activate(
        this.board,
        this.solvedWords,
        "cascade",
      );
      this.currentWords = timestampWords(
        decision.activeWords,
        Date.now(),
      );
      suppressedShieldConversions = decision.suppressedShieldConversions;
    }

    const progress = this.progress();
    return {
      ...progress,
      board: this.snapshot(),
      activeWords: this.activeWords(),
      flippedTileIds: [...word.tileIds],
      suppressedShieldConversions,
    };
  }

  settleTransitions(): void {
    // Legacy V2 settles through its existing cascade timer. Normal V3 play
    // never constructs this isolated compatibility session.
  }

  transitionTileIdsForObjective(_objectiveId: string): string[] {
    return [];
  }

  canAcceptInput(): boolean {
    return !this.isComplete();
  }

  debugSnapshot(): null {
    return null;
  }

  progress(): BoardSessionProgress {
    return {
      solved: this.solvedWords,
      total: this.totalWords,
      complete: this.isComplete(),
    };
  }

  isComplete(): boolean {
    return this.solvedWords >= this.totalWords;
  }

  obstacleMarkers() {
    return [];
  }

  shownWords(): string[] {
    return this.director.shownWords();
  }

  setActiveShields(activeShields: number): void {
    this.director.setActiveShields(activeShields);
  }
}
