/**
 * Per-level countdown.
 *
 * The clock is derived from wall-clock timestamps rather than counted down by an
 * interval, so a dropped frame or a throttled background tab cannot make it drift.
 * Paused time is accumulated and subtracted, which is what keeps a Raid, a tutorial
 * card or the settings sheet from eating the player's board time.
 */

/** Ten minutes. Generous next to a typical board, so it reads as a safety net. */
export const LEVEL_TIME_LIMIT_SECONDS = 600;

/** How long is left when the board should start warning the player. */
export const LEVEL_TIME_URGENT_SECONDS = 60;

export type LevelTimerState = {
  startedAt: number;
  limitMs: number;
  /** When the current pause began, or null while running. */
  pausedAt: number | null;
  /** Total time already spent paused. */
  pausedMs: number;
};

export function createLevelTimer(now: number, limitSeconds = LEVEL_TIME_LIMIT_SECONDS): LevelTimerState {
  return { startedAt: now, limitMs: Math.max(0, limitSeconds) * 1000, pausedAt: null, pausedMs: 0 };
}

export function pauseLevelTimer(state: LevelTimerState, now: number): LevelTimerState {
  if (state.pausedAt !== null) return state;
  return { ...state, pausedAt: now };
}

export function resumeLevelTimer(state: LevelTimerState, now: number): LevelTimerState {
  if (state.pausedAt === null) return state;
  return {
    ...state,
    pausedAt: null,
    pausedMs: state.pausedMs + Math.max(0, now - state.pausedAt),
  };
}

/** Milliseconds of board time consumed, excluding anything spent paused. */
export function levelTimeElapsedMs(state: LevelTimerState, now: number): number {
  const frozenSince = state.pausedAt ?? now;
  return Math.max(0, frozenSince - state.startedAt - state.pausedMs);
}

export function levelTimeRemainingMs(state: LevelTimerState, now: number): number {
  return Math.max(0, state.limitMs - levelTimeElapsedMs(state, now));
}

export function isLevelTimeUrgent(state: LevelTimerState, now: number): boolean {
  const remaining = levelTimeRemainingMs(state, now);
  return remaining > 0 && remaining <= LEVEL_TIME_URGENT_SECONDS * 1000;
}

/**
 * The clock reaching zero is currently a display state only — no penalty is applied
 * and the board stays playable. The fail behaviour is still an open design decision.
 */
export function isLevelTimeUp(state: LevelTimerState, now: number): boolean {
  return levelTimeRemainingMs(state, now) === 0;
}

/** Renders as m:ss, always showing two second digits. */
export function formatLevelClock(remainingMs: number): string {
  const total = Math.ceil(Math.max(0, remainingMs) / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
