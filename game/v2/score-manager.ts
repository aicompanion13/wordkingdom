import type { RunSummary, ScoreSnapshot } from "./types";

const COMBOS = [1, 1.2, 1.5, 2];

export class ScoreManager {
  private score = 0;
  private comboIndex = 0;
  private correct = 0;
  private attempts = 0;
  private hints = 0;
  private longestWord = "";
  private lastSolveAt: number;

  constructor(startedAt: number) {
    this.lastSolveAt = startedAt;
  }

  recordCorrect(word: string, now: number): number {
    this.attempts += 1;
    this.correct += 1;
    const seconds = Math.max(1, (now - this.lastSolveAt) / 1000);
    const speedMultiplier = seconds <= 5 ? 1.5 : seconds <= 9 ? 1.25 : seconds <= 14 ? 1.1 : 1;
    const points = Math.round(word.length * 100 * speedMultiplier * COMBOS[this.comboIndex]);
    this.score += points;
    this.comboIndex = Math.min(COMBBOS_MAX, this.comboIndex + 1);
    this.lastSolveAt = now;
    if (word.length > this.longestWord.length) this.longestWord = word;
    return points;
  }

  recordIncorrect(): void {
    this.attempts += 1;
    this.comboIndex = 0;
  }

  useHint(): void {
    this.hints += 1;
    this.comboIndex = 0;
  }

  pause(durationMs: number): void {
    this.lastSolveAt += Math.max(0, durationMs);
  }

  snapshot(): ScoreSnapshot {
    return {
      score: this.score,
      combo: COMBOS[this.comboIndex],
      correct: this.correct,
      attempts: this.attempts,
      hints: this.hints,
      longestWord: this.longestWord,
    };
  }

  finalize(elapsedSeconds: number, eventCoins: number): RunSummary {
    const accuracy = this.attempts ? this.correct / this.attempts : 1;
    let stars = 1;
    if (this.score >= 2600 && accuracy >= 0.75) stars = 2;
    if (this.score >= 4500 && accuracy >= 0.9 && this.hints <= 1) stars = 3;
    const baseCoins = Math.max(100, Math.round(this.score / 8));
    const starMultiplier = stars === 3 ? 1.5 : stars === 2 ? 1.25 : 1;
    const totalCoins = Math.round(baseCoins * starMultiplier) + eventCoins;
    return { ...this.snapshot(), elapsedSeconds, accuracy, stars, baseCoins, eventCoins, totalCoins };
  }
}

const COMBBOS_MAX = COMBOS.length - 1;
