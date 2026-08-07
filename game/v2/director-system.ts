import { SeededRandom } from "./random";
import type { ActiveWord, AreaDefinition, BadgeType, DirectorDecision } from "./types";
import { BoardController } from "./board-controller";

type LengthBand = "short" | "medium" | "long";

export class DirectorSystem {
  private readonly random: SeededRandom;
  private readonly area: AreaDefinition;
  private readonly recentWords: Set<string>;
  private readonly usedWords = new Set<string>();
  private readonly shown = new Set<string>();
  private activeShields: number;
  private readonly maxBadgedWords: number;
  private badgeCooldownMoves = 0;
  private decisionCounter = 0;

  constructor(area: AreaDefinition, seed: number, recentWords: string[] = [], activeShields = 0, maxBadgedWords = 1) {
    this.area = area;
    this.random = new SeededRandom(seed ^ 0xa5a5a5a5);
    this.recentWords = new Set(recentWords.map((word) => word.toUpperCase()));
    this.activeShields = activeShields;
    this.maxBadgedWords = Math.max(0, Math.min(2, maxBadgedWords));
  }

  setActiveShields(activeShields: number): void {
    this.activeShields = Math.max(0, activeShields);
  }

  notifyWordCleared(word: ActiveWord): void {
    if (word.badges.length > 0) this.badgeCooldownMoves = 1;
  }

  activate(board: BoardController, wave: number, reason: DirectorDecision["reason"]): DirectorDecision {
    const desiredCount = 2 + this.random.int(2);
    const words = this.selectVariedWords(desiredCount);
    let suppressedShieldConversions = 0;
    const occupiedTileIds = new Set<string>();
    const occupiedOrientations = new Set<string>();
    const activeWords: ActiveWord[] = words.map((word) => {
      this.usedWords.add(word);
      this.shown.add(word);
      const path = board.ensureWord(word, occupiedTileIds, occupiedOrientations);
      const tileIds = board.tileIdsForPath(path);
      tileIds.forEach((tileId) => occupiedTileIds.add(tileId));
      occupiedOrientations.add(this.orientationFamily(path));
      this.decisionCounter += 1;
      return {
        id: `active-${wave}-${this.decisionCounter}`,
        word,
        path,
        tileIds,
        badges: [],
      };
    });
    this.EvaluateBadgeSpawns(activeWords).forEach((wordIndex) => {
      const activeWord = activeWords[wordIndex];
      const badgeIndex = Math.min(activeWord.tileIds.length - 1, Math.max(1, this.random.int(activeWord.tileIds.length)));
      const badge = this.pickBadgeType();
      if (badge.suppressed) suppressedShieldConversions += 1;
      activeWord.badges = [{ type: badge.type, tileId: activeWord.tileIds[badgeIndex] }];
    });
    return { activeWords, wave, reason, suppressedShieldConversions };
  }

  EvaluateBadgeSpawns(activeWords: ActiveWord[]): number[] {
    const existingBadges = activeWords.filter((word) => word.badges.length > 0).length;
    if (existingBadges >= this.maxBadgedWords) return [];
    if (this.badgeCooldownMoves > 0) {
      this.badgeCooldownMoves -= 1;
      return [];
    }

    const spawnChance = this.maxBadgedWords > 1 ? 0.5 : 0.4;
    if (this.random.next() >= spawnChance) return [];

    const candidates = activeWords
      .map((word, index) => ({ index, score: this.badgeCandidateScore(word) }))
      .filter(({ index }) => activeWords[index].badges.length === 0)
      .sort((first, second) => first.score - second.score);
    const availableSlots = Math.max(0, this.maxBadgedWords - existingBadges);
    let badgeSlots = Math.min(1, availableSlots, candidates.length);
    if (this.maxBadgedWords > 1 && activeWords.length === 3 && availableSlots > 1 && this.random.next() < 0.25) badgeSlots = 2;
    return candidates.slice(0, badgeSlots).map(({ index }) => index);
  }

  shownWords(): string[] {
    return [...this.shown];
  }

  private selectVariedWords(count: number): string[] {
    const dictionary = [...new Set(this.area.themeDictionary.map((word) => word.toUpperCase()))]
      .filter((word) => word.length >= 4 && word.length <= 8);
    let candidates = dictionary.filter((word) => !this.usedWords.has(word) && !this.recentWords.has(word));
    if (candidates.length < count) candidates = dictionary.filter((word) => !this.usedWords.has(word));
    if (candidates.length < count) {
      this.usedWords.clear();
      candidates = dictionary.filter((word) => !this.recentWords.has(word));
    }
    if (candidates.length < count) candidates = dictionary;

    const requestedBands: LengthBand[] = count === 3
      ? this.random.shuffle<LengthBand>(["short", "medium", "long"])
      : this.random.next() < 0.5 ? ["short", "long"] : ["medium", "long"];
    const selected: string[] = [];
    requestedBands.forEach((band) => {
      const matches = this.random.shuffle(candidates.filter((word) => !selected.includes(word) && this.lengthBand(word) === band));
      if (matches[0]) selected.push(matches[0]);
    });
    const remainder = this.random.shuffle(candidates.filter((word) => !selected.includes(word)));
    while (selected.length < count && remainder.length > 0) selected.push(remainder.shift()!);
    return selected;
  }

  private lengthBand(word: string): LengthBand {
    if (word.length <= 5) return "short";
    if (word.length === 6) return "medium";
    return "long";
  }

  private pickBadgeType(): { type: BadgeType; suppressed: boolean } {
    const roll = this.random.next();
    if (roll < 0.5) return { type: "raid", suppressed: false };
    if (roll < 0.85) return { type: "attack", suppressed: false };
    if (this.activeShields >= 3) return { type: "raid", suppressed: true };
    return { type: "shield", suppressed: false };
  }

  private badgeCandidateScore(word: ActiveWord): number {
    const orientation = this.orientationFamily(word.path);
    const diagonalDifficulty = orientation.startsWith("diagonal") ? -8 : 0;
    return word.word.length * 10 + diagonalDifficulty + this.random.next();
  }

  private orientationFamily(path: Array<{ row: number; col: number }>): string {
    const start = path[0];
    const end = path[path.length - 1];
    if (start.row === end.row) return "horizontal";
    if (start.col === end.col) return "vertical";
    return Math.sign(end.row - start.row) === Math.sign(end.col - start.col) ? "diagonal-down" : "diagonal-up";
  }
}
