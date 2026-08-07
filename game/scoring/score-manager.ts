import scoringConfigJson from "./data/scoring_config.json" with { type: "json" };
import type {
  BoardResult,
  ComboBreakReason,
  ScoreManagerEventMap,
  ScoreManagerSnapshot,
  ScoringBoardDefinition,
  ScoringConfig,
  ScoringWord,
  TelemetryRecord,
  WordScoreEvent,
} from "./types";

type Listener<K extends keyof ScoreManagerEventMap> = (payload: ScoreManagerEventMap[K]) => void;

export const scoringConfig: ScoringConfig = {
  basePointsPerLetter: scoringConfigJson.basePointsPerLetter,
  speedTiers: scoringConfigJson.speedTiers.map((tier) => ({ ...tier })),
  comboLadder: [...scoringConfigJson.comboLadder],
  comboIdleTimeoutSeconds: scoringConfigJson.comboIdleTimeoutSeconds,
  hintBreaksCombo: scoringConfigJson.hintBreaksCombo,
};

export class ScoreManager {
  private readonly config: ScoringConfig;
  private readonly baseCombo: number;
  private readonly startedAt: number;
  private score = 0;
  private comboIndex = 0;
  private bestCombo: number;
  private validSelections = 0;
  private invalidSelections = 0;
  private hintsUsed = 0;
  private comboBreaks = 0;
  private longestWord = "";
  private lastActivityAt: number;
  private lastWord?: WordScoreEvent;
  private activatedAt = new Map<string, number>();
  private timePerWord: number[] = [];
  private idleTimer?: ReturnType<typeof setTimeout>;
  private listeners = new Map<keyof ScoreManagerEventMap, Set<(payload: never) => void>>();

  constructor();
  constructor(startedAt: number);
  constructor(config: ScoringConfig, startedAt?: number);
  constructor(configOrStartedAt: ScoringConfig | number = scoringConfig, explicitStartedAt = Date.now()) {
    const sourceConfig = typeof configOrStartedAt === "number" ? scoringConfig : configOrStartedAt;
    const startedAt = typeof configOrStartedAt === "number" ? configOrStartedAt : explicitStartedAt;
    if (sourceConfig.comboLadder.length === 0) throw new Error("scoring_config.json requires at least one combo multiplier");
    if (sourceConfig.speedTiers.length === 0) throw new Error("scoring_config.json requires at least one speed tier");
    this.config = {
      basePointsPerLetter: sourceConfig.basePointsPerLetter,
      speedTiers: sourceConfig.speedTiers.map((tier) => ({ ...tier })),
      comboLadder: [...sourceConfig.comboLadder],
      comboIdleTimeoutSeconds: sourceConfig.comboIdleTimeoutSeconds,
      hintBreaksCombo: sourceConfig.hintBreaksCombo,
    };
    this.baseCombo = this.config.comboLadder[0];
    this.bestCombo = this.baseCombo;
    this.startedAt = startedAt;
    this.lastActivityAt = startedAt;
    this.resetIdleTimer();
  }

  onWordSolved(word: ScoringWord, matchTimestamp: number): WordScoreEvent {
    const elapsedSeconds = Math.max(0, (matchTimestamp - word.activatedAt) / 1000);
    const speedMultiplier = this.speedMultiplier(elapsedSeconds);
    const comboMultiplier = this.config.comboLadder[this.comboIndex];
    const points = Math.round(word.word.length * this.config.basePointsPerLetter * speedMultiplier * comboMultiplier);
    const event: WordScoreEvent = {
      wordId: word.id,
      word: word.word,
      points,
      elapsedSeconds,
      speedMultiplier,
      comboMultiplier,
    };

    this.score += points;
    this.validSelections += 1;
    this.timePerWord.push(Number(elapsedSeconds.toFixed(2)));
    this.lastActivityAt = matchTimestamp;
    this.lastWord = event;
    if (word.word.length > this.longestWord.length) this.longestWord = word.word;
    this.emit("OnWordScored", event);

    const previous = comboMultiplier;
    this.comboIndex = Math.min(this.config.comboLadder.length - 1, this.comboIndex + 1);
    const current = this.config.comboLadder[this.comboIndex];
    this.bestCombo = Math.max(this.bestCombo, current);
    if (current > previous) this.emit("OnComboIncrement", { previous, current, tier: this.comboIndex });
    this.resetIdleTimer();
    return event;
  }

  onBonusWordSolved(
    wordId: string,
    word: string,
    points: number,
    matchTimestamp = Date.now(),
  ): WordScoreEvent {
    const comboMultiplier = this.config.comboLadder[this.comboIndex];
    const event: WordScoreEvent = {
      wordId,
      word,
      points,
      elapsedSeconds: 0,
      speedMultiplier: 1,
      comboMultiplier,
      category: "bonus",
    };

    this.score += points;
    this.validSelections += 1;
    this.lastActivityAt = matchTimestamp;
    this.lastWord = event;
    if (word.length > this.longestWord.length) this.longestWord = word;
    this.emit("OnWordScored", event);
    this.resetIdleTimer();
    return event;
  }

  onInvalidSelection(timestamp = Date.now()): void {
    this.invalidSelections += 1;
    this.breakCombo("invalid-selection", timestamp);
    this.resetIdleTimer();
  }

  on<K extends keyof ScoreManagerEventMap>(event: K, listener: Listener<K>): () => void {
    const listeners = this.listeners.get(event) ?? new Set();
    listeners.add(listener as (payload: never) => void);
    this.listeners.set(event, listeners);
    return () => listeners.delete(listener as (payload: never) => void);
  }

  snapshot(now = Date.now()): ScoreManagerSnapshot {
    const idleTimeoutMs = this.config.comboIdleTimeoutSeconds * 1000;
    const idleRemainingRatio = this.comboIndex === 0
      ? 1
      : Math.max(0, 1 - (now - this.lastActivityAt) / idleTimeoutMs);
    return {
      score: this.score,
      comboMultiplier: this.config.comboLadder[this.comboIndex],
      bestCombo: this.bestCombo,
      validSelections: this.validSelections,
      invalidSelections: this.invalidSelections,
      hintsUsed: this.hintsUsed,
      comboBreaks: this.comboBreaks,
      longestWord: this.longestWord,
      wordsFound: this.validSelections,
      idleRemainingRatio,
      lastWord: this.lastWord,
    };
  }

  // Compatibility surface retained for the untouched /v4 reference build.
  activateWords(wordIds: string[], activatedAt = Date.now()): void {
    this.activatedAt = new Map(wordIds.map((wordId) => [wordId, activatedAt]));
  }

  scoreWord(wordId: string, word: string, completedAt = Date.now()): WordScoreEvent {
    return this.onWordSolved({ id: wordId, word, activatedAt: this.activatedAt.get(wordId) ?? this.lastActivityAt }, completedAt);
  }

  invalidSelection(now = Date.now()): void {
    this.onInvalidSelection(now);
  }

  useHint(now = Date.now()): void {
    this.hintsUsed += 1;
    if (this.config.hintBreaksCombo) {
      this.breakCombo("hint", now);
      this.resetIdleTimer();
    }
  }

  tick(now = Date.now()): ScoreManagerSnapshot {
    const idleTimeoutMs = this.config.comboIdleTimeoutSeconds * 1000;
    if (this.comboIndex > 0 && now - this.lastActivityAt >= idleTimeoutMs) this.breakCombo("idle-timeout", now);
    return this.snapshot(now);
  }

  finalize(board: ScoringBoardDefinition, completedAt = Date.now(), previousBest = 0): BoardResult {
    const durationSeconds = Math.max(1, Math.round((completedAt - this.startedAt) / 1000));
    const totalSelections = this.validSelections + this.invalidSelections;
    const accuracy = totalSelections ? this.validSelections / totalSelections : 1;
    const starsEarned = this.starsForScore(board.starThresholds);
    return {
      boardId: board.boardId,
      level: board.level,
      title: board.title,
      finalScore: this.score,
      starsEarned,
      durationSeconds,
      wordsFound: this.validSelections,
      invalidSelections: this.invalidSelections,
      hintsUsed: this.hintsUsed,
      bestCombo: this.bestCombo,
      comboBreaks: this.comboBreaks,
      longestWord: this.longestWord,
      accuracy,
      timePerWord: [...this.timePerWord],
      starThresholds: [...board.starThresholds],
      newBest: this.score > previousBest,
    };
  }

  telemetry(board: ScoringBoardDefinition, endedAt = Date.now(), abandoned = false): TelemetryRecord {
    const result = this.finalize(board, endedAt);
    return {
      boardId: board.boardId,
      finalScore: result.finalScore,
      starsEarned: result.starsEarned,
      durationSeconds: result.durationSeconds,
      wordsFound: result.wordsFound,
      invalidSelections: result.invalidSelections,
      hintsUsed: result.hintsUsed,
      bestCombo: result.bestCombo,
      comboBreaks: result.comboBreaks,
      timePerWord: result.timePerWord,
      abandoned,
      recordedAt: Date.now(),
    };
  }

  private speedMultiplier(elapsedSeconds: number): number {
    const tier = this.config.speedTiers.find((candidate) => elapsedSeconds < candidate.maxSeconds);
    return (tier ?? this.config.speedTiers[this.config.speedTiers.length - 1]).multiplier;
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (this.comboIndex === 0) return;
      this.breakCombo("idle-timeout", Date.now());
    }, this.config.comboIdleTimeoutSeconds * 1000);
  }

  private breakCombo(reason: ComboBreakReason, timestamp: number): void {
    const previous = this.config.comboLadder[this.comboIndex];
    this.comboIndex = 0;
    this.comboBreaks += 1;
    this.lastActivityAt = timestamp;
    this.emit("OnComboBreak", { previous, current: this.baseCombo, reason });
  }

  private starsForScore(thresholds: [number, number, number]): number {
    if (this.score >= thresholds[2]) return 3;
    if (this.score >= thresholds[1]) return 2;
    if (this.score >= thresholds[0]) return 1;
    return 0;
  }

  private emit<K extends keyof ScoreManagerEventMap>(event: K, payload: ScoreManagerEventMap[K]): void {
    this.listeners.get(event)?.forEach((listener) => listener(payload as never));
  }
}
