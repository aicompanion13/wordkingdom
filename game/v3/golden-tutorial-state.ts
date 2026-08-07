export type GoldenTutorialPhase =
  | "FIRST_WORD"
  | "FIRST_DRAG"
  | "FIRST_WORD_ACCEPTED"
  | "FIRST_TRANSFORMATION"
  | "UNDERSTOOD";

import type {
  FtueCompletionResult,
  FtueCreditId,
  FtueTutorialId,
  FtueVisualStep,
  OceanRewardPhase,
  OceanDiscoveryStickerId,
  PendingFtueStep,
} from "./ftue-flow";
import type { PowerUpKind } from "./pvp-types";

const OCEAN_STICKERS_BY_LEVEL: Record<number, readonly OceanDiscoveryStickerId[]> = {
  2: ["coral-castle", "pearl", "sea-turtle"],
  3: ["dancing-dolphin", "golden-anchor", "reef-gate"],
  4: ["whale-song", "triton-mark", "sunken-throne"],
  5: ["coral-crown", "ocean-palace", "sunken-crown"],
};

function oceanStickersForLevel(level: number): readonly OceanDiscoveryStickerId[] {
  return OCEAN_STICKERS_BY_LEVEL[level] ?? [];
}

export type FtueBeat = "FIRST_DRAG" | "FIRST_CHANGE" | "SECOND_SOLVE";

export type FtueProgress = {
  version: 6;
  hasCompletedFTUE: boolean;
  skipped: boolean;
  completedBeats: FtueBeat[];
  completedTutorials: FtueTutorialId[];
  grantedCredits: FtueCreditId[];
  albumUnlocked: boolean;
  unlockedAlbumPages: number[];
  viewedAlbumPages: number[];
  pendingMandatoryStep: PendingFtueStep;
  pendingTutorialAction: PowerUpKind | null;
  completedVisualSteps: FtueVisualStep[];
  level1ResultsAcknowledged: boolean;
  level1CompletionResult: FtueCompletionResult | null;
  oceanRewardLevel: number | null;
  oceanRewardPhase: OceanRewardPhase;
  oceanRewardedLevels: number[];
  oceanCollectedStickers: OceanDiscoveryStickerId[];
  oceanStickerRevealCount: number;
  oceanCompletionResult: FtueCompletionResult | null;
  oceanPackMessageDismissed: boolean;
  oceanAlbumMessageDismissed: boolean;
  introVideoSeen: boolean;
};

export type FtueStallStage = "NONE" | "OBJECTIVES" | "SUGGESTION" | "HINT";

export const FTUE_HINT_LIMIT = 3;
export const FTUE_DRAG_NUDGE_MS = 7_000;
export const FTUE_OBJECTIVE_NUDGE_MS = 7_000;
export const FTUE_SUGGESTION_MS = 18_000;
export const FTUE_HINT_OFFER_MS = 23_000;
export const FTUE_CAUSE_EXPLANATION_MS = 1_200;

export type GoldenTutorialState = {
  phase: GoldenTutorialPhase;
  message: string | null;
  recommendedObjectiveId: string | null;
  firstSolvedObjectiveId: string | null;
  localSuccessorObjectiveId: string | null;
};

export type GoldenTransitionPresentation = {
  confirmationMs: number;
  transformationMs: number;
  totalInputLockMs: number;
  visualMode: "FLIP" | "CROSSFADE";
};

const FTUE_BEATS: FtueBeat[] = ["FIRST_DRAG", "FIRST_CHANGE", "SECOND_SOLVE"];

export function createFtueProgress(): FtueProgress {
  return {
    version: 6,
    hasCompletedFTUE: false,
    skipped: false,
    completedBeats: [],
    completedTutorials: [],
    grantedCredits: [],
    albumUnlocked: false,
    unlockedAlbumPages: [],
    viewedAlbumPages: [],
    pendingMandatoryStep: null,
    pendingTutorialAction: null,
    completedVisualSteps: [],
    level1ResultsAcknowledged: false,
    level1CompletionResult: null,
    oceanRewardLevel: null,
    oceanRewardPhase: null,
    oceanRewardedLevels: [],
    oceanCollectedStickers: [],
    oceanStickerRevealCount: 0,
    oceanCompletionResult: null,
    oceanPackMessageDismissed: false,
    oceanAlbumMessageDismissed: false,
    introVideoSeen: false,
  };
}

export function parseFtueProgress(serialized: string | null): FtueProgress {
  if (!serialized) return createFtueProgress();
  try {
    const raw = JSON.parse(serialized) as Record<string, unknown> & { version?: number };
    if (raw.version === 5) return migrateVersionFive(raw);
    if (raw.version !== 6) return createFtueProgress();
    const candidate = raw as Partial<Omit<FtueProgress, "version">> & { version: 6 };
    const rewardLevel = isOceanLevel(candidate.oceanRewardLevel) ? candidate.oceanRewardLevel : null;
    return {
      version: 6,
      hasCompletedFTUE: candidate.hasCompletedFTUE === true,
      skipped: candidate.skipped === true,
      completedBeats: Array.isArray(candidate.completedBeats)
        ? candidate.completedBeats.filter((beat): beat is FtueBeat => FTUE_BEATS.includes(beat as FtueBeat))
        : [],
      completedTutorials: Array.isArray(candidate.completedTutorials) ? candidate.completedTutorials : [],
      grantedCredits: Array.isArray(candidate.grantedCredits) ? candidate.grantedCredits : [],
      albumUnlocked: candidate.albumUnlocked === true,
      unlockedAlbumPages: uniqueLevels(candidate.unlockedAlbumPages),
      viewedAlbumPages: uniqueLevels(candidate.viewedAlbumPages),
      pendingMandatoryStep: candidate.pendingMandatoryStep === "OPEN_LEVEL_2_ALBUM"
        || candidate.pendingMandatoryStep === "VIEW_LEVEL_2_ALBUM"
        ? candidate.pendingMandatoryStep
        : null,
      pendingTutorialAction: candidate.pendingTutorialAction === "shield" || candidate.pendingTutorialAction === "attack" || candidate.pendingTutorialAction === "steal" || candidate.pendingTutorialAction === "raid"
        ? candidate.pendingTutorialAction
        : null,
      completedVisualSteps: Array.isArray(candidate.completedVisualSteps)
        ? candidate.completedVisualSteps.filter(isFtueVisualStep)
        : [],
      level1ResultsAcknowledged: candidate.level1ResultsAcknowledged === true,
      level1CompletionResult: parseCompletionResult(candidate.level1CompletionResult),
      oceanRewardLevel: rewardLevel,
      oceanRewardPhase: isOceanRewardPhase(candidate.oceanRewardPhase) ? candidate.oceanRewardPhase : null,
      oceanRewardedLevels: uniqueOceanLevels(candidate.oceanRewardedLevels),
      oceanCollectedStickers: uniqueOceanStickers(candidate.oceanCollectedStickers),
      oceanStickerRevealCount: clampStickerRevealCount(candidate.oceanStickerRevealCount),
      oceanCompletionResult: parseCompletionResult(candidate.oceanCompletionResult),
      oceanPackMessageDismissed: candidate.oceanPackMessageDismissed === true,
      oceanAlbumMessageDismissed: candidate.oceanAlbumMessageDismissed === true,
      introVideoSeen: candidate.introVideoSeen === true,
    };
  } catch {
    return createFtueProgress();
  }
}

export function serializeFtueProgress(progress: FtueProgress): string {
  return JSON.stringify(progress);
}

export function ftueStorageKey(accountId: string): string {
  return `word-kingdom-v3-ftue-v1:${encodeURIComponent(accountId.trim().toLowerCase())}`;
}

export function markFtueBeat(progress: FtueProgress, beat: FtueBeat): FtueProgress {
  if (progress.completedBeats.includes(beat)) return progress;
  return { ...progress, completedBeats: [...progress.completedBeats, beat] };
}

function uniqueLevels(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((level): level is number => Number.isInteger(level) && level >= 1 && level <= 10))].sort((a, b) => a - b);
}

const FTUE_VISUAL_STEPS: readonly FtueVisualStep[] = [
  "welcome-guidance",
  "first-word-guidance",
  "level-2-rules-guidance",
  "first-transformation",
  "level-2-ready-guidance",
  "level-2-pack-opened",
  "level-2-album-activated",
  "level-2-album-guidance",
  "level-2-album-view",
];

const OCEAN_REWARD_PHASES: readonly Exclude<OceanRewardPhase, null>[] = [
  "RESULTS",
  "PACK_READY",
  "STICKER_REVEAL",
  "ALBUM_ACTIVATED",
  "ALBUM_GUIDE",
  "ALBUM_REVEAL",
  "PACK_COMPLETE",
  "KINGDOM_COMPLETE",
];

function isOceanRewardPhase(value: unknown): value is OceanRewardPhase {
  return value === null || OCEAN_REWARD_PHASES.includes(value as Exclude<OceanRewardPhase, null>);
}

function clampStickerRevealCount(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) ? Math.max(0, Math.min(3, value)) : 0;
}

function isOceanLevel(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 2 && value <= 5;
}

function uniqueOceanLevels(value: unknown): number[] {
  return uniqueLevels(value).filter((level) => level >= 2 && level <= 5);
}

function uniqueOceanStickers(value: unknown): OceanDiscoveryStickerId[] {
  if (!Array.isArray(value)) return [];
  const valid = new Set<OceanDiscoveryStickerId>([2, 3, 4, 5].flatMap((level) => [...oceanStickersForLevel(level)]));
  return [...new Set(value.filter((id): id is OceanDiscoveryStickerId => typeof id === "string" && valid.has(id as OceanDiscoveryStickerId)))];
}

function migrateVersionFive(raw: Record<string, unknown>): FtueProgress {
  const migrated = createFtueProgress();
  const rewardGranted = raw.level2RewardGranted === true;
  return {
    ...migrated,
    hasCompletedFTUE: raw.hasCompletedFTUE === true,
    skipped: raw.skipped === true,
    completedBeats: Array.isArray(raw.completedBeats) ? raw.completedBeats.filter((beat): beat is FtueBeat => FTUE_BEATS.includes(beat as FtueBeat)) : [],
    completedTutorials: Array.isArray(raw.completedTutorials) ? raw.completedTutorials as FtueTutorialId[] : [],
    grantedCredits: Array.isArray(raw.grantedCredits) ? raw.grantedCredits as FtueCreditId[] : [],
    albumUnlocked: raw.albumUnlocked === true,
    unlockedAlbumPages: uniqueLevels(raw.unlockedAlbumPages),
    viewedAlbumPages: uniqueLevels(raw.viewedAlbumPages),
    completedVisualSteps: Array.isArray(raw.completedVisualSteps) ? raw.completedVisualSteps.filter(isFtueVisualStep) : [],
    level1ResultsAcknowledged: raw.level1ResultsAcknowledged === true,
    level1CompletionResult: parseCompletionResult(raw.level1CompletionResult),
    oceanRewardLevel: rewardGranted ? 2 : null,
    oceanRewardPhase: isOceanRewardPhase(raw.level2RewardPhase) ? raw.level2RewardPhase as OceanRewardPhase : null,
    oceanRewardedLevels: rewardGranted ? [2] : [],
    oceanCollectedStickers: rewardGranted && Number(raw.level2StickerRevealCount) >= 3 ? [...oceanStickersForLevel(2)] : [],
    oceanStickerRevealCount: rewardGranted ? clampStickerRevealCount(raw.level2StickerRevealCount) : 0,
    oceanCompletionResult: parseCompletionResult(raw.level2CompletionResult),
    oceanPackMessageDismissed: raw.level2PackMessageDismissed === true,
    oceanAlbumMessageDismissed: raw.level2AlbumMessageDismissed === true,
    introVideoSeen: true,
    pendingMandatoryStep: raw.pendingMandatoryStep === "OPEN_LEVEL_2_ALBUM" || raw.pendingMandatoryStep === "VIEW_LEVEL_2_ALBUM" ? raw.pendingMandatoryStep : null,
  };
}

function parseCompletionResult(value: unknown): FtueCompletionResult | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const numericKeys: Array<keyof Omit<FtueCompletionResult, "longestWord">> = [
    "score", "combo", "correct", "attempts", "hints", "elapsedSeconds", "accuracy", "stars",
    "baseCoins", "eventCoins", "totalCoins", "bestCombo", "invalidSelections",
  ];
  if (numericKeys.some((key) => typeof candidate[key] !== "number" || !Number.isFinite(candidate[key]))) return null;
  return {
    score: candidate.score as number,
    combo: candidate.combo as number,
    correct: candidate.correct as number,
    attempts: candidate.attempts as number,
    hints: candidate.hints as number,
    longestWord: typeof candidate.longestWord === "string" ? candidate.longestWord : "",
    elapsedSeconds: candidate.elapsedSeconds as number,
    accuracy: candidate.accuracy as number,
    stars: candidate.stars as number,
    baseCoins: candidate.baseCoins as number,
    eventCoins: candidate.eventCoins as number,
    totalCoins: candidate.totalCoins as number,
    bestCombo: candidate.bestCombo as number,
    invalidSelections: candidate.invalidSelections as number,
  };
}

function isFtueVisualStep(value: unknown): value is FtueVisualStep {
  return FTUE_VISUAL_STEPS.includes(value as FtueVisualStep);
}

export function completeFtueVisualStep(
  progress: FtueProgress,
  step: FtueVisualStep,
): FtueProgress {
  if (progress.completedVisualSteps.includes(step)) return progress;
  return {
    ...progress,
    completedVisualSteps: [...progress.completedVisualSteps, step],
  };
}

export function completeLevel2Guidance(progress: FtueProgress): FtueProgress {
  return {
    ...progress,
    pendingMandatoryStep: null,
  };
}

export function migrateFtueProgress(
  stored: (Omit<Partial<FtueProgress>, "version"> & { version?: number }) | undefined,
  local: FtueProgress,
  completedLevels: readonly number[],
): FtueProgress {
  if (stored?.version === 6) {
    return parseFtueProgress(JSON.stringify(stored));
  }
  if (stored?.version === 5) {
    const parsed = parseFtueProgress(JSON.stringify(stored));
    const completedOceanLevels = uniqueOceanLevels(completedLevels);
    const inferredRewardedLevels = completedOceanLevels.filter(
      (level) => level !== parsed.oceanRewardLevel || parsed.oceanRewardPhase === null,
    );
    const rewardedOceanLevels = uniqueOceanLevels([
      ...parsed.oceanRewardedLevels,
      ...inferredRewardedLevels,
    ]);
    return {
      ...parsed,
      albumUnlocked: parsed.albumUnlocked || rewardedOceanLevels.length > 0,
      unlockedAlbumPages: uniqueLevels([
        ...parsed.unlockedAlbumPages,
        ...rewardedOceanLevels,
      ]),
      oceanRewardedLevels: rewardedOceanLevels,
      oceanCollectedStickers: uniqueOceanStickers([
        ...parsed.oceanCollectedStickers,
        ...rewardedOceanLevels.flatMap((level) => [...oceanStickersForLevel(level)]),
      ]),
    };
  }
  const completed = uniqueLevels(completedLevels);
  if (!completed.length) return local;
  const levelTwoComplete = completed.includes(2);
  const rewardedOceanLevels = completed.filter((level) => level >= 2 && level <= 5);
  return {
    ...createFtueProgress(),
    introVideoSeen: true,
    hasCompletedFTUE: completed.includes(10),
    skipped: local.skipped,
    completedBeats: local.completedBeats,
    completedTutorials: completed.flatMap((level) => {
      if (level === 1) return ["level-1-drag"] as FtueTutorialId[];
      if (level === 2) return ["level-2-album"] as FtueTutorialId[];
      if (level === 3) return ["level-3-hint", "level-3-raid"] as FtueTutorialId[];
      if (level === 4) return ["level-4-bonus"] as FtueTutorialId[];
      if (level === 6) return ["level-6-shield"] as FtueTutorialId[];
      if (level === 7) return ["level-7-attack"] as FtueTutorialId[];
      if (level === 8) return ["level-8-steal"] as FtueTutorialId[];
      return [];
    }),
    albumUnlocked: levelTwoComplete,
    unlockedAlbumPages: completed.filter((level) => level >= 2),
    viewedAlbumPages: completed.filter((level) => level >= 2),
    pendingMandatoryStep: null,
    completedVisualSteps: [
      ...(completed.includes(1) ? ["welcome-guidance", "first-word-guidance", "first-transformation"] as const : []),
      ...(completed.includes(2) ? ["level-2-rules-guidance"] as const : []),
    ],
    level1ResultsAcknowledged: completed.includes(1),
    oceanRewardedLevels: rewardedOceanLevels,
    oceanCollectedStickers: rewardedOceanLevels.flatMap((level) => [...oceanStickersForLevel(level)]),
  };
}

export function recordLevelOneCompletion(
  progress: FtueProgress,
  result: FtueCompletionResult,
): FtueProgress {
  return {
    ...progress,
    level1ResultsAcknowledged: false,
    level1CompletionResult: progress.level1CompletionResult ?? result,
  };
}

export function acknowledgeLevelOneResults(progress: FtueProgress): FtueProgress {
  if (!progress.level1CompletionResult) return progress;
  return {
    ...progress,
    level1ResultsAcknowledged: true,
    level1CompletionResult: null,
    pendingMandatoryStep: null,
  };
}

export function recordOceanLevelCompletion(progress: FtueProgress, level: number, result: FtueCompletionResult): FtueProgress {
  if (!isOceanLevel(level) || progress.oceanRewardedLevels.includes(level)) return progress;
  const credit = `level-${level}-discovery-pack` as FtueCreditId;
  return {
    ...progress,
    grantedCredits: progress.grantedCredits.includes(credit)
      ? progress.grantedCredits
      : [...progress.grantedCredits, credit],
    oceanRewardLevel: level,
    oceanRewardPhase: "RESULTS",
    oceanRewardedLevels: uniqueOceanLevels([...progress.oceanRewardedLevels, level]),
    oceanStickerRevealCount: 0,
    oceanCompletionResult: result,
    oceanPackMessageDismissed: true,
    oceanAlbumMessageDismissed: true,
  };
}

export function continueToOceanPack(progress: FtueProgress): FtueProgress {
  if (!progress.oceanRewardLevel || progress.oceanRewardPhase !== "RESULTS") return progress;
  return { ...progress, oceanRewardPhase: "PACK_READY" };
}

export function openOceanDiscoveryPack(progress: FtueProgress): FtueProgress {
  if (!progress.oceanRewardLevel || progress.oceanRewardPhase !== "PACK_READY") return progress;
  return {
    ...(progress.oceanRewardLevel === 2 ? completeFtueVisualStep(progress, "level-2-pack-opened") : progress),
    oceanRewardPhase: "STICKER_REVEAL",
  };
}

export function revealNextOceanSticker(progress: FtueProgress): FtueProgress {
  if (progress.oceanRewardPhase !== "STICKER_REVEAL" || !progress.oceanRewardLevel) return progress;
  return { ...progress, oceanStickerRevealCount: Math.min(3, progress.oceanStickerRevealCount + 1) };
}

export function completeOceanStickerPack(progress: FtueProgress): FtueProgress {
  if (!progress.oceanRewardLevel || progress.oceanStickerRevealCount < 3) return progress;
  const level = progress.oceanRewardLevel;
  return {
    ...(level === 2 ? completeFtueVisualStep(progress, "level-2-album-activated") : progress),
    albumUnlocked: true,
    unlockedAlbumPages: uniqueLevels([...progress.unlockedAlbumPages, level]),
    oceanCollectedStickers: uniqueOceanStickers([...progress.oceanCollectedStickers, ...oceanStickersForLevel(level)]),
    oceanRewardPhase: level === 2 ? "ALBUM_ACTIVATED" : level === 5 ? "KINGDOM_COMPLETE" : "PACK_COMPLETE",
  };
}

export function beginLevelTwoAlbumGuide(progress: FtueProgress): FtueProgress {
  if (progress.oceanRewardLevel !== 2 || progress.oceanRewardPhase !== "ALBUM_ACTIVATED") return progress;
  return {
    ...completeFtueVisualStep(progress, "level-2-album-guidance"),
    pendingMandatoryStep: "OPEN_LEVEL_2_ALBUM",
    oceanRewardPhase: "ALBUM_GUIDE",
  };
}

export function beginLevelTwoAlbumReveal(progress: FtueProgress): FtueProgress {
  if (progress.oceanRewardLevel !== 2 || (progress.oceanRewardPhase !== "ALBUM_GUIDE" && progress.oceanRewardPhase !== "ALBUM_REVEAL")) return progress;
  return { ...progress, pendingMandatoryStep: "VIEW_LEVEL_2_ALBUM", oceanRewardPhase: "ALBUM_REVEAL" };
}

export function finishOceanReward(progress: FtueProgress): FtueProgress {
  if (progress.oceanRewardPhase !== "PACK_COMPLETE" && progress.oceanRewardPhase !== "KINGDOM_COMPLETE") return progress;
  return {
    ...progress,
    oceanRewardLevel: null,
    oceanRewardPhase: null,
    oceanStickerRevealCount: 0,
    oceanCompletionResult: null,
  };
}

export function completeFtueTutorial(progress: FtueProgress, tutorial: FtueTutorialId): FtueProgress {
  if (progress.completedTutorials.includes(tutorial)) return progress;
  return { ...progress, completedTutorials: [...progress.completedTutorials, tutorial] };
}

export function grantFtueCredit(progress: FtueProgress, credit: FtueCreditId): FtueProgress {
  if (progress.grantedCredits.includes(credit)) return progress;
  return { ...progress, grantedCredits: [...progress.grantedCredits, credit] };
}

export function unlockAlbumPage(progress: FtueProgress, level: number): FtueProgress {
  const unlockedAlbumPages = uniqueLevels([...progress.unlockedAlbumPages, level]);
  return {
    ...progress,
    albumUnlocked: progress.albumUnlocked || level >= 2,
    unlockedAlbumPages,
  };
}

export function viewAlbumPage(progress: FtueProgress, level: number): FtueProgress {
  const viewedOceanPages = level >= 2 && level <= 5
    ? progress.unlockedAlbumPages.filter((page) => page >= 2 && page <= 5)
    : [level];
  const completingLevelTwoGuide = progress.oceanRewardLevel === 2;
  return {
    ...(completingLevelTwoGuide ? completeFtueVisualStep(progress, "level-2-album-view") : progress),
    viewedAlbumPages: uniqueLevels([...progress.viewedAlbumPages, ...viewedOceanPages]),
    pendingMandatoryStep: completingLevelTwoGuide ? null : progress.pendingMandatoryStep,
    oceanRewardLevel: completingLevelTwoGuide ? null : progress.oceanRewardLevel,
    oceanRewardPhase: completingLevelTwoGuide ? null : progress.oceanRewardPhase,
    oceanCompletionResult: completingLevelTwoGuide ? null : progress.oceanCompletionResult,
    oceanStickerRevealCount: completingLevelTwoGuide ? 0 : progress.oceanStickerRevealCount,
    completedTutorials: completingLevelTwoGuide && !progress.completedTutorials.includes("level-2-album")
      ? [...progress.completedTutorials, "level-2-album"]
      : progress.completedTutorials,
  };
}

export function unseenAlbumPages(progress: FtueProgress): number[] {
  return progress.unlockedAlbumPages.filter((level) => !progress.viewedAlbumPages.includes(level));
}

export function skipFtue(progress: FtueProgress): FtueProgress {
  return { ...progress, skipped: true, hasCompletedFTUE: true };
}

export function completeFtue(progress: FtueProgress): FtueProgress {
  return { ...progress, hasCompletedFTUE: true };
}

export function ftueGuidanceEnabled(progress: FtueProgress): boolean {
  return !progress.hasCompletedFTUE && !progress.skipped;
}

export function markIntroVideoSeen(progress: FtueProgress): FtueProgress {
  if (progress.introVideoSeen) return progress;
  return { ...progress, introVideoSeen: true };
}

export function ftueStallStage(
  idleMs: number,
  hintsUsed: number,
  progress: FtueProgress,
): FtueStallStage {
  if (!ftueGuidanceEnabled(progress) || idleMs < FTUE_OBJECTIVE_NUDGE_MS) return "NONE";
  if (idleMs < FTUE_SUGGESTION_MS) return "OBJECTIVES";
  if (idleMs < FTUE_HINT_OFFER_MS || hintsUsed >= FTUE_HINT_LIMIT) return "SUGGESTION";
  return "HINT";
}

export function isUsefulActivePath(selectedIds: string[], activePaths: string[][]): boolean {
  if (selectedIds.length < 2) return false;
  return activePaths.some((path) => {
    if (selectedIds.length > path.length) return false;
    const forward = path.slice(0, selectedIds.length);
    const reverse = [...path].reverse().slice(0, selectedIds.length);
    return (
      forward.every((id, index) => id === selectedIds[index]) ||
      reverse.every((id, index) => id === selectedIds[index])
    );
  });
}

export function createGoldenTutorialState(
  progress: FtueProgress = createFtueProgress(),
): GoldenTutorialState {
  if (!ftueGuidanceEnabled(progress) || progress.completedBeats.includes("FIRST_CHANGE")) {
    return {
      phase: "UNDERSTOOD",
      message: null,
      recommendedObjectiveId: null,
      firstSolvedObjectiveId: null,
      localSuccessorObjectiveId: null,
    };
  }
  if (progress.completedBeats.includes("FIRST_DRAG")) {
    return {
      phase: "FIRST_DRAG",
      message: null,
      recommendedObjectiveId: null,
      firstSolvedObjectiveId: null,
      localSuccessorObjectiveId: null,
    };
  }
  return {
    phase: "FIRST_WORD",
    message: "Swipe across the letters to find SHORE.",
    recommendedObjectiveId: "a0-shore",
    firstSolvedObjectiveId: null,
    localSuccessorObjectiveId: null,
  };
}

export function beginGoldenTutorialDrag(
  state: GoldenTutorialState,
): GoldenTutorialState {
  if (state.phase !== "FIRST_WORD") return state;
  return {
    ...state,
    phase: "FIRST_DRAG",
    message: null,
    recommendedObjectiveId: null,
  };
}

export function showGoldenDragInstruction(
  state: GoldenTutorialState,
): GoldenTutorialState {
  if (state.phase !== "FIRST_WORD") return state;
  return { ...state, message: "Swipe across the letters to find SHORE." };
}

export function acceptGoldenTutorialWord(
  state: GoldenTutorialState,
  objectiveId: string,
): GoldenTutorialState {
  if (state.phase !== "FIRST_WORD" && state.phase !== "FIRST_DRAG") return state;
  return {
    ...state,
    phase: "FIRST_WORD_ACCEPTED",
    message: null,
    recommendedObjectiveId: null,
    firstSolvedObjectiveId: objectiveId,
  };
}

export function showGoldenCauseExplanation(
  state: GoldenTutorialState,
): GoldenTutorialState {
  if (state.phase !== "FIRST_TRANSFORMATION" || state.message === "A new word appeared.") return state;
  return { ...state, message: "A new word appeared." };
}

export function revealGoldenTutorialTransformation(
  state: GoldenTutorialState,
  localSuccessorObjectiveId: string | null,
): GoldenTutorialState {
  if (state.phase !== "FIRST_WORD_ACCEPTED") return state;
  return {
    ...state,
    phase: "FIRST_TRANSFORMATION",
    message: "The board changed.",
    localSuccessorObjectiveId,
  };
}

export function completeGoldenTutorialCue(
  state: GoldenTutorialState,
): GoldenTutorialState {
  if (state.phase !== "FIRST_TRANSFORMATION") return state;
  return {
    ...state,
    phase: "UNDERSTOOD",
    message: null,
    localSuccessorObjectiveId: null,
  };
}

export function goldenTransitionPresentation(
  reducedMotion: boolean,
): GoldenTransitionPresentation {
  return {
    confirmationMs: 180,
    transformationMs: 320,
    totalInputLockMs: 500,
    visualMode: reducedMotion ? "CROSSFADE" : "FLIP",
  };
}
