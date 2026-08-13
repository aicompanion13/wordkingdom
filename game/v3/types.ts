import type { V3RunSummaryCore } from "../scoring/types";
import type { BadgeType, PlayerSettings } from "../v2/types";

export type PackTier = "GREEN" | "BLUE" | "GOLD";
export type TrackNodeKind = "STANDARD" | "MILESTONE" | "HARD" | "BOSS";
export type ObjectiveKind = "WORDS" | "OBSTACLES";

export type TrackReward = {
  coins: number;
  energy?: number;
  /** Hints granted on completion. Every level pays at least one. */
  hints?: number;
  pack?: PackTier;
};

export type ObjectiveDefinition = {
  kind: ObjectiveKind;
  target: number;
  obstacleKey?: string;
  label: string;
};

export type TrackNode = {
  level: number;
  chapterId: string;
  areaId: number;
  kind: TrackNodeKind;
  title: string;
  objective: ObjectiveDefinition;
  reward: TrackReward;
  gatewayTo?: string;
};

export type ChapterDefinition = {
  chapterId: string;
  areaId: number;
  themeKey: string;
  displayName: string;
  subtitle: string;
  startLevel: number;
  endLevel: number;
  accent: string;
  albumId: string;
  gatewayTo?: string;
};

export type CardDefinition = {
  cardId: string;
  name: string;
  rarity: 1 | 2 | 3 | 4 | 5;
  spriteKey: string;
  icon: string;
};

export type AlbumSetDefinition = {
  setId: string;
  setName: string;
  completionReward: { energy: number; coins: number };
  cards: CardDefinition[];
};

export type AlbumDefinition = {
  albumId: string;
  albumName: string;
  themeKey: string;
  chapterId: string;
  accent: string;
  completionReward: { frame: string; badge: string };
  sets: AlbumSetDefinition[];
};

export type PackResult = {
  tier: PackTier;
  cards: Array<CardDefinition & { isNew: boolean }>;
  vaultStarsEarned: number;
};

export type V3PlayerState = {
  version: 4;
  energy: number;
  energyUpdatedAt: number;
  coins: number;
  stars: number;
  shields: number;
  vaultStars: number;
  currentLevel: number;
  hints: number;
  unlockedChapterIds: string[];
  completedLevels: number[];
  claimedSetRewards: string[];
  claimedAlbumRewards: string[];
  cards: Record<string, number>;
  goldPity: number;
  royalDictionary: string[];
  recentWordsByArea: Record<string, string[]>;
  settings: PlayerSettings;
};

export type ObstacleState = {
  key: string;
  icon: string;
  tileIds: string[];
  cleared: number;
  target: number;
};

export type V3RunSummary = V3RunSummaryCore & {
  node: TrackNode;
  objectiveComplete: boolean;
  reward: TrackReward;
  packResult?: PackResult;
  /** Hints that actually landed, after the pool cap. May be less than `reward.hints`. */
  hintsGranted?: number;
  /** Collectibles credited by this level, whether album cards or FTUE ocean stickers. */
  collectiblesGranted?: number;
};

export type PendingBadgeReward = { type: BadgeType; pack: PackTier };
