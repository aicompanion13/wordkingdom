"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import areasJson from "@/game/v2/data/areas.json";
import type { AreaDefinition, BadgeAssignment, BadgeType, BoardSnapshot, PlayerSettings, Position, Tile } from "@/game/v2/types";
import { ScoreManager, scoringConfig } from "@/game/scoring/score-manager";
import type { ScoreManagerSnapshot } from "@/game/scoring/types";
import albumsJson from "@/game/v3/data/album_data.json";
import albumPagesJson from "@/game/v3/data/album_pages.json";
import chaptersJson from "@/game/v3/data/track_data.json";
import defaultPlayerJson from "@/game/v3/data/default-player.json";
import defaultPvpJson from "@/game/v3/data/pvp_state.json";
import oceanAlbumJson from "@/game/v3/data/ocean_album.json";
import { AlbumManager } from "@/game/v3/album-manager";
import { BadgeManager } from "@/game/v3/badge-manager";
import type { BadgeCollectionResult } from "@/game/v3/badge-manager";
import type { BoardSession, SessionActiveWord } from "@/game/v3/board-session";
import type { CanonicalBoardSnapshot } from "@/game/v3/canonical-board-state";
import {
  createGoldenBoardSession,
  createGeneratedBoardSession,
  generatedLevelForPlayerLevel,
  GENERATED_LEVELS,
  GOLDEN_LEVEL_1,
} from "@/game/v3/board-session-factory";
import { EconomyManagerV3, ENERGY_CAP, ENERGY_REGEN_MS } from "@/game/v3/economy-manager";
import { JuiceAnimationSystem } from "@/game/v3/juice-animation-system";
import type { FxPoint, JuiceEffect } from "@/game/v3/juice-animation-system";
import { ObjectiveManager } from "@/game/v3/objective-manager";
import { ObstacleManager } from "@/game/v3/obstacle-manager";
import { PackResolver } from "@/game/v3/pack-resolver";
import { PvpManager } from "@/game/v3/pvp-manager";
import { TrackManager } from "@/game/v3/track-manager";
import { chapterThemeForLevel } from "@/game/v3/chapter-theme";
import {
  createBonusWordAnimationPlan,
  createObjectiveWordAnimationPlan,
  WORD_WAVE_STAGGER_MS,
} from "@/game/v3/word-animation";
import {
  acceptGoldenTutorialWord,
  acknowledgeLevelOneResults,
  beginLevelTwoAlbumGuide,
  beginLevelTwoAlbumReveal,
  beginGoldenTutorialDrag,
  completeFtue,
  completeFtueTutorial,
  completeGoldenTutorialCue,
  completeFtueVisualStep,
  completeOceanStickerPack,
  continueToOceanPack,
  createFtueProgress,
  createGoldenTutorialState,
  FTUE_CAUSE_EXPLANATION_MS,
  FTUE_DRAG_NUDGE_MS,
  FTUE_HINT_LIMIT,
  ftueGuidanceEnabled,
  ftueStallStage,
  ftueStorageKey,
  grantFtueCredit,
  isUsefulActivePath,
  markFtueBeat,
  markIntroVideoSeen,
  migrateFtueProgress,
  finishOceanReward,
  openOceanDiscoveryPack,
  parseFtueProgress,
  recordLevelOneCompletion,
  recordOceanLevelCompletion,
  revealNextOceanSticker,
  revealGoldenTutorialTransformation,
  serializeFtueProgress,
  showGoldenCauseExplanation,
  showGoldenDragInstruction,
  skipFtue,
  unlockAlbumPage,
  unseenAlbumPages,
  viewAlbumPage,
} from "@/game/v3/golden-tutorial-state";
import type { FtueBeat, FtueProgress, FtueStallStage, GoldenTutorialState } from "@/game/v3/golden-tutorial-state";
import { OCEAN_ALBUM_STAGE_PLAN, OCEAN_STICKER_LABELS, oceanStickersForLevel, tutorialDefinition, visiblePowerKinds } from "@/game/v3/ftue-flow";
import type { FtueCreditId, FtueTutorialId, FtueVisualStep, OceanDiscoveryStickerId, OceanRewardPhase } from "@/game/v3/ftue-flow";
import type { CardAttackResult, IncomingCardActionResult, MetaTutorialId, PowerUpKind, PvpState, RaidSession, RivalProfile, StealSession } from "@/game/v3/pvp-types";
import type { AlbumDefinition, CardDefinition, ChapterDefinition, ObstacleState, PackResult, PackTier, TrackNode, V3PlayerState, V3RunSummary } from "@/game/v3/types";
import { JuiceFxLayer } from "./JuiceFxLayer";
import { ConceptCard, DiscoveryArtwork, FtueCoachmark } from "./FtueCoachmarks";
import base from "../v2/V2.module.css";
import styles from "./V3.module.css";

const areas = areasJson as AreaDefinition[];
const chapters = chaptersJson as ChapterDefinition[];
const albums = albumsJson as AlbumDefinition[];
type AlbumPageDefinition = {
  level: number;
  theme: "coral" | "forest";
  title: string;
  backgroundImage: string;
  backgroundPosition: string;
  treatment: string;
  sticker: { x: number; y: number; scale: number; icon: string; label: string };
};
const albumPages = albumPagesJson as AlbumPageDefinition[];
const oceanAlbum = oceanAlbumJson as {
  title: string;
  backgroundImage: string;
  stickers: Array<{ id: OceanDiscoveryStickerId; x: number; y: number; rotation: number; scale: number }>;
};
const track = new TrackManager(chapters, areas);
const albumManager = new AlbumManager(albums);
const INITIAL_COMBO = scoringConfig.comboLadder[0];
const COMBO_URGENT_RATIO = 7 / scoringConfig.comboIdleTimeoutSeconds;
const PACK_COSTS: Record<PackTier, number> = { GREEN: 500, BLUE: 1200, GOLD: 2500 };
const CARD_REPAIR_COST = 300;
const EMPTY_SCORE: ScoreManagerSnapshot = {
  score: 0,
  comboMultiplier: INITIAL_COMBO,
  bestCombo: INITIAL_COMBO,
  validSelections: 0,
  invalidSelections: 0,
  hintsUsed: 0,
  comboBreaks: 0,
  longestWord: "",
  wordsFound: 0,
  idleRemainingRatio: 0,
};
const BADGES: Record<BadgeType, { icon: string; label: string }> = {
  attack: { icon: "⚔️", label: "Attack" }, steal: { icon: "🃏", label: "Steal" }, raid: { icon: "💰", label: "Raid" }, shield: { icon: "🛡️", label: "Shield" },
};

const POWER_ORDER: readonly BadgeType[] = ["shield", "attack", "steal", "raid"];

type Screen = "hub" | "board" | "summary";
type Tab = "shop" | "teams" | "home" | "events" | "albums";
type GeneratedFlipPhase = "out" | "in" | null;
type AcceptedWordKind = "objective" | "bonus" | null;
type PlayerAccount = { displayName: string; email: string };
type PvpOverlayState =
  | { kind: "raid"; session: RaidSession; tutorial: boolean }
  | { kind: "attack"; target: RivalProfile; result: CardAttackResult | null; tutorial: boolean }
  | { kind: "steal"; target: RivalProfile; session: StealSession; tutorial: boolean; busy: boolean }
  | { kind: "shield"; protectedCardId: string | null; result: IncomingCardActionResult | null; tutorial: boolean };
type AlbumTransitionState = { level: number; kind: "bubbles" | "vines" | "fade" };
type LevelOneCoachState =
  | { kind: "welcome"; messageOpen: boolean }
  | { kind: "first-word"; messageOpen: boolean }
  | { kind: "level-2-rules"; messageOpen: boolean }
  | { kind: "transformation"; messageOpen: boolean }
  | null;

function freshPlayer(): V3PlayerState {
  const source = defaultPlayerJson as V3PlayerState;
  return {
    ...source,
    energyUpdatedAt: Date.now(),
    unlockedChapterIds: [...source.unlockedChapterIds],
    completedLevels: [...source.completedLevels],
    claimedSetRewards: [...source.claimedSetRewards],
    claimedAlbumRewards: [...source.claimedAlbumRewards],
    cards: { ...source.cards },
    royalDictionary: [...source.royalDictionary],
    recentWordsByArea: Object.fromEntries(Object.entries(source.recentWordsByArea).map(([key, value]) => [key, [...value]])),
    settings: { ...source.settings },
  };
}

function freshPvpState(): PvpState {
  const source = defaultPvpJson as PvpState;
  return {
    ...source,
    pvpHistory: [...source.pvpHistory],
    matchmakingQueue: source.matchmakingQueue.map((rival) => ({ ...rival, cards: rival.cards?.map((card) => ({ ...card })) ?? [] })),
    notificationOutbox: [...source.notificationOutbox],
    levelBriefingsAcknowledged: [...(source.levelBriefingsAcknowledged ?? [])],
    pendingSteal: source.pendingSteal ? structuredClone(source.pendingSteal) : null,
    pendingRaid: source.pendingRaid ? structuredClone(source.pendingRaid) : null,
    ftueProgress: structuredClone(source.ftueProgress ?? createFtueProgress()),
  };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en", { notation: value >= 10000 ? "compact" : "standard" }).format(value);
}

function formatResourceNumber(value: number): string {
  return new Intl.NumberFormat("en", { notation: value >= 1000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}

function energyTimer(player: V3PlayerState, now: number): string {
  if (player.energy >= ENERGY_CAP) return "FULL";
  const remaining = Math.max(0, ENERGY_REGEN_MS - (Math.max(0, now - player.energyUpdatedAt) % ENERGY_REGEN_MS));
  return `${Math.floor(remaining / 60000)}:${String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0")}`;
}

export default function WordKingdomV3({ account, signOutUrl }: { account: PlayerAccount; signOutUrl: string }) {
  const [hydrated, setHydrated] = useState(false);
  const [loginIntroOpen, setLoginIntroOpen] = useState(true);
  const [player, setPlayer] = useState<V3PlayerState>(freshPlayer);
  const [pvpState, setPvpState] = useState<PvpState>(freshPvpState);
  const [clock, setClock] = useState(0);
  const [screen, setScreen] = useState<Screen>("hub");
  const [tab, setTab] = useState<Tab>("home");
  const [viewChapterId, setViewChapterId] = useState("chapter_ocean");
  const [selectedNode, setSelectedNode] = useState<TrackNode | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [board, setBoard] = useState<BoardSnapshot | null>(null);
  const [activeWords, setActiveWords] = useState<SessionActiveWord[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [acceptedPathIds, setAcceptedPathIds] = useState<string[]>([]);
  const [transformationDiffIds, setTransformationDiffIds] = useState<string[]>([]);
  const [acceptedWordKind, setAcceptedWordKind] = useState<AcceptedWordKind>(null);
  const [neutralShakeIds, setNeutralShakeIds] = useState<string[]>([]);
  const [hintedId, setHintedId] = useState<string | null>(null);
  const [cascades, setCascades] = useState(0);
  const [score, setScore] = useState<ScoreManagerSnapshot>(EMPTY_SCORE);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [badgeCounts, setBadgeCounts] = useState<Record<BadgeType, number>>({ attack: 0, steal: 0, raid: 0, shield: 0 });
  const [juiceEffects, setJuiceEffects] = useState<JuiceEffect[]>([]);
  const [badgePopIds, setBadgePopIds] = useState<string[]>([]);
  const [trayImpactSlots, setTrayImpactSlots] = useState<string[]>([]);
  const [juiceShake, setJuiceShake] = useState(false);
  const [coinCounterPulse, setCoinCounterPulse] = useState(false);
  const [bonusWordsFound, setBonusWordsFound] = useState(0);
  const [pvpOverlay, setPvpOverlay] = useState<PvpOverlayState | null>(null);
  const [albumPageLevel, setAlbumPageLevel] = useState<number | null>(null);
  const [albumTransition, setAlbumTransition] = useState<AlbumTransitionState | null>(null);
  const [tutorialLibraryOpen, setTutorialLibraryOpen] = useState(false);
  const [contextualPrompt, setContextualPrompt] = useState<string | null>(null);
  const [obstacles, setObstacles] = useState<ObstacleState | null>(null);
  const [objectiveProgress, setObjectiveProgress] = useState({ current: 0, target: 5, complete: false });
  const [summary, setSummary] = useState<V3RunSummary | null>(null);
  const [packReveal, setPackReveal] = useState<PackResult | null>(null);
  const [message, setMessage] = useState("Find one of the active words");
  const [animating, setAnimating] = useState(false);
  const [shake, setShake] = useState(false);
  const [generatedLevelSeed, setGeneratedLevelSeed] = useState(GENERATED_LEVELS[0].seed);
  const [generatedRun, setGeneratedRun] = useState<{ seed: number; totalWords: number; qa: boolean } | null>(null);
  const [goldenRun, setGoldenRun] = useState(false);
  const [goldenReplayIndex, setGoldenReplayIndex] = useState(0);
  const [goldenReplayPlan, setGoldenReplayPlan] = useState<string[]>([]);
  const [goldenTutorial, setGoldenTutorial] = useState<GoldenTutorialState>(createGoldenTutorialState);
  const [ftueProgress, setFtueProgress] = useState<FtueProgress>(createFtueProgress);
  const [ftueReady, setFtueReady] = useState(false);
  const [ftueStall, setFtueStall] = useState<FtueStallStage>("NONE");
  const [ftueFocusIds, setFtueFocusIds] = useState<string[]>([]);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [generatedObstacleTypes, setGeneratedObstacleTypes] = useState<Record<string, string>>({});
  const [generatedFlipPhase, setGeneratedFlipPhase] = useState<GeneratedFlipPhase>(null);
  const [canonicalDebug, setCanonicalDebug] = useState<CanonicalBoardSnapshot | null>(null);
  const [levelOneCoach, setLevelOneCoach] = useState<LevelOneCoachState>(null);

  const economy = useRef<EconomyManagerV3 | null>(null);
  const pvp = useRef<PvpManager | null>(null);
  const boardSession = useRef<BoardSession | null>(null);
  const scorer = useRef<ScoreManager | null>(null);
  const scoreIdleUnsubscribe = useRef<(() => void) | null>(null);
  const badges = useRef<BadgeManager | null>(null);
  const juice = useRef(new JuiceAnimationSystem());
  const juiceTimers = useRef<number[]>([]);
  const objective = useRef<ObjectiveManager | null>(null);
  const obstacleEngine = useRef<ObstacleManager | null>(null);
  const runNode = useRef<TrackNode | null>(null);
  const runArea = useRef<AreaDefinition>(areas[0]);
  const runStartedAt = useRef(0);
  const totalPausedMs = useRef(0);
  const pauseStartedAt = useRef(0);
  const pendingFinish = useRef(false);
  const resumeAfterPack = useRef(false);
  const eventCoins = useRef(0);
  const hintsUsedRef = useRef(0);
  const selection = useRef<string[]>([]);
  const tutorialResume = useRef<(() => void) | null>(null);
  const levelOneAutoStarted = useRef(false);
  const dragStart = useRef<Position | null>(null);
  const dragging = useRef(false);
  const cloudReady = useRef(false);
  const cloudSaveTimer = useRef<number | null>(null);
  const cloudSaveInFlight = useRef<Promise<void> | null>(null);
  const ftueLastUsefulAt = useRef(Date.now());
  const ftueProgressRef = useRef(ftueProgress);
  const ftueFirstChangeAt = useRef(0);
  const completedMetaLevel = useRef(0);
  const stealResolutionLock = useRef(false);
  const ftueRecoveryAttempted = useRef(false);
  const albumButtonRef = useRef<HTMLButtonElement>(null);
  const levelPlayButtonRef = useRef<HTMLButtonElement>(null);

  const queueCloudSave = (nextPlayer: V3PlayerState, nextPvp: PvpState) => {
    if (!cloudReady.current) return;
    if (cloudSaveTimer.current !== null) window.clearTimeout(cloudSaveTimer.current);
    cloudSaveTimer.current = window.setTimeout(() => {
      cloudSaveTimer.current = null;
      const request = (cloudSaveInFlight.current ?? Promise.resolve())
        .catch(() => undefined)
        .then(() => fetch("/api/player", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ player: nextPlayer, pvp: nextPvp }),
        }))
        .then((response) => {
          if (!response.ok) throw new Error("Account save failed");
        });
      cloudSaveInFlight.current = request;
      void request
        .catch(() => setToast("Progress is safe locally, but cloud sync needs a retry."))
        .finally(() => {
          if (cloudSaveInFlight.current === request) cloudSaveInFlight.current = null;
        });
    }, 180);
  };

  const persistPvp = (next = pvp.current?.snapshot()) => {
    if (!next) return;
    if (badges.current) badges.current = new BadgeManager(next.badgeProgress, next.readyActions);
    setPvpState(next);
    setBadgeCounts(next.badgeProgress);
    const nextPlayer = economy.current?.snapshot() ?? player;
    queueCloudSave(nextPlayer, next);
  };

  const persist = (next: V3PlayerState) => {
    setPlayer(next);
    const nextPvp = pvp.current
      ? pvp.current.syncCoinBank(next.coins)
      : pvpState;
    if (badges.current) badges.current = new BadgeManager(nextPvp.badgeProgress, nextPvp.readyActions);
    setPvpState(nextPvp);
    queueCloudSave(next, nextPvp);
  };

  const updateFtueProgress = (updater: (current: FtueProgress) => FtueProgress) => {
    const next = updater(ftueProgressRef.current);
    ftueProgressRef.current = next;
    setFtueProgress(next);
    try {
      window.localStorage.setItem(ftueStorageKey(account.email), serializeFtueProgress(next));
    } catch {
      // Account persistence remains authoritative when browser storage is unavailable.
    }
    if (pvp.current) {
      const nextPvp = pvp.current.setFtueProgress(next);
      setPvpState(nextPvp);
      queueCloudSave(economy.current?.snapshot() ?? player, nextPvp);
    }
  };

  const recordFtueBeat = (beat: FtueBeat) => {
    updateFtueProgress((current) => markFtueBeat(current, beat));
  };

  useEffect(() => {
    try {
      const next = parseFtueProgress(window.localStorage.getItem(ftueStorageKey(account.email)));
      ftueProgressRef.current = next;
      setFtueProgress(next);
    } catch {
      const next = createFtueProgress();
      ftueProgressRef.current = next;
      setFtueProgress(next);
    }
    setFtueReady(true);
  }, [account.email]);

  useEffect(() => {
    let active = true;
    void fetch("/api/player", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Account load failed");
        return response.json() as Promise<{ player: V3PlayerState; pvp: PvpState }>;
      })
      .then(({ player: savedPlayer, pvp: savedPvp }) => {
        if (!active) return;
        const restored = {
          ...freshPlayer(),
          ...savedPlayer,
          settings: { ...freshPlayer().settings, ...savedPlayer.settings },
          cards: { ...savedPlayer.cards },
          royalDictionary: [...(savedPlayer.royalDictionary ?? [])],
          recentWordsByArea: { ...freshPlayer().recentWordsByArea, ...savedPlayer.recentWordsByArea },
        };
        economy.current = new EconomyManagerV3(restored);
        const localFtue = parseFtueProgress(window.localStorage.getItem(ftueStorageKey(account.email)));
        const migratedFtue = migrateFtueProgress(savedPvp.ftueProgress, localFtue, restored.completedLevels);
        pvp.current = new PvpManager({ ...savedPvp, ftueProgress: migratedFtue });
        const next = economy.current.snapshot();
        const nextPvp = pvp.current.syncCoinBank(next.coins);
        setPlayer(next);
        setPvpState(nextPvp);
        ftueProgressRef.current = migratedFtue;
        setFtueProgress(migratedFtue);
        setLoginIntroOpen(!migratedFtue.introVideoSeen);
        try { window.localStorage.setItem(ftueStorageKey(account.email), serializeFtueProgress(migratedFtue)); } catch { /* Cloud save is authoritative. */ }
        setBadgeCounts(nextPvp.badgeProgress);
        setViewChapterId(track.chapterForLevel(next.currentLevel).chapterId);
        const pendingSteal = pvp.current.pendingStealSession();
        const pendingTarget = pendingSteal ? pvp.current.rival(pendingSteal.targetId) : null;
        if (pendingSteal && pendingTarget) {
          setPvpOverlay({ kind: "steal", target: pendingTarget, session: pendingSteal, tutorial: pendingSteal.tutorial, busy: false });
        } else {
          const pendingRaid = pvp.current.pendingRaidSession();
          if (pendingRaid) setPvpOverlay({ kind: "raid", session: pendingRaid, tutorial: migratedFtue.pendingTutorialAction === "raid" });
        }
        cloudReady.current = true;
        setHydrated(true);
      })
      .catch(() => {
        if (!active) return;
        const restored = freshPlayer();
        const restoredPvp = freshPvpState();
        economy.current = new EconomyManagerV3(restored);
        pvp.current = new PvpManager(restoredPvp);
        setPlayer(economy.current.snapshot());
        const normalizedPvp = pvp.current.snapshot();
        setPvpState(normalizedPvp);
        setBadgeCounts(normalizedPvp.badgeProgress);
        setToast("Your account could not sync yet. Please reload once.");
        setHydrated(true);
      });
    return () => {
      active = false;
      if (cloudSaveTimer.current !== null) window.clearTimeout(cloudSaveTimer.current);
    };
  }, []);

  useEffect(() => {
    setClock(Date.now());
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => () => scoreIdleUnsubscribe.current?.(), []);

  useEffect(() => () => {
    juiceTimers.current.forEach((timer) => window.clearTimeout(timer));
    juiceTimers.current = [];
  }, []);

  useEffect(() => {
    if (!hydrated || !economy.current || player.energy >= ENERGY_CAP) return;
    const next = economy.current.regenerate(clock);
    if (next.energy !== player.energy) persist(next);
  }, [clock, hydrated, player.energy]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!hydrated || !ftueReady || screen !== "hub" || summary) return;
    const progress = ftueProgressRef.current;
    const result = progress.level1CompletionResult ?? progress.oceanCompletionResult;
    const level = progress.level1CompletionResult ? 1 : progress.oceanRewardLevel ?? 0;
    if (!result || !level) return;
    if (level >= 2 && (!progress.oceanRewardPhase || progress.oceanRewardPhase === "ALBUM_GUIDE" || progress.oceanRewardPhase === "ALBUM_REVEAL")) return;
    const node = track.node(level);
    setSummary({ ...result, node, objectiveComplete: true, reward: node.reward });
    setScreen("summary");
  }, [ftueReady, hydrated, screen, summary]);

  useEffect(() => {
    if (screen !== "summary" || !ftueProgress.oceanCompletionResult || !ftueProgress.oceanRewardLevel) return;
    const phase = ftueProgress.oceanRewardPhase;
    if (phase !== "STICKER_REVEAL") return;
    const revealCount = ftueProgress.oceanStickerRevealCount;
    const timer = window.setTimeout(() => {
      updateFtueProgress(revealCount < 3 ? revealNextOceanSticker : completeOceanStickerPack);
    }, prefersReducedMotion ? 180 : revealCount < 3 ? 540 : 620);
    return () => window.clearTimeout(timer);
  }, [ftueProgress.oceanRewardPhase, ftueProgress.oceanCompletionResult, ftueProgress.oceanRewardLevel, ftueProgress.oceanStickerRevealCount, prefersReducedMotion, screen]);

  const activeChapter = track.chapterForLevel(player.currentLevel);
  const viewedChapter = track.chapter(viewChapterId) ?? activeChapter;
  const activeArea = areas.find((area) => area.areaId === activeChapter.areaId) ?? areas[0];
  const activeAlbum = albumManager.album(activeChapter.albumId);
  const albumUnseenCount = unseenAlbumPages(ftueProgress).length;
  const currentRunLevel = runNode.current?.level ?? player.currentLevel;
  const visiblePowers = visiblePowerKinds(currentRunLevel);
  const shoreTutorialPath = activeWords.find((word) => word.id === "a0-shore")?.tileIds ?? [];
  const standardHintVisible = currentRunLevel >= 4
    || (currentRunLevel === 3 && (contextualPrompt !== null || ftueProgress.completedTutorials.includes("level-3-hint")))
    || (currentRunLevel === 2 && Math.max(0, clock - ftueLastUsefulAt.current) >= 10_000);
  const badgeByTile = useMemo(() => {
    const result = new Map<string, BadgeType>();
    const level = runNode.current?.level ?? player.currentLevel;
    const allowed = new Set(visiblePowerKinds(level));
    activeWords.forEach((word) => word.badges.forEach((badge) => {
      if (allowed.has(badge.type)) result.set(badge.tileId, badge.type);
    }));
    return result;
  }, [activeWords, player.currentLevel, currentRunLevel]);

  const obstacleTileIds = useMemo(
    () => new Set([...(obstacles?.tileIds ?? []), ...Object.keys(generatedObstacleTypes)]),
    [obstacles, generatedObstacleTypes],
  );
  const boardLocked = animating || Boolean(levelOneCoach?.messageOpen) || pvpOverlay !== null || packReveal !== null || settingsOpen || Boolean(boardSession.current && !boardSession.current.canAcceptInput());
  const comboDrain = score.comboMultiplier === INITIAL_COMBO ? 0 : scorer.current?.snapshot(clock).idleRemainingRatio ?? score.idleRemainingRatio;
  const comboUrgent = comboDrain > 0 && comboDrain <= COMBO_URGENT_RATIO;
  const runStepTarget = generatedRun?.totalWords ?? 5;
  const isQaRun = generatedRun?.qa ?? false;
  const isGoldenRun = goldenRun && Boolean(generatedRun);
  const ftueActive = isGoldenRun && ftueGuidanceEnabled(ftueProgress);
  const goldenCompletedWords = isGoldenRun
    ? (canonicalDebug?.completedObjectives ?? []).map((id) =>
        GOLDEN_LEVEL_1.objectives.find((objective) => objective.id === id)?.word,
      ).filter((word): word is string => Boolean(word))
    : [];
  const goldenLockedCount = isGoldenRun ? canonicalDebug?.queuedObjectives.length ?? 0 : 0;

  useEffect(() => {
    if (screen !== "board" || !ftueActive) {
      setFtueStall("NONE");
      return;
    }
    if (boardLocked) return;
    const idleMs = Math.max(0, clock - ftueLastUsefulAt.current);
    const nextStall = ftueStallStage(idleMs, hintsUsedRef.current, ftueProgress);
    setFtueStall(nextStall);
    if (goldenTutorial.phase === "FIRST_WORD" && idleMs >= FTUE_DRAG_NUDGE_MS) {
      setGoldenTutorial((current) => showGoldenDragInstruction(current));
      setMessage("Swipe across the letters to find SHORE.");
      return;
    }
    if ((nextStall === "SUGGESTION" || nextStall === "HINT") && goldenTutorial.phase !== "FIRST_WORD") {
      setMessage("Find either word.");
    }
  }, [boardLocked, clock, ftueActive, ftueProgress, goldenTutorial.phase, screen]);

  useEffect(() => {
    const hintTutorialComplete = ftueProgress.completedTutorials.includes("level-3-hint");
    if (screen !== "board" || currentRunLevel !== 3 || hintTutorialComplete || boardLocked) return;
    const idleMs = Math.max(0, clock - ftueLastUsefulAt.current);
    if (idleMs >= 8_000) setContextualPrompt("Need help? Tap Hint to reveal your next move.");
  }, [boardLocked, clock, currentRunLevel, ftueProgress.completedTutorials, screen]);

  const scheduleJuice = (callback: () => void, delayMs: number) => {
    const timer = window.setTimeout(callback, delayMs);
    juiceTimers.current.push(timer);
    return timer;
  };

  const clearJuiceFx = () => {
    juiceTimers.current.forEach((timer) => window.clearTimeout(timer));
    juiceTimers.current = [];
    setJuiceEffects([]);
    setBadgePopIds([]);
    setTrayImpactSlots([]);
    setJuiceShake(false);
    setCoinCounterPulse(false);
  };

  const elementCenter = (element: Element): FxPoint => {
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };

  const selectedPathCenter = (tileIds: readonly string[]): FxPoint => {
    const points = tileIds
      .map((tileId) => document.querySelector(`[data-v3-tile-id="${tileId}"]`))
      .filter((element): element is Element => element !== null)
      .map(elementCenter);
    if (points.length === 0) {
      return { x: window.innerWidth / 2, y: Math.min(window.innerHeight * 0.52, 440) };
    }
    return {
      x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
      y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    };
  };

  const queueBadgeFx = (result: BadgeCollectionResult): number => {
    if (result.arrivals.length === 0) {
      setBadgeCounts(result.counts);
      return Date.now();
    }

    const startedAt = Date.now();
    const effects = result.arrivals.flatMap((arrival) => {
      const source = document.querySelector(`[data-v3-tile-id="${arrival.sourceTileId}"]`);
      const target = document.querySelector(`[data-badge-slot="${arrival.type}-${arrival.targetSlotIndex}"]`);
      if (!source || !target) return [];
      return [juice.current.createBadgeFly({
        badgeType: arrival.type,
        sourceTileId: arrival.sourceTileId,
        targetSlotIndex: arrival.targetSlotIndex,
        source: elementCenter(source),
        target: elementCenter(target),
        now: startedAt,
      })];
    });

    if (effects.length === 0) {
      setBadgeCounts(result.counts);
      return startedAt;
    }

    const durationMs = Math.max(...effects.map((effect) => effect.durationMs));
    const effectIds = new Set(effects.map((effect) => effect.id));
    const impactSlots = result.arrivals.map((arrival) => `${arrival.type}-${arrival.targetSlotIndex}`);
    setBadgePopIds(result.arrivals.map((arrival) => arrival.sourceTileId));
    setJuiceEffects((current) => [...current, ...effects]);
    scheduleJuice(() => setBadgePopIds([]), 150);
    scheduleJuice(() => {
      setBadgeCounts(result.displayCounts);
      setTrayImpactSlots(impactSlots);
      setJuiceShake(true);
    }, durationMs);
    scheduleJuice(() => {
      setTrayImpactSlots([]);
      setJuiceShake(false);
    }, durationMs + 110);
    if (result.createdActions.length) scheduleJuice(() => setBadgeCounts(result.counts), durationMs + 170);
    scheduleJuice(() => setJuiceEffects((current) => current.filter((effect) => !effectIds.has(effect.id))), durationMs + 240);
    return startedAt + durationMs + (result.createdActions.length ? 180 : 0);
  };

  const saveBadgeResult = (result: BadgeCollectionResult | undefined) => {
    if (!result || !pvp.current) return;
    persistPvp(pvp.current.syncPowerUps(result.counts, result.readyActions));
  };

  const queueCoinFx = (source: FxPoint, amount: number, includeVaultReveal = false): number => {
    const counter = document.querySelector("[data-coin-counter]");
    if (!counter) return 0;
    const coinEffect = juice.current.createCoinShower({ amount, source, target: elementCenter(counter) });
    const effects: JuiceEffect[] = includeVaultReveal
      ? [juice.current.createVaultReveal({ center: source, amount }), coinEffect]
      : [coinEffect];
    const effectIds = new Set(effects.map((effect) => effect.id));
    const durationMs = Math.max(...effects.map((effect) => effect.durationMs));
    setJuiceEffects((current) => [...current, ...effects]);
    scheduleJuice(() => setCoinCounterPulse(true), Math.max(0, durationMs - 180));
    scheduleJuice(() => setCoinCounterPulse(false), durationMs + 40);
    scheduleJuice(() => setJuiceEffects((current) => current.filter((effect) => !effectIds.has(effect.id))), durationMs + 180);
    return durationMs;
  };

  const queueCombatFx = (blocked: boolean, coinsWon: number) => {
    const center = { x: window.innerWidth / 2, y: Math.min(window.innerHeight * 0.48, 420) };
    const effect = juice.current.createCombatImpact({ blocked, center });
    setJuiceEffects((current) => [...current, effect]);
    scheduleJuice(() => setJuiceEffects((current) => current.filter((candidate) => candidate.id !== effect.id)), effect.durationMs + 140);
    if (!blocked) queueCoinFx(center, coinsWon);
  };

  const openPack = (tier: PackTier): PackResult => {
    const chapter = runNode.current ? track.chapter(runNode.current.chapterId) ?? activeChapter : activeChapter;
    const album = albumManager.album(chapter.albumId);
    const resolver = new PackResolver(Date.now() ^ player.currentLevel * 701);
    const result = resolver.open(tier, album, economy.current?.snapshot() ?? player);
    economy.current?.applyPack(result);
    if (economy.current) persist(economy.current.snapshot());
    setPackReveal(result);
    return result;
  };

  const startRun = (node = track.node(player.currentLevel)) => {
    const replayingCompletedLevel = player.completedLevels.includes(node.level);
    if (node.level !== player.currentLevel && !replayingCompletedLevel) { setToast("Reach this node first."); return; }
    if (node.kind === "MILESTONE") {
      if (!economy.current) return;
      economy.current.completeNode(node, 0, 0);
      const chapter = track.chapter(node.chapterId) ?? activeChapter;
      const result = new PackResolver(Date.now() ^ node.level).open("GREEN", albumManager.album(chapter.albumId), economy.current.snapshot());
      economy.current.applyPack(result);
      persist(economy.current.snapshot());
      setSelectedNode(null);
      setPackReveal(result);
      setToast("Milestone chest claimed — no Energy spent!");
      return;
    }
    const freeFtueLevel = node.level <= 2 && !player.completedLevels.includes(node.level);
    if (!freeFtueLevel && !economy.current?.spendEnergy(1)) { setToast("You need one Energy ticket to play."); return; }
    clearJuiceFx();
    if (!freeFtueLevel && economy.current) persist(economy.current.snapshot());
    const area = areas.find((candidate) => candidate.areaId === node.areaId) ?? areas[0];
    const activatedAt = Date.now();
    const isGoldenFtueLevel = node.level === 1;
    const generatedLevel = isGoldenFtueLevel ? null : generatedLevelForPlayerLevel(node.level);
    const session = isGoldenFtueLevel
      ? createGoldenBoardSession(GOLDEN_LEVEL_1, activatedAt)
      : createGeneratedBoardSession(generatedLevel!, activatedAt);
    session.setActiveShields(pvpState.activeShields);
    const activatedWords = session.activeWords();
    const nextObjective = new ObjectiveManager({
      kind: "WORDS",
      target: session.totalWords,
      label: node.objective.label,
    });
    runNode.current = node;
    runArea.current = area;
    boardSession.current = session;
    const nextScorer = new ScoreManager(activatedAt);
    scoreIdleUnsubscribe.current?.();
    scoreIdleUnsubscribe.current = nextScorer.on("OnComboBreak", (event) => {
      if (event.reason === "idle-timeout") setScore(nextScorer.snapshot());
    });
    scorer.current = nextScorer;
    const savedPowerUps = pvp.current?.snapshot() ?? pvpState;
    badges.current = isGoldenFtueLevel ? null : new BadgeManager(savedPowerUps.badgeProgress, savedPowerUps.readyActions);
    objective.current = nextObjective;
    obstacleEngine.current = null;
    runStartedAt.current = activatedAt;
    totalPausedMs.current = 0;
    pauseStartedAt.current = 0;
    pendingFinish.current = false;
    resumeAfterPack.current = false;
    eventCoins.current = 0;
    hintsUsedRef.current = 0;
    setGeneratedRun({ seed: isGoldenFtueLevel ? GOLDEN_LEVEL_1.seed : generatedLevel!.seed, totalWords: session.totalWords, qa: false });
    setGoldenRun(isGoldenFtueLevel);
    setGoldenReplayPlan([]);
    setGoldenTutorial(createGoldenTutorialState(ftueProgress));
    setLevelOneCoach(isGoldenFtueLevel && ftueGuidanceEnabled(ftueProgressRef.current) && !ftueProgressRef.current.completedVisualSteps.includes("welcome-guidance")
      ? { kind: "welcome", messageOpen: true }
      : isGoldenFtueLevel && ftueGuidanceEnabled(ftueProgressRef.current) && !ftueProgressRef.current.completedVisualSteps.includes("first-word-guidance")
      ? { kind: "first-word", messageOpen: true }
      : node.level === 2 && ftueGuidanceEnabled(ftueProgressRef.current) && !ftueProgressRef.current.completedVisualSteps.includes("level-2-rules-guidance")
      ? { kind: "level-2-rules", messageOpen: true }
      : null);
    ftueLastUsefulAt.current = activatedAt;
    ftueFirstChangeAt.current = 0;
    setFtueStall("NONE");
    setFtueFocusIds([]);
    setGeneratedObstacleTypes(Object.fromEntries(session.obstacleMarkers().map((marker) => [marker.tileId, marker.type])));
    setGeneratedFlipPhase(null);
    setBoard(session.snapshot());
    setCanonicalDebug(session.debugSnapshot());
    setActiveWords(activatedWords);
    setObstacles(null);
    setObjectiveProgress(nextObjective.progress());
    setScore(nextScorer.snapshot());
    setHintsUsed(0);
    setBadgeCounts(savedPowerUps.badgeProgress);
    setPvpOverlay(null);
    stealResolutionLock.current = false;
    setSelectedIds([]);
    setAcceptedPathIds([]);
    setTransformationDiffIds([]);
    setAcceptedWordKind(null);
    setBonusWordsFound(0);
    setNeutralShakeIds([]);
    setContextualPrompt(null);
    selection.current = [];
    setCascades(0);
    setSummary(null);
    setSelectedNode(null);
    setMessage(isGoldenFtueLevel && ftueGuidanceEnabled(ftueProgress)
      ? "Swipe across the letters to find SHORE."
      : node.kind === "BOSS"
        ? "Defeat the guardian with living words"
        : "The Current reveals fresh words");
    setScreen("board");
  };

  const requestLevelStart = (node = track.node(player.currentLevel)) => {
    setSelectedNode(null);
    startRun(node);
  };

  useEffect(() => {
    if (loginIntroOpen || !hydrated || !ftueReady || levelOneAutoStarted.current || screen !== "hub" || player.currentLevel !== 1 || player.completedLevels.includes(1) || ftueProgress.level1CompletionResult) return;
    levelOneAutoStarted.current = true;
    startRun(track.node(1));
  }, [ftueReady, hydrated, loginIntroOpen, player.completedLevels, player.currentLevel, screen]);

  const startGeneratedLevel = (seed: number) => {
    const level = GENERATED_LEVELS.find((candidate) => candidate.seed === seed);
    if (!level) { setToast(`Generated level ${seed} is unavailable.`); return; }
    clearJuiceFx();
    const activatedAt = Date.now();
    const session = createGeneratedBoardSession(level, activatedAt);
    boardSession.current = session;
    runNode.current = track.node(player.currentLevel);
    runArea.current = activeArea;
    const nextScorer = new ScoreManager(activatedAt);
    scoreIdleUnsubscribe.current?.();
    scoreIdleUnsubscribe.current = nextScorer.on("OnComboBreak", (event) => {
      if (event.reason === "idle-timeout") setScore(nextScorer.snapshot());
    });
    scorer.current = nextScorer;
    badges.current = null;
    objective.current = null;
    obstacleEngine.current = null;
    runStartedAt.current = activatedAt;
    totalPausedMs.current = 0;
    pauseStartedAt.current = 0;
    pendingFinish.current = false;
    resumeAfterPack.current = false;
    eventCoins.current = 0;
    hintsUsedRef.current = 0;
    setGeneratedRun({ seed, totalWords: session.totalWords, qa: true });
    setGoldenRun(false);
    setGoldenReplayPlan([]);
    setFtueStall("NONE");
    setFtueFocusIds([]);
    setGeneratedObstacleTypes(Object.fromEntries(session.obstacleMarkers().map((marker) => [marker.tileId, marker.type])));
    setGeneratedFlipPhase(null);
    setBoard(session.snapshot());
    setCanonicalDebug(session.debugSnapshot());
    setActiveWords(session.activeWords());
    setObstacles(null);
    setObjectiveProgress({ current: 0, target: session.totalWords, complete: false });
    setScore(nextScorer.snapshot());
    setHintsUsed(0);
    setBadgeCounts(pvp.current?.snapshot().badgeProgress ?? pvpState.badgeProgress);
    setPvpOverlay(null);
    setPackReveal(null);
    setSelectedIds([]);
    setAcceptedPathIds([]);
    setTransformationDiffIds([]);
    setAcceptedWordKind(null);
    setBonusWordsFound(0);
    setNeutralShakeIds([]);
    selection.current = [];
    setCascades(0);
    setSummary(null);
    setSelectedNode(null);
    setDebugOpen(false);
    setMessage(`Generated seed ${seed} · tiles transmute in place`);
    setScreen("board");
  };

  const startGoldenLevel = (replayIndex = goldenReplayIndex) => {
    clearJuiceFx();
    const activatedAt = Date.now();
    const session = createGoldenBoardSession(GOLDEN_LEVEL_1, activatedAt);
    const debug = session.debugSnapshot();
    const replayPlan = debug?.authored?.replayMoveOrders[replayIndex] ?? [];
    boardSession.current = session;
    runNode.current = track.node(player.currentLevel);
    runArea.current = activeArea;
    const nextScorer = new ScoreManager(activatedAt);
    scoreIdleUnsubscribe.current?.();
    scoreIdleUnsubscribe.current = nextScorer.on("OnComboBreak", (event) => {
      if (event.reason === "idle-timeout") setScore(nextScorer.snapshot());
    });
    scorer.current = nextScorer;
    badges.current = null;
    objective.current = null;
    obstacleEngine.current = null;
    runStartedAt.current = activatedAt;
    totalPausedMs.current = 0;
    pauseStartedAt.current = 0;
    pendingFinish.current = false;
    resumeAfterPack.current = false;
    eventCoins.current = 0;
    hintsUsedRef.current = 0;
    setGeneratedRun({ seed: GOLDEN_LEVEL_1.seed, totalWords: session.totalWords, qa: true });
    setGoldenRun(true);
    setGoldenReplayIndex(replayIndex);
    setGoldenReplayPlan(replayPlan);
    setGoldenTutorial(createGoldenTutorialState(ftueProgress));
    setLevelOneCoach(ftueGuidanceEnabled(ftueProgressRef.current) && !ftueProgressRef.current.completedVisualSteps.includes("first-word-guidance")
      ? { kind: "first-word", messageOpen: true }
      : null);
    ftueLastUsefulAt.current = activatedAt;
    ftueFirstChangeAt.current = 0;
    setFtueStall("NONE");
    setFtueFocusIds([]);
    setGeneratedObstacleTypes({});
    setGeneratedFlipPhase(null);
    setBoard(session.snapshot());
    setCanonicalDebug(debug);
    setActiveWords(session.activeWords());
    setObstacles(null);
    setObjectiveProgress({ current: 0, target: session.totalWords, complete: false });
    setScore(nextScorer.snapshot());
    setHintsUsed(0);
    setBadgeCounts(pvp.current?.snapshot().badgeProgress ?? pvpState.badgeProgress);
    setPvpOverlay(null);
    setPackReveal(null);
    setSelectedIds([]);
    setAcceptedPathIds([]);
    setTransformationDiffIds([]);
    setAcceptedWordKind(null);
    setBonusWordsFound(0);
    setNeutralShakeIds([]);
    selection.current = [];
    setCascades(0);
    setSummary(null);
    setSelectedNode(null);
    setDebugOpen(false);
    setContextualPrompt(null);
    setMessage(ftueGuidanceEnabled(ftueProgress) ? "Swipe across the letters to find SHORE." : "Find either active word");
    setScreen("board");
  };

  const markTutorialComplete = (tutorial: FtueTutorialId) => {
    updateFtueProgress((current) => completeFtueTutorial(current, tutorial));
  };

  const ensureFtueCredit = (credit: FtueCreditId, grant: () => void): boolean => {
    if (ftueProgressRef.current.grantedCredits.includes(credit)) return false;
    grant();
    updateFtueProgress((current) => grantFtueCredit(current, credit));
    return true;
  };

  const markFtueVisualStep = (step: FtueVisualStep) => {
    updateFtueProgress((current) => completeFtueVisualStep(current, step));
  };

  const dismissWelcomeCoach = () => {
    markFtueVisualStep("welcome-guidance");
    setLevelOneCoach(ftueGuidanceEnabled(ftueProgressRef.current) && !ftueProgressRef.current.completedVisualSteps.includes("first-word-guidance")
      ? { kind: "first-word", messageOpen: true }
      : null);
  };

  const dismissLevelTwoRulesCoach = () => {
    markFtueVisualStep("level-2-rules-guidance");
    setLevelOneCoach(null);
  };

  const refreshPowerState = () => {
    if (!pvp.current) return;
    const next = pvp.current.snapshot();
    badges.current = new BadgeManager(next.badgeProgress, next.readyActions);
    setBadgeCounts(next.badgeProgress);
    persistPvp(next);
  };

  const openAlbumPage = (level: number) => {
    if (!ftueProgressRef.current.unlockedAlbumPages.includes(level)) return;
    const theme = chapterThemeForLevel(level);
    updateFtueProgress((current) => level === 2
      ? beginLevelTwoAlbumReveal(current)
      : current);
    setAlbumTransition({ level, kind: theme.albumTransition });
    const transitionMs = prefersReducedMotion ? 220 : theme.albumTransition === "bubbles" ? 2250 : 900;
    window.setTimeout(() => {
      setScreen("hub");
      setTab("albums");
      setAlbumPageLevel(level);
      setAlbumTransition(null);
    }, transitionMs);
  };

  const openLatestAlbumPage = () => {
    const unseen = unseenAlbumPages(ftueProgressRef.current);
    const level = unseen.at(-1) ?? ftueProgressRef.current.unlockedAlbumPages.at(-1);
    if (level) {
      if (level === 2) {
        markFtueVisualStep("level-2-album-guidance");
        updateFtueProgress(beginLevelTwoAlbumReveal);
      }
      openAlbumPage(level);
    }
  };

  const continueFromAlbumPage = () => {
    if (!albumPageLevel) return;
    const viewedLevel = albumPageLevel;
    if (viewedLevel === 2) markFtueVisualStep("level-2-album-view");
    updateFtueProgress((current) => viewAlbumPage(current, viewedLevel));
    setAlbumPageLevel(null);
    setTab("home");
    setToast(viewedLevel >= 2 && viewedLevel <= 5 ? "Ocean Album saved." : `Level ${viewedLevel} Album page viewed.`);
  };

  const finishRun = () => {
    if (!scorer.current || !economy.current || !runNode.current || !objective.current) return;
    const scoreSnapshot = scorer.current.snapshot();
    const elapsedSeconds = Math.max(1, Math.round((Date.now() - runStartedAt.current - totalPausedMs.current) / 1000));
    const attempts = scoreSnapshot.validSelections + scoreSnapshot.invalidSelections;
    const accuracy = attempts ? scoreSnapshot.validSelections / attempts : 1;
    // Preserve the existing V3 summary/economy behavior; the new mastery layer remains out of scope for this step.
    let stars = 1;
    if (scoreSnapshot.score >= 2600 && accuracy >= 0.75) stars = 2;
    if (scoreSnapshot.score >= 4500 && accuracy >= 0.9 && hintsUsedRef.current <= 1) stars = 3;
    const baseCoins = Math.max(100, Math.round(scoreSnapshot.score / 8));
    const starMultiplier = stars === 3 ? 1.5 : stars === 2 ? 1.25 : 1;
    const baseSummary = {
      score: scoreSnapshot.score,
      combo: scoreSnapshot.comboMultiplier,
      correct: scoreSnapshot.validSelections,
      attempts,
      hints: hintsUsedRef.current,
      longestWord: scoreSnapshot.longestWord,
      elapsedSeconds,
      accuracy,
      stars,
      baseCoins,
      eventCoins: eventCoins.current,
      totalCoins: Math.round(baseCoins * starMultiplier) + eventCoins.current,
      bestCombo: scoreSnapshot.bestCombo,
      invalidSelections: scoreSnapshot.invalidSelections,
    };
    const progress = objective.current.progress();
    let rewardPack: PackResult | undefined;
    economy.current.rememberWords(
      runNode.current.areaId,
      boardSession.current?.shownWords() ?? [],
    );
    if (progress.complete) {
      const oceanRewardPending = runNode.current.level >= 2
        && runNode.current.level <= 5
        && !ftueProgressRef.current.oceanRewardedLevels.includes(runNode.current.level);
      const deferForestUnlock = runNode.current.level === 5 && oceanRewardPending;
      economy.current.completeNode(runNode.current, baseSummary.totalCoins, baseSummary.stars, !deferForestUnlock);
      if (runNode.current.level === 1) {
        updateFtueProgress((current) => recordLevelOneCompletion(current, baseSummary));
      } else if (oceanRewardPending) {
        updateFtueProgress((current) => recordOceanLevelCompletion(current, runNode.current!.level, baseSummary));
      } else if (runNode.current.level > 5) {
        updateFtueProgress((current) => unlockAlbumPage(current, runNode.current!.level));
      }
      if (runNode.current.level === 10) {
        updateFtueProgress((current) => completeFtue(current));
      }
      if (runNode.current.reward.pack && runNode.current.level > 5) {
        const chapter = track.chapter(runNode.current.chapterId) ?? activeChapter;
        rewardPack = new PackResolver(Date.now() ^ runNode.current.level).open(runNode.current.reward.pack, albumManager.album(chapter.albumId), economy.current.snapshot());
        economy.current.applyPack(rewardPack);
      }
    }
    persist(economy.current.snapshot());
    setSummary({ ...baseSummary, node: runNode.current, objectiveComplete: progress.complete, reward: runNode.current.reward, packResult: rewardPack });
    setAnimating(false);
    setScreen("summary");
    if (progress.complete) window.setTimeout(() => beginPostLevelMeta(runNode.current!.level), 420);
  };

  const ownedCards = (): CardDefinition[] => albums
    .flatMap((album) => album.sets.flatMap((set) => set.cards))
    .filter((card, index, all) => player.cards[card.cardId] > 0 && all.findIndex((item) => item.cardId === card.cardId) === index);

  const launchPowerUp = (kind: PowerUpKind, tutorial = false) => {
    if (!pvp.current) return;
    const target = pvp.current.firstOpponent();
    if (kind === "raid") {
      const session = pvp.current.createRaid();
      if (session) {
        persistPvp();
        setPvpOverlay({ kind: "raid", session, tutorial });
      }
      return;
    }
    if (kind === "steal") {
      const session = pvp.current.beginStealSession(target.playerId, tutorial);
      if (!session) {
        setToast("No eligible rival cards are available. Your Steal is saved.");
        return;
      }
      const selectedTarget = pvp.current.rival(session.targetId);
      if (!selectedTarget) return;
      persistPvp();
      setPvpOverlay({ kind: "steal", target: selectedTarget, session, tutorial: session.tutorial, busy: false });
      return;
    }
    if (kind === "attack") setPvpOverlay({ kind: "attack", target, result: null, tutorial });
    if (kind === "shield") setPvpOverlay({ kind: "shield", protectedCardId: null, result: null, tutorial });
  };

  const launchNextMeta = (level = completedMetaLevel.current) => {
    if (!pvp.current) return;
    const state = pvp.current.snapshot();
    const unlocked: PowerUpKind[] = [
      ...(level >= 3 ? ["raid" as const] : []),
      ...(level >= 6 ? ["shield" as const] : []),
      ...(level >= 7 ? ["attack" as const] : []),
      ...(level >= 8 ? ["steal" as const] : []),
    ];
    const next = unlocked.find((kind) => state.readyActions[kind] > 0);
    if (next) launchPowerUp(next);
  };

  const beginPostLevelMeta = (level: number) => {
    if (!pvp.current) return;
    completedMetaLevel.current = level;
    const tutorial = pvp.current.pendingTutorial(level);
    if (tutorial && tutorial !== "album") {
      const creditByPower: Partial<Record<PowerUpKind, FtueCreditId>> = {
        raid: "level-3-raid-action",
        shield: "level-6-shield-action",
        attack: "level-7-attack-action",
        steal: "level-8-steal-action",
      };
      const credit = creditByPower[tutorial];
      if (credit) {
        ensureFtueCredit(credit, () => {
          if (pvp.current!.snapshot().readyActions[tutorial] < 1) pvp.current!.addReadyAction(tutorial);
        });
      }
      persistPvp();
      updateFtueProgress((current) => ({ ...current, pendingTutorialAction: tutorial }));
      launchPowerUp(tutorial, true);
      return;
    }
    launchNextMeta(level);
  };

  const chooseAttackCard = (cardId: string) => {
    if (pvpOverlay?.kind !== "attack" || pvpOverlay.result || !pvp.current) return;
    const result = pvpOverlay.tutorial
      ? pvp.current.attackTutorialCard(pvpOverlay.target.playerId, cardId)
      : pvp.current.attackCard(pvpOverlay.target.playerId, cardId);
    if (!result) return;
    persistPvp();
    queueCombatFx(result.blocked, 0);
    setPvpOverlay({ ...pvpOverlay, result, target: result.target });
  };

  const performSteal = () => {
    if (pvpOverlay?.kind !== "steal" || pvpOverlay.session.status === "resolved" || pvpOverlay.busy || !pvp.current || stealResolutionLock.current) return;
    stealResolutionLock.current = true;
    setPvpOverlay({ ...pvpOverlay, busy: true });
    try {
      const resolved = pvp.current.resolveStealSession(pvpOverlay.session.id);
      if (!resolved?.result) {
        setToast("No eligible rival cards are available. Your Steal is saved.");
        setPvpOverlay({ ...pvpOverlay, busy: false });
        return;
      }
      const result = resolved.result;
      if (!result.blocked && result.card && economy.current && pvp.current.claimStealReward(resolved.id)) {
        const next = economy.current.snapshot();
        next.cards[result.card.cardId] = (next.cards[result.card.cardId] ?? 0) + 1;
        economy.current.replace(next);
        persist(next);
      } else {
        persistPvp();
      }
      const savedSession = pvp.current.pendingStealSession() ?? resolved;
      setPvpOverlay({ kind: "steal", session: savedSession, target: result.target, tutorial: pvpOverlay.tutorial, busy: false });
    } finally {
      stealResolutionLock.current = false;
    }
  };

  const deferSteal = () => {
    if (pvpOverlay?.kind !== "steal" || pvpOverlay.busy || pvpOverlay.session.status !== "ready") return;
    persistPvp();
    setPvpOverlay(null);
    setToast("Steal saved. You can use it after a later level.");
  };

  const chooseShieldCard = (cardId: string) => {
    if (pvpOverlay?.kind !== "shield" || pvpOverlay.protectedCardId || !pvp.current) return;
    const protectedCard = pvp.current.protectCard(cardId);
    if (!protectedCard) return;
    const result = pvpOverlay.tutorial ? pvp.current.simulateIncomingCardAction(cardId) : null;
    persistPvp();
    setPvpOverlay({ ...pvpOverlay, protectedCardId: cardId, result });
  };

  const pickRaidChest = (chestId: string, source?: FxPoint) => {
    if (pvpOverlay?.kind !== "raid" || !pvp.current || pvpOverlay.session.complete) return;
    const next = pvp.current.pickRaid(pvpOverlay.session, chestId);
    const openedChest = next.chests.find((chest) => chest.id === chestId);
    if (source && openedChest) queueCoinFx(source, openedChest.coins, true);
    setPvpOverlay({ ...pvpOverlay, session: next });
  };

  const closePvpOverlay = () => {
    if (!pvpOverlay) return;
    if (pvpOverlay.kind === "raid" && !pvpOverlay.session.complete) return;
    if (pvpOverlay.kind === "attack" && !pvpOverlay.result) return;
    if (pvpOverlay.kind === "steal") {
      if (pvpOverlay.session.status !== "resolved" || !pvp.current) return;
      pvp.current.completeStealSession(pvpOverlay.session.id);
      if (pvpOverlay.tutorial) pvp.current.completeTutorial("steal");
      persistPvp();
      if (pvpOverlay.tutorial) markTutorialComplete("level-8-steal");
      if (pvpOverlay.tutorial) updateFtueProgress((current) => ({ ...current, pendingTutorialAction: null }));
      setPvpOverlay(null);
      window.setTimeout(() => launchNextMeta(), 180);
      return;
    }
    if (pvpOverlay.kind === "shield" && !pvpOverlay.protectedCardId) return;
    if (pvp.current) {
      if (pvpOverlay.kind === "raid" && !pvpOverlay.session.awarded && economy.current) {
        const awarded = pvp.current.awardRaid(pvpOverlay.session);
        const next = economy.current.snapshot();
        next.coins += awarded.coinsWon;
        economy.current.replace(next);
        persist(next);
      }
      if (pvpOverlay.kind === "raid") {
        pvp.current.completeRaidSession(pvpOverlay.session.id);
        persistPvp();
      }
      const tutorial: MetaTutorialId | null = pvpOverlay.tutorial ? pvpOverlay.kind : null;
      if (tutorial) {
        persistPvp(pvp.current.completeTutorial(tutorial));
        const ftueTutorial: Partial<Record<PowerUpKind, FtueTutorialId>> = {
          shield: "level-6-shield",
          attack: "level-7-attack",
          steal: "level-8-steal",
          raid: "level-3-raid",
        };
        const completed = ftueTutorial[tutorial];
        if (completed) markTutorialComplete(completed);
        updateFtueProgress((current) => ({ ...current, pendingTutorialAction: null }));
      }
    }
    setPvpOverlay(null);
    window.setTimeout(() => launchNextMeta(), 180);
  };

  useEffect(() => {
    if (!hydrated || ftueRecoveryAttempted.current || !pvp.current) return;
    ftueRecoveryAttempted.current = true;
    const recoverableLevel = [8, 7, 6, 3].find((level) => player.completedLevels.includes(level) && pvp.current?.pendingTutorial(level));
    if (!recoverableLevel) return;
    const tutorial = pvp.current.pendingTutorial(recoverableLevel);
    if (tutorial && tutorial !== "album") {
      if (pvp.current.snapshot().readyActions[tutorial] < 1 && ftueProgressRef.current.pendingTutorialAction === tutorial && tutorial !== "steal" && tutorial !== "raid") {
        pvp.current.addReadyAction(tutorial);
        persistPvp();
      }
      window.setTimeout(() => beginPostLevelMeta(recoverableLevel), 250);
    }
  }, [hydrated, player.completedLevels]);

  const closePackReveal = () => {
    setPackReveal(null);
    resumeAfterPack.current = false;
  };

  const solveCanonicalWord = (
    word: SessionActiveWord,
    points: number,
    physicalTileIds: string[],
    rewardBadges: BadgeAssignment[],
  ) => {
    const session = boardSession.current;
    if (!session || boardLocked) return;
    const generatedSeed = generatedRun?.seed;
    const isQaRun = generatedRun?.qa ?? false;
    const transformationDiff = session.transitionTileIdsForObjective(word.id);
    const animationPlan = createObjectiveWordAnimationPlan(
      physicalTileIds,
      transformationDiff,
      prefersReducedMotion,
    );
    objective.current?.recordWord();
    const badgeResult = badges.current?.collect({ badges: rewardBadges });
    if (badgeResult) {
      queueBadgeFx(badgeResult);
      saveBadgeResult(badgeResult);
    }
    setAnimating(true);
    setAcceptedWordKind("objective");
    setAcceptedPathIds([...animationPlan.acceptedPath]);
    setSelectedIds([...animationPlan.acceptedPath]);
    setTransformationDiffIds([...animationPlan.transformationDiff]);
    setGeneratedFlipPhase(null);
    setMessage(isGoldenRun ? "" : `+${formatNumber(points)} · ${word.word} is transmuting`);

    window.setTimeout(() => {
      if (boardSession.current !== session) return;
      const commitTransformation = () => {
      let result;
      try {
        result = session.solve(word, Date.now());
      } catch (error) {
        setGeneratedFlipPhase(null);
        setTransformationDiffIds([]);
        setAcceptedPathIds([]);
        setAcceptedWordKind(null);
        setSelectedIds([]);
        setAnimating(false);
        setMessage(error instanceof Error ? error.message : "Generated transmutation failed");
        return;
      }

      setTransformationDiffIds(result.flippedTileIds);
      setBoard(result.board);
      setActiveWords(result.activeWords);
      setCanonicalDebug(session.debugSnapshot());
      setCascades(result.solved);
      setObjectiveProgress({
        current: result.solved,
        target: result.total,
        complete: result.complete,
      });
      setSelectedIds([]);
      selection.current = [];
      setGeneratedFlipPhase("in");
      window.setTimeout(() => {
        if (boardSession.current !== session) return;
        session.settleTransitions(Date.now());
        setCanonicalDebug(session.debugSnapshot());
        setBoard(session.snapshot());
        setActiveWords(session.activeWords());
        setTransformationDiffIds([]);
        setAcceptedPathIds([]);
        setAcceptedWordKind(null);
        setSelectedIds([]);
        setGeneratedFlipPhase(null);
        const releaseOrFinish = () => {
          if (result.complete) {
            if (isQaRun) {
              setAnimating(false);
              setMessage(isGoldenRun ? "Golden Level 1 complete · every authored branch verified" : `Generated seed ${generatedSeed} complete · all maps verified`);
            } else {
              setMessage("Kingdom transmutation complete!");
              window.setTimeout(finishRun, 260);
            }
          } else if (!session.canAcceptInput()) {
            const debug = session.debugSnapshot();
            setMessage(debug?.recoveryReason ?? debug?.lastValidationResult.message ?? "Canonical board validation requires attention");
            setAnimating(false);
          } else {
            if (isGoldenRun) setMessage(`${word.word} complete`);
            else if (result.revealedWord) setMessage(`${word.word} flipped to reveal ${result.revealedWord}`);
            else setMessage(`${word.word} transmuted in place`);
            setAnimating(false);
          }
        };

        if (isGoldenRun && result.solved === 1 && ftueGuidanceEnabled(ftueProgressRef.current)) {
          const localSuccessorId = session.debugSnapshot()?.authored?.selectedBranch?.localSuccessor?.objectiveId ?? null;
          setGoldenTutorial((current) => revealGoldenTutorialTransformation(current, localSuccessorId));
          recordFtueBeat("FIRST_CHANGE");
          ftueFirstChangeAt.current = Date.now();
          ftueLastUsefulAt.current = ftueFirstChangeAt.current;
          setFtueFocusIds(result.flippedTileIds);
          scheduleJuice(() => setFtueFocusIds([]), 650);
          if (!ftueProgressRef.current.completedVisualSteps.includes("first-transformation")) {
            tutorialResume.current = () => {
              markFtueVisualStep("first-transformation");
              setLevelOneCoach(null);
              releaseOrFinish();
            };
            setLevelOneCoach({ kind: "transformation", messageOpen: true });
          } else {
            releaseOrFinish();
          }
        } else {
          if (isGoldenRun && result.solved === 2 && ftueActive && !ftueProgressRef.current.completedBeats.includes("SECOND_SOLVE")) {
            recordFtueBeat("SECOND_SOLVE");
            ftueLastUsefulAt.current = Date.now();
            setMessage("Nice — two in a row!");
          }
          releaseOrFinish();
        }
      }, animationPlan.flipInMs);
      };
      setAcceptedPathIds([]);
      setSelectedIds([]);
      setAcceptedWordKind(null);
      setGeneratedFlipPhase("out");
      window.setTimeout(commitTransformation, animationPlan.flipOutMs);
    }, animationPlan.acceptedWaveMs);
  };

  const solveWord = (
    word: SessionActiveWord,
    points: number,
    physicalTileIds: string[],
    rewardBadges: BadgeAssignment[],
  ) => {
    if (generatedRun) {
      solveCanonicalWord(word, points, physicalTileIds, rewardBadges);
      return;
    }
    const session = boardSession.current;
    if (boardLocked || !session || !scorer.current || !badges.current || !objective.current) return;
    setAnimating(true);
    setAcceptedWordKind("objective");
    setAcceptedPathIds(physicalTileIds);
    setSelectedIds(physicalTileIds);
    setTransformationDiffIds(word.tileIds);
    const legacyAnimationPlan = createObjectiveWordAnimationPlan(
      physicalTileIds,
      word.tileIds,
      prefersReducedMotion,
    );
    objective.current.recordWord();
    const clearedObstacles = obstacleEngine.current?.clear(word.tileIds) ?? 0;
    objective.current.recordObstacles(clearedObstacles);
    setObjectiveProgress(objective.current.progress());
    setObstacles(obstacleEngine.current?.snapshot() ?? null);
    const badgeResult = badges.current.collect({ badges: rewardBadges });
    queueBadgeFx(badgeResult);
    saveBadgeResult(badgeResult);
    setMessage(`+${formatNumber(points)} · ${word.word}${clearedObstacles ? ` · ${clearedObstacles} obstacle cleared` : ""}`);
    window.setTimeout(() => {
      if (boardSession.current !== session) return;
      const result = session.solve(word, Date.now());
      const nextCascade = result.solved;
      setCascades(nextCascade);
      setTransformationDiffIds([]);
      setAcceptedPathIds([]);
      setAcceptedWordKind(null);
      setSelectedIds([]);
      selection.current = [];
      setBoard(result.board);
      if (result.complete) {
        setAnimating(false);
        window.setTimeout(finishRun, 360);
        return;
      }
      setActiveWords(result.activeWords);
      setObstacles(obstacleEngine.current?.seed(result.activeWords) ?? null);
      setAnimating(false);
      if (result.suppressedShieldConversions) setMessage("Shield storage full · Blue badge converted to Raid Gold");
      else setMessage(`${Math.max(0, runStepTarget - nextCascade)} word flips remain`);
    }, legacyAnimationPlan.acceptedWaveMs + legacyAnimationPlan.transformationMs);
  };

  const celebrateBonusWord = (
    wordId: string,
    word: string,
    points: number,
    physicalTileIds: string[],
    rewardBadges: BadgeAssignment[],
    acceptedAt: number,
  ) => {
    const session = boardSession.current;
    const scoreManager = scorer.current;
    if (!session || !scoreManager || boardLocked) return;
    const animationPlan = createBonusWordAnimationPlan(
      physicalTileIds,
      prefersReducedMotion,
    );
    const rewardSource = selectedPathCenter(animationPlan.acceptedPath);
    const scoreEvent = scoreManager.onBonusWordSolved(
      wordId,
      word,
      points,
      acceptedAt,
    );
    const badgeResult = badges.current?.collect({ badges: rewardBadges });
    if (badgeResult) saveBadgeResult(badgeResult);
    const nextPlayer = economy.current?.awardBonusWord(word, scoreEvent.points);
    if (nextPlayer) persist(nextPlayer);

    setAnimating(true);
    setAcceptedWordKind("bonus");
    setAcceptedPathIds([...animationPlan.acceptedPath]);
    setSelectedIds([...animationPlan.acceptedPath]);
    setScore(scoreManager.snapshot(acceptedAt));
    setBonusWordsFound((count) => count + 1);
    const bonusTutorialVisible = (runNode.current?.level ?? player.currentLevel) >= 4;
    const shouldTeachBonus = (runNode.current?.level ?? player.currentLevel) === 4
      && !ftueProgressRef.current.completedTutorials.includes("level-4-bonus");
    if (shouldTeachBonus) markTutorialComplete("level-4-bonus");
    setMessage(bonusTutorialVisible
      ? shouldTeachBonus
        ? "Bonus Word! It was added to your Royal Dictionary."
        : `Bonus Word! ${word} · +${formatNumber(scoreEvent.points)} Coins`
      : "");

    window.setTimeout(() => {
      if (boardSession.current !== session) return;
      const badgeFinishedAt = badgeResult ? queueBadgeFx(badgeResult) : Date.now();
      const coinFxMs = bonusTutorialVisible ? queueCoinFx(rewardSource, scoreEvent.points) : 0;
      setActiveWords(session.activeWords());
      setAcceptedPathIds([]);
      setSelectedIds([]);
      setAcceptedWordKind(null);
      selection.current = [];
      const rewardSettleMs = Math.max(
        prefersReducedMotion ? 120 : 260,
        coinFxMs,
        badgeFinishedAt - Date.now(),
      );
      window.setTimeout(() => {
        if (boardSession.current !== session) return;
        setAnimating(false);
        setMessage("Find either word.");
      }, rewardSettleMs);
    }, animationPlan.acceptedWaveMs);
  };

  const noteUsefulFtueInteraction = () => {
    ftueLastUsefulAt.current = Date.now();
    setFtueStall("NONE");
    setFtueFocusIds([]);
    if (!ftueActive) return;
    if (goldenTutorial.phase === "FIRST_WORD") {
      setGoldenTutorial((current) => beginGoldenTutorialDrag(current));
      recordFtueBeat("FIRST_DRAG");
      markFtueVisualStep("first-word-guidance");
      setLevelOneCoach(null);
      setMessage("");
    } else if (goldenTutorial.phase === "FIRST_TRANSFORMATION") {
      setGoldenTutorial((current) => completeGoldenTutorialCue(current));
      setMessage("");
    }
  };

  const updateSelection = (path: Position[]) => {
    const ids = boardSession.current?.tileIdsForPath(path) ?? [];
    selection.current = ids;
    setSelectedIds(ids);
    return ids;
  };

  const submitSelection = () => {
    if (
      selection.current.length < 2 ||
      boardLocked ||
      !boardSession.current?.canAcceptInput()
    ) {
      selection.current = [];
      setSelectedIds([]);
      return;
    }
    const session = boardSession.current;
    const scoreManager = scorer.current;
    if (!session || !scoreManager) return;
    const matchTimestamp = Date.now();
    const result = session.acceptSelection(
      selection.current,
      matchTimestamp,
      (word, acceptedAt) => scoreManager.onWordSolved(word, acceptedAt),
    );
    if (result.kind === "accepted") {
      if (isGoldenRun) {
        noteUsefulFtueInteraction();
        setGoldenTutorial((current) =>
          acceptGoldenTutorialWord(current, result.word.id),
        );
        setMessage("");
      }
      setCanonicalDebug(session.debugSnapshot());
      setScore(scoreManager.snapshot(matchTimestamp));
      solveWord(
        result.word,
        result.score.points,
        result.tileIds,
        result.rewards,
      );
      return;
    }
    if (result.kind === "bonus") {
      celebrateBonusWord(
        result.wordId,
        result.word,
        result.points,
        result.tileIds,
        result.rewards,
        matchTimestamp,
      );
      return;
    }
    if (result.kind === "neutral") {
      setNeutralShakeIds(result.tileIds);
      selection.current = [];
      setSelectedIds([]);
      window.setTimeout(() => setNeutralShakeIds([]), 260);
      return;
    }
    scoreManager.onInvalidSelection(matchTimestamp);
    setScore(scoreManager.snapshot(matchTimestamp));
    setMessage("Try another path");
    setNeutralShakeIds(result.tileIds);
    window.setTimeout(() => setNeutralShakeIds([]), 240);
    selection.current = [];
    setSelectedIds([]);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>, tile: Tile) => {
    if (boardLocked || !boardSession.current?.canAcceptInput()) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = true;
    dragStart.current = { row: tile.row, col: tile.col };
    updateSelection([{ row: tile.row, col: tile.col }]);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const session = boardSession.current;
    if (boardLocked || !dragging.current || !dragStart.current || !session) return;
    const element = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-v3-tile-id]");
    const tile = board?.tiles.flat().find((candidate) => candidate.id === element?.dataset.v3TileId);
    if (!tile) return;
    const path = session.pathBetween(dragStart.current, tile);
    if (path.length) {
      const ids = updateSelection(path);
      if (isUsefulActivePath(ids, activeWords.map((word) => word.tileIds))) noteUsefulFtueInteraction();
    }
  };

  const onPointerUp = () => {
    dragging.current = false;
    dragStart.current = null;
    if (!boardLocked && selection.current.length > 1) submitSelection();
  };

  const onPointerCancel = () => {
    dragging.current = false;
    dragStart.current = null;
    selection.current = [];
    setSelectedIds([]);
  };

  const onKeyboardTile = (tile: Tile) => {
    if (boardLocked) return;
    if (selection.current.length === 0 || selection.current.length > 1) { updateSelection([tile]); return; }
    const first = board?.tiles.flat().find((candidate) => candidate.id === selection.current[0]);
    const session = boardSession.current;
    if (!first || !session) return;
    const path = session.pathBetween(first, tile);
    if (path.length > 1) {
      const ids = updateSelection(path);
      if (isUsefulActivePath(ids, activeWords.map((word) => word.tileIds))) noteUsefulFtueInteraction();
      window.setTimeout(submitSelection, 0);
    }
  };

  const useHint = () => {
    const word = activeWords[0];
    if (!word || boardLocked) return;
    if (isGoldenRun && hintsUsedRef.current >= FTUE_HINT_LIMIT) {
      setMessage("No hints left this level");
      return;
    }
    hintsUsedRef.current += 1;
    setHintsUsed(hintsUsedRef.current);
    setHintedId(word.tileIds[0]);
    if (isGoldenRun) noteUsefulFtueInteraction();
    if ((runNode.current?.level ?? player.currentLevel) === 3 && !ftueProgressRef.current.completedTutorials.includes("level-3-hint")) {
      markTutorialComplete("level-3-hint");
      setContextualPrompt(null);
    }
    setMessage(`${word.word} begins with ${word.word[0]}`);
    window.setTimeout(() => setHintedId(null), 1500);
  };

  const replayNextGoldenMove = () => {
    if (!isGoldenRun || animating) return;
    const objectiveId = goldenReplayPlan[cascades];
    const word = activeWords.find((candidate) => candidate.id === objectiveId);
    if (!word) {
      setMessage(objectiveId ? `Replay mismatch: ${objectiveId} is not active` : "Replay sequence complete");
      return;
    }
    selection.current = [...word.tileIds];
    setSelectedIds(word.tileIds);
    window.setTimeout(submitSelection, 0);
  };

  const simulateIncomingAttack = () => {
    if (!pvp.current) return;
    const card = ownedCards()[0];
    if (!card) { setToast("Collect a card first."); return; }
    const result = pvp.current.simulateIncomingCardAction(card.cardId);
    persistPvp();
    setToast(result.blocked ? `${card.name}'s Shield broke and blocked the hit.` : `${card.name} was damaged.`);
  };

  const debugPowerUp = (kind: PowerUpKind) => {
    if (!pvp.current) return;
    const next = pvp.current.addReadyAction(kind);
    badges.current = new BadgeManager(next.badgeProgress, next.readyActions);
    persistPvp(next);
    setToast(`${BADGES[kind].label} action added for post-level QA.`);
  };

  const updateSetting = (key: keyof PlayerSettings) => {
    if (!economy.current) return;
    persist(economy.current.updateSetting(key, !player.settings[key]));
  };

  const skipFtueTips = () => {
    updateFtueProgress((current) => skipFtue(current));
    setGoldenTutorial(createGoldenTutorialState(skipFtue(ftueProgress)));
    setFtueStall("NONE");
    setFtueFocusIds([]);
    setMessage("Find either active word");
  };

  const resetFtueGuidance = () => {
    const reset: FtueProgress = {
      ...ftueProgressRef.current,
      skipped: false,
      completedBeats: [],
      completedTutorials: ftueProgressRef.current.completedTutorials.filter((tutorial) => tutorial !== "level-1-drag"),
      completedVisualSteps: ftueProgressRef.current.completedVisualSteps.filter((step) => step !== "welcome-guidance" && step !== "first-word-guidance" && step !== "first-transformation"),
    };
    updateFtueProgress(() => reset);
    const canRestartGuidanceHere = isGoldenRun && cascades === 0;
    setGoldenTutorial(canRestartGuidanceHere
      ? createGoldenTutorialState(reset)
      : createGoldenTutorialState(completeFtue(reset)));
    ftueLastUsefulAt.current = Date.now();
    ftueFirstChangeAt.current = 0;
    setFtueStall("NONE");
    setFtueFocusIds([]);
    setLevelOneCoach(canRestartGuidanceHere ? { kind: "welcome", messageOpen: true } : null);
    if (canRestartGuidanceHere) setMessage("Swipe across the letters to find SHORE.");
    setToast("FTUE guidance reset safely");
  };

  const returnHome = () => {
    boardSession.current = null;
    setCanonicalDebug(null);
    setGeneratedRun(null);
    setGoldenRun(false);
    setGoldenReplayPlan([]);
    setGeneratedObstacleTypes({});
    setGeneratedFlipPhase(null);
    setAcceptedPathIds([]);
    setTransformationDiffIds([]);
    setAcceptedWordKind(null);
    setFtueStall("NONE");
    setFtueFocusIds([]);
    setLevelOneCoach(null);
    setScreen("hub");
    setTab("home");
    const chapter = track.chapterForLevel(economy.current?.snapshot().currentLevel ?? player.currentLevel);
    setViewChapterId(chapter.chapterId);
  };

  const restartProgress = async () => {
    if (cloudSaveTimer.current !== null) {
      window.clearTimeout(cloudSaveTimer.current);
      cloudSaveTimer.current = null;
    }
    await cloudSaveInFlight.current?.catch(() => undefined);

    const response = await fetch("/api/player", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "restart-progress" }),
    });
    if (!response.ok) throw new Error("Account restart failed");

    const reset = await response.json() as { player: V3PlayerState; pvp: PvpState };
    economy.current = new EconomyManagerV3(reset.player);
    pvp.current = new PvpManager(reset.pvp);
    scoreIdleUnsubscribe.current?.();
    scoreIdleUnsubscribe.current = null;
    boardSession.current = null;
    scorer.current = null;
    badges.current = null;
    objective.current = null;
    obstacleEngine.current = null;
    runNode.current = null;
    pendingFinish.current = false;
    resumeAfterPack.current = false;
    eventCoins.current = 0;
    hintsUsedRef.current = 0;
    selection.current = [];
    dragStart.current = null;
    dragging.current = false;
    clearJuiceFx();

    const freshFtue = createFtueProgress();
    try {
      window.localStorage.setItem(
        ftueStorageKey(account.email),
        serializeFtueProgress(freshFtue),
      );
    } catch {
      // The account reset remains authoritative if browser storage is unavailable.
    }

    setPlayer(economy.current.snapshot());
    setPvpState(pvp.current.snapshot());
    ftueProgressRef.current = freshFtue;
    setFtueProgress(freshFtue);
    setGoldenTutorial(createGoldenTutorialState(freshFtue));
    setBoard(null);
    setActiveWords([]);
    setSelectedIds([]);
    setAcceptedPathIds([]);
    setTransformationDiffIds([]);
    setAcceptedWordKind(null);
    setBonusWordsFound(0);
    setNeutralShakeIds([]);
    setHintedId(null);
    setCascades(0);
    setScore(EMPTY_SCORE);
    setHintsUsed(0);
    setBadgeCounts({ attack: 0, steal: 0, raid: 0, shield: 0 });
    setBadgePopIds([]);
    setTrayImpactSlots([]);
    setJuiceShake(false);
    setCoinCounterPulse(false);
    setPvpOverlay(null);
    setAlbumPageLevel(null);
    setAlbumTransition(null);
    setTutorialLibraryOpen(false);
    setContextualPrompt(null);
    stealResolutionLock.current = false;
    setObstacles(null);
    setObjectiveProgress({ current: 0, target: 5, complete: false });
    setSummary(null);
    setPackReveal(null);
    setMessage("Find one of the active words");
    setAnimating(false);
    setShake(false);
    setGeneratedRun(null);
    setGoldenRun(false);
    setGoldenReplayIndex(0);
    setGoldenReplayPlan([]);
    setFtueStall("NONE");
    setFtueFocusIds([]);
    setGeneratedObstacleTypes({});
    setGeneratedFlipPhase(null);
    setCanonicalDebug(null);
    setSelectedNode(null);
    setViewChapterId("chapter_ocean");
    setDebugOpen(false);
    setTab("home");
    setScreen("hub");
    setSettingsOpen(false);
    setToast("Progress restarted. Level 1 is ready.");
  };

  const resetSave = () => {
    economy.current = new EconomyManagerV3(freshPlayer());
    pvp.current = new PvpManager(freshPvpState());
    persistPvp(pvp.current.snapshot());
    persist(economy.current.snapshot());
    setViewChapterId("chapter_ocean");
    setDebugOpen(false);
    setToast("Version 3 save reset");
  };

  const debugLevel = (level: number) => {
    if (!economy.current) return;
    const next = economy.current.debugLevel(level);
    persist(next);
    setViewChapterId(track.chapterForLevel(level).chapterId);
    setToast(`Jumped to Level ${level}`);
  };

  const claimSet = (setId: string) => {
    const next = structuredClone(player);
    const set = albums.flatMap((album) => album.sets).find((candidate) => candidate.setId === setId);
    if (!set || !albumManager.claimSet(next, set)) { setToast("Complete all 9 cards first."); return; }
    economy.current?.replace(next);
    persist(next);
    setToast(`Set complete: +${set.completionReward.energy} Energy`);
  };

  const redeemVault = () => {
    const next = structuredClone(player);
    const result = albumManager.redeemVault(next, activeAlbum);
    if (!result) { setToast("Collect 100 Vault Stars and keep one card missing."); return; }
    economy.current?.replace(next);
    persist(next);
    setPackReveal(result);
  };

  const claimAlbum = (albumId: string) => {
    const next = structuredClone(player);
    const album = albums.find((candidate) => candidate.albumId === albumId);
    if (!album || !albumManager.claimAlbum(next, album)) { setToast("Complete every set to earn the royal cosmetic."); return; }
    economy.current?.replace(next);
    persist(next);
    setToast(`${album.completionReward.frame} frame unlocked!`);
  };

  const buyPack = (tier: PackTier) => {
    if (!economy.current) return;
    const cost = PACK_COSTS[tier];
    if (player.coins < cost) { setToast(`You need ${formatNumber(cost)} Coins.`); return; }
    const next = economy.current.snapshot();
    next.coins -= cost;
    economy.current.replace(next);
    persist(next);
    openPack(tier);
  };

  const repairCard = (cardId: string) => {
    if (!economy.current || !pvp.current) return;
    if (player.coins < CARD_REPAIR_COST) { setToast(`Repairs cost ${CARD_REPAIR_COST} Coins.`); return; }
    const next = economy.current.snapshot();
    next.coins -= CARD_REPAIR_COST;
    economy.current.replace(next);
    pvp.current.repairCard(cardId);
    persist(next);
    setToast("Card repaired and ready for play.");
  };

  if (screen === "hub") {
    const albumGuided = ftueProgress.pendingMandatoryStep === "OPEN_LEVEL_2_ALBUM";
    return <main className={`${base.shell} ${base.hubShell} ${styles.v3Shell}`} style={{ "--chapter-accent": viewedChapter.accent } as CSSProperties}>
      <TopBar player={player} timer={energyTimer(player, clock)} locked={albumGuided} onShop={() => setTab("shop")} onSettings={() => setSettingsOpen(true)} />
      <section className={`${base.hubContent} ${styles.hubContent}`}>
        {tab === "home" && <HomeMenu player={player} hydrated={hydrated && ftueReady && !albumGuided} playRef={levelPlayButtonRef} guideLevelTwo={false} onPlay={() => requestLevelStart(track.node(player.currentLevel))} />}
        {tab === "albums" && <AlbumPanel albums={albums} pages={albumPages} pageLevel={albumPageLevel} player={player} pvp={pvpState} activeChapter={activeChapter} ftueProgress={ftueProgress} reducedMotion={prefersReducedMotion} onContinuePage={continueFromAlbumPage} onOpenPage={openAlbumPage} unlockedPages={ftueProgress.unlockedAlbumPages} onClaim={claimSet} onVault={redeemVault} onClaimAlbum={claimAlbum} onRepair={repairCard} />}
        {tab === "shop" && <PackShop player={player} onBuy={buyPack} />}
        {tab === "teams" && <SimplePanel eyebrow="SOCIAL KINGDOM" title="Teams" copy="Trade duplicates, request energy, and conquer together." items={[["🦁", "Royal Wordsmiths", "42 Members"], ["⚡", "Energy Requests", "3 waiting"], ["🃏", "Card Trades", "7 offers"]]} onAction={() => setToast("Request sent to the Royal Wordsmiths.")} />}
        {tab === "events" && <SimplePanel eyebrow="LIVE NOW" title="Events" copy="Timed races now award themed packs and Vault Stars." items={[["⚔️", "Raid Tournament", "Ends in 2h"], ["⭐", "Star Race", "8 stars to lead"], ["🃏", "Album Sprint", "2 days left"]]} onAction={() => setToast("Event pinned to your home rail.")} />}
      </section>
      <BottomNav active={tab} albumButtonRef={albumButtonRef} albumUnlocked={ftueProgress.albumUnlocked} albumNotifications={albumUnseenCount} guideAlbum={albumGuided} tutorialLock={albumGuided} onChange={(nextTab) => {
        if (nextTab === "albums") openLatestAlbumPage();
        else setTab(nextTab);
      }} />
      {ftueProgress.pendingMandatoryStep === "OPEN_LEVEL_2_ALBUM" && <FtueCoachmark
        icon={<DiscoveryArtwork kind="album" />}
        title="Your Ocean Album is ready"
        message="Tap Album to see the three stickers you discovered."
        targetRef={albumButtonRef}
        gesture="tap"
        dim
        reducedMotion={prefersReducedMotion}
        messageOpen={false}
        testId="level-2-album-guide"
      />}
      {tab === "home" && <button className={base.hubDebugToggle} onClick={() => setDebugOpen((open) => !open)}>⚙ Royal QA</button>}
      {debugOpen && tab === "home" && <div className={`${base.hubDebugDock} ${styles.debugDock}`}>
        <b>LOCAL QA TOOLS</b>
        <button onClick={() => economy.current && persist(economy.current.debugAdd())}>+ Resources</button>
        <button onClick={() => debugLevel(5)}>Level 5 Ocean Boss</button>
        <button onClick={() => debugLevel(10)}>Level 10 Forest Boss</button>
        <button onClick={() => debugLevel(15)}>Level 15 Desert Boss</button>
        <button onClick={() => debugLevel(16)}>Level 16 Space Chapter</button>
        <button onClick={() => debugLevel(21)}>Level 21 Frost Chapter</button>
        <button onClick={() => debugPowerUp("shield")}>+ Shield Action</button>
        <button onClick={() => debugPowerUp("attack")}>+ Attack Action</button>
        <button onClick={simulateIncomingAttack}>Incoming Attack</button>
        <button onClick={resetFtueGuidance}>Reset FTUE Tips</button>
        <button onClick={resetSave}>Reset V3 Save</button>
        <span style={{ gridColumn: "1 / -1", marginTop: 4, color: "#ffe17a", fontSize: 7, fontWeight: 900, letterSpacing: ".08em" }}>GENERATED TRANSMUTATION</span>
        <select aria-label="Generated level" value={generatedLevelSeed} onChange={(event) => setGeneratedLevelSeed(Number(event.target.value))} style={{ gridColumn: "1 / -1", minHeight: 30, border: "2px solid #e4ad35", borderRadius: 8, padding: "4px 7px", color: "#233d70", background: "#fff4c9", fontSize: 8, fontWeight: 900 }}>
          {GENERATED_LEVELS.map((level) => <option value={level.seed} key={level.seed}>Level {level.levelNumber} · {level.themeName}</option>)}
        </select>
        <button style={{ gridColumn: "1 / -1" }} onClick={() => startGeneratedLevel(generatedLevelSeed)}>Load Generated Level</button>
        <span style={{ gridColumn: "1 / -1", marginTop: 4, color: "#ffe17a", fontSize: 7, fontWeight: 900, letterSpacing: ".08em" }}>AUTHORED GOLDEN CORE</span>
        <select aria-label="Golden replay sequence" value={goldenReplayIndex} onChange={(event) => setGoldenReplayIndex(Number(event.target.value))} style={{ gridColumn: "1 / -1", minHeight: 30, border: "2px solid #e4ad35", borderRadius: 8, padding: "4px 7px", color: "#233d70", background: "#fff4c9", fontSize: 8, fontWeight: 900 }}>
          {Array.from({ length: GOLDEN_LEVEL_1.replayMetadata.expectedCompleteMoveOrders }, (_, index) => <option value={index} key={index}>Replay path {index + 1} of {GOLDEN_LEVEL_1.replayMetadata.expectedCompleteMoveOrders}</option>)}
        </select>
        <button style={{ gridColumn: "1 / -1" }} onClick={() => startGoldenLevel(goldenReplayIndex)}>Load Golden Level 1</button>
      </div>}
      {selectedNode && <LevelPopup node={selectedNode} isCurrent={selectedNode.level === player.currentLevel} onClose={() => setSelectedNode(null)} onPlay={() => requestLevelStart(selectedNode)} />}
      {settingsOpen && <SettingsModal account={account} signOutUrl={signOutUrl} player={player} onToggle={updateSetting} onRestart={restartProgress} onHowToPlay={() => { setSettingsOpen(false); setTutorialLibraryOpen(true); }} onClose={() => setSettingsOpen(false)} />}
      {tutorialLibraryOpen && <TutorialLibrary maxLevel={Math.min(10, Math.max(player.currentLevel, ...player.completedLevels, 1))} onClose={() => setTutorialLibraryOpen(false)} />}
      {albumTransition && <AlbumTransition state={albumTransition} reducedMotion={prefersReducedMotion} />}
      {packReveal && <PackModal result={packReveal} onClose={closePackReveal} />}
      {pvpOverlay && <PvpEventOverlay state={pvpOverlay} ownedCards={ownedCards()} onAttack={chooseAttackCard} onSteal={performSteal} onUseLater={deferSteal} onShield={chooseShieldCard} onPick={pickRaidChest} onClose={closePvpOverlay} />}
      {pvpOverlay?.tutorial && <PowerTutorialPrompt kind={pvpOverlay.kind} />}
      {toast && <div className={base.toast} role="status">{toast}</div>}
      {loginIntroOpen && <LoginIntro onClose={() => { setLoginIntroOpen(false); updateFtueProgress(markIntroVideoSeen); }} />}
    </main>;
  }

  if (screen === "summary" && summary) {
    const summaryTheme = chapterThemeForLevel(summary.node.level);
    const summaryStyle = {
      "--theme-accent": summaryTheme.accent,
      "--theme-accent-dark": summaryTheme.accentDark,
      "--theme-soft": summaryTheme.soft,
      "--theme-veil": summaryTheme.veil,
      "--theme-background-image": summaryTheme.backgroundImage ? `url("${summaryTheme.backgroundImage}")` : "none",
    } as CSSProperties;
    if (summary.objectiveComplete && summary.node.level === 1 && ftueProgress.level1CompletionResult) {
      return <main data-chapter-theme={summaryTheme.id} className={`${base.shell} ${base.summaryShell} ${styles.summaryShell} ${styles.levelOneCompletionShell}`} style={summaryStyle}>
        <LevelOneResults
          summary={summary}
          onContinue={() => {
            updateFtueProgress(acknowledgeLevelOneResults);
            setSummary(null);
            requestLevelStart(track.node(2));
          }}
        />
      </main>;
    }
    const oceanCompletionActive = summary.objectiveComplete
      && summary.node.level >= 2
      && summary.node.level <= 5
      && ftueProgress.oceanRewardLevel === summary.node.level
      && ftueProgress.oceanRewardPhase !== null
      && ftueProgress.oceanRewardPhase !== "ALBUM_GUIDE"
      && ftueProgress.oceanRewardPhase !== "ALBUM_REVEAL";
    if (oceanCompletionActive) {
      return <main data-chapter-theme={summaryTheme.id} className={`${base.shell} ${base.summaryShell} ${styles.summaryShell} ${styles.levelOneCompletionShell}`} style={summaryStyle}>
        <OceanRewardExperience
          level={summary.node.level}
          phase={ftueProgress.oceanRewardPhase!}
          summary={summary}
          revealCount={ftueProgress.oceanStickerRevealCount}
          collectedCount={ftueProgress.oceanCollectedStickers.length}
          reducedMotion={prefersReducedMotion}
          onContinueResults={() => updateFtueProgress(continueToOceanPack)}
          onOpenPack={() => updateFtueProgress(openOceanDiscoveryPack)}
          onOpenAlbum={() => {
            updateFtueProgress(beginLevelTwoAlbumGuide);
            setSummary(null);
            returnHome();
          }}
          onFinish={() => {
            if (summary.node.level === 5 && economy.current) {
              persist(economy.current.unlockChapter("chapter_forest"));
              setToast("Ocean Kingdom discovered! Forest Kingdom unlocked.");
            }
            updateFtueProgress(finishOceanReward);
            setSummary(null);
            returnHome();
          }}
        />
      </main>;
    }
    return <main data-chapter-theme={summaryTheme.id} className={`${base.shell} ${base.summaryShell} ${styles.summaryShell}`} style={summaryStyle}>
      <GameTopBar player={player} timer={energyTimer(player, clock)} onBack={returnHome} onSettings={() => setSettingsOpen(true)} coinPulse={coinCounterPulse} />
      <div className={styles.summaryAtmosphere} aria-hidden="true"><i /><i /><i /><i /><i /><span>🪙</span><span>🪙</span></div>
      <section className={`${base.summaryCard} ${styles.summaryCard}`} data-complete={summary.objectiveComplete}>
        <div className={styles.summaryRays} aria-hidden="true" />
        {summary.objectiveComplete && <CelebrationBurst />}
        <div className={`${base.summaryCrown} ${styles.summaryCrownMedal}`}><span>{summary.objectiveComplete ? "👑" : "🛡️"}</span><i aria-hidden="true">◆</i></div>
        <span className={`${base.kicker} ${styles.summaryKicker}`}>LEVEL {summary.node.level} · {summary.node.title}</span>
        <h1>{summary.objectiveComplete ? "Conquest Complete!" : "Objective Not Met"}</h1>
        {summary.objectiveComplete && summary.node.level > 5 && summary.node.level <= 10 && <div className={styles.albumUnlockNotice}>📖 <b>New Album page unlocked!</b><button onClick={() => openAlbumPage(summary.node.level)}>OPEN</button></div>}
        <div className={`${base.stars} ${styles.summaryStars}`} aria-label={`${summary.stars} of 3 stars earned`}>{[1, 2, 3].map((star) => <span data-earned={star <= summary.stars && summary.objectiveComplete ? "true" : undefined} className={star <= summary.stars && summary.objectiveComplete ? base.starEarned : ""} key={star}>★</span>)}</div>
        <div className={`${base.summaryGrid} ${styles.royalSummaryGrid}`}><Result label="Score" value={formatNumber(summary.score)} /><Result label="Time" value={`${summary.elapsedSeconds}s`} /><Result label="Accuracy" value={`${Math.round(summary.accuracy * 100)}%`} /><Result label="Longest Word" value={summary.longestWord || "—"} /><Result label="Hints" value={String(summary.hints)} /><Result label="Objective" value={summary.objectiveComplete ? "Complete" : "Retry"} /></div>
        {summary.objectiveComplete && <div className={styles.rewardStrip}>
          <div className={styles.rewardHeading}><span>LEVEL REWARD</span><i aria-hidden="true">✦</i></div>
          <div className={styles.rewardCurrency}>
            <span className={styles.rewardCoin} aria-label={`${formatNumber(summary.totalCoins + summary.reward.coins)} Coins`}><i aria-hidden="true">🪙</i><b>{formatNumber(summary.totalCoins + summary.reward.coins)}</b><small>COINS</small></span>
            {summary.reward.energy ? <span className={styles.rewardEnergy} aria-label={`${summary.reward.energy} Energy`}><i aria-hidden="true">⚡</i><b>{summary.reward.energy}</b><small>ENERGY</small></span> : null}
          </div>
          {summary.packResult && <button className={styles.rewardPackButton} onClick={() => setPackReveal(summary.packResult!)}><span aria-hidden="true">🎁</span><b>{summary.packResult.tier} PACK</b><small>OPEN</small></button>}
        </div>}
        <button className={`${base.primaryCta} ${styles.summaryPrimaryCta}`} onClick={() => {
          if (!summary.objectiveComplete) requestLevelStart(summary.node);
          else if (summary.node.level === 1 && ftueProgressRef.current.pendingMandatoryStep) returnHome();
          else requestLevelStart(track.node(player.currentLevel));
        }}><span>{summary.objectiveComplete ? summary.node.level === 1 && ftueProgress.pendingMandatoryStep ? "CONTINUE" : `Play Level ${player.currentLevel}` : "Retry Level"}</span><small>{summary.objectiveComplete && summary.node.level === 1 && ftueProgress.pendingMandatoryStep ? "OPEN YOUR NEW ALBUM" : "1 ⚡ Ticket"}</small></button>
        <button className={`${base.secondaryCta} ${styles.summarySecondaryCta}`} onClick={returnHome}>Return to Conquest Track</button>
      </section>
      {packReveal && <PackModal result={packReveal} onClose={closePackReveal} />}
      {pvpOverlay && <PvpEventOverlay state={pvpOverlay} ownedCards={ownedCards()} onAttack={chooseAttackCard} onSteal={performSteal} onUseLater={deferSteal} onShield={chooseShieldCard} onPick={pickRaidChest} onClose={closePvpOverlay} />}
      {pvpOverlay?.tutorial && <PowerTutorialPrompt kind={pvpOverlay.kind} />}
      {settingsOpen && <SettingsModal account={account} signOutUrl={signOutUrl} player={player} onToggle={updateSetting} onRestart={restartProgress} onHowToPlay={() => { setSettingsOpen(false); setTutorialLibraryOpen(true); }} onClose={() => setSettingsOpen(false)} />}
      {tutorialLibraryOpen && <TutorialLibrary maxLevel={Math.min(10, Math.max(player.currentLevel, ...player.completedLevels, 1))} onClose={() => setTutorialLibraryOpen(false)} />}
      {albumTransition && <AlbumTransition state={albumTransition} reducedMotion={prefersReducedMotion} />}
    </main>;
  }

  const node = runNode.current ?? track.node(player.currentLevel);
  const area = runArea.current;
  const chapterTheme = chapterThemeForLevel(node.level, area.themeKey);
  const chapterStyle = {
    "--level-accent": chapterTheme.accent,
    "--theme-accent": chapterTheme.accent,
    "--theme-accent-dark": chapterTheme.accentDark,
    "--theme-soft": chapterTheme.soft,
    "--theme-veil": chapterTheme.veil,
    "--theme-background-image": chapterTheme.backgroundImage ? `url("${chapterTheme.backgroundImage}")` : "none",
  } as CSSProperties;
  return <main data-chapter-theme={chapterTheme.id} className={`${base.shell} ${base.boardShell} ${styles.boardShell} ${isGoldenRun ? styles.goldenBoard : ""} ${boardLocked ? styles.boardPaused : ""} ${juiceShake ? styles.juiceScreenShake : ""}`} style={chapterStyle}>
    {!(isGoldenRun && !player.completedLevels.includes(1))
      && <GameTopBar player={player} timer={energyTimer(player, clock)} onBack={returnHome} onSettings={() => setSettingsOpen(true)} coinPulse={coinCounterPulse} />}
    <section className={styles.chapterIdentity} aria-label={`${chapterTheme.chapterTitle}, Level ${node.level}`}>
      <div className={styles.chapterTopRow}>
        {isGoldenRun && !player.completedLevels.includes(1) && <button className={styles.ftueInlineBack} onClick={returnHome} aria-label="Return to menu">‹</button>}
        <div className={styles.chapterBannerLine}>
          <i aria-hidden="true">{chapterTheme.ornaments[0]}</i>
          <h1>{chapterTheme.chapterTitle}</h1>
          <div className={styles.chapterBannerRight}>
            <small>LV {node.level}</small>
            <i aria-hidden="true">{chapterTheme.ornaments[1]}</i>
          </div>
        </div>
      </div>
    </section>
    <section className={styles.themeObjectiveRail} data-ftue-stall={ftueActive ? ftueStall : undefined}>
      <div className={styles.themeObjectiveHeading}><span>FIND</span><small>{activeWords.length} ACTIVE</small></div>
      <div className={styles.themeObjectiveWords}>{activeWords.map((word, index) => <div data-ftue-active-word="true" className={`${base.activeWordChip} ${goldenTutorial.recommendedObjectiveId === word.id ? styles.tutorialRecommendedWord : ""} ${goldenTutorial.localSuccessorObjectiveId === word.id ? styles.tutorialSuccessorWord : ""} ${ftueActive && ftueStall === "SUGGESTION" && index === 0 ? styles.ftueSuggestedWord : ""}`} aria-label={`${word.word}${goldenTutorial.recommendedObjectiveId === word.id ? ", recommended first word" : ""}`} key={word.id}><span>{word.word}</span></div>)}</div>
    </section>
    {contextualPrompt && <aside className={styles.contextualFtuePrompt} role="status">{contextualPrompt}</aside>}
    {!isGoldenRun && visiblePowers.length > 0 && <div className={styles.mobilePowerProgress}><PowerProgress kinds={visiblePowers} badgeCounts={badgeCounts} readyActions={pvpState.readyActions} impactSlots={trayImpactSlots} /></div>}
    {node.level > 10 && <>
      <section className={`${base.runHeader} ${styles.runHeaderWithPreview}`}><div><span className={base.kicker}>{`${area.icon} ${area.displayName} · Level ${node.level}`}</span><h1>{node.kind === "BOSS" ? "Guardian Board" : "Living Board"}</h1></div><div className={styles.previewScoreHud}><span><small>SCORE</small><b>{formatNumber(score.score)}</b></span><i>{`x${score.comboMultiplier.toFixed(1)}`}</i></div><div className={`${base.cascadeCounter} ${styles.largeCascadeCounter}`}><b>{cascades}</b><span>/ {runStepTarget}</span><small>Steps</small></div></section>
      <div className={base.cascadeTrack} aria-hidden="true"><i style={{ width: `${(cascades / runStepTarget) * 100}%` }} /></div>
      <section className={styles.objectiveBar} data-complete={objectiveProgress.complete}><span>🔤</span><div><small>LEVEL OBJECTIVE</small><b>{node.objective.label}</b></div><em>{objectiveProgress.current}/{objectiveProgress.target}</em></section>
    </>}
    <section className={base.boardLayout}>
      <div className={`${base.boardCard} ${shake ? base.shake : ""}`}>
        <div className={base.boardMessage} role="status" aria-live="polite">{message}</div>
        <div className={`${base.letterGrid} ${styles.boardLetterGrid}`} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
          {isGoldenRun && ftueActive && goldenTutorial.phase === "FIRST_WORD" && <div className={styles.shoreGuideLine} aria-hidden="true"><i /><span>➜</span></div>}
          {board?.tiles.flat().map((tile) => {
            const badge = badgeByTile.get(tile.id);
            const blocked = currentRunLevel > 5 && obstacleTileIds.has(tile.id);
            const generatedObstacle = generatedObstacleTypes[tile.id];
            const isFlipping = Boolean(generatedRun) && transformationDiffIds.includes(tile.id);
            const acceptedIndex = acceptedPathIds.indexOf(tile.id);
            const replacementIndex = transformationDiffIds.indexOf(tile.id);
            const isReplacementPopping = replacementIndex >= 0 && generatedFlipPhase === "in";
            const isTutorialTile = isGoldenRun && goldenTutorial.recommendedObjectiveId === "a0-shore" && activeWords.find((word) => word.id === "a0-shore")?.tileIds.includes(tile.id);
            const tileStyle: CSSProperties | undefined = acceptedIndex >= 0 || isReplacementPopping ? {
              ...(acceptedIndex >= 0 ? { "--word-stagger": `${acceptedIndex * WORD_WAVE_STAGGER_MS}ms` } as CSSProperties : {}),
              ...(isReplacementPopping ? { "--replacement-stagger": `${replacementIndex * 7}ms` } as CSSProperties : {}),
            } : undefined;
            const tileFaceStyle: CSSProperties | undefined = generatedRun ? {
              transformStyle: "preserve-3d",
              transition: prefersReducedMotion ? "opacity 120ms ease" : "transform 180ms ease, opacity 180ms ease",
              ...(isFlipping ? {
                transform: prefersReducedMotion ? "none" : generatedFlipPhase === "out" ? "rotateY(88deg)" : generatedFlipPhase === "in" ? "rotateY(-88deg)" : "rotateY(0deg)",
                opacity: generatedFlipPhase ? 0.18 : 1,
              } : {}),
            } : undefined;
            return <button key={tile.id} data-v3-tile-id={tile.id} data-accepted-word={acceptedIndex >= 0 ? "true" : undefined} data-accepted-kind={acceptedIndex >= 0 ? acceptedWordKind ?? undefined : undefined} data-replacement-pop={isReplacementPopping ? "true" : undefined} data-ftue-focus={ftueFocusIds.includes(tile.id) ? "true" : undefined} disabled={boardLocked} style={tileStyle} className={`${base.tile} ${styles.boldTile} ${acceptedIndex >= 0 ? styles.acceptedWordTile : ""} ${acceptedIndex >= 0 && acceptedWordKind === "bonus" ? styles.bonusWordTile : ""} ${isReplacementPopping ? styles.replacementLetterTile : ""} ${isTutorialTile ? styles.tutorialRecommendedTile : ""} ${selectedIds.includes(tile.id) ? base.selected : ""} ${transformationDiffIds.includes(tile.id) && !generatedRun ? base.clearing : ""} ${neutralShakeIds.includes(tile.id) ? styles.neutralWordTile : ""} ${hintedId === tile.id ? base.hinted : ""} ${badge ? base.badged : ""} ${badgePopIds.includes(tile.id) ? styles.badgeTilePop : ""} ${blocked ? styles.obstacleTile : ""}`} onPointerDown={(event) => onPointerDown(event, tile)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onKeyboardTile(tile); } }}>
              <span className={styles.tileFace} style={tileFaceStyle}><span className={styles.tileLetter}>{tile.letter}</span></span>
              {badge && <i data-badge={badge}>{BADGES[badge].icon}</i>}
              {blocked && <em title={generatedObstacle ? `${generatedObstacle} placeholder obstacle` : undefined}>{generatedObstacle ? generatedObstacle === "ICE" ? "◆" : "✦" : obstacles?.icon}</em>}
            </button>;
          })}
        </div>
        {!isGoldenRun && node.level <= 10 && <div className={styles.comboTimerBar} data-urgent={comboUrgent ? "true" : undefined} aria-label={`Combo x${score.comboMultiplier.toFixed(1)}`}>
          <i style={{ width: `${Math.round(comboDrain * 100)}%` }} />
          <b>{`x${score.comboMultiplier.toFixed(1)}`}</b>
        </div>}
        <div className={base.boardActions} data-ftue-actions={isGoldenRun ? "true" : undefined}>
          {!isGoldenRun && standardHintVisible && <button onClick={useHint} disabled={boardLocked}>💡 Hint <small>resets combo</small></button>}
          {isGoldenRun && (ftueStall === "HINT" || !ftueActive) && <button onClick={useHint} disabled={boardLocked || hintsUsed >= FTUE_HINT_LIMIT}>💡 {ftueActive ? "Need a clue?" : "Hint"}<small>{Math.max(0, FTUE_HINT_LIMIT - hintsUsed)} left</small></button>}
          <span>{boardLocked ? generatedRun ? "Tiles are changing in place" : "Board paused for royal action" : isGoldenRun ? "Drag in a straight line · no timer" : "Drag or tap two endpoints"}</span>
          {isGoldenRun && ftueActive && <button className={styles.skipTipsButton} onClick={skipFtueTips} disabled={boardLocked}>Skip tips</button>}
        </div>
      </div>
      <aside className={base.runPanel}>
        {!isGoldenRun && visiblePowers.length > 0 && <div className={styles.desktopPowerProgress}><PowerProgress kinds={visiblePowers} badgeCounts={badgeCounts} readyActions={pvpState.readyActions} impactSlots={trayImpactSlots} /></div>}
        <div className={base.scoreHero}><span>{isGoldenRun ? "Golden tutorial" : "Royal score"}</span><b>{isGoldenRun ? "Guided puzzle" : formatNumber(score.score)}</b><i>{isGoldenRun ? "No timer · no combo pressure" : `${score.comboMultiplier.toFixed(1)}× combo`}</i></div>
        <div className={base.runStats}>{isGoldenRun ? <><Result label="Choice" value="Either word" /><Result label="Letters" value="Stay put" /></> : <><Result label="Accuracy" value={`${score.validSelections + score.invalidSelections ? Math.round((score.validSelections / (score.validSelections + score.invalidSelections)) * 100) : 100}%`} /><Result label="Longest" value={score.longestWord || "—"} /><Result label="Hints" value={String(hintsUsed)} /><Result label="Words" value={String(score.validSelections)} />{currentRunLevel >= 4 && <Result label="Bonus" value={String(bonusWordsFound)} />}</>}</div>
      </aside>
      <button className={`${base.debugToggle} ${styles.mobileDebugToggle}`} onClick={() => setDebugOpen((open) => !open)}>⚙ Royal QA Tools</button>
      {debugOpen && <div className={`${base.boardDebug} ${styles.mobileBoardDebug}`}>
          <button className={styles.qaPrimaryAction} onClick={() => { const word = activeWords[0]; if (!word) return; selection.current = [...word.tileIds]; setSelectedIds(word.tileIds); window.setTimeout(submitSelection, 0); }}>✅ Auto-solve current word</button>
          <span>{isGoldenRun ? `AUTHORED ${GOLDEN_LEVEL_1.levelId} v${GOLDEN_LEVEL_1.version}` : isQaRun ? `GENERATED ${generatedRun?.seed}` : "DEBUG OPTIONS"}</span>
          {isGoldenRun && <>
            <button onClick={resetFtueGuidance}>Reset FTUE guidance</button>
            <select aria-label="Golden replay sequence in board" value={goldenReplayIndex} onChange={(event) => setGoldenReplayIndex(Number(event.target.value))}>
              {Array.from({ length: GOLDEN_LEVEL_1.replayMetadata.expectedCompleteMoveOrders }, (_, index) => <option value={index} key={index}>Replay path {index + 1}</option>)}
            </select>
            <button onClick={() => startGoldenLevel(goldenReplayIndex)}>Restart selected replay</button>
            <button onClick={replayNextGoldenMove} disabled={animating || cascades >= goldenReplayPlan.length}>Replay next authored move</button>
          </>}
          {isQaRun ? <button onClick={returnHome}>Exit {isGoldenRun ? "Golden Level" : "Generated QA"}</button> : <>
            <button onClick={() => debugPowerUp("attack")}>Queue Attack</button>
            <button onClick={() => debugPowerUp("steal")}>Queue Steal</button>
            <button onClick={() => debugPowerUp("raid")}>Queue Raid</button>
            <button onClick={() => debugPowerUp("shield")}>Queue Shield</button>
            <button onClick={simulateIncomingAttack}>Incoming Attack</button>
            <button onClick={() => debugPowerUp("shield")}>Queue Shield</button>
            <button onClick={() => openPack("GOLD")}>Open Gold Pack</button>
          </>}
      </div>}
    </section>
    <JuiceFxLayer effects={juiceEffects} />
    {levelOneCoach?.kind === "welcome" && <ConceptCard
      title="Welcome to Word Kingdom!"
      message="Find hidden words, collect royal cards, raid rival kingdoms, and gather gold as you build your realm."
      cta="Let's go"
      messageOpen={levelOneCoach.messageOpen}
      onDismiss={dismissWelcomeCoach}
      testId="level-1-welcome-guide"
    />}
    {levelOneCoach?.kind === "level-2-rules" && <ConceptCard
      title="Words Can Run Both Ways!"
      message="Swipe in any straight line — forward, backward, up, down, or diagonal. If the letters spell a word either direction, it counts."
      cta="Got it"
      messageOpen={levelOneCoach.messageOpen}
      onDismiss={dismissLevelTwoRulesCoach}
      testId="level-2-rules-guide"
    />}
    {levelOneCoach?.kind === "first-word" && <FtueCoachmark
      icon={<span className={styles.wordSelectionVisual}>{[..."SHORE"].map((letter) => <i key={letter}>{letter}</i>)}</span>}
      title="Find your first word!"
      message="Swipe across the letters to find SHORE."
      swipeTileIds={shoreTutorialPath}
      gesture="swipe"
      dim={levelOneCoach.messageOpen}
      messageOpen={levelOneCoach.messageOpen}
      onDismiss={() => setLevelOneCoach({ kind: "first-word", messageOpen: false })}
      reducedMotion={prefersReducedMotion}
      testId="level-1-first-word-guide"
    />}
    {levelOneCoach?.kind === "transformation" && <FtueCoachmark
      icon={<span className={styles.transformedTileVisual}><i>A</i><b>R</b></span>}
      title="The board is alive!"
      message="Finding words changes letters and reveals new possibilities."
      messageOpen={levelOneCoach.messageOpen}
      onDismiss={() => {
        const resume = tutorialResume.current;
        tutorialResume.current = null;
        resume?.();
      }}
      reducedMotion={prefersReducedMotion}
      testId="level-1-transformation-message"
    />}
    {pvpOverlay && <PvpEventOverlay state={pvpOverlay} ownedCards={ownedCards()} onAttack={chooseAttackCard} onSteal={performSteal} onUseLater={deferSteal} onShield={chooseShieldCard} onPick={pickRaidChest} onClose={closePvpOverlay} />}
    {pvpOverlay?.tutorial && <PowerTutorialPrompt kind={pvpOverlay.kind} />}
    {packReveal && <PackModal result={packReveal} onClose={closePackReveal} />}
    {settingsOpen && <SettingsModal account={account} signOutUrl={signOutUrl} player={player} onToggle={updateSetting} onRestart={restartProgress} onHowToPlay={() => { setSettingsOpen(false); setTutorialLibraryOpen(true); }} onClose={() => setSettingsOpen(false)} />}
    {tutorialLibraryOpen && <TutorialLibrary maxLevel={Math.min(10, Math.max(player.currentLevel, ...player.completedLevels, 1))} onClose={() => setTutorialLibraryOpen(false)} />}
    {albumTransition && <AlbumTransition state={albumTransition} reducedMotion={prefersReducedMotion} />}
  </main>;
}

function LevelOneResults({ summary, onContinue }: { summary: V3RunSummary; onContinue: () => void }) {
  return <ConquestCompletePanel summary={summary} title="LEVEL 1 COMPLETE!" cta="PLAY LEVEL 2" onContinue={onContinue} />;
}

function ConquestCompletePanel({ summary, title, cta, onContinue }: { summary: V3RunSummary; title: string; cta: string; onContinue: () => void }) {
  return <section className={`${base.summaryCard} ${styles.summaryCard} ${styles.ftueSummaryCard}`} role="dialog" aria-modal="true" aria-labelledby="ftue-results-title" data-complete="true">
    <div className={styles.summaryRays} aria-hidden="true" />
    <CelebrationBurst />
    <div className={`${base.summaryCrown} ${styles.summaryCrownMedal}`}><span>👑</span><i aria-hidden="true">◆</i></div>
    <span className={`${base.kicker} ${styles.summaryKicker}`}>WORD KINGDOM · LEVEL {summary.node.level}</span>
    <h1 id="ftue-results-title">{title}</h1>
    <div className={`${base.summaryGrid} ${styles.royalSummaryGrid} ${styles.ftueResultGrid}`} aria-label={`Level ${summary.node.level} results`}>
      <Result label="Score" value={formatNumber(summary.score)} />
      <Result label="Time" value={`${summary.elapsedSeconds}s`} />
      <Result label="Longest Word" value={summary.longestWord || "—"} />
      <Result label="Accuracy" value={`${Math.round(summary.accuracy * 100)}%`} />
      <Result label="Words Found" value={String(summary.correct)} />
    </div>
    <button className={`${base.primaryCta} ${styles.summaryPrimaryCta} ${styles.ftuePrimaryContinue}`} onClick={onContinue}><span>{cta}</span></button>
  </section>;
}

const CELEBRATION_BURST_GLYPHS = ["🪙", "✦", "⭐", "◆", "🪙", "✦", "⭐", "◆"];

function CelebrationBurst() {
  return <>
    <div className={styles.celebrationBurst} aria-hidden="true">
      {CELEBRATION_BURST_GLYPHS.map((glyph, index) => <i
        key={index}
        style={{ "--burst-angle": `${index * 45}deg`, "--burst-delay": `${(index % 4) * 45}ms` } as CSSProperties}
      >{glyph}</i>)}
    </div>
    <div className={styles.celebrationRain} aria-hidden="true">
      {Array.from({ length: 12 }, (_, index) => <em key={index} />)}
    </div>
  </>;
}

const OCEAN_STICKER_SYMBOLS: Record<OceanDiscoveryStickerId, string> = {
  "coral-castle": "🏰", pearl: "◉", "sea-turtle": "🐢",
  "dancing-dolphin": "🐬", "golden-anchor": "⚓", "reef-gate": "♜",
  "whale-song": "🐋", "triton-mark": "🔱", "sunken-throne": "♛",
  "coral-crown": "♕", "ocean-palace": "🏯", "sunken-crown": "👑",
};

function OceanStickerVisual({ sticker, missing = false }: { sticker: OceanDiscoveryStickerId; missing?: boolean }) {
  return <span className={styles.oceanStickerVisual} data-missing={missing ? "true" : undefined} aria-hidden="true">{OCEAN_STICKER_SYMBOLS[sticker]}</span>;
}

function OceanRewardExperience({ level, phase, summary, revealCount, collectedCount, reducedMotion, onContinueResults, onOpenPack, onOpenAlbum, onFinish }: {
  level: number;
  phase: Exclude<OceanRewardPhase, null>;
  summary: V3RunSummary;
  revealCount: number;
  collectedCount: number;
  reducedMotion: boolean;
  onContinueResults: () => void;
  onOpenPack: () => void;
  onOpenAlbum: () => void;
  onFinish: () => void;
}) {
  const stickers = oceanStickersForLevel(level);
  const showingResults = phase === "RESULTS";
  const showingPack = phase === "PACK_READY";
  const showingStickers = phase === "STICKER_REVEAL" || phase === "ALBUM_ACTIVATED";
  const safeRevealCount = Math.max(0, Math.min(3, revealCount));
  if (showingResults) return <ConquestCompletePanel summary={summary} title={`LEVEL ${level} COMPLETE!`} cta="CONTINUE TO OCEAN PACK" onContinue={onContinueResults} />;
  return <section className={`${base.summaryCard} ${styles.summaryCard} ${styles.ftueSummaryCard} ${styles.oceanRewardCard}`} role="dialog" aria-modal="true" aria-labelledby="ocean-reward-title" data-phase={phase} data-reduced-motion={reducedMotion ? "true" : undefined}>
    <div className={styles.summaryRays} aria-hidden="true" />
    <span className={`${base.kicker} ${styles.summaryKicker}`}>OCEAN KINGDOM · LEVEL {level}</span>
    <h1 id="ocean-reward-title">{phase === "KINGDOM_COMPLETE" ? "OCEAN KINGDOM DISCOVERED!" : showingPack ? "OCEAN PACK EARNED!" : "NEW OCEAN STICKERS"}</h1>
    {showingPack && <div className={styles.levelOnePackSection}><p>Tap the pack when you are ready.</p><button onClick={onOpenPack} aria-label="Open Ocean sticker pack"><span className={styles.levelOnePackArtwork}><DiscoveryArtwork kind="album" /><i>OCEAN</i><b>STICKER PACK</b></span></button></div>}
    {showingStickers && <div className={styles.levelOneStickerReveal} aria-live="polite"><div className={styles.levelOneAlbumTray}><DiscoveryArtwork kind="album" /><span>{Math.min(12, collectedCount + safeRevealCount)}/12 OCEAN STICKERS</span></div><div className={styles.levelOneStickerRow}>{stickers.map((sticker, index) => { const revealed = index < safeRevealCount; return <article key={sticker} data-revealed={revealed ? "true" : undefined}>{revealed ? <OceanStickerVisual sticker={sticker} /> : <OceanStickerVisual sticker={sticker} missing />}<b>{revealed ? OCEAN_STICKER_LABELS[sticker] : "Mystery"}</b></article>; })}</div>{phase === "ALBUM_ACTIVATED" && <div className={styles.levelOneAlbumActivated}><h2>Your Ocean Album is ready</h2><p>Visit the real Album area to place your first stickers.</p><button onClick={onOpenAlbum}><DiscoveryArtwork kind="album" /><span>GO TO ALBUM</span></button></div>}</div>}
    {phase === "PACK_COMPLETE" && <div className={styles.oceanPackComplete}><div className={styles.levelOneStickerRow}>{stickers.map((sticker) => <article data-revealed="true" key={sticker}><OceanStickerVisual sticker={sticker} /><b>{OCEAN_STICKER_LABELS[sticker]}</b></article>)}</div><p>{collectedCount}/12 Ocean stickers collected.</p><button className={`${base.primaryCta} ${styles.summaryPrimaryCta}`} onClick={onFinish}><span>CONTINUE</span></button></div>}
    {phase === "KINGDOM_COMPLETE" && <div className={styles.oceanKingdomComplete}><div className={styles.levelOneStickerRow}>{stickers.map((sticker) => <article data-revealed="true" key={sticker}><OceanStickerVisual sticker={sticker} /><b>{OCEAN_STICKER_LABELS[sticker]}</b></article>)}</div><p>All 12 Ocean stickers are in place. Forest Kingdom is now unlocked.</p><button className={`${base.primaryCta} ${styles.summaryPrimaryCta}`} onClick={onFinish}><span>RETURN TO CONQUEST</span></button></div>}
  </section>;
}

function TopBar({ player, timer, locked = false, onShop, onSettings }: { player: V3PlayerState; timer: string; locked?: boolean; onShop: () => void; onSettings: () => void }) {
  return <header className={`${base.hubTopBar} ${styles.largeTopBar} ${styles.mobileResourceBar}`}>
    <Resource icon="⚡" value={`${player.energy}/${ENERGY_CAP}`} sub={timer} />
    <Resource icon="⭐" value={String(player.stars)} sub="STARS" />
    <button disabled={locked} data-coin-counter className={`${base.coinResource} ${styles.largeCoin} ${styles.hubCoin}`} onClick={onShop} aria-label={`Coins: ${formatNumber(player.coins)}. Open shop`}><span>🪙</span><b>{formatResourceNumber(player.coins)}</b><small>COINS</small><i>+</i></button>
    <button disabled={locked} className={`${base.settingsButton} ${styles.largeTopIcon} ${styles.hubSettings}`} onClick={onSettings} aria-label="Settings">⚙</button>
  </header>;
}

function GameTopBar({ player, timer, onBack, onSettings, coinPulse }: { player: V3PlayerState; timer: string; onBack: () => void; onSettings: () => void; coinPulse: boolean }) {
  return <header className={`${base.gameTopBar} ${styles.largeTopBar}`}><button className={`${base.gameBack} ${styles.largeTopIcon}`} onClick={onBack}>‹</button><Resource icon="⚡" value={`${player.energy}/${ENERGY_CAP}`} sub={timer} /><Resource icon="⭐" value={String(player.stars)} sub="STARS" /><div data-coin-counter className={`${base.coinResource} ${styles.largeCoin} ${styles.gameCoin} ${coinPulse ? styles.coinCounterImpact : ""}`}><span>🪙</span><b>{formatResourceNumber(player.coins)}</b><i>+</i></div><button className={`${base.settingsButton} ${styles.largeTopIcon}`} onClick={onSettings}>⚙</button></header>;
}

function Resource({ icon, value, sub }: { icon: string; value: string; sub?: string }) { return <div className={`${base.navResource} ${styles.largeResource}`}><span>{icon}</span><b>{value}</b>{sub && <small>{sub}</small>}</div>; }

function PowerProgress({ kinds, badgeCounts, readyActions, impactSlots }: { kinds: PowerUpKind[]; badgeCounts: Record<BadgeType, number>; readyActions: Record<PowerUpKind, number>; impactSlots: string[] }) {
  return <section className={styles.powerProgress} aria-label="Persistent royal powers">
    <div className={styles.powerProgressHeading}><span>ROYAL POWERS</span><small>Progress saves between levels</small></div>
    <div className={styles.powerProgressGrid} data-count={kinds.length}>{POWER_ORDER.filter((kind) => kinds.includes(kind)).map((type) => <article data-power={type} key={type}>
      <div><b aria-hidden="true">{BADGES[type].icon}</b><span>{BADGES[type].label}</span><strong>{badgeCounts[type]}/3</strong>{readyActions[type] > 0 && <em aria-label={`${readyActions[type]} ready`}>{readyActions[type]} READY</em>}</div>
      <p aria-label={`${badgeCounts[type]} of 3 badges`}>
        {[0, 1, 2].map((slot) => <i data-badge-slot={`${type}-${slot}`} data-collected={slot < badgeCounts[type] ? "true" : undefined} className={impactSlots.includes(`${type}-${slot}`) ? styles.traySlotImpact : ""} key={slot} />)}
      </p>
    </article>)}</div>
  </section>;
}

function HomeMenu({ player, hydrated, playRef, guideLevelTwo, onPlay }: { player: V3PlayerState; hydrated: boolean; playRef: RefObject<HTMLButtonElement | null>; guideLevelTwo: boolean; onPlay: () => void }) {
  return <section className={styles.mainMenu}>
    <div className={styles.heroArtwork}>
      <img src="/word-kingdom-mobile-v3.png" alt="Word Kingdom: Spell & Steal with the young king, living word board, and castle raid" />
      <div className={styles.heroShine} />
    </div>
    <button ref={playRef} className={`${styles.mainPlayButton} ${guideLevelTwo ? styles.guidedLevelTwoButton : ""}`} disabled={!hydrated || (!guideLevelTwo && player.energy < 1)} onClick={onPlay}>
      <span>PLAY LEVEL</span><b>{player.currentLevel}</b><small>{guideLevelTwo ? "CONTINUE JOURNEY" : "1 ENERGY"}</small>
    </button>
  </section>;
}

function ConquestTrack({ chapter, nodes, player, hydrated, onChapter, onNode }: { chapter: ChapterDefinition; nodes: TrackNode[]; player: V3PlayerState; hydrated: boolean; onChapter: (id: string) => void; onNode: (node: TrackNode) => void }) {
  const chapterIndex = chapters.findIndex((item) => item.chapterId === chapter.chapterId);
  const unlocked = player.unlockedChapterIds.includes(chapter.chapterId);
  const trackTheme = chapterThemeForLevel(chapter.startLevel, chapter.themeKey);
  const trackStyle = {
    "--track-theme-accent": trackTheme.accent,
    "--track-theme-dark": trackTheme.accentDark,
    "--track-background-image": trackTheme.backgroundImage ? `url("${trackTheme.backgroundImage}")` : "none",
  } as CSSProperties;
  return <section className={styles.trackCard} data-theme={chapter.themeKey} style={trackStyle}>
    <header className={styles.chapterHeader}><button disabled={chapterIndex === 0} onClick={() => onChapter(chapters[chapterIndex - 1].chapterId)}>‹</button><div><small>CHAPTER {chapterIndex + 1} · {chapter.themeKey.replaceAll("_", " ")}</small><h1>{chapter.displayName}</h1><p>{chapter.subtitle}</p></div><button disabled={chapterIndex === chapters.length - 1} onClick={() => onChapter(chapters[chapterIndex + 1].chapterId)}>›</button></header>
    {!unlocked && <div className={styles.chapterLocked}><span>🔒</span><b>Defeat the Ocean Guardian</b><small>Complete Level 15 to open this gateway.</small></div>}
    <div className={styles.trackViewport} aria-label={`${chapter.displayName} level path`}>
      <div className={styles.trackPath} />
      {nodes.slice().reverse().map((node, index) => { const complete = player.completedLevels.includes(node.level); const current = player.currentLevel === node.level; const locked = !unlocked || node.level > player.currentLevel; return <button key={node.level} className={styles.trackNode} data-kind={node.kind} data-side={index % 4 < 2 ? "left" : "right"} data-current={current} data-complete={complete} disabled={!hydrated || locked} onClick={() => onNode(node)} style={{ "--node-order": index } as CSSProperties}><i>{node.kind === "MILESTONE" ? "🎁" : node.kind === "HARD" ? "🔥" : node.kind === "BOSS" ? "🐙" : complete ? "✓" : node.level}</i><span>{node.kind === "BOSS" ? "GATEWAY" : node.kind === "HARD" ? "HARD" : node.kind === "MILESTONE" ? "CHEST" : `LEVEL ${node.level}`}</span>{current && <em>🤴</em>}</button>; })}
    </div>
    <div className={styles.trackFooter}><span>🃏 {albumManager.album(chapter.albumId).albumName}</span><b>{nodes.filter((node) => player.completedLevels.includes(node.level)).length}/{nodes.length} conquered</b></div>
  </section>;
}

function LevelPopup({ node, isCurrent, onClose, onPlay }: { node: TrackNode; isCurrent: boolean; onClose: () => void; onPlay: () => void }) {
  return <div className={base.modalOverlay} role="dialog" aria-modal="true"><section className={`${base.settingsModal} ${styles.levelPopup}`}><button className={base.modalClose} onClick={onClose}>×</button><span className={styles.nodeHero}>{node.kind === "BOSS" ? "🐙" : node.kind === "HARD" ? "🔥" : node.kind === "MILESTONE" ? "🎁" : "⚔️"}</span><small>{node.kind} NODE</small><h2>Level {node.level}</h2><p>{node.title}</p><div className={styles.objectivePopup}><span>{node.objective.kind === "OBSTACLES" ? "🧊" : node.kind === "MILESTONE" ? "🎁" : "🔤"}</span><div><small>OBJECTIVE</small><b>{node.objective.label}</b></div></div><div className={styles.rewardPreview}><small>POSSIBLE REWARDS</small><b>🪙 {node.reward.coins} {node.reward.energy ? `· ⚡ ${node.reward.energy}` : ""} {node.reward.pack ? `· ${node.reward.pack} PACK` : ""}</b></div><button className={base.primaryCta} disabled={!isCurrent} onClick={onPlay}>{isCurrent ? node.kind === "MILESTONE" ? "CLAIM CHEST" : "PLAY" : "LOCKED"}<small>{node.kind === "MILESTONE" ? "FREE · NO ENERGY" : "1 ⚡ Ticket"}</small></button></section></div>;
}

function AlbumPanel({ albums, pages, pageLevel, unlockedPages, ftueProgress, reducedMotion, onOpenPage, onContinuePage, ...collectionProps }: { albums: AlbumDefinition[]; pages: AlbumPageDefinition[]; pageLevel: number | null; unlockedPages: number[]; ftueProgress: FtueProgress; reducedMotion: boolean; onOpenPage: (level: number) => void; onContinuePage: () => void; player: V3PlayerState; pvp: PvpState; activeChapter: ChapterDefinition; onClaim: (setId: string) => void; onVault: () => void; onClaimAlbum: (albumId: string) => void; onRepair: (cardId: string) => void }) {
  const page = pages.find((candidate) => candidate.level === pageLevel);
  const continueRef = useRef<HTMLButtonElement>(null);
  const [oceanSceneReady, setOceanSceneReady] = useState(false);
  useEffect(() => {
    setOceanSceneReady(false);
    if (!page || page.level < 2 || page.level > 5) return;
    const timer = window.setTimeout(() => setOceanSceneReady(true), reducedMotion ? 50 : 240);
    return () => window.clearTimeout(timer);
  }, [page?.level, reducedMotion]);
  if (page && page.level >= 2 && page.level <= 5) {
    const collected = new Set(ftueProgress.oceanCollectedStickers);
    return <section className={styles.oceanAlbumPage} data-ready={oceanSceneReady ? "true" : undefined} data-complete={collected.size === 12 ? "true" : undefined}>
      <header><small>WORD KINGDOM COLLECTION</small><h1>{oceanAlbum.title}</h1><p>{collected.size}/12 stickers collected</p></header>
      <div className={styles.oceanAlbumProgress} aria-label={`${collected.size} of 12 Ocean stickers collected`}><i style={{ width: `${collected.size / 12 * 100}%` }} /></div>
      <div className={styles.oceanAlbumScene} style={{ backgroundImage: `linear-gradient(rgba(4,34,73,.08),rgba(2,28,67,.2)),url("${oceanAlbum.backgroundImage}")` }}>
        {oceanAlbum.stickers.map((slot) => {
          const isCollected = collected.has(slot.id);
          return <article className={styles.oceanAlbumSlot} data-collected={isCollected ? "true" : undefined} key={slot.id} style={{ left: `${slot.x}%`, top: `${slot.y}%`, transform: `translate(-50%,-50%) rotate(${slot.rotation}deg) scale(${slot.scale})` }} aria-label={`${OCEAN_STICKER_LABELS[slot.id]}: ${isCollected ? "collected" : "missing"}`}>
            <OceanStickerVisual sticker={slot.id} missing={!isCollected} />
            <b>{isCollected ? OCEAN_STICKER_LABELS[slot.id] : "?"}</b>
          </article>;
        })}
      </div>
      <button ref={continueRef} className={styles.albumPageContinue} disabled={!oceanSceneReady} onClick={onContinuePage}>{collected.size === 12 ? "CONTINUE TO FOREST KINGDOM" : "CONTINUE"}</button>
    </section>;
  }
  if (page) {
    const stickerStyle = {
      left: `${page.sticker.x}%`,
      top: `${page.sticker.y}%`,
      transform: `translate(-50%,-50%) scale(${page.sticker.scale})`,
    } as CSSProperties;
    return <section className={styles.albumStoryPage} data-theme={page.theme} data-treatment={page.treatment} style={{ backgroundImage: `linear-gradient(rgba(7,28,65,.08),rgba(4,20,48,.36)),url("${page.backgroundImage}")`, backgroundPosition: page.backgroundPosition }}>
      <header><small>WORD KINGDOM · ALBUM PAGE {page.level}</small><h1>{page.title}</h1></header>
      <div className={styles.albumSticker} style={stickerStyle}><span>{page.sticker.icon}</span><b>{page.sticker.label}</b><small>LEVEL {page.level} COLLECTIBLE</small></div>
      <button ref={continueRef} className={styles.albumPageContinue} onClick={onContinuePage}>CONTINUE</button>
    </section>;
  }
  if (collectionProps.activeChapter.chapterId === "chapter_ocean" && unlockedPages.some((level) => level >= 2 && level <= 5)) {
    const latestOceanPage = unlockedPages.filter((level) => level >= 2 && level <= 5).at(-1)!;
    return <section className={styles.oceanAlbumCover}><div><DiscoveryArtwork kind="album" /><small>ROYAL COLLECTION</small><h1>Ocean Kingdom</h1><p>{ftueProgress.oceanCollectedStickers.length}/12 stickers collected</p><button onClick={() => onOpenPage(latestOceanPage)}>OPEN OCEAN ALBUM</button></div></section>;
  }
  return <section className={styles.albumPageChooser}>
    <header><small>ROYAL STORY ALBUM</small><h1>Kingdom Pages</h1><p>Every conquered level reveals a new scene.</p></header>
    <div>{pages.map((item) => <button key={item.level} disabled={!unlockedPages.includes(item.level)} data-theme={item.theme} onClick={() => onOpenPage(item.level)}><span>{unlockedPages.includes(item.level) ? item.sticker.icon : "🔒"}</span><b>Level {item.level}</b><small>{unlockedPages.includes(item.level) ? item.title : "Locked"}</small></button>)}</div>
    <AlbumCollectionPanel albums={albums} {...collectionProps} />
  </section>;
}

function AlbumCollectionPanel({ albums, player, pvp, activeChapter, onClaim, onVault, onClaimAlbum, onRepair }: { albums: AlbumDefinition[]; player: V3PlayerState; pvp: PvpState; activeChapter: ChapterDefinition; onClaim: (setId: string) => void; onVault: () => void; onClaimAlbum: (albumId: string) => void; onRepair: (cardId: string) => void }) {
  const [albumId, setAlbumId] = useState(activeChapter.albumId);
  const [setIndex, setSetIndex] = useState(0);
  const album = albumManager.album(albumId);
  const set = album.sets[setIndex] ?? album.sets[0];
  const progress = albumManager.setProgress(player, set);
  const albumComplete = albumManager.isAlbumComplete(player, album);
  const albumClaimed = player.claimedAlbumRewards.includes(album.albumId);
  const themeIcons: Record<string, string> = { OCEAN_ABYSS: "🐚", ENCHANTED_FOREST: "🌲", DESERT_RUINS: "🏺", STARFALL_REALM: "🚀", FROZEN_KEEP: "❄️" };
  const totalCards = album.sets.reduce((sum, item) => sum + item.cards.length, 0);
  return <section className={`${base.hubPanel} ${styles.albumPanel}`}><header className={styles.albumHeader}><div><small>ROYAL COLLECTION</small><h1>{album.albumName}</h1><p>{album.sets.reduce((sum, item) => sum + albumManager.setProgress(player, item), 0)}/{totalCards} cards collected</p></div><div className={styles.vaultMeter}><span>VAULT ⭐</span><b>{player.vaultStars}/100</b><i><em style={{ width: `${Math.min(100, player.vaultStars)}%` }} /></i><button disabled={player.vaultStars < 100} onClick={onVault}>OPEN</button></div></header><div className={styles.albumTabs}>{albums.map((item) => <button key={item.albumId} disabled={!player.unlockedChapterIds.includes(item.chapterId)} className={item.albumId === albumId ? styles.activeAlbum : ""} onClick={() => { setAlbumId(item.albumId); setSetIndex(0); }}>{themeIcons[item.themeKey] ?? "👑"}<span>{item.albumName}</span></button>)}</div><div className={styles.setTabs}>{album.sets.map((item, index) => <button className={index === setIndex ? styles.activeSet : ""} onClick={() => setSetIndex(index)} key={item.setId}>{index + 1}<span>{albumManager.setProgress(player, item)}/{item.cards.length}</span></button>)}</div><div className={styles.setTitle}><div><small>SET {setIndex + 1}</small><h2>{set.setName}</h2></div><button disabled={progress < set.cards.length || player.claimedSetRewards.includes(set.setId)} onClick={() => onClaim(set.setId)}>{player.claimedSetRewards.includes(set.setId) ? "CLAIMED" : `CLAIM · ⚡${set.completionReward.energy}`}</button></div><div className={styles.cardGrid}>{set.cards.map((card) => { const count = player.cards[card.cardId] ?? 0; const protectedCard = pvp.protectedCardIds.includes(card.cardId); const damaged = pvp.damagedCardIds.includes(card.cardId); return <article className={`${count ? styles.ownedCard : styles.missingCard} ${protectedCard ? styles.protectedCard : ""} ${damaged ? styles.damagedCard : ""}`} data-rarity={card.rarity} key={card.cardId}><div className={styles.cardArt}>{count ? card.icon : "?"}</div><small>{"★".repeat(card.rarity)}</small><b>{count ? card.name : "Missing"}</b>{protectedCard && <span className={styles.cardStatus}>🛡️ PROTECTED</span>}{damaged && <button className={styles.repairCardButton} onClick={() => onRepair(card.cardId)}>REPAIR · 🪙 {CARD_REPAIR_COST}</button>}{count > 1 && <em>×{count}</em>}</article>; })}</div><footer className={styles.setReward}><span>🎁</span><div><small>SET COMPLETION</small><b>⚡ {set.completionReward.energy} + 🪙 {formatNumber(set.completionReward.coins)}</b></div><em>{progress}/{set.cards.length}</em></footer><div className={styles.albumGrandReward}><span>👑</span><div><small>FULL ALBUM REWARD</small><b>{album.completionReward.frame} Frame</b><p>{album.completionReward.badge} Badge</p></div><button disabled={!albumComplete || albumClaimed} onClick={() => onClaimAlbum(album.albumId)}>{albumClaimed ? "CLAIMED" : "CLAIM"}</button></div></section>;
}

function PackShop({ player, onBuy }: { player: V3PlayerState; onBuy: (tier: PackTier) => void }) {
  const packs: Array<{ tier: PackTier; icon: string; cards: number }> = [{ tier: "GREEN", icon: "🟢", cards: 2 }, { tier: "BLUE", icon: "🔵", cards: 3 }, { tier: "GOLD", icon: "🟡", cards: 4 }];
  return <section className={base.hubPanel}><header className={base.panelHeader}><small>ROYAL MARKET</small><h1>Card Pack Shop</h1><p>Spend Raid coins on new cards and Vault Stars.</p></header><div className={styles.simpleGrid}>{packs.map((pack) => <article key={pack.tier}><span>{pack.icon}</span><div><b>{pack.tier} Pack</b><small>{pack.cards} Cards</small></div><button disabled={player.coins < PACK_COSTS[pack.tier]} onClick={() => onBuy(pack.tier)}>🪙 {formatNumber(PACK_COSTS[pack.tier])}</button></article>)}</div></section>;
}

function SimplePanel({ eyebrow, title, copy, items, onAction }: { eyebrow: string; title: string; copy: string; items: string[][]; onAction: () => void }) {
  return <section className={base.hubPanel}><header className={base.panelHeader}><small>{eyebrow}</small><h1>{title}</h1><p>{copy}</p></header><div className={styles.simpleGrid}>{items.map(([icon, name, detail]) => <article key={name}><span>{icon}</span><div><b>{name}</b><small>{detail}</small></div><button onClick={onAction}>VIEW</button></article>)}</div></section>;
}

function BottomNav({ active, albumButtonRef, albumUnlocked, albumNotifications, guideAlbum, tutorialLock, onChange }: { active: Tab; albumButtonRef: RefObject<HTMLButtonElement | null>; albumUnlocked: boolean; albumNotifications: number; guideAlbum: boolean; tutorialLock: boolean; onChange: (tab: Tab) => void }) {
  const tabs: Array<{ id: Tab; icon: string; label: string }> = [{ id: "shop", icon: "🛒", label: "Shop" }, { id: "teams", icon: "🛡️", label: "Teams" }, { id: "home", icon: "👑", label: "Conquest" }, { id: "events", icon: "🏆", label: "Events" }, { id: "albums", icon: "🃏", label: "Albums" }];
  return <nav className={`${base.bottomNav} ${styles.mobileBottomNav}`}>{tabs.filter((item) => item.id !== "albums" || albumUnlocked).map((item) => <button ref={item.id === "albums" ? albumButtonRef : undefined} disabled={tutorialLock && (!guideAlbum || item.id !== "albums")} className={`${active === item.id ? `${base.activeTab} ${styles.mobileActiveTab}` : ""} ${item.id === "albums" && guideAlbum ? styles.albumGuideButton : ""}`} onClick={() => onChange(item.id)} key={item.id}><span>{item.id === "albums" ? <DiscoveryArtwork kind="album" /> : item.icon}</span><b>{item.label}</b>{item.id === "albums" && albumNotifications > 0 && <i>{albumNotifications}</i>}</button>)}</nav>;
}

function SettingsModal({ account, signOutUrl, player, onToggle, onRestart, onHowToPlay, onClose }: { account: PlayerAccount; signOutUrl: string; player: V3PlayerState; onToggle: (key: keyof PlayerSettings) => void; onRestart: () => Promise<void>; onHowToPlay: () => void; onClose: () => void }) {
  const [restartStage, setRestartStage] = useState<0 | 1 | 2>(0);
  const [restarting, setRestarting] = useState(false);
  const [restartError, setRestartError] = useState("");

  const confirmRestart = async () => {
    setRestarting(true);
    setRestartError("");
    try {
      await onRestart();
    } catch {
      setRestarting(false);
      setRestartError("Progress could not be restarted. Nothing was deleted — please try again.");
    }
  };

  return <div className={base.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="settings-title"><section className={base.settingsModal}><button className={base.modalClose} onClick={onClose} disabled={restarting}>×</button><span className={base.modalIcon}>⚙</span><h2 id="settings-title">Settings</h2><p>Signed in as <b>{account.displayName}</b><br /><small>{account.email}</small></p>{([['sfx','Sound Effects'],['bgm','Background Music'],['haptics','Haptics']] as Array<[keyof PlayerSettings,string]>).map(([key, label]) => <button className={base.settingRow} onClick={() => onToggle(key)} key={key} disabled={restarting}><span><b>{label}</b><small>Saved to your account</small></span><i className={player.settings[key] ? base.settingOn : ""}>{player.settings[key] ? "ON" : "OFF"}</i></button>)}
    <button className={styles.howToPlayButton} onClick={onHowToPlay} disabled={restarting}>How to Play</button>
    {restartStage === 0 && <button className={styles.restartProgressButton} onClick={() => setRestartStage(1)}>Restart Progress</button>}
    {restartStage === 1 && <div className={styles.restartConfirm} role="alert"><b>Restart from Level 1? All game progress will be deleted.</b><div><button onClick={() => setRestartStage(0)}>CANCEL</button><button className={styles.restartContinue} onClick={() => setRestartStage(2)}>CONTINUE</button></div></div>}
    {restartStage === 2 && <div className={styles.restartConfirm} role="alert"><b>Are you absolutely sure?</b><p>This cannot be undone. Your account will start again from Level 1.</p><div><button onClick={() => setRestartStage(0)} disabled={restarting}>KEEP PROGRESS</button><button className={styles.restartFinal} onClick={confirmRestart} disabled={restarting}>{restarting ? "RESTARTING…" : "YES, RESTART"}</button></div></div>}
    {restartError && <p className={styles.restartError} role="status">{restartError}</p>}
    <a className={styles.signOutButton} href={signOutUrl}>SIGN OUT</a></section></div>;
}

function TutorialLibrary({ maxLevel, onClose }: { maxLevel: number; onClose: () => void }) {
  const [level, setLevel] = useState(1);
  const definition = tutorialDefinition(level);
  const fallback: Record<number, string> = {
    2: "Find the active words and watch the board reveal new paths.",
    5: "Complete Coral Kingdom and prepare for the Forest Kingdom.",
  };
  return <div className={base.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="tutorial-library-title"><section className={styles.tutorialLibrary}>
    <button className={base.modalClose} onClick={onClose} aria-label="Close How to Play">×</button>
    <small>REPLAY WITHOUT REWARDS</small><h2 id="tutorial-library-title">How to Play</h2>
    <div className={styles.tutorialLevelTabs}>{Array.from({ length: maxLevel }, (_, index) => index + 1).map((item) => <button key={item} data-active={item === level} onClick={() => setLevel(item)}>{item}</button>)}</div>
    <article><span>{level <= 5 ? "🐚" : "🌿"}</span><small>LEVEL {level}</small><h3>{definition?.feature.toString().toUpperCase() ?? "PRACTICE"}</h3><p>{definition?.instruction ?? fallback[level] ?? "Replay this level to practise the systems you have unlocked."}</p></article>
    <p className={styles.replaySafety}>Tutorial replay never grants extra cards, powers, tokens, or rewards.</p>
    <button className={styles.pvpContinue} onClick={onClose}>CONTINUE</button>
  </section></div>;
}

function AlbumTransition({ state, reducedMotion }: { state: AlbumTransitionState; reducedMotion: boolean }) {
  return <div className={styles.albumTransition} data-kind={reducedMotion ? "fade" : state.kind} aria-hidden="true">
    {state.kind === "bubbles" && !reducedMotion && Array.from({ length: 30 }, (_, index) => {
      const left = (index * 41 + 7) % 100;
      const size = 6 + ((index * 13) % 22);
      const duration = 1.3 + ((index * 7) % 20) / 20;
      const delay = ((index * 173) % 38) / 20;
      const drift = (index % 2 === 0 ? 1 : -1) * (8 + (index * 5) % 16);
      return <i key={index} style={{ "--left": `${left}%`, "--size": `${size}px`, "--duration": `${duration}s`, "--delay": `${delay}s`, "--drift": `${drift}px` } as CSSProperties} />;
    })}
    {state.kind === "vines" && !reducedMotion && <><b /><b /><span>🍃</span><span>✦</span><span>🍃</span></>}
  </div>;
}

function PackModal({ result, onClose }: { result: PackResult; onClose: () => void }) {
  return <div className={base.modalOverlay} role="dialog" aria-modal="true"><section className={styles.packModal} data-tier={result.tier}><small>{result.tier} PACK</small><h2>Royal cards revealed!</h2><div>{result.cards.map((card, index) => <article key={`${card.cardId}-${index}`} data-rarity={card.rarity}><span>{card.icon}</span><b>{card.name}</b><small>{"★".repeat(card.rarity)}</small><em>{card.isNew ? "NEW!" : `DUPLICATE +${[0,1,2,4,8,15][card.rarity]} ⭐`}</em></article>)}</div>{result.vaultStarsEarned > 0 && <p>+{result.vaultStarsEarned} Vault Stars</p>}<button onClick={onClose}>COLLECT</button></section></div>;
}

function PowerTutorialPrompt({ kind }: { kind: PowerUpKind }) {
  const copy: Record<PowerUpKind, string> = {
    shield: "Shield protects one of your collectibles.",
    attack: "Attack breaks an opponent's Shield.",
    steal: "Steal takes an unprotected collectible.",
    raid: "Choose boxes to reveal coins and collectible rewards.",
  };
  return <div className={styles.powerTutorialPrompt} role="status">{copy[kind]}</div>;
}

function Result({ label, value }: { label: string; value: string }) { return <div className={base.result}><span>{label}</span><b>{value}</b></div>; }

function LoginIntro({ onClose }: { onClose: () => void }) {
  const [playbackError, setPlaybackError] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const canEnter = playbackError || videoEnded;

  return <section className={styles.loginIntro} role="dialog" aria-modal="true" aria-label="Welcome to Word Kingdom">
    <video
      autoPlay
      muted
      playsInline
      preload="auto"
      onEnded={() => setVideoEnded(true)}
      onError={() => setPlaybackError(true)}
      aria-label="Word Kingdom introduction"
    >
      <source src="/word-kingdom-login-intro.mp4" type="video/mp4" />
    </video>
    <div className={styles.loginIntroChrome}>
      {canEnter && <button type="button" onClick={onClose}>ENTER KINGDOM</button>}
    </div>
  </section>;
}

function PvpEventOverlay({ state, ownedCards, onAttack, onSteal, onUseLater, onShield, onPick, onClose }: { state: PvpOverlayState; ownedCards: CardDefinition[]; onAttack: (cardId: string) => void; onSteal: () => void; onUseLater: () => void; onShield: (cardId: string) => void; onPick: (chestId: string, source?: FxPoint) => void; onClose: () => void }) {
  if (state.kind === "raid") {
    return <div className={`${base.eventOverlay} ${styles.pvpOverlay}`} role="dialog" aria-modal="true"><section className={`${base.eventCard} ${styles.pvpEventCard}`} data-event="raid"><div className={base.eventIcon}>💰</div><span className={base.kicker}>{state.tutorial ? "OPEN THREE BOXES." : "COIN RAID"}</span><h2>Raid {state.session.target.displayName}</h2><p>The jackpot was locked in before your first pick. Choose exactly three of nine boxes.</p><div className={styles.raidStatus}><span>{state.session.picksRemaining} PICKS LEFT</span><b>🪙 {formatNumber(state.session.coinsWon)}</b></div><div className={`${styles.vaultGrid} ${styles.nineVaultGrid}`}>{state.session.chests.map((chest, index) => { const revealed = state.session.pickedIds.includes(chest.id); const guideFirstPick = state.tutorial && state.session.pickedIds.length === 0 && index === 0; return <button key={chest.id} className={guideFirstPick ? styles.guidedVaultBox : undefined} disabled={revealed || state.session.complete} data-revealed={revealed} data-tier={revealed ? chest.tier : undefined} onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); onPick(chest.id, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }); }}><span>{revealed ? chest.tier === "jackpot" ? "👑" : chest.coins ? "🪙" : "✨" : "🔒"}</span><b>{revealed ? formatNumber(chest.coins) : index + 1}</b><small>{revealed ? chest.tier.toUpperCase() : "CLOSED"}</small></button>; })}</div>{state.session.complete && <div className={styles.pvpResultBanner}><small>RAID COMPLETE</small><b>+{formatNumber(state.session.coinsWon)} Coins</b><span>Coins go straight to your persistent balance.</span></div>}<button className={styles.pvpContinue} disabled={!state.session.complete} onClick={onClose}>{state.session.complete ? "COLLECT COINS" : "CHOOSE 3 BOXES"}</button></section></div>;
  }
  if (state.kind === "attack") {
    return <div className={`${base.eventOverlay} ${styles.pvpOverlay}`} role="dialog" aria-modal="true"><section className={`${base.eventCard} ${styles.pvpEventCard}`} data-event="attack"><div className={base.eventIcon}>⚔️</div><span className={base.kicker}>{state.tutorial ? "CHOOSE ONE CARD TO ATTACK." : "CARD ATTACK"}</span><h2>{state.target.displayName}</h2>{!state.result ? <div className={styles.metaCardChoice}>{state.target.cards.filter((card) => !card.stolen).map((card) => <button key={card.cardId} onClick={() => onAttack(card.cardId)}><span>{card.icon}</span><b>{card.name}</b><small>{card.shielded ? "Shield status hidden" : "Visible rival card"}</small></button>)}</div> : <div className={styles.pvpResultBanner}><small>{state.result.blocked ? "SHIELD BROKE" : "DIRECT HIT"}</small><b>{state.result.card.name}</b><span>{state.result.blocked ? "The card was protected and remains safe." : "The card is Damaged, not deleted."}</span></div>}<button className={styles.pvpContinue} disabled={!state.result} onClick={onClose}>{state.result ? "CONTINUE" : "CHOOSE A CARD"}</button></section></div>;
  }
  if (state.kind === "steal") {
    const result = state.session.result;
    return <div className={`${base.eventOverlay} ${styles.pvpOverlay}`} role="dialog" aria-modal="true"><section className={`${base.eventCard} ${styles.pvpEventCard}`} data-event="steal" data-steal-status={state.session.status}><div className={base.eventIcon}>🃏</div><span className={base.kicker}>{state.tutorial ? "STEAL ONE ELIGIBLE CARD." : "CARD STEAL"}</span><h2>{state.target.displayName}</h2><p>The eligible card is selected randomly. Tutorial cards and completed collections stay safe.</p>{result && <div className={styles.pvpResultBanner}><small>{result.blocked ? "STEAL BLOCKED" : "CARD STOLEN"}</small><b>{result.blocked ? "Steal Blocked." : result.card?.name ?? "Royal Card"}</b><span>{result.blocked ? "The card's Shield was consumed and the card stayed safe." : "The card was added to your Album."}</span></div>}{result ? <button className={styles.pvpContinue} onClick={onClose}>CONTINUE</button> : <div className={styles.stealActions}><button className={styles.pvpContinue} disabled={state.busy} onClick={onSteal}>{state.busy ? "CHOOSING…" : "STEAL A CARD"}</button><button className={styles.briefingSecondary} disabled={state.busy} onClick={onUseLater}>USE LATER</button></div>}</section></div>;
  }
  return <div className={`${base.eventOverlay} ${styles.pvpOverlay}`} role="dialog" aria-modal="true"><section className={`${base.eventCard} ${styles.pvpEventCard}`} data-event="shield"><div className={base.eventIcon}>🛡️</div><span className={base.kicker}>{state.tutorial ? "PROTECT ONE OF YOUR CARDS." : "CARD SHIELD"}</span><h2>{state.result?.blocked ? "Shield blocked the Attack!" : state.protectedCardId ? "Card protected" : "Choose a card"}</h2>{!state.protectedCardId ? <div className={styles.metaCardChoice}>{ownedCards.map((card) => <button key={card.cardId} onClick={() => onShield(card.cardId)}><span>{card.icon}</span><b>{card.name}</b><small>Protect from one Attack or Steal</small></button>)}</div> : <div className={styles.pvpResultBanner}><small>{state.result?.blocked ? "SCRIPTED ATTACK BLOCKED" : "SHIELD EQUIPPED"}</small><b>{ownedCards.find((card) => card.cardId === state.protectedCardId)?.name ?? "Royal Card"}</b><span>{state.result?.blocked ? "The Shield was consumed exactly once." : "Protection is now visible in your Album."}</span></div>}<button className={styles.pvpContinue} disabled={!state.protectedCardId} onClick={onClose}>{state.protectedCardId ? "CONTINUE" : "CHOOSE A CARD"}</button></section></div>;
}

function LegacyPvpEventOverlay({ state, onPick, onClose }: { state: any; onPick: (chestId: string, source?: FxPoint) => void; onClose: () => void }) {
  if (state.kind === "raid") {
    const { session } = state;
    return <div className={`${base.eventOverlay} ${styles.pvpOverlay}`} role="dialog" aria-modal="true" aria-label="Legacy raid"><section className={`${base.eventCard} ${styles.pvpEventCard}`}><h2>Legacy event</h2><button onClick={onClose}>Close</button></section></div>;
  }

  if (state.kind === "attack") {
    const { result } = state;
    return <div className={`${base.eventOverlay} ${styles.pvpOverlay}`} role="dialog" aria-modal="true" aria-label="Rival attack result"><section className={`${base.eventCard} ${styles.pvpEventCard}`} data-event="attack"><div className={base.eventIcon}>{result.blocked ? "💥" : "⚔️"}</div><span className={base.kicker}>RANDOM RIVAL TARGET</span><div className={styles.rivalTarget}><span>{result.target.avatar}</span><div><small>DEFENDER</small><b>{result.target.displayName}</b><em>{result.target.activeShields} Shields remaining</em></div></div><h2>{result.blocked ? "Shield shattered!" : "Vault breached!"}</h2><p>{result.blocked ? "The defender consumed one Shield. You still receive a Blocked consolation reward." : "No Shield was active, so 15% of the rival's unspent Coin Bank was stolen."}</p><div className={`${styles.pvpResultBanner} ${result.blocked ? styles.blockedBanner : styles.successBanner}`}><small>{result.blocked ? "BLOCKED REWARD" : "STOLEN"}</small><b>+{formatNumber(result.coinsWon)} Coins</b><span>Green Card Pack secured</span></div><div className={styles.notificationReceipt}>🔔 {result.notification.message}</div><button className={styles.pvpContinue} onClick={onClose}>CLAIM & RESUME</button></section></div>;
  }

  const { result } = state;
  return <div className={`${base.eventOverlay} ${styles.pvpOverlay}`} role="dialog" aria-modal="true" aria-label="Shield fragment earned"><section className={`${base.eventCard} ${styles.pvpEventCard}`} data-event="shield"><div className={base.eventIcon}>🛡️</div><span className={base.kicker}>RARE DEFENSE DROP</span><h2>{result.forgedShield ? "Full Shield forged!" : result.capacityReached ? "Shield vault full" : "Shield fragment earned!"}</h2><p>{result.forgedShield ? "Three fragments combined into one Active Shield. The next incoming attack will shatter it instead of stealing Coins." : result.capacityReached ? "You already hold the maximum of three Active Shields. Future Blue drops convert to Raid Gold." : "Collect two more fragment sets across future boards to forge one Active Shield."}</p><div className={styles.shieldForge}><span>{[0, 1, 2].map((slot) => <i className={slot < result.activeShields ? styles.activeShield : ""} key={slot}>🛡️</i>)}</span><div><small>ACTIVE SHIELDS</small><b>{result.activeShields}/3</b></div></div><div className={styles.fragmentForge}><small>SHIELD FRAGMENTS</small><i><em style={{ width: `${(result.shieldFragments / 3) * 100}%` }} /></i><b>{result.shieldFragments}/3</b></div><button className={styles.pvpContinue} onClick={onClose}>STORE & RESUME</button></section></div>;
}
