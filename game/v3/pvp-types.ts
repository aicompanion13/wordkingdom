import type { CardDefinition } from "./types";
import type { FtueProgress } from "./golden-tutorial-state";

export type PowerUpKind = "attack" | "steal" | "shield" | "raid";
export type PvpActionType = "ATTACK" | "STEAL" | "SHIELD" | "RAID";
export type MetaTutorialId = "album" | PowerUpKind;
export type PowerUpCounter = Record<PowerUpKind, number>;

export type NpcCardState = CardDefinition & {
  shielded: boolean;
  damaged: boolean;
  stolen: boolean;
  protectedTutorial?: boolean;
  completedCollection?: boolean;
};

export type PvpHistoryEntry = {
  timestamp: number;
  attackerId: string;
  defenderId?: string;
  actionType: PvpActionType;
  shieldBlocked: boolean;
  coinsLost: number;
  coinsWon?: number;
};

export type RivalProfile = {
  playerId: string;
  displayName: string;
  avatar: string;
  coinBank: number;
  activeShields: number;
  cards: NpcCardState[];
};

export type PvpNotification = {
  id: string;
  recipientId: string;
  priority: "normal" | "high";
  message: string;
  createdAt: number;
};

export type PvpState = {
  playerId: string;
  displayName: string;
  coinBank: number;
  activeShields: number;
  shieldFragments: number;
  maxShieldCapacity: number;
  pvpHistory: PvpHistoryEntry[];
  matchmakingQueue: RivalProfile[];
  notificationOutbox: PvpNotification[];
  badgeProgress: PowerUpCounter;
  readyActions: PowerUpCounter;
  protectedCardIds: string[];
  damagedCardIds: string[];
  tutorialsCompleted: MetaTutorialId[];
  levelBriefingsAcknowledged: number[];
  pendingSteal: StealSession | null;
  pendingRaid: RaidSession | null;
  ftueProgress: FtueProgress;
};

export type RaidChest = {
  id: string;
  coins: number;
  tier: "jackpot" | "medium" | "small" | "empty";
};

export type RaidSession = {
  id: string;
  target: RivalProfile;
  chests: RaidChest[];
  pickedIds: string[];
  picksRemaining: number;
  coinsWon: number;
  complete: boolean;
  awarded: boolean;
};

export type CardAttackResult = {
  target: RivalProfile;
  card: NpcCardState;
  blocked: boolean;
  damaged: boolean;
};

export type CardStealResult = {
  target: RivalProfile;
  card: NpcCardState | null;
  blocked: boolean;
};

export type StealSession = {
  id: string;
  targetId: string;
  tutorial: boolean;
  status: "ready" | "resolved";
  result: CardStealResult | null;
  rewardClaimed: boolean;
  createdAt: number;
};

export type CardShieldResult = {
  cardId: string;
  protected: boolean;
};

export type IncomingCardActionResult = {
  blocked: boolean;
  cardId: string;
  damaged: boolean;
};
