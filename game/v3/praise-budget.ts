export type CelebrationBannerKind =
  | "great-word"
  | "royal-combo"
  | "bonus-found"
  | "keep-going"
  | "on-fire"
  | "one-more";

/*
 * Praise banners are rationed so they stay special. "one-more" (an urgency cue) and
 * "bonus-found" (it reports a real Royal Dictionary entry) carry information rather than
 * flattery, so they are exempt from the budget and always show.
 *
 * Tutorial instructions, power unlocks and Raid results never reach here at all — they
 * are ConceptCard scrolls, not celebration banners — so they cannot spend the allowance.
 */
export const PRAISE_BANNERS: readonly CelebrationBannerKind[] = ["great-word", "royal-combo", "on-fire", "keep-going"];

/** Combo milestones — the marquee moments a board builds towards. */
const MILESTONE_BANNERS: readonly CelebrationBannerKind[] = ["royal-combo", "on-fire"];

export const MAX_PRAISE_BANNERS_PER_BOARD = 3;

/*
 * Routine praise gets at most two of the three slots, so a player who finds several long
 * words early cannot starve the board of its "On fire!" moment. Milestones fire at most
 * once each anyway (the caller latches them), so the total still cannot exceed the cap.
 */
const MAX_ROUTINE_PRAISE_PER_BOARD = MAX_PRAISE_BANNERS_PER_BOARD - 1;

export type PraiseBudget = {
  /** Praise banners already spent on this board. */
  shown: number;
  /** Of those, how many were routine (non-milestone) praise. */
  routineShown: number;
  /** Solve that spent the most recent one, so praise can be spaced out. */
  lastSolveIndex: number;
};

export function createPraiseBudget(): PraiseBudget {
  return { shown: 0, routineShown: 0, lastSolveIndex: -1 };
}

export function isPraiseBanner(kind: CelebrationBannerKind): boolean {
  return PRAISE_BANNERS.includes(kind);
}

export function isMilestoneBanner(kind: CelebrationBannerKind): boolean {
  return MILESTONE_BANNERS.includes(kind);
}

/**
 * Decides whether a banner may show, and returns the budget to carry forward.
 * Exempt banners always show and never change the budget.
 */
export function considerCelebration(
  kind: CelebrationBannerKind,
  budget: PraiseBudget,
  solveIndex: number,
): { show: boolean; budget: PraiseBudget } {
  if (!isPraiseBanner(kind)) return { show: true, budget };
  if (budget.shown >= MAX_PRAISE_BANNERS_PER_BOARD) return { show: false, budget };

  const milestone = isMilestoneBanner(kind);
  if (!milestone && budget.routineShown >= MAX_ROUTINE_PRAISE_PER_BOARD) return { show: false, budget };
  // "Great word" is the only praise that can land on genuinely back-to-back solves, so
  // space it out. Combo milestones are rare enough on their own to always speak.
  if (kind === "great-word" && budget.lastSolveIndex === solveIndex - 1) return { show: false, budget };

  return {
    show: true,
    budget: {
      shown: budget.shown + 1,
      routineShown: budget.routineShown + (milestone ? 0 : 1),
      lastSolveIndex: solveIndex,
    },
  };
}
