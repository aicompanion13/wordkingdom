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
import { considerCelebration, createPraiseBudget } from "@/game/v3/praise-budget";
import type { CelebrationBannerKind } from "@/game/v3/praise-budget";
import {
  createLevelTimer,
  formatLevelClock,
  isLevelTimeUrgent,
  levelTimeRemainingMs,
  pauseLevelTimer,
  resumeLevelTimer,
} from "@/game/v3/level-timer";
import type { LevelTimerState } from "@/game/v3/level-timer";
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
import { EconomyManagerV3, ENERGY_CAP, ENERGY_REGEN_MS, HINT_POOL_CAP, hintsThatLand } from "@/game/v3/economy-manager";
import { FeedbackOverlay } from "@/game/v3/feedback/FeedbackOverlay";
import { useLongPress } from "@/game/v3/feedback/useLongPress";
import { JuiceAnimationSystem } from "@/game/v3/juice-animation-system";
import type { FxPoint, JuiceEffect } from "@/game/v3/juice-animation-system";
import { ObjectiveManager } from "@/game/v3/objective-manager";
import { ObstacleManager } from "@/game/v3/obstacle-manager";
import { PackResolver } from "@/game/v3/pack-resolver";
import { PvpManager } from "@/game/v3/pvp-manager";
import { TrackManager } from "@/game/v3/track-manager";
import { chapterThemeForLevel } from "@/game/v3/chapter-theme";
import { CLEAN_WORLD_MAP_LAYOUTS } from "@/game/v3/clean-world-map-layouts";
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
  beginOceanStickerReveal,
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
  FTUE_HINT_OFFER_MS,
  FTUE_HINT_LIMIT,
  ftueGuidanceEnabled,
  ftueStallStage,
  ftueStorageKey,
  grantFtueCredit,
  isUsefulActivePath,
  markFtueBeat,
  markIntroVideoSeen,
  migrateFtueProgress,
  dismissOceanAlbumMessage,
  dismissOceanPackMessage,
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
import { KingdomPopup } from "./KingdomPopup";
import { ConceptCard, DiscoveryArtwork, FtueCoachmark } from "./FtueCoachmarks";
import { ObjectiveTray } from "./ObjectiveTray";
import { LevelCompletePanel } from "./LevelCompletePanel";
import { useWordKingdomAudio } from "./useWordKingdomAudio";
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
const CELEBRATION_BANNERS: Record<CelebrationBannerKind, { src: string; alt: string }> = {
  "great-word": { src: "/banners/great-word.webp", alt: "Great Word!" },
  "royal-combo": { src: "/banners/royal-combo.webp", alt: "Royal Combo!" },
  "bonus-found": { src: "/banners/bonus-found.webp", alt: "Bonus Found!" },
  "keep-going": { src: "/banners/keep-going.webp", alt: "Keep Going!" },
  "on-fire": { src: "/banners/on-fire.webp", alt: "On Fire!" },
  "one-more": { src: "/banners/one-more.webp", alt: "One More!" },
};
const GREAT_WORD_MIN_LENGTH = 7;
const ROYAL_COMBO_THRESHOLD = scoringConfig.comboLadder[3];
const ON_FIRE_THRESHOLD = scoringConfig.comboLadder[scoringConfig.comboLadder.length - 1];
const KEEP_GOING_MIN_BROKEN_COMBO = scoringConfig.comboLadder[1];
const CELEBRATION_HOLD_MS = 1450;
const CELEBRATION_FADE_MS = 220;
const BADGES: Record<BadgeType, { icon: string; label: string }> = {
  attack: { icon: "/power-badges/badge-attack.webp", label: "Attack" }, steal: { icon: "/power-badges/badge-steal.webp", label: "Steal" }, raid: { icon: "/power-badges/badge-raid.webp", label: "Raid" }, shield: { icon: "/power-badges/badge-shield.webp", label: "Shield" },
};
const RAID_BOX_ART: Record<"locked" | "jackpot" | "medium" | "small" | "empty", string> = {
  locked: "/raid-boxes/box-locked.webp",
  jackpot: "/raid-boxes/box-jackpot.webp",
  medium: "/raid-boxes/box-medium.webp",
  small: "/raid-boxes/box-small.webp",
  empty: "/raid-boxes/box-empty.webp",
};

type WorldMapId = "ocean" | "forest";
type WorldMapMessageId = "welcome" | "album" | "forest" | null;
type WorldMapDefinition = {
  id: WorldMapId;
  chapterId: string;
  title: string;
  levels: readonly number[];
  background: string;
  intrinsicWidth: number;
  intrinsicHeight: number;
  levelHotspots: Readonly<Record<number, { x: number; y: number; milestone?: "raid" | "album" }>>;
  album: { x: number; y: number };
  raidChest: { x: number; y: number };
  gate: { x: number; y: number };
};

const WORLD_MAPS: Record<WorldMapId, WorldMapDefinition> = {
  ocean: {
    id: "ocean",
    chapterId: "chapter_ocean",
    title: "OCEAN KINGDOM",
    levels: CLEAN_WORLD_MAP_LAYOUTS.ocean.levels,
    background: CLEAN_WORLD_MAP_LAYOUTS.ocean.asset,
    intrinsicWidth: CLEAN_WORLD_MAP_LAYOUTS.ocean.intrinsicWidth,
    intrinsicHeight: CLEAN_WORLD_MAP_LAYOUTS.ocean.intrinsicHeight,
    levelHotspots: CLEAN_WORLD_MAP_LAYOUTS.ocean.levelHotspots,
    album: CLEAN_WORLD_MAP_LAYOUTS.ocean.album,
    raidChest: CLEAN_WORLD_MAP_LAYOUTS.ocean.raidChest,
    gate: CLEAN_WORLD_MAP_LAYOUTS.ocean.gate,
  },
  forest: {
    id: "forest",
    chapterId: "chapter_forest",
    title: "FOREST KINGDOM",
    levels: CLEAN_WORLD_MAP_LAYOUTS.forest.levels,
    background: CLEAN_WORLD_MAP_LAYOUTS.forest.asset,
    intrinsicWidth: CLEAN_WORLD_MAP_LAYOUTS.forest.intrinsicWidth,
    intrinsicHeight: CLEAN_WORLD_MAP_LAYOUTS.forest.intrinsicHeight,
    levelHotspots: CLEAN_WORLD_MAP_LAYOUTS.forest.levelHotspots,
    album: CLEAN_WORLD_MAP_LAYOUTS.forest.album,
    raidChest: CLEAN_WORLD_MAP_LAYOUTS.forest.raidChest,
    gate: CLEAN_WORLD_MAP_LAYOUTS.forest.gate,
  },
};

const POWER_ORDER: readonly BadgeType[] = ["shield", "attack", "steal", "raid"];
const RAID_FIRST_LEVEL = 3;
const RAID_GUARANTEED_INTERVAL = 4;
const isScheduledRaidTopUp = (level: number) =>
  level > RAID_FIRST_LEVEL && (level - RAID_FIRST_LEVEL) % RAID_GUARANTEED_INTERVAL === 0;
/** Below this level hints are free; from here on they are drawn from the pool. */
const HINT_POOL_INTRO_LEVEL = 4;
/**
 * Hints now arrive with every completed level via the track reward, so there is no separate
 * refill schedule. The FTUE is graded generously for the same reason the boards are easy.
 */
const FULL_STARS_THROUGH_LEVEL = 10;

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
  | { kind: "first-word"; messageOpen: boolean }
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

function playerBackupKey(accountId: string): string {
  return `wk-v3-player-backup:${accountId}`;
}

/** Last known good state mirrored on this device, used only when the cloud load fails outright. */
function readLocalBackup(accountId: string): { player: V3PlayerState; pvp: PvpState } | null {
  try {
    const raw = window.localStorage.getItem(playerBackupKey(accountId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { player?: V3PlayerState; pvp?: PvpState };
    if (!parsed?.player || !parsed?.pvp) return null;
    if (!Number.isFinite(parsed.player.currentLevel)) return null;
    return { player: parsed.player, pvp: parsed.pvp };
  } catch {
    return null;
  }
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
  const [feedbackOpen, setFeedbackOpen] = useState(false);
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
  const [contextualPrompt, setContextualPrompt] = useState(false);
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
  const [celebration, setCelebration] = useState<CelebrationBannerKind | null>(null);
  const [celebrationLeaving, setCelebrationLeaving] = useState(false);
  const [worldMapMessage, setWorldMapMessage] = useState<WorldMapMessageId>(null);
  const [worldMapFocus, setWorldMapFocus] = useState<"level" | "album" | "gate" | null>(null);
  const [worldMapTransition, setWorldMapTransition] = useState(false);
  const [shakingMapTarget, setShakingMapTarget] = useState<string | null>(null);
  const [acknowledgedPowerIntro, setAcknowledgedPowerIntro] = useState<PowerUpKind | null>(null);

  const { playSfx, playTileSelect, setMusic } = useWordKingdomAudio({
    sfxEnabled: player.settings.sfx,
    bgmEnabled: player.settings.bgm,
  });

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
  const dragStart = useRef<Position | null>(null);
  const dragging = useRef(false);
  const celebrationTimeout = useRef<number | undefined>(undefined);
  const celebrationLeaveTimeout = useRef<number | undefined>(undefined);
  const celebrationShown = useRef({ royalCombo: false, onFire: false });
  /* Board-scoped praise budget: how many spent, and the solve that spent the last one. */
  const praiseBudget = useRef(createPraiseBudget());
  const solveIndex = useRef(0);
  const levelTimer = useRef<LevelTimerState | null>(null);
  const boardCardRef = useRef<HTMLDivElement | null>(null);
  const cloudReady = useRef(false);
  const cloudSaveTimer = useRef<number | null>(null);
  const cloudSaveInFlight = useRef<Promise<void> | null>(null);
  const pendingCloudSave = useRef<{ player: V3PlayerState; pvp: PvpState } | null>(null);
  const ftueLastUsefulAt = useRef(Date.now());
  const ftueProgressRef = useRef(ftueProgress);
  const ftueFirstChangeAt = useRef(0);
  const completedMetaLevel = useRef(0);
  const stealResolutionLock = useRef(false);
  const ftueRecoveryAttempted = useRef(false);
  const albumButtonRef = useRef<HTMLButtonElement>(null);
  const levelPlayButtonRef = useRef<HTMLButtonElement>(null);
  const mapAlbumButtonRef = useRef<HTMLButtonElement>(null);
  const mapGateButtonRef = useRef<HTMLButtonElement>(null);
  const hintButtonRef = useRef<HTMLButtonElement>(null);
  const audibleDialogRef = useRef<string | null>(null);

  const writeLocalBackup = (nextPlayer: V3PlayerState, nextPvp: PvpState) => {
    try {
      window.localStorage.setItem(playerBackupKey(account.email), JSON.stringify({ player: nextPlayer, pvp: nextPvp }));
    } catch {
      // Browser storage can be unavailable; the cloud save stays authoritative.
    }
  };

  const queueCloudSave = (nextPlayer: V3PlayerState, nextPvp: PvpState) => {
    if (!cloudReady.current) return;
    // Mirror locally first: this survives the tab closing before the debounce fires.
    writeLocalBackup(nextPlayer, nextPvp);
    pendingCloudSave.current = { player: nextPlayer, pvp: nextPvp };
    if (cloudSaveTimer.current !== null) window.clearTimeout(cloudSaveTimer.current);
    cloudSaveTimer.current = window.setTimeout(() => {
      cloudSaveTimer.current = null;
      pendingCloudSave.current = null;
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
        .catch(() => setToast("Progress is saved on this device, but cloud sync needs a retry."))
        .finally(() => {
          if (cloudSaveInFlight.current === request) cloudSaveInFlight.current = null;
        });
    }, 180);
  };

  // Send any debounced save immediately. `keepalive` lets the request outlive the page,
  // which is the whole point when the player closes the tab right after a reward.
  const flushCloudSave = () => {
    if (cloudSaveTimer.current !== null) {
      window.clearTimeout(cloudSaveTimer.current);
      cloudSaveTimer.current = null;
    }
    const pending = pendingCloudSave.current;
    if (!pending) return;
    pendingCloudSave.current = null;
    try {
      void fetch("/api/player", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(pending),
        keepalive: true,
      }).catch(() => undefined);
    } catch {
      // The local mirror written in queueCloudSave is the fallback.
    }
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
        // Cloud gave us nothing, so fall back to this device's mirror rather than
        // showing a brand new game. cloudReady stays false, so this is never
        // written back over whatever the account actually holds.
        const backup = readLocalBackup(account.email);
        const restored = backup ? { ...freshPlayer(), ...backup.player, settings: { ...freshPlayer().settings, ...backup.player.settings } } : freshPlayer();
        const restoredPvp = backup?.pvp ?? freshPvpState();
        economy.current = new EconomyManagerV3(restored);
        pvp.current = new PvpManager(restoredPvp);
        setPlayer(economy.current.snapshot());
        const normalizedPvp = pvp.current.snapshot();
        setPvpState(normalizedPvp);
        setBadgeCounts(normalizedPvp.badgeProgress);
        setViewChapterId(track.chapterForLevel(economy.current.snapshot().currentLevel).chapterId);
        setToast(backup
          ? "Showing progress saved on this device. Reload once to sync your account."
          : "Your account could not sync yet. Please reload once.");
        setHydrated(true);
      });
    return () => {
      active = false;
      // Send the debounced save rather than dropping it on the floor.
      flushCloudSave();
    };
  }, []);

  useEffect(() => {
    const onPageHide = () => flushCloudSave();
    const onVisibilityChange = () => {
      // Mobile browsers often only fire visibilitychange when the player switches away.
      if (document.visibilityState === "hidden") flushCloudSave();
    };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    setClock(Date.now());
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (screen !== "hub" || tab !== "home" || loginIntroOpen || !hydrated || !ftueReady || worldMapMessage) return;
    if (player.currentLevel === 1 && !player.completedLevels.includes(1) && !ftueProgress.completedVisualSteps.includes("welcome-guidance")) {
      setWorldMapMessage("welcome");
      return;
    }
    if (ftueProgress.pendingMandatoryStep === "OPEN_LEVEL_2_ALBUM" && !ftueProgress.completedVisualSteps.includes("level-2-album-card")) {
      setWorldMapMessage("album");
      return;
    }
    if (viewChapterId === "chapter_forest" && !ftueProgress.completedVisualSteps.includes("forest-welcome-guidance")) {
      setWorldMapMessage("forest");
    }
  }, [ftueProgress.completedVisualSteps, ftueProgress.pendingMandatoryStep, ftueReady, hydrated, loginIntroOpen, player.completedLevels, player.currentLevel, screen, tab, viewChapterId, worldMapMessage]);

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
      if (revealCount < 3) {
        playSfx("sticker_reveal", { cooldownMs: 180 });
      } else if (ftueProgress.oceanRewardLevel === 5) {
        playSfx("album_complete", { duckMs: 3600 });
      } else if (ftueProgress.oceanRewardLevel === 2) {
        playSfx("album_unlock", { duckMs: 1080 });
      }
      updateFtueProgress(revealCount < 3 ? revealNextOceanSticker : completeOceanStickerPack);
    }, prefersReducedMotion ? 180 : revealCount < 3 ? 540 : 620);
    return () => window.clearTimeout(timer);
  }, [ftueProgress.oceanRewardPhase, ftueProgress.oceanCompletionResult, ftueProgress.oceanRewardLevel, ftueProgress.oceanStickerRevealCount, playSfx, prefersReducedMotion, screen]);

  const activeChapter = track.chapterForLevel(player.currentLevel);
  const viewedChapter = track.chapter(viewChapterId) ?? activeChapter;
  const activeArea = areas.find((area) => area.areaId === activeChapter.areaId) ?? areas[0];
  const activeAlbum = albumManager.album(activeChapter.albumId);
  const albumUnseenCount = unseenAlbumPages(ftueProgress).length;
  const currentRunLevel = runNode.current?.level ?? player.currentLevel;
  const visiblePowers = visiblePowerKinds(currentRunLevel);
  const audibleDialog = packReveal
    ? "pack"
    : pvpOverlay
      ? `power-${pvpOverlay.kind}`
      : settingsOpen
        ? "settings"
        : tutorialLibraryOpen
          ? "tutorial-library"
          : selectedNode
            ? "level"
            : levelOneCoach?.messageOpen
              ? `coach-${levelOneCoach.kind}`
              : contextualPrompt
                ? "hint-coach"
                : null;
  const shoreTutorialPath = activeWords.find((word) => word.id === "a0-shore")?.tileIds ?? [];
  const standardHintVisible = currentRunLevel >= 4
    || (currentRunLevel === 3 && (contextualPrompt || ftueProgress.completedTutorials.includes("level-3-hint")))
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
  const boardLocked = animating || Boolean(levelOneCoach?.messageOpen) || contextualPrompt || pvpOverlay !== null || packReveal !== null || settingsOpen || feedbackOpen || Boolean(boardSession.current && !boardSession.current.canAcceptInput());
  /*
   * Anything that locks the board — a Raid, a tutorial card, settings — also stops the
   * level clock, so an interruption the game imposed never costs the player board time.
   */
  useEffect(() => {
    if (!levelTimer.current) return;
    levelTimer.current = boardLocked || screen !== "board"
      ? pauseLevelTimer(levelTimer.current, Date.now())
      : resumeLevelTimer(levelTimer.current, Date.now());
  }, [boardLocked, screen]);
  const levelClockMs = levelTimer.current ? levelTimeRemainingMs(levelTimer.current, clock) : null;
  const levelClockUrgent = levelTimer.current ? isLevelTimeUrgent(levelTimer.current, clock) : false;
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
    if (loginIntroOpen) {
      setMusic(null);
      return;
    }
    if (screen === "hub") {
      setMusic(tab === "albums" ? "album" : "kingdom");
      return;
    }
    const level = screen === "summary" ? summary?.node.level ?? currentRunLevel : currentRunLevel;
    setMusic(level >= 6 && level <= 10 ? "forest" : "ocean");
  }, [currentRunLevel, loginIntroOpen, screen, setMusic, summary?.node.level, tab]);

  useEffect(() => {
    const previous = audibleDialogRef.current;
    audibleDialogRef.current = audibleDialog;
    if (audibleDialog === previous) return;
    if (!audibleDialog) {
      if (previous) playSfx("ui_popup_close");
      return;
    }
    if (audibleDialog === "pack") {
      playSfx("pack_open", { duckMs: 1250 });
      return;
    }
    if (audibleDialog.startsWith("power-")) {
      playSfx(`power_${audibleDialog.slice(6)}` as "power_attack" | "power_steal" | "power_raid" | "power_shield", { duckMs: 900 });
      return;
    }
    playSfx("ui_popup_open");
  }, [audibleDialog, playSfx]);

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
    if (screen !== "board" || currentRunLevel < 1 || currentRunLevel > 3 || hintTutorialComplete || boardLocked) return;
    const idleMs = Math.max(0, clock - ftueLastUsefulAt.current);
    if (idleMs >= FTUE_HINT_OFFER_MS) setContextualPrompt(true);
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

  const fireCelebration = (kind: CelebrationBannerKind) => {
    const verdict = considerCelebration(kind, praiseBudget.current, solveIndex.current);
    praiseBudget.current = verdict.budget;
    if (!verdict.show) return;
    window.clearTimeout(celebrationTimeout.current);
    window.clearTimeout(celebrationLeaveTimeout.current);
    setCelebrationLeaving(false);
    setCelebration(kind);
    celebrationTimeout.current = window.setTimeout(() => {
      setCelebrationLeaving(true);
      celebrationLeaveTimeout.current = window.setTimeout(() => {
        setCelebration(null);
        setCelebrationLeaving(false);
      }, CELEBRATION_FADE_MS);
    }, CELEBRATION_HOLD_MS);
  };

  const playComboSfx = (comboMultiplier: number) => {
    const comboIndex = scoringConfig.comboLadder.findIndex(
      (value) => Math.abs(value - comboMultiplier) < 0.001,
    );
    if (comboIndex === 1) playSfx("combo_2");
    else if (comboIndex === 2) playSfx("combo_3");
    else if (comboIndex >= 3) playSfx("combo_4_plus");
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
    playSfx("coin_reward", { cooldownMs: 180, volume: includeVaultReveal ? 1 : 0.82 });
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
    const retryingFailedLevel = summary?.node.level === node.level && summary.objectiveComplete === false;
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
    if (retryingFailedLevel) playSfx("level_retry", { duckMs: 800 });
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
    celebrationShown.current = { royalCombo: false, onFire: false };
    praiseBudget.current = createPraiseBudget();
    solveIndex.current = 0;
    levelTimer.current = createLevelTimer(Date.now());
    scoreIdleUnsubscribe.current = nextScorer.on("OnComboBreak", (event) => {
      if (event.reason === "idle-timeout") {
        setScore(nextScorer.snapshot());
        if (event.previous >= KEEP_GOING_MIN_BROKEN_COMBO - 0.001) fireCelebration("keep-going");
      }
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
    setLevelOneCoach(isGoldenFtueLevel && ftueGuidanceEnabled(ftueProgressRef.current) && !ftueProgressRef.current.completedVisualSteps.includes("first-word-guidance")
      ? { kind: "first-word", messageOpen: false }
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
    setContextualPrompt(false);
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
    celebrationShown.current = { royalCombo: false, onFire: false };
    praiseBudget.current = createPraiseBudget();
    solveIndex.current = 0;
    levelTimer.current = createLevelTimer(Date.now());
    scoreIdleUnsubscribe.current = nextScorer.on("OnComboBreak", (event) => {
      if (event.reason === "idle-timeout") {
        setScore(nextScorer.snapshot());
        if (event.previous >= KEEP_GOING_MIN_BROKEN_COMBO - 0.001) fireCelebration("keep-going");
      }
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
    celebrationShown.current = { royalCombo: false, onFire: false };
    praiseBudget.current = createPraiseBudget();
    solveIndex.current = 0;
    levelTimer.current = createLevelTimer(Date.now());
    scoreIdleUnsubscribe.current = nextScorer.on("OnComboBreak", (event) => {
      if (event.reason === "idle-timeout") {
        setScore(nextScorer.snapshot());
        if (event.previous >= KEEP_GOING_MIN_BROKEN_COMBO - 0.001) fireCelebration("keep-going");
      }
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
      ? { kind: "first-word", messageOpen: false }
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
    setContextualPrompt(false);
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

  const dismissHintCoach = () => {
    markTutorialComplete("level-3-hint");
    setContextualPrompt(false);
    window.setTimeout(() => hintButtonRef.current?.focus(), 0);
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
    playSfx("ui_tap");
    const theme = chapterThemeForLevel(level);
    updateFtueProgress((current) => level === 2
      ? beginLevelTwoAlbumReveal(current)
      : current);
    setAlbumTransition({ level, kind: theme.albumTransition });
    const transitionMs = prefersReducedMotion ? 220 : theme.albumTransition === "bubbles" ? 1500 : 900;
    const destinationSwitchMs = prefersReducedMotion ? 0 : theme.albumTransition === "bubbles" ? 780 : 420;
    window.setTimeout(() => {
      setScreen("hub");
      setTab("albums");
      setAlbumPageLevel(level);
      window.setTimeout(() => setAlbumTransition(null), Math.max(0, transitionMs - destinationSwitchMs));
    }, destinationSwitchMs);
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

  const focusWorldMapTarget = (target: "level" | "album" | "gate") => {
    setWorldMapFocus(target);
    window.setTimeout(() => {
      const ref = target === "level" ? levelPlayButtonRef : target === "album" ? mapAlbumButtonRef : mapGateButtonRef;
      ref.current?.focus();
    }, 80);
  };

  const continueWorldMapMessage = () => {
    if (worldMapMessage === "welcome") {
      markFtueVisualStep("welcome-guidance");
      setWorldMapMessage(null);
      focusWorldMapTarget("level");
      return;
    }
    if (worldMapMessage === "album") {
      markFtueVisualStep("level-2-album-card");
      setWorldMapMessage(null);
      setWorldMapFocus(null);
      window.setTimeout(() => albumButtonRef.current?.focus(), 80);
      return;
    }
    if (worldMapMessage === "forest") {
      markFtueVisualStep("forest-welcome-guidance");
      setWorldMapMessage(null);
      focusWorldMapTarget("level");
    }
  };

  const shakeWorldMapTarget = (target: string) => {
    setShakingMapTarget(target);
    window.setTimeout(() => setShakingMapTarget((current) => current === target ? null : current), 420);
  };

  const selectWorldMapLevel = (level: number) => {
    const complete = player.completedLevels.includes(level);
    const unlocked = level === player.currentLevel || complete;
    if (!unlocked) {
      shakeWorldMapTarget(`level-${level}`);
      return;
    }
    setWorldMapFocus(null);
    requestLevelStart(track.node(level));
  };

  const enterForestMap = () => {
    const forestUnlocked = player.completedLevels.includes(5) && ftueProgressRef.current.oceanCollectedStickers.length === 12;
    if (!forestUnlocked) {
      shakeWorldMapTarget("gate");
      return;
    }
    setWorldMapFocus(null);
    setWorldMapTransition(true);
    window.setTimeout(() => {
      setViewChapterId("chapter_forest");
      setWorldMapTransition(false);
    }, prefersReducedMotion ? 220 : 600);
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
    // The first ten levels are the tutorial. They are deliberately easy, so clearing the
    // objective is mastery enough — a scored 1-star result there would read as a failure
    // for doing exactly what the game asked.
    if (runNode.current.level <= FULL_STARS_THROUGH_LEVEL) stars = 3;
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
    let hintsGranted = 0;
    if (progress.complete) {
      const oceanRewardPending = runNode.current.level >= 2
        && runNode.current.level <= 5
        && !ftueProgressRef.current.oceanRewardedLevels.includes(runNode.current.level);
      const deferForestUnlock = runNode.current.level === 5 && oceanRewardPending;
      // Measured before the grant, so a pool that is already full reports honestly.
      hintsGranted = hintsThatLand(economy.current.snapshot().hints, runNode.current.reward.hints ?? 0);
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
    // Levels 2-5 hand collectibles out as the FTUE's ocean stickers rather than album
    // cards, so the tray counts those instead of the pack it never opened.
    const collectiblesGranted = rewardPack
      ? rewardPack.cards.length
      : progress.complete
        ? oceanStickersForLevel(runNode.current.level).length
        : 0;
    setSummary({
      ...baseSummary,
      node: runNode.current,
      objectiveComplete: progress.complete,
      reward: runNode.current.reward,
      packResult: rewardPack,
      hintsGranted,
      collectiblesGranted,
    });
    setAnimating(false);
    setScreen("summary");
    if (progress.complete) {
      playSfx("level_complete", { duckMs: 2600 });
      window.setTimeout(() => beginPostLevelMeta(runNode.current!.level), 420);
    }
  };

  const ownedCards = (): CardDefinition[] => albums
    .flatMap((album) => album.sets.flatMap((set) => set.cards))
    .filter((card, index, all) => player.cards[card.cardId] > 0 && all.findIndex((item) => item.cardId === card.cardId) === index);

  const launchPowerUp = (kind: PowerUpKind, tutorial = false) => {
    if (!pvp.current) return;
    if (tutorial) setAcknowledgedPowerIntro(null);
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
    if (isScheduledRaidTopUp(level) && pvp.current.snapshot().readyActions.raid < 1) {
      pvp.current.addReadyAction("raid");
      persistPvp();
    }
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

  const deferAttack = () => {
    if (pvpOverlay?.kind !== "attack" || pvpOverlay.result) return;
    setPvpOverlay(null);
    setToast("Attack saved. That rival has no unshielded cards left right now.");
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

  const deferShield = () => {
    if (pvpOverlay?.kind !== "shield" || pvpOverlay.protectedCardId) return;
    setPvpOverlay(null);
    setToast("Shield saved. You can use it once you own a card.");
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
      setAcknowledgedPowerIntro(null);
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
    setAcknowledgedPowerIntro(null);
    window.setTimeout(() => launchNextMeta(), 180);
  };

  const acknowledgePowerTutorialIntro = () => {
    if (!pvpOverlay?.tutorial) return;
    setAcknowledgedPowerIntro(pvpOverlay.kind);
    window.setTimeout(() => {
      document.querySelector<HTMLButtonElement>("[data-pvp-primary-action]")?.focus();
    }, 0);
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
    solveIndex.current += 1;
    if (!isGoldenRun) {
      const comboNow = scorer.current?.snapshot().comboMultiplier ?? INITIAL_COMBO;
      if (comboNow >= ON_FIRE_THRESHOLD - 0.001 && !celebrationShown.current.onFire) {
        celebrationShown.current.onFire = true;
        celebrationShown.current.royalCombo = true;
        fireCelebration("on-fire");
      } else if (comboNow >= ROYAL_COMBO_THRESHOLD - 0.001 && !celebrationShown.current.royalCombo) {
        celebrationShown.current.royalCombo = true;
        fireCelebration("royal-combo");
      } else if (word.word.length >= GREAT_WORD_MIN_LENGTH) {
        fireCelebration("great-word");
      }
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
      playSfx("board_refill", { cooldownMs: 180 });
      setActiveWords(result.activeWords);
      if (!isGoldenRun && !result.complete && result.activeWords.length === 1) fireCelebration("one-more");
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
      playSfx("board_refill", { cooldownMs: 180 });
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
    else if (bonusTutorialVisible) fireCelebration("bonus-found");
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
    if (ids.length > 0 && ids.at(-1) !== selection.current.at(-1)) playTileSelect();
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
      const nextScore = scoreManager.snapshot(matchTimestamp);
      setScore(nextScore);
      playSfx("word_found");
      playComboSfx(nextScore.comboMultiplier);
      solveWord(
        result.word,
        result.score.points,
        result.tileIds,
        result.rewards,
      );
      return;
    }
    if (result.kind === "bonus") {
      playSfx("bonus_word");
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
      playSfx("invalid_word");
      setNeutralShakeIds(result.tileIds);
      selection.current = [];
      setSelectedIds([]);
      window.setTimeout(() => setNeutralShakeIds([]), 260);
      return;
    }
    scoreManager.onInvalidSelection(matchTimestamp);
    playSfx("invalid_word");
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
    if (selection.current.length > 0) playSfx("selection_cancel");
    dragging.current = false;
    dragStart.current = null;
    selection.current = [];
    setSelectedIds([]);
  };

  const boardLongPress = useLongPress(() => {
    dragging.current = false;
    dragStart.current = null;
    selection.current = [];
    setSelectedIds([]);
    setFeedbackOpen(true);
  }, boardLocked);

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
    const currentLevel = runNode.current?.level ?? player.currentLevel;
    if (!isGoldenRun && currentLevel >= HINT_POOL_INTRO_LEVEL) {
      if (!economy.current?.spendHint()) {
        setMessage("No hints left — earn more as you keep playing");
        return;
      }
      persist(economy.current.snapshot());
    }
    hintsUsedRef.current += 1;
    playSfx("hint_reveal");
    setHintsUsed(hintsUsedRef.current);
    setHintedId(word.tileIds[0]);
    if (isGoldenRun) noteUsefulFtueInteraction();
    if (currentLevel === 3 && !ftueProgressRef.current.completedTutorials.includes("level-3-hint")) {
      markTutorialComplete("level-3-hint");
      setContextualPrompt(false);
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
    setLevelOneCoach(canRestartGuidanceHere ? { kind: "first-word", messageOpen: false } : null);
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
    // Drop the queued save and the device mirror, or a restart could be undone by stale state.
    pendingCloudSave.current = null;
    try { window.localStorage.removeItem(playerBackupKey(account.email)); } catch { /* Nothing to clean up. */ }
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
    setContextualPrompt(false);
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

  const playUiTap = (event: React.MouseEvent<HTMLElement>) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!button || button.disabled || button.matches("[data-v3-tile-id]")) return;
    playSfx("ui_tap", { cooldownMs: 35, volume: 0.62 });
  };

  if (screen === "hub") {
    const worldId: WorldMapId = viewChapterId === "chapter_forest" ? "forest" : "ocean";
    const world = WORLD_MAPS[worldId];
    const forestUnlocked = player.completedLevels.includes(5) && ftueProgress.oceanCollectedStickers.length === 12;
    return <main className={`${base.shell} ${base.hubShell} ${styles.v3Shell}`} style={{ "--chapter-accent": viewedChapter.accent } as CSSProperties} onClickCapture={playUiTap}>
      <TopBar player={player} locked={Boolean(worldMapMessage)} onShop={() => setTab("shop")} onSettings={() => setSettingsOpen(true)} />
      <section className={`${base.hubContent} ${styles.hubContent} ${tab === "home" ? styles.worldMapHubContent : styles.panelHubContent}`}>
        {tab === "home" && <WorldMapMenu
          world={world}
          player={player}
          hydrated={hydrated && ftueReady}
          albumUnlocked={ftueProgress.albumUnlocked}
          forestUnlocked={forestUnlocked}
          currentLevelRef={levelPlayButtonRef}
          albumRef={mapAlbumButtonRef}
          gateRef={mapGateButtonRef}
          focusTarget={worldMapFocus}
          shakingTarget={shakingMapTarget}
          transitioning={worldMapTransition}
          onLevel={selectWorldMapLevel}
          onAlbum={() => {
            if (!ftueProgress.albumUnlocked) { shakeWorldMapTarget("album"); return; }
            setWorldMapFocus(null);
            openLatestAlbumPage();
          }}
          onGate={() => worldId === "ocean" ? enterForestMap() : shakeWorldMapTarget("gate")}
        />}
        {tab === "albums" && <AlbumPanel albums={albums} pages={albumPages} pageLevel={albumPageLevel} player={player} pvp={pvpState} activeChapter={activeChapter} ftueProgress={ftueProgress} reducedMotion={prefersReducedMotion} onContinuePage={continueFromAlbumPage} onOpenPage={openAlbumPage} unlockedPages={ftueProgress.unlockedAlbumPages} onClaim={claimSet} onVault={redeemVault} onClaimAlbum={claimAlbum} onRepair={repairCard} />}
        {tab === "shop" && <PackShop player={player} onBuy={buyPack} />}
        {tab === "teams" && <SimplePanel eyebrow="SOCIAL KINGDOM" title="Teams" copy="Trade duplicates, request energy, and conquer together." items={[["🦁", "Royal Wordsmiths", "42 Members"], ["⚡", "Energy Requests", "3 waiting"], ["🃏", "Card Trades", "7 offers"]]} onAction={() => setToast("Request sent to the Royal Wordsmiths.")} />}
        {tab === "events" && <SimplePanel eyebrow="LIVE NOW" title="Events" copy="Timed races now award themed packs and Vault Stars." items={[["⚔️", "Raid Tournament", "Ends in 2h"], ["⭐", "Star Race", "8 stars to lead"], ["🃏", "Album Sprint", "2 days left"]]} onAction={() => setToast("Event pinned to your home rail.")} />}
      </section>
      <BottomNav active={tab} albumButtonRef={albumButtonRef} albumUnlocked={ftueProgress.albumUnlocked} albumNotifications={albumUnseenCount} guideAlbum={ftueProgress.pendingMandatoryStep === "OPEN_LEVEL_2_ALBUM" && !worldMapMessage} tutorialLock={ftueProgress.pendingMandatoryStep === "OPEN_LEVEL_2_ALBUM" && !worldMapMessage} onChange={(nextTab) => {
        if (nextTab === "albums") openLatestAlbumPage();
        else setTab(nextTab);
      }} />
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
      {pvpOverlay && <PvpEventOverlay state={pvpOverlay} ownedCards={ownedCards()} onAttack={chooseAttackCard} onAttackSkip={deferAttack} onSteal={performSteal} onUseLater={deferSteal} onShield={chooseShieldCard} onShieldSkip={deferShield} onPick={pickRaidChest} onClose={closePvpOverlay} />}
      {pvpOverlay?.tutorial && acknowledgedPowerIntro !== pvpOverlay.kind && <PowerTutorialPrompt kind={pvpOverlay.kind} onContinue={acknowledgePowerTutorialIntro} />}
      {toast && <div className={base.toast} role="status">{toast}</div>}
      {loginIntroOpen && <LoginIntro onClose={() => { setLoginIntroOpen(false); updateFtueProgress(markIntroVideoSeen); }} />}
      {worldMapMessage === "welcome" && <ConceptCard title="Welcome to Word Kingdom" message="Follow the path and begin your first word adventure." cta="LET'S GO!" icon={null} onDismiss={continueWorldMapMessage} testId="world-map-welcome" />}
      {worldMapMessage === "album" && <ConceptCard title="Your Album Is Open" message="Your stickers reveal each kingdom. Tap the album to see what you collected." cta="SHOW ME" icon={<DiscoveryArtwork kind="album" />} onDismiss={continueWorldMapMessage} testId="world-map-album" />}
      {worldMapMessage === "forest" && <ConceptCard title="Forest Kingdom" message="A new album and five new levels are waiting." cta="LET'S GO!" icon={<img className={styles.tutorialSceneArtwork} src="/world-maps/forest-kingdom-map-clean.webp" alt="" />} onDismiss={continueWorldMapMessage} testId="world-map-forest" />}
      {worldMapFocus === "level" && world.id === "ocean" && player.currentLevel === 1 && !worldMapMessage && <FtueCoachmark
        icon={null}
        title="Play Level 1"
        message="Tap Level 1 to begin."
        targetRef={levelPlayButtonRef}
        gesture="tap"
        messageOpen={false}
        reducedMotion={prefersReducedMotion}
        testId="level-1-map-gesture"
      />}
      {ftueProgress.pendingMandatoryStep === "OPEN_LEVEL_2_ALBUM" && !worldMapMessage && <FtueCoachmark
        icon={null}
        title="Open your Album"
        message="Tap Albums to place your new stickers."
        targetRef={albumButtonRef}
        gesture="tap"
        messageOpen={false}
        reducedMotion={prefersReducedMotion}
        testId="level-2-album-gesture"
      />}
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
      return <main data-chapter-theme={summaryTheme.id} className={`${base.shell} ${base.summaryShell} ${styles.summaryShell} ${styles.levelOneCompletionShell}`} style={summaryStyle} onClickCapture={playUiTap}>
        <TopBar player={player} onShop={() => { setSummary(null); returnHome(); setTab("shop"); }} onSettings={() => setSettingsOpen(true)} />
        <div className={styles.gameTopBarSpacer} aria-hidden="true" />
        <LevelOneResults
          summary={summary}
          onContinue={() => {
            updateFtueProgress(acknowledgeLevelOneResults);
            setSummary(null);
            returnHome();
          }}
        />
        {settingsOpen && <SettingsModal account={account} signOutUrl={signOutUrl} player={player} onToggle={updateSetting} onRestart={restartProgress} onHowToPlay={() => { setSettingsOpen(false); setTutorialLibraryOpen(true); }} onClose={() => setSettingsOpen(false)} />}
        {tutorialLibraryOpen && <TutorialLibrary maxLevel={Math.min(10, Math.max(player.currentLevel, ...player.completedLevels, 1))} onClose={() => setTutorialLibraryOpen(false)} />}
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
      return <main data-chapter-theme={summaryTheme.id} className={`${base.shell} ${base.summaryShell} ${styles.summaryShell} ${styles.levelOneCompletionShell}`} style={summaryStyle} onClickCapture={playUiTap}>
        <TopBar player={player} onShop={() => { setSummary(null); returnHome(); setTab("shop"); }} onSettings={() => setSettingsOpen(true)} />
        <div className={styles.gameTopBarSpacer} aria-hidden="true" />
        <OceanRewardExperience
          level={summary.node.level}
          phase={ftueProgress.oceanRewardPhase!}
          summary={summary}
          revealCount={ftueProgress.oceanStickerRevealCount}
          collectedCount={ftueProgress.oceanCollectedStickers.length}
          reducedMotion={prefersReducedMotion}
          onContinueResults={() => {
            playSfx("ui_tap");
            updateFtueProgress(continueToOceanPack);
          }}
          onOpenPack={() => {
            playSfx("pack_open", { duckMs: 1250 });
            updateFtueProgress((current) => openOceanDiscoveryPack(dismissOceanPackMessage(current)));
          }}
          onStartStickerReveal={() => {
            playSfx("ui_tap");
            updateFtueProgress(beginOceanStickerReveal);
          }}
          onOpenAlbum={() => {
            updateFtueProgress((current) => beginLevelTwoAlbumGuide(dismissOceanAlbumMessage(current)));
            setSummary(null);
            returnHome();
          }}
          onFinish={() => {
            if (summary.node.level === 5 && economy.current) {
              persist(economy.current.unlockChapter("chapter_forest"));
              setToast("Ocean Album complete. The Forest gate is open.");
            }
            updateFtueProgress(finishOceanReward);
            setSummary(null);
            returnHome();
            if (summary.node.level === 5) {
              setViewChapterId("chapter_ocean");
              focusWorldMapTarget("gate");
            }
          }}
        />
        {settingsOpen && <SettingsModal account={account} signOutUrl={signOutUrl} player={player} onToggle={updateSetting} onRestart={restartProgress} onHowToPlay={() => { setSettingsOpen(false); setTutorialLibraryOpen(true); }} onClose={() => setSettingsOpen(false)} />}
        {tutorialLibraryOpen && <TutorialLibrary maxLevel={Math.min(10, Math.max(player.currentLevel, ...player.completedLevels, 1))} onClose={() => setTutorialLibraryOpen(false)} />}
      </main>;
    }
    /*
     * A cleared level gets the Level Complete panel — the design the whole game now uses.
     * A missed objective keeps the older popup, because failing needs two choices (retry or
     * go back) and the panel is deliberately a single tap-to-continue surface.
     */
    if (summary.objectiveComplete) {
      return <main data-chapter-theme={summaryTheme.id} className={`${base.shell} ${base.summaryShell} ${styles.summaryShell}`} style={summaryStyle} onClickCapture={playUiTap}>
        <TopBar player={player} coinPulse={coinCounterPulse} onShop={() => { returnHome(); setTab("shop"); }} onSettings={() => setSettingsOpen(true)} />
        <div className={styles.gameTopBarSpacer} aria-hidden="true" />
        <div className={styles.summaryAtmosphere} aria-hidden="true"><i /><i /><i /><i /><i /><span>🪙</span><span>🪙</span></div>
        <CelebrationBurst />
        <ConquestCompletePanel
          summary={summary}
          title={summary.node.level === 10 ? "FOREST ALBUM COMPLETE!" : `LEVEL ${summary.node.level} COMPLETE!`}
          cta=""
          onContinue={() => {
            // The chest showed how many cards were won; the pack reveal names them.
            if (summary.packResult) { setPackReveal(summary.packResult); return; }
            if (ftueProgressRef.current.unlockedAlbumPages.includes(summary.node.level)) {
              setToast("📖 New Album page unlocked!");
            }
            returnHome();
          }}
        />
        {packReveal && <PackModal result={packReveal} onClose={() => { closePackReveal(); returnHome(); }} />}
        {settingsOpen && <SettingsModal account={account} signOutUrl={signOutUrl} player={player} onToggle={updateSetting} onRestart={restartProgress} onHowToPlay={() => { setSettingsOpen(false); setTutorialLibraryOpen(true); }} onClose={() => setSettingsOpen(false)} />}
        {albumTransition && <AlbumTransition state={albumTransition} reducedMotion={prefersReducedMotion} />}
      </main>;
    }

    return <main data-chapter-theme={summaryTheme.id} className={`${base.shell} ${base.summaryShell} ${styles.summaryShell}`} style={summaryStyle} onClickCapture={playUiTap}>
      <TopBar player={player} coinPulse={coinCounterPulse} onShop={() => { returnHome(); setTab("shop"); }} onSettings={() => setSettingsOpen(true)} />
      <div className={styles.gameTopBarSpacer} aria-hidden="true" />
      <div className={styles.summaryAtmosphere} aria-hidden="true"><i /><i /><i /><i /><i /><span>🪙</span><span>🪙</span></div>
      {summary.objectiveComplete && <CelebrationBurst />}
      <KingdomPopup
        title={summary.objectiveComplete ? summary.node.level === 10 ? "Forest Album Complete!" : "Conquest Complete!" : "Objective Not Met"}
        subtitle={`LEVEL ${summary.node.level} · ${summary.node.title}`}
        icon={summary.objectiveComplete ? "👑" : "🛡️"}
        tone={summary.objectiveComplete ? "success" : "setback"}
        celebrate={summary.objectiveComplete}
        onClose={returnHome}
        secondaryText="Return to Conquest Track"
        onSecondary={returnHome}
        ctaText={<><span>{summary.objectiveComplete ? `RETURN TO ${summary.node.level <= 5 ? "OCEAN" : "FOREST"} MAP` : "Retry Level"}</span><small>{summary.objectiveComplete ? summary.node.level === 10 ? "KINGDOM DISCOVERED" : "NEXT LEVEL UNLOCKED" : "1 ⚡ Ticket"}</small></>}
        onCta={() => {
          if (!summary.objectiveComplete) requestLevelStart(summary.node);
          else returnHome();
        }}
      >
        {summary.objectiveComplete && summary.node.level === 10 && <div className={styles.albumUnlockNotice}>🌿 <b>You discovered the Forest Kingdom.</b></div>}
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
      </KingdomPopup>
      {packReveal && <PackModal result={packReveal} onClose={closePackReveal} />}
      {pvpOverlay && <PvpEventOverlay state={pvpOverlay} ownedCards={ownedCards()} onAttack={chooseAttackCard} onAttackSkip={deferAttack} onSteal={performSteal} onUseLater={deferSteal} onShield={chooseShieldCard} onShieldSkip={deferShield} onPick={pickRaidChest} onClose={closePvpOverlay} />}
      {pvpOverlay?.tutorial && acknowledgedPowerIntro !== pvpOverlay.kind && <PowerTutorialPrompt kind={pvpOverlay.kind} onContinue={acknowledgePowerTutorialIntro} />}
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
  return <main data-chapter-theme={chapterTheme.id} className={`${base.shell} ${base.boardShell} ${styles.boardShell} ${isGoldenRun ? styles.goldenBoard : ""} ${boardLocked ? styles.boardPaused : ""} ${juiceShake ? styles.juiceScreenShake : ""}`} style={chapterStyle} onClickCapture={playUiTap}>
    <TopBar player={player} coinPulse={coinCounterPulse} onShop={() => { returnHome(); setTab("shop"); }} onSettings={() => setSettingsOpen(true)} />
    <div className={styles.gameTopBarSpacer} aria-hidden="true" />
    <section className={styles.chapterIdentity} aria-label={`${chapterTheme.chapterTitle}, Level ${node.level}`}>
      <div className={styles.chapterTopRow}>
        <button className={styles.ftueInlineBack} onClick={returnHome} aria-label="Back to kingdom map">‹</button>
        {levelClockMs !== null && <output
          className={styles.levelClock}
          data-urgent={levelClockUrgent ? "true" : undefined}
          aria-label={`Time remaining: ${formatLevelClock(levelClockMs)}`}
        >{formatLevelClock(levelClockMs)}</output>}
        <div className={styles.chapterBannerLine}>
          <i aria-hidden="true">{chapterTheme.ornaments[0]}</i>
          <h1>{chapterTheme.chapterTitle}</h1>
          <div className={styles.chapterBannerRight}>
            <span className={styles.levelMedal} aria-hidden="true"><b>{node.level}</b></span>
            <i aria-hidden="true">{chapterTheme.ornaments[1]}</i>
          </div>
        </div>
      </div>
    </section>
    <ObjectiveTray
      activeWords={activeWords}
      recommendedObjectiveId={goldenTutorial.recommendedObjectiveId}
      hintedTileId={hintedId}
      stall={ftueActive ? ftueStall : undefined}
    />
    {!isGoldenRun && visiblePowers.length > 0 && <div className={styles.mobilePowerProgress}><PowerProgress kinds={visiblePowers} badgeCounts={badgeCounts} readyActions={pvpState.readyActions} impactSlots={trayImpactSlots} /></div>}
    {node.level > 10 && <>
      <section className={`${base.runHeader} ${styles.runHeaderWithPreview}`}><div><span className={base.kicker}>{`${area.icon} ${area.displayName} · Level ${node.level}`}</span><h1>{node.kind === "BOSS" ? "Guardian Board" : "Living Board"}</h1></div><div className={styles.previewScoreHud}><span><small>SCORE</small><b>{formatNumber(score.score)}</b></span><i>{`x${score.comboMultiplier.toFixed(1)}`}</i></div><div className={`${base.cascadeCounter} ${styles.largeCascadeCounter}`}><b>{cascades}</b><span>/ {runStepTarget}</span><small>Steps</small></div></section>
      <div className={base.cascadeTrack} aria-hidden="true"><i style={{ width: `${(cascades / runStepTarget) * 100}%` }} /></div>
      <section className={styles.objectiveBar} data-complete={objectiveProgress.complete}><span>🔤</span><div><small>LEVEL OBJECTIVE</small><b>{node.objective.label}</b></div><em>{objectiveProgress.current}/{objectiveProgress.target}</em></section>
    </>}
    <section className={base.boardLayout}>
      <div
        className={`${base.boardCard} ${shake ? base.shake : ""}`}
        ref={boardCardRef}
        onPointerDown={boardLongPress.onPointerDown}
        onPointerMove={boardLongPress.onPointerMove}
        onPointerUp={boardLongPress.onPointerUp}
        onPointerCancel={boardLongPress.onPointerCancel}
        onContextMenu={(event) => event.preventDefault()}
      >
        <div className={base.boardMessage} role="status" aria-live="polite">{message}</div>
        {celebration && <div className={styles.celebrationBanner} data-leaving={celebrationLeaving ? "true" : undefined} role="status" aria-live="polite">
          <img src={CELEBRATION_BANNERS[celebration].src} alt={CELEBRATION_BANNERS[celebration].alt} />
        </div>}
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
              <span className={styles.tileFace} style={tileFaceStyle} data-badge={badge || undefined}>
                {badge && <img className={styles.tileBadgeWatermark} src={BADGES[badge].icon} alt="" aria-hidden="true" />}
                <span className={styles.tileLetter}>{tile.letter}</span>
              </span>
              {blocked && <em title={generatedObstacle ? `${generatedObstacle} placeholder obstacle` : undefined}>{generatedObstacle ? generatedObstacle === "ICE" ? "◆" : "✦" : obstacles?.icon}</em>}
            </button>;
          })}
        </div>
        {!isGoldenRun && node.level <= 10 && <div className={styles.comboTimerBar} data-urgent={comboUrgent ? "true" : undefined} aria-label={`Combo x${score.comboMultiplier.toFixed(1)}`}>
          <i style={{ width: `${Math.round(comboDrain * 100)}%` }} />
          <b>{`x${score.comboMultiplier.toFixed(1)}`}</b>
        </div>}
        <div className={base.boardActions} data-ftue-actions={isGoldenRun ? "true" : undefined}>
          {!isGoldenRun && standardHintVisible && <button ref={hintButtonRef} onClick={useHint} disabled={boardLocked || (currentRunLevel >= HINT_POOL_INTRO_LEVEL && player.hints < 1)}>💡 Hint <small>{currentRunLevel >= HINT_POOL_INTRO_LEVEL ? `${player.hints}/${HINT_POOL_CAP} left` : "resets combo"}</small></button>}
          {isGoldenRun && (ftueStall === "HINT" || !ftueActive) && <button ref={hintButtonRef} onClick={useHint} disabled={boardLocked || hintsUsed >= FTUE_HINT_LIMIT}>💡 {ftueActive ? "Need a clue?" : "Hint"}<small>{Math.max(0, FTUE_HINT_LIMIT - hintsUsed)} left</small></button>}
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
    <FeedbackOverlay open={feedbackOpen} targetRef={boardCardRef} level={node.level} onClose={() => setFeedbackOpen(false)} />
    {levelOneCoach?.kind === "first-word" && !levelOneCoach.messageOpen && <FtueCoachmark
      icon={<span className={styles.wordSelectionVisual}>{[..."SHORE"].map((letter) => <i key={letter}>{letter}</i>)}</span>}
      title="Swipe to Spell"
      message="Drag across the highlighted word."
      swipeTileIds={shoreTutorialPath}
      gesture="swipe"
      messageOpen={false}
      reducedMotion={prefersReducedMotion}
      testId="level-1-first-word-gesture"
    />}
    {levelOneCoach?.kind === "transformation" && <ConceptCard
      icon={<span className={styles.transformedTileVisual}><i>A</i><b>R</b></span>}
      title="The board is alive!"
      message="Finding words changes letters and reveals new possibilities."
      cta="CONTINUE"
      onDismiss={() => {
        const resume = tutorialResume.current;
        tutorialResume.current = null;
        resume?.();
      }}
      testId="level-1-transformation-message"
    />}
    {pvpOverlay && <PvpEventOverlay state={pvpOverlay} ownedCards={ownedCards()} onAttack={chooseAttackCard} onAttackSkip={deferAttack} onSteal={performSteal} onUseLater={deferSteal} onShield={chooseShieldCard} onShieldSkip={deferShield} onPick={pickRaidChest} onClose={closePvpOverlay} />}
    {contextualPrompt && <ConceptCard title="Need a Hint?" message="Tap Hint to reveal part of a word. Hints are optional." cta="GOT IT" icon="💡" onDismiss={dismissHintCoach} testId="hint-available-guide" />}
    {pvpOverlay?.tutorial && acknowledgedPowerIntro !== pvpOverlay.kind && <PowerTutorialPrompt kind={pvpOverlay.kind} onContinue={acknowledgePowerTutorialIntro} />}
    {packReveal && <PackModal result={packReveal} onClose={closePackReveal} />}
    {settingsOpen && <SettingsModal account={account} signOutUrl={signOutUrl} player={player} onToggle={updateSetting} onRestart={restartProgress} onHowToPlay={() => { setSettingsOpen(false); setTutorialLibraryOpen(true); }} onClose={() => setSettingsOpen(false)} />}
    {tutorialLibraryOpen && <TutorialLibrary maxLevel={Math.min(10, Math.max(player.currentLevel, ...player.completedLevels, 1))} onClose={() => setTutorialLibraryOpen(false)} />}
    {albumTransition && <AlbumTransition state={albumTransition} reducedMotion={prefersReducedMotion} />}
  </main>;
}

function LevelOneResults({ summary, onContinue }: { summary: V3RunSummary; onContinue: () => void }) {
  return <ConquestCompletePanel summary={summary} title="LEVEL 1 COMPLETE!" cta="RETURN TO OCEAN MAP" onContinue={onContinue} />;
}

function ConquestCompletePanel({ summary, title, cta, onContinue }: { summary: V3RunSummary; title: string; cta: string; onContinue: () => void }) {
  // `cta` is retained by the call sites but the panel no longer shows a button: the whole
  // panel is the continue affordance, so the label would be a second, competing target.
  void cta;
  return <LevelCompletePanel
    title={title}
    stars={summary.objectiveComplete ? summary.stars : 0}
    score={formatNumber(summary.score)}
    timeLabel={`${summary.elapsedSeconds}s`}
    accuracyLabel={`${Math.round(summary.accuracy * 100)}%`}
    longestWord={summary.longestWord}
    hintsUsed={summary.hints}
    rewards={{
      runCoins: summary.totalCoins,
      levelCoins: summary.node.reward.coins,
      hints: summary.objectiveComplete ? summary.hintsGranted ?? 0 : 0,
      cards: summary.objectiveComplete ? summary.collectiblesGranted ?? 0 : 0,
    }}
    hintsAtCap={summary.objectiveComplete && (summary.hintsGranted ?? 0) === 0 && Boolean(summary.node.reward.hints)}
    chest={summary.objectiveComplete && summary.packResult ? summary.packResult.tier : null}
    onContinue={onContinue}
  />;
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

function OceanRewardExperience({ level, phase, summary, revealCount, collectedCount, reducedMotion, onContinueResults, onOpenPack, onStartStickerReveal, onOpenAlbum, onFinish }: {
  level: number;
  phase: Exclude<OceanRewardPhase, null>;
  summary: V3RunSummary;
  revealCount: number;
  collectedCount: number;
  reducedMotion: boolean;
  onContinueResults: () => void;
  onOpenPack: () => void;
  onStartStickerReveal: () => void;
  onOpenAlbum: () => void;
  onFinish: () => void;
}) {
  const stickers = oceanStickersForLevel(level);
  const showingResults = phase === "RESULTS";
  const showingPack = phase === "PACK_READY";
  const showingStickerAnnouncement = phase === "STICKER_READY";
  const showingStickers = phase === "STICKER_REVEAL" || phase === "ALBUM_ACTIVATED";
  const safeRevealCount = Math.max(0, Math.min(3, revealCount));
  if (showingResults) return <ConquestCompletePanel summary={summary} title={`LEVEL ${level} COMPLETE!`} cta="CONTINUE TO OCEAN PACK" onContinue={onContinueResults} />;
  if (showingStickerAnnouncement) return <ConceptCard title="New Ocean Stickers!" message="Three new treasures are ready for your Ocean Album." cta="REVEAL THEM" onDismiss={onStartStickerReveal} testId="ocean-stickers-announcement" />;
  return <section className={`${base.summaryCard} ${styles.summaryCard} ${styles.ftueSummaryCard} ${styles.oceanRewardCard}`} role="dialog" aria-modal="true" aria-labelledby="ocean-reward-title" data-phase={phase} data-reduced-motion={reducedMotion ? "true" : undefined}>
    <div className={styles.summaryRays} aria-hidden="true" />
    <span className={`${base.kicker} ${styles.summaryKicker}`}>OCEAN KINGDOM · LEVEL {level}</span>
    <h1 id="ocean-reward-title">{phase === "KINGDOM_COMPLETE" ? "OCEAN ALBUM COMPLETE!" : showingPack ? "OCEAN PACK EARNED!" : "NEW OCEAN STICKERS"}</h1>
    {showingPack && <div className={styles.levelOnePackSection}><p>Tap the pack when you are ready.</p><button onClick={onOpenPack} aria-label="Open Ocean sticker pack"><img className={styles.oceanDiscoveryPack} src="/tutorial/ocean-discovery-pack-v2.png" alt="" /></button></div>}
    {showingStickers && <div className={styles.levelOneStickerReveal} aria-live="polite"><div className={styles.levelOneAlbumTray}><DiscoveryArtwork kind="album" /><span>{Math.min(12, collectedCount + safeRevealCount)}/12 OCEAN STICKERS</span></div><div className={styles.levelOneStickerRow}>{stickers.map((sticker, index) => { const revealed = index < safeRevealCount; return <article key={sticker} data-revealed={revealed ? "true" : undefined}>{revealed ? <OceanStickerVisual sticker={sticker} /> : <OceanStickerVisual sticker={sticker} missing />}<b>{revealed ? OCEAN_STICKER_LABELS[sticker] : "Mystery"}</b></article>; })}</div>{phase === "ALBUM_ACTIVATED" && <div className={styles.levelOneAlbumActivated}><h2>Your Ocean Album is ready</h2><p>Visit the real Album area to place your first stickers.</p><button onClick={onOpenAlbum}><DiscoveryArtwork kind="album" /><span>GO TO ALBUM</span></button></div>}</div>}
    {phase === "PACK_COMPLETE" && <div className={styles.oceanPackComplete}><div className={styles.levelOneStickerRow}>{stickers.map((sticker) => <article data-revealed="true" key={sticker}><OceanStickerVisual sticker={sticker} /><b>{OCEAN_STICKER_LABELS[sticker]}</b></article>)}</div><p>{collectedCount}/12 Ocean stickers collected.</p><button className={`${base.primaryCta} ${styles.summaryPrimaryCta}`} onClick={onFinish}><span>CONTINUE</span></button></div>}
    {phase === "KINGDOM_COMPLETE" && <div className={styles.oceanKingdomComplete}><div className={styles.levelOneStickerRow}>{stickers.map((sticker) => <article data-revealed="true" key={sticker}><OceanStickerVisual sticker={sticker} /><b>{OCEAN_STICKER_LABELS[sticker]}</b></article>)}</div><p>You discovered the Ocean Kingdom. The Forest gate is now open.</p><button className={`${base.primaryCta} ${styles.summaryPrimaryCta}`} onClick={onFinish}><span>SEE THE GATE</span></button></div>}
  </section>;
}

function TopBar({ player, locked = false, coinPulse = false, onShop, onSettings }: { player: V3PlayerState; locked?: boolean; coinPulse?: boolean; onShop: () => void; onSettings: () => void }) {
  return <header className={styles.royalTopBar} aria-label="Resources">
    <img className={styles.royalTopBarArt} src="/topbar/word-kingdom-topbar-v2.webp" alt="" aria-hidden="true" draggable={false} />
    <output className={styles.royalTopBarCoins} aria-label={`Coins: ${formatNumber(player.coins)}`}>{formatResourceNumber(player.coins)}</output>
    <output className={styles.royalTopBarEnergy} aria-label={`Energy: ${player.energy}/${ENERGY_CAP}`}>{player.energy}/{ENERGY_CAP}</output>
    <output className={styles.royalTopBarStars} aria-label={`Stars: ${player.stars}`}>{player.stars}</output>
    {/* No profile screen exists yet, so the portrait opens settings, where the account lives. */}
    <button disabled={locked} className={styles.royalTopBarProfile} onClick={onSettings} aria-label="Profile and account" />
    <button disabled={locked} data-coin-counter className={`${styles.royalTopBarShop} ${coinPulse ? styles.coinCounterImpact : ""}`} onClick={onShop} aria-label="Get more coins" />
    <button disabled={locked} className={styles.royalTopBarSettings} onClick={onSettings} aria-label="Open settings" />
  </header>;
}

function PowerProgress({ kinds, badgeCounts, readyActions, impactSlots }: { kinds: PowerUpKind[]; badgeCounts: Record<BadgeType, number>; readyActions: Record<PowerUpKind, number>; impactSlots: string[] }) {
  return <section className={styles.powerProgress} aria-label="Persistent royal powers">
    <div className={styles.powerProgressHeading}><span>ROYAL POWERS</span><small>Progress saves between levels</small></div>
    <div className={styles.powerProgressGrid} data-count={kinds.length}>{POWER_ORDER.filter((kind) => kinds.includes(kind)).map((type) => <article data-power={type} key={type}>
      <div><b aria-hidden="true"><img src={BADGES[type].icon} alt="" /></b><span>{BADGES[type].label}</span><strong>{badgeCounts[type]}/3</strong>{readyActions[type] > 0 && <em aria-label={`${readyActions[type]} ready`}>{readyActions[type]} READY</em>}</div>
      <p aria-label={`${badgeCounts[type]} of 3 badges`}>
        {[0, 1, 2].map((slot) => <i data-badge-slot={`${type}-${slot}`} data-collected={slot < badgeCounts[type] ? "true" : undefined} className={impactSlots.includes(`${type}-${slot}`) ? styles.traySlotImpact : ""} key={slot} />)}
      </p>
    </article>)}</div>
  </section>;
}

function WorldMapMenu({
  world,
  player,
  hydrated,
  albumUnlocked,
  forestUnlocked,
  currentLevelRef,
  albumRef,
  gateRef,
  focusTarget,
  shakingTarget,
  transitioning,
  onLevel,
  onAlbum,
  onGate,
}: {
  world: WorldMapDefinition;
  player: V3PlayerState;
  hydrated: boolean;
  albumUnlocked: boolean;
  forestUnlocked: boolean;
  currentLevelRef: RefObject<HTMLButtonElement | null>;
  albumRef: RefObject<HTMLButtonElement | null>;
  gateRef: RefObject<HTMLButtonElement | null>;
  focusTarget: "level" | "album" | "gate" | null;
  shakingTarget: string | null;
  transitioning: boolean;
  onLevel: (level: number) => void;
  onAlbum: () => void;
  onGate: () => void;
}) {
  const gateOpen = world.id === "ocean" && forestUnlocked;
  const artboardStyle = {
    "--world-map-width": world.intrinsicWidth,
    "--world-map-height": world.intrinsicHeight,
  } as CSSProperties;
  return <section className={styles.worldMap} data-world={world.id} data-transitioning={transitioning ? "true" : undefined} aria-label={`${world.title} level journey`}>
    <div className={styles.worldMapArtboard} style={artboardStyle}>
      <img className={styles.worldMapBackground} src={world.background} alt="" aria-hidden="true" draggable={false} />
      {world.levels.map((level) => {
      const hotspot = world.levelHotspots[level];
      const complete = player.completedLevels.includes(level);
      const current = player.currentLevel === level;
      const locked = !current && !complete;
      return <button
        ref={current ? currentLevelRef : undefined}
        key={level}
        type="button"
        className={styles.worldLevelButton}
        style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` } as CSSProperties}
        data-current={current ? "true" : undefined}
        data-complete={complete ? "true" : undefined}
        data-locked={locked ? "true" : undefined}
        data-milestone={hotspot.milestone}
        data-guided={current && focusTarget === "level" ? "true" : undefined}
        data-shake={shakingTarget === `level-${level}` ? "true" : undefined}
        disabled={!hydrated}
        aria-disabled={locked}
        aria-label={locked ? `Level ${level}, locked` : complete ? `Replay Level ${level}` : `Play Level ${level}`}
        onClick={() => onLevel(level)}
      >
        <i className={styles.worldNodeLight} aria-hidden="true" />
        <b>{level}</b>
        <span aria-hidden="true">{locked ? "🔒" : complete ? "★" : hotspot.milestone === "raid" ? "♦" : ""}</span>
        <small>{locked ? "LOCKED" : complete ? "REPLAY" : "PLAY"}</small>
      </button>;
    })}
    <button
      ref={albumRef}
      className={styles.worldAlbumButton}
      type="button"
      style={{ left: `${world.album.x}%`, top: `${world.album.y}%` } as CSSProperties}
      data-unlocked={albumUnlocked ? "true" : undefined}
      data-guided={focusTarget === "album" ? "true" : undefined}
      data-shake={shakingTarget === "album" ? "true" : undefined}
      disabled={!hydrated}
      aria-disabled={!albumUnlocked}
      aria-label={albumUnlocked ? `Open ${world.title} album` : "Album unlocks after Level 2"}
      onClick={onAlbum}
    ><DiscoveryArtwork kind="album" /><b>{albumUnlocked ? "ALBUM" : "LOCKED"}</b></button>
    <img
      className={styles.worldRaidChest}
      src={RAID_BOX_ART.locked}
      alt=""
      aria-hidden="true"
      style={{ left: `${world.raidChest.x}%`, top: `${world.raidChest.y}%` } as CSSProperties}
    />
    <button
      ref={gateRef}
      className={styles.worldGateButton}
      type="button"
      style={{ left: `${world.gate.x}%`, top: `${world.gate.y}%` } as CSSProperties}
      data-open={gateOpen ? "true" : undefined}
      data-guided={focusTarget === "gate" ? "true" : undefined}
      data-shake={shakingTarget === "gate" ? "true" : undefined}
      disabled={!hydrated}
      aria-disabled={!gateOpen}
      aria-label={gateOpen ? "Enter Forest Kingdom" : world.id === "forest" ? "Next kingdom is coming soon" : "Complete Level 5 and the Ocean album to open the Forest gate"}
      onClick={onGate}
    >{gateOpen ? <span>FOREST OPEN</span> : <span>🔒</span>}</button>
    </div>
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
        {!reducedMotion && <OceanAlbumSceneVideoLayers />}
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

const OCEAN_SCENE_CLIP_MS = 1500;
const OCEAN_SCENE_LAYER_COUNT = 3;

function OceanAlbumSceneVideoLayers() {
  const layerRefs = useRef<Array<HTMLVideoElement | null>>([]);
  useEffect(() => {
    const timers = Array.from({ length: OCEAN_SCENE_LAYER_COUNT }, (_, index) => window.setTimeout(() => {
      layerRefs.current[index]?.play().catch(() => {});
    }, (OCEAN_SCENE_CLIP_MS / OCEAN_SCENE_LAYER_COUNT) * index));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);
  return <>
    {Array.from({ length: OCEAN_SCENE_LAYER_COUNT }, (_, index) => <video
      key={index}
      ref={(node) => { layerRefs.current[index] = node; }}
      className={styles.oceanAlbumSceneVideo}
      style={{ animationDelay: `-${(OCEAN_SCENE_CLIP_MS / OCEAN_SCENE_LAYER_COUNT) * index}ms` }}
      src="/ocean-album-clip.mp4"
      muted
      loop
      playsInline
      aria-hidden="true"
    />)}
  </>;
}

function AlbumTransition({ state, reducedMotion }: { state: AlbumTransitionState; reducedMotion: boolean }) {
  return <div className={styles.albumTransition} data-kind={reducedMotion ? "fade" : state.kind} aria-hidden="true">
    {state.kind === "bubbles" && !reducedMotion && <video className={styles.albumTransitionVideo} src="/ocean-album-clip.mp4" autoPlay muted playsInline />}
    {state.kind === "vines" && !reducedMotion && <><b /><b /><span>🍃</span><span>✦</span><span>🍃</span></>}
  </div>;
}

function PackModal({ result, onClose }: { result: PackResult; onClose: () => void }) {
  return <div className={base.modalOverlay} role="dialog" aria-modal="true"><section className={styles.packModal} data-tier={result.tier}><small>{result.tier} PACK</small><h2>Royal cards revealed!</h2><div>{result.cards.map((card, index) => <article key={`${card.cardId}-${index}`} data-rarity={card.rarity}><span>{card.icon}</span><b>{card.name}</b><small>{"★".repeat(card.rarity)}</small><em>{card.isNew ? "NEW!" : `DUPLICATE +${[0,1,2,4,8,15][card.rarity]} ⭐`}</em></article>)}</div>{result.vaultStarsEarned > 0 && <p>+{result.vaultStarsEarned} Vault Stars</p>}<button onClick={onClose}>COLLECT</button></section></div>;
}

function PowerTutorialPrompt({ kind, onContinue }: { kind: PowerUpKind; onContinue: () => void }) {
  const copy: Record<PowerUpKind, { title: string; body: string; cta: string; testId: string }> = {
    raid: {
      title: "Raid the Royal Vault",
      body: "Choose 3 chests. Every chest can hide coins for your next sticker pack.",
      cta: "START RAID",
      testId: "raid-intro-guide",
    },
    shield: {
      title: "Shield Your Collection",
      body: "Shield protects one of your collectibles from the next Attack or Steal.",
      cta: "CHOOSE A CARD",
      testId: "shield-intro-guide",
    },
    attack: {
      title: "Launch an Attack",
      body: "Attack damages an opponent's card. A Shield can block the hit.",
      cta: "CHOOSE A CARD",
      testId: "attack-intro-guide",
    },
    steal: {
      title: "Steal a Royal Card",
      body: "Steal takes one eligible unprotected card and adds it to your Album.",
      cta: "STEAL A CARD",
      testId: "steal-intro-guide",
    },
  };
  const message = copy[kind];
  return <ConceptCard
    title={message.title}
    message={message.body}
    cta={message.cta}
    icon={<img src={BADGES[kind].icon} alt="" />}
    onDismiss={onContinue}
    testId={message.testId}
  />;
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

function PvpEventOverlay({ state, ownedCards, onAttack, onAttackSkip, onSteal, onUseLater, onShield, onShieldSkip, onPick, onClose }: { state: PvpOverlayState; ownedCards: CardDefinition[]; onAttack: (cardId: string) => void; onAttackSkip: () => void; onSteal: () => void; onUseLater: () => void; onShield: (cardId: string) => void; onShieldSkip: () => void; onPick: (chestId: string, source?: FxPoint) => void; onClose: () => void }) {
  if (state.kind === "raid") {
    return <div className={`${base.eventOverlay} ${styles.pvpOverlay}`} role="dialog" aria-modal="true"><section className={`${base.eventCard} ${styles.pvpEventCard}`} data-event="raid"><div className={base.eventIcon}><img src={BADGES.raid.icon} alt="" /></div><span className={base.kicker}>{state.tutorial ? "OPEN THREE BOXES." : "COIN RAID"}</span><h2>Raid {state.session.target.displayName}</h2><p>The jackpot was locked in before your first pick. Choose exactly three of nine boxes.</p><div className={styles.raidStatus}><span>{state.session.picksRemaining} PICKS LEFT</span><b>🪙 {formatNumber(state.session.coinsWon)}</b></div><div className={`${styles.vaultGrid} ${styles.nineVaultGrid}`}>{state.session.chests.map((chest, index) => { const revealed = state.session.pickedIds.includes(chest.id); const guideFirstPick = state.tutorial && state.session.pickedIds.length === 0 && index === 0; return <button key={chest.id} className={guideFirstPick ? styles.guidedVaultBox : undefined} disabled={revealed || state.session.complete} data-pvp-primary-action={guideFirstPick ? "true" : undefined} data-revealed={revealed} data-tier={revealed ? chest.tier : undefined} onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); onPick(chest.id, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }); }}><img src={RAID_BOX_ART[revealed ? chest.tier : "locked"]} alt="" />{revealed && <b>{formatNumber(chest.coins)}</b>}{revealed && <small>{chest.tier.toUpperCase()}</small>}</button>; })}</div>{state.session.complete && <div className={styles.pvpResultBanner}><small>RAID COMPLETE</small><b>+{formatNumber(state.session.coinsWon)} Coins</b><span>Coins go straight to your persistent balance.</span></div>}<button className={styles.pvpContinue} disabled={!state.session.complete} onClick={onClose}>{state.session.complete ? "COLLECT COINS" : "CHOOSE 3 BOXES"}</button></section></div>;
  }
  if (state.kind === "attack") {
    const attackableCards = state.target.cards.filter((card) => !card.stolen);
    const noCardsToAttack = !state.result && attackableCards.length === 0;
    return <div className={`${base.eventOverlay} ${styles.pvpOverlay}`} role="dialog" aria-modal="true"><section className={`${base.eventCard} ${styles.pvpEventCard}`} data-event="attack"><div className={base.eventIcon}><img src={BADGES.attack.icon} alt="" /></div><span className={base.kicker}>{state.tutorial ? "CHOOSE ONE CARD TO ATTACK." : "CARD ATTACK"}</span><h2>{state.target.displayName}</h2>{noCardsToAttack ? <p>Every card {state.target.displayName} owns has already been claimed. This Attack stays ready for another rival.</p> : !state.result ? <div className={styles.metaCardChoice}>{attackableCards.map((card, index) => <button key={card.cardId} data-pvp-primary-action={index === 0 ? "true" : undefined} onClick={() => onAttack(card.cardId)}><span>{card.icon}</span><b>{card.name}</b><small>{card.shielded ? "Shield status hidden" : "Visible rival card"}</small></button>)}</div> : <div className={styles.pvpResultBanner}><small>{state.result.blocked ? "SHIELD BROKE" : "DIRECT HIT"}</small><b>{state.result.card.name}</b><span>{state.result.blocked ? "The card was protected and remains safe." : "The card is Damaged, not deleted."}</span></div>}<button className={styles.pvpContinue} data-pvp-primary-action={noCardsToAttack ? "true" : undefined} disabled={!state.result && !noCardsToAttack} onClick={noCardsToAttack ? onAttackSkip : onClose}>{state.result ? "CONTINUE" : noCardsToAttack ? "OK, GOT IT" : "CHOOSE A CARD"}</button></section></div>;
  }
  if (state.kind === "steal") {
    const result = state.session.result;
    return <div className={`${base.eventOverlay} ${styles.pvpOverlay}`} role="dialog" aria-modal="true"><section className={`${base.eventCard} ${styles.pvpEventCard}`} data-event="steal" data-steal-status={state.session.status}><div className={base.eventIcon}><img src={BADGES.steal.icon} alt="" /></div><span className={base.kicker}>{state.tutorial ? "STEAL ONE ELIGIBLE CARD." : "CARD STEAL"}</span><h2>{state.target.displayName}</h2><p>The eligible card is selected randomly. Tutorial cards and completed collections stay safe.</p>{result && <div className={styles.pvpResultBanner}><small>{result.blocked ? "STEAL BLOCKED" : "CARD STOLEN"}</small><b>{result.blocked ? "Steal Blocked." : result.card?.name ?? "Royal Card"}</b><span>{result.blocked ? "The card's Shield was consumed and the card stayed safe." : "The card was added to your Album."}</span></div>}{result ? <button className={styles.pvpContinue} onClick={onClose}>CONTINUE</button> : <div className={styles.stealActions}><button className={styles.pvpContinue} data-pvp-primary-action="true" disabled={state.busy} onClick={onSteal}>{state.busy ? "CHOOSING…" : "STEAL A CARD"}</button><button className={styles.briefingSecondary} disabled={state.busy} onClick={onUseLater}>USE LATER</button></div>}</section></div>;
  }
  const noCardsToProtect = ownedCards.length === 0 && !state.protectedCardId;
  return <div className={`${base.eventOverlay} ${styles.pvpOverlay}`} role="dialog" aria-modal="true"><section className={`${base.eventCard} ${styles.pvpEventCard}`} data-event="shield"><div className={base.eventIcon}><img src={BADGES.shield.icon} alt="" /></div><span className={base.kicker}>{state.tutorial ? "PROTECT ONE OF YOUR CARDS." : "CARD SHIELD"}</span><h2>{state.result?.blocked ? "Shield blocked the Attack!" : state.protectedCardId ? "Card protected" : noCardsToProtect ? "No cards yet" : "Choose a card"}</h2>{noCardsToProtect ? <p>You don't have any Royal Cards yet. This Shield stays ready — come back once you've collected one.</p> : !state.protectedCardId ? <div className={styles.metaCardChoice}>{ownedCards.map((card, index) => <button key={card.cardId} data-pvp-primary-action={index === 0 ? "true" : undefined} onClick={() => onShield(card.cardId)}><span>{card.icon}</span><b>{card.name}</b><small>Protect from one Attack or Steal</small></button>)}</div> : <div className={styles.pvpResultBanner}><small>{state.result?.blocked ? "SCRIPTED ATTACK BLOCKED" : "SHIELD EQUIPPED"}</small><b>{ownedCards.find((card) => card.cardId === state.protectedCardId)?.name ?? "Royal Card"}</b><span>{state.result?.blocked ? "The Shield was consumed exactly once." : "Protection is now visible in your Album."}</span></div>}<button className={styles.pvpContinue} data-pvp-primary-action={noCardsToProtect ? "true" : undefined} disabled={!state.protectedCardId && !noCardsToProtect} onClick={noCardsToProtect ? onShieldSkip : onClose}>{state.protectedCardId ? "CONTINUE" : noCardsToProtect ? "OK, GOT IT" : "CHOOSE A CARD"}</button></section></div>;
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
