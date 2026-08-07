import type { BoardResult, SummaryRevealState } from "./types";

export class RunSummaryController {
  private timers: Array<ReturnType<typeof setTimeout>> = [];

  start(result: BoardResult, onReveal: (state: SummaryRevealState) => void): void {
    this.cancel();
    let state: SummaryRevealState = { displayedScore: 0, starsVisible: 0, statsVisible: false, actionsVisible: false };
    const update = (partial: Partial<SummaryRevealState>) => {
      state = { ...state, ...partial };
      onReveal(state);
    };
    update(state);
    const scoreSteps = 20;
    for (let step = 1; step <= scoreSteps; step += 1) {
      this.timers.push(setTimeout(() => update({ displayedScore: Math.round(result.finalScore * (step / scoreSteps)) }), step * 30));
    }
    const starStart = 820;
    for (let star = 1; star <= result.starsEarned; star += 1) {
      this.timers.push(setTimeout(() => update({ starsVisible: star }), starStart + (star - 1) * 300));
    }
    const statsAt = starStart + Math.max(1, result.starsEarned) * 300;
    this.timers.push(setTimeout(() => update({ statsVisible: true }), statsAt));
    this.timers.push(setTimeout(() => update({ actionsVisible: true }), statsAt + 300));
  }

  cancel(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers = [];
  }
}
