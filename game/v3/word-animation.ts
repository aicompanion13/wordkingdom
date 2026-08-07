export const WORD_WAVE_STAGGER_MS = 38;
export const ACCEPTED_TILE_POP_MS = 220;
export const BONUS_TILE_PULSE_MS = 330;
export const ACCEPTED_WAVE_PADDING_MS = 24;
export const TRANSFORMATION_MS = 320;
export const REDUCED_ACCEPTED_WAVE_MS = 160;
export const REDUCED_TRANSFORMATION_MS = 180;

export type ObjectiveWordAnimationPlan = Readonly<{
  acceptedPath: readonly string[];
  transformationDiff: readonly string[];
  acceptedWaveMs: number;
  transformationMs: number;
  flipOutMs: number;
  flipInMs: number;
}>;

export function createObjectiveWordAnimationPlan(
  acceptedPath: readonly string[],
  transformationDiff: readonly string[],
  reducedMotion: boolean,
): ObjectiveWordAnimationPlan {
  const acceptedWaveMs = reducedMotion
    ? REDUCED_ACCEPTED_WAVE_MS
    : ACCEPTED_TILE_POP_MS +
      Math.max(0, acceptedPath.length - 1) * WORD_WAVE_STAGGER_MS +
      ACCEPTED_WAVE_PADDING_MS;
  const transformationMs = reducedMotion
    ? REDUCED_TRANSFORMATION_MS
    : TRANSFORMATION_MS;
  const flipOutMs = reducedMotion ? 60 : 120;
  return Object.freeze({
    acceptedPath: Object.freeze([...acceptedPath]),
    transformationDiff: Object.freeze([...transformationDiff]),
    acceptedWaveMs,
    transformationMs,
    flipOutMs,
    flipInMs: transformationMs - flipOutMs,
  });
}

export function createBonusWordAnimationPlan(
  acceptedPath: readonly string[],
  reducedMotion: boolean,
): Readonly<{ acceptedPath: readonly string[]; acceptedWaveMs: number }> {
  return Object.freeze({
    acceptedPath: Object.freeze([...acceptedPath]),
    acceptedWaveMs: reducedMotion
      ? REDUCED_ACCEPTED_WAVE_MS
      : BONUS_TILE_PULSE_MS +
        Math.max(0, acceptedPath.length - 1) * WORD_WAVE_STAGGER_MS +
        ACCEPTED_WAVE_PADDING_MS,
  });
}
