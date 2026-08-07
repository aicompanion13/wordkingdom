export type SpeedTier = { maxSeconds: number; multiplier: number };

export type ScoringConfig = {
  basePointsPerLetter: number;
  speedTiers: SpeedTier[];
  comboLadder: number[];
  comboIdleTimeoutSeconds: number;
  hintBreaksCombo?: boolean;
};

export type ScoringWord = {
  id: string;
  word: string;
  activatedAt: number;
};

export type ScoringBoardDefinition = {
  boardId: string;
  level: number;
  areaId: number;
  title: string;
  wordsToComplete: number;
  starThresholds: [number, number, number];
};

export type ComboBreakReason = "invalid-selection" | "hint" | "idle-timeout";

export type WordScoreEvent = {
  wordId: string;
  word: string;
  points: number;
  elapsedSeconds: number;
  speedMultiplier: number;
  comboMultiplier: number;
  category?: "objective" | "bonus";
};

export type ScoreManagerSnapshot = {
  score: number;
  comboMultiplier: number;
  bestCombo: number;
  validSelections: number;
  invalidSelections: number;
  hintsUsed: number;
  comboBreaks: number;
  longestWord: string;
  wordsFound: number;
  idleRemainingRatio: number;
  lastWord?: WordScoreEvent;
};

export type V3RunSummaryCore = {
  score: number;
  combo: number;
  correct: number;
  attempts: number;
  hints: number;
  longestWord: string;
  elapsedSeconds: number;
  accuracy: number;
  stars: number;
  baseCoins: number;
  eventCoins: number;
  totalCoins: number;
  bestCombo: number;
  invalidSelections: number;
};

export type BoardResult = {
  boardId: string;
  level: number;
  title: string;
  finalScore: number;
  starsEarned: number;
  durationSeconds: number;
  wordsFound: number;
  invalidSelections: number;
  hintsUsed: number;
  bestCombo: number;
  comboBreaks: number;
  longestWord: string;
  accuracy: number;
  timePerWord: number[];
  starThresholds: [number, number, number];
  newBest: boolean;
};

export type TelemetryRecord = {
  boardId: string;
  finalScore: number;
  starsEarned: number;
  durationSeconds: number;
  wordsFound: number;
  invalidSelections: number;
  hintsUsed: number;
  bestCombo: number;
  comboBreaks: number;
  timePerWord: number[];
  abandoned: boolean;
  recordedAt: number;
};

export type ScoreManagerEventMap = {
  OnWordScored: WordScoreEvent;
  OnComboIncrement: { previous: number; current: number; tier: number };
  OnComboBreak: { previous: number; current: number; reason: ComboBreakReason };
};

export type SummaryRevealState = {
  displayedScore: number;
  starsVisible: number;
  statsVisible: boolean;
  actionsVisible: boolean;
};
