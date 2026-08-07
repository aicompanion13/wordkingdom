import { SeededRandom } from "../v2/random.js";
import type {
  CardAttackResult,
  CardShieldResult,
  CardStealResult,
  IncomingCardActionResult,
  MetaTutorialId,
  NpcCardState,
  PowerUpCounter,
  PowerUpKind,
  PvpState,
  RaidSession,
  RivalProfile,
  StealSession,
} from "./pvp-types";
import { acknowledgeBriefing, hasAcknowledgedBriefing } from "./level-briefing";
import { createFtueProgress } from "./golden-tutorial-state";
import type { FtueProgress } from "./golden-tutorial-state";

const MAX_HISTORY = 30;
const EMPTY_COUNTERS: PowerUpCounter = { attack: 0, steal: 0, shield: 0, raid: 0 };
const TUTORIAL_LEVELS: Record<number, MetaTutorialId> = { 3: "raid", 6: "shield", 7: "attack", 8: "steal" };

const NPC_CARD_SETS: Array<Array<Omit<NpcCardState, "shielded" | "damaged" | "stolen">>> = [
  [
    { cardId: "ocean_01", name: "Golden Anchor", rarity: 1, spriteKey: "card_anchor", icon: "⚓" },
    { cardId: "ocean_02", name: "Pearl Shell", rarity: 2, spriteKey: "card_pearl", icon: "🐚" },
    { cardId: "ocean_03", name: "Neptune Trident", rarity: 4, spriteKey: "card_trident", icon: "🔱" },
  ],
  [
    { cardId: "forest_01", name: "Moonlit Acorn", rarity: 1, spriteKey: "card_acorn", icon: "🌰" },
    { cardId: "forest_02", name: "Moss Crown", rarity: 2, spriteKey: "card_moss", icon: "🌿" },
    { cardId: "forest_03", name: "Ancient Stag", rarity: 4, spriteKey: "card_stag", icon: "🦌" },
  ],
  [
    { cardId: "desert_01", name: "Royal Scarab", rarity: 1, spriteKey: "card_scarab", icon: "🪲" },
    { cardId: "desert_02", name: "Sun Tablet", rarity: 2, spriteKey: "card_tablet", icon: "☀️" },
    { cardId: "desert_03", name: "Sphinx Crown", rarity: 4, spriteKey: "card_sphinx", icon: "👑" },
  ],
  [
    { cardId: "space_01", name: "Comet Crown", rarity: 1, spriteKey: "card_comet", icon: "☄️" },
    { cardId: "space_02", name: "Moon Compass", rarity: 2, spriteKey: "card_moon", icon: "🌙" },
    { cardId: "space_03", name: "Star Throne", rarity: 4, spriteKey: "card_star", icon: "🌟" },
  ],
];

function normalizedCards(rival: RivalProfile, index: number): NpcCardState[] {
  const cards: Array<Partial<NpcCardState> & Omit<NpcCardState, "shielded" | "damaged" | "stolen">> = rival.cards?.length ? rival.cards : NPC_CARD_SETS[index % NPC_CARD_SETS.length];
  return cards.map((card, cardIndex) => ({
    ...card,
    shielded: Boolean(card.shielded ?? cardIndex === 1),
    damaged: Boolean(card.damaged),
    stolen: Boolean(card.stolen),
    protectedTutorial: Boolean(card.protectedTutorial ?? cardIndex === 0),
    completedCollection: Boolean(card.completedCollection),
  }));
}

function normalizeState(state: PvpState): PvpState {
  return {
    ...structuredClone(state),
    badgeProgress: { ...EMPTY_COUNTERS, ...(state.badgeProgress ?? {}) },
    readyActions: { ...EMPTY_COUNTERS, ...(state.readyActions ?? {}) },
    protectedCardIds: [...(state.protectedCardIds ?? [])],
    damagedCardIds: [...(state.damagedCardIds ?? [])],
    tutorialsCompleted: [...(state.tutorialsCompleted ?? [])],
    levelBriefingsAcknowledged: [...(state.levelBriefingsAcknowledged ?? [])],
    pendingSteal: state.pendingSteal ? structuredClone(state.pendingSteal) : null,
    pendingRaid: state.pendingRaid ? structuredClone(state.pendingRaid) : null,
    ftueProgress: state.ftueProgress ? structuredClone(state.ftueProgress) : createFtueProgress(),
    pvpHistory: [...(state.pvpHistory ?? [])],
    notificationOutbox: [...(state.notificationOutbox ?? [])],
    matchmakingQueue: state.matchmakingQueue.map((rival, index) => ({
      ...rival,
      cards: normalizedCards(rival, index),
    })),
  };
}

export class PvpManager {
  private state: PvpState;
  private random: SeededRandom;

  constructor(state: PvpState, seed = Date.now()) {
    this.state = normalizeState(state);
    this.random = new SeededRandom(seed ^ 0x51e1d5);
  }

  syncCoinBank(coins: number): PvpState {
    this.state.coinBank = Math.max(0, Math.round(coins));
    return this.snapshot();
  }

  syncPowerUps(progress: PowerUpCounter, readyActions: PowerUpCounter): PvpState {
    this.state.badgeProgress = { ...progress };
    this.state.readyActions = { ...readyActions };
    return this.snapshot();
  }

  setFtueProgress(progress: FtueProgress): PvpState {
    this.state.ftueProgress = structuredClone(progress);
    return this.snapshot();
  }

  grantTutorialBadges(kind: PowerUpKind, amount: number): PvpState {
    for (let index = 0; index < Math.max(0, Math.floor(amount)); index += 1) {
      this.state.badgeProgress[kind] += 1;
      if (this.state.badgeProgress[kind] >= 3) {
        this.state.badgeProgress[kind] -= 3;
        this.state.readyActions[kind] += 1;
      }
    }
    return this.snapshot();
  }

  addReadyAction(kind: PowerUpKind, amount = 1): PvpState {
    this.state.readyActions[kind] += Math.max(0, Math.floor(amount));
    return this.snapshot();
  }

  consumeReadyAction(kind: PowerUpKind): boolean {
    if (this.state.readyActions[kind] < 1) return false;
    this.state.readyActions[kind] -= 1;
    return true;
  }

  pendingTutorial(level: number): MetaTutorialId | null {
    const tutorial = TUTORIAL_LEVELS[level];
    return tutorial && !this.state.tutorialsCompleted.includes(tutorial) ? tutorial : null;
  }

  completeTutorial(tutorial: MetaTutorialId): PvpState {
    if (!this.state.tutorialsCompleted.includes(tutorial)) this.state.tutorialsCompleted.push(tutorial);
    return this.snapshot();
  }

  isLevelBriefingAcknowledged(level: number): boolean {
    return hasAcknowledgedBriefing(this.state.levelBriefingsAcknowledged, level);
  }

  acknowledgeLevelBriefing(level: number): PvpState {
    this.state.levelBriefingsAcknowledged = acknowledgeBriefing(this.state.levelBriefingsAcknowledged, level);
    return this.snapshot();
  }

  firstOpponent(): RivalProfile {
    return structuredClone(this.state.matchmakingQueue[0]);
  }

  rival(playerId: string): RivalProfile | null {
    const rival = this.state.matchmakingQueue.find((candidate) => candidate.playerId === playerId);
    return rival ? structuredClone(rival) : null;
  }

  attackCard(rivalId: string, cardId: string): CardAttackResult | null {
    if (!this.consumeReadyAction("attack")) return null;
    const targetIndex = this.state.matchmakingQueue.findIndex((rival) => rival.playerId === rivalId);
    const cardIndex = this.state.matchmakingQueue[targetIndex]?.cards.findIndex((card) => card.cardId === cardId) ?? -1;
    if (targetIndex < 0 || cardIndex < 0) {
      this.state.readyActions.attack += 1;
      return null;
    }
    const card = this.state.matchmakingQueue[targetIndex].cards[cardIndex];
    const blocked = card.shielded;
    card.shielded = false;
    if (!blocked) card.damaged = true;
    this.pushHistory({ timestamp: Math.floor(Date.now() / 1000), attackerId: this.state.playerId, defenderId: rivalId, actionType: "ATTACK", shieldBlocked: blocked, coinsLost: 0 });
    return { target: structuredClone(this.state.matchmakingQueue[targetIndex]), card: structuredClone(card), blocked, damaged: !blocked };
  }

  attackTutorialCard(rivalId: string, cardId: string): CardAttackResult | null {
    if (!this.consumeReadyAction("attack")) return null;
    const target = this.state.matchmakingQueue.find((rival) => rival.playerId === rivalId);
    const card = target?.cards.find((candidate) => candidate.cardId === cardId);
    if (!target || !card) {
      this.state.readyActions.attack += 1;
      return null;
    }
    return {
      target: structuredClone(target),
      card: { ...structuredClone(card), shielded: false, damaged: false },
      blocked: card.shielded,
      damaged: false,
    };
  }

  beginStealSession(preferredRivalId?: string, tutorial = false): StealSession | null {
    if (this.state.pendingSteal) return structuredClone(this.state.pendingSteal);
    if (this.state.readyActions.steal < 1) return null;
    const candidates = this.eligibleStealTargets();
    if (!candidates.length) return null;
    const preferred = candidates.find(({ target }) => target.playerId === preferredRivalId);
    const selected = preferred ?? candidates[this.random.int(candidates.length)];
    this.state.pendingSteal = {
      id: `steal-${Date.now()}-${this.random.int(1_000_000)}`,
      targetId: selected.target.playerId,
      tutorial,
      status: "ready",
      result: null,
      rewardClaimed: false,
      createdAt: Date.now(),
    };
    return structuredClone(this.state.pendingSteal);
  }

  pendingStealSession(): StealSession | null {
    return this.state.pendingSteal ? structuredClone(this.state.pendingSteal) : null;
  }

  resolveStealSession(sessionId: string): StealSession | null {
    const session = this.state.pendingSteal;
    if (!session || session.id !== sessionId) return null;
    if (session.status === "resolved") return structuredClone(session);
    if (this.state.readyActions.steal < 1) return null;

    const candidates = this.eligibleStealTargets();
    if (!candidates.length) return null;
    const selectedTarget = candidates.find(({ target }) => target.playerId === session.targetId)
      ?? candidates[this.random.int(candidates.length)];
    const selectedCard = selectedTarget.cards[this.random.int(selectedTarget.cards.length)];
    const card = this.state.matchmakingQueue[selectedTarget.targetIndex].cards[selectedCard.cardIndex];
    const blocked = card.shielded;

    // The action is consumed only after a real target and card have been resolved.
    if (!this.consumeReadyAction("steal")) return null;
    session.targetId = selectedTarget.target.playerId;
    card.shielded = false;
    if (!blocked) card.stolen = true;
    const result: CardStealResult = {
      target: structuredClone(this.state.matchmakingQueue[selectedTarget.targetIndex]),
      card: structuredClone(card),
      blocked,
    };
    session.status = "resolved";
    session.result = result;
    this.pushHistory({ timestamp: Math.floor(Date.now() / 1000), attackerId: this.state.playerId, defenderId: selectedTarget.target.playerId, actionType: "STEAL", shieldBlocked: blocked, coinsLost: 0 });
    return structuredClone(session);
  }

  claimStealReward(sessionId: string): boolean {
    const session = this.state.pendingSteal;
    if (!session || session.id !== sessionId || session.status !== "resolved" || session.rewardClaimed) return false;
    if (!session.result || session.result.blocked || !session.result.card) return false;
    session.rewardClaimed = true;
    return true;
  }

  completeStealSession(sessionId: string): boolean {
    if (!this.state.pendingSteal || this.state.pendingSteal.id !== sessionId || this.state.pendingSteal.status !== "resolved") return false;
    this.state.pendingSteal = null;
    return true;
  }

  stealRandomCard(rivalId?: string): CardStealResult | null {
    const session = this.beginStealSession(rivalId);
    if (!session) return null;
    const resolved = this.resolveStealSession(session.id);
    if (!resolved?.result) return null;
    this.completeStealSession(session.id);
    return resolved.result;
  }

  protectCard(cardId: string): CardShieldResult | null {
    if (!this.consumeReadyAction("shield")) return null;
    if (!this.state.protectedCardIds.includes(cardId)) this.state.protectedCardIds.push(cardId);
    return { cardId, protected: true };
  }

  simulateIncomingCardAction(cardId: string): IncomingCardActionResult {
    const blocked = this.state.protectedCardIds.includes(cardId);
    if (blocked) this.state.protectedCardIds = this.state.protectedCardIds.filter((id) => id !== cardId);
    else if (!this.state.damagedCardIds.includes(cardId)) this.state.damagedCardIds.push(cardId);
    this.pushHistory({ timestamp: Math.floor(Date.now() / 1000), attackerId: "npc_tutorial", defenderId: this.state.playerId, actionType: "ATTACK", shieldBlocked: blocked, coinsLost: 0 });
    return { blocked, cardId, damaged: !blocked };
  }

  repairCard(cardId: string): PvpState {
    this.state.damagedCardIds = this.state.damagedCardIds.filter((id) => id !== cardId);
    return this.snapshot();
  }

  createRaid(): RaidSession | null {
    if (this.state.pendingRaid) return structuredClone(this.state.pendingRaid);
    if (!this.consumeReadyAction("raid")) return null;
    const target = this.coinKing();
    const jackpot = Math.max(900, Math.floor(target.coinBank * 0.08));
    const rewards = [
      { coins: jackpot, tier: "jackpot" as const },
      { coins: 360 + this.random.int(220), tier: "medium" as const },
      { coins: 280 + this.random.int(180), tier: "medium" as const },
      { coins: 130 + this.random.int(100), tier: "small" as const },
      { coins: 100 + this.random.int(80), tier: "small" as const },
      { coins: 70 + this.random.int(60), tier: "small" as const },
      { coins: 50 + this.random.int(40), tier: "small" as const },
      { coins: 0, tier: "empty" as const },
      { coins: 0, tier: "empty" as const },
    ];
    const chests = this.random.shuffle(rewards).map((reward, index) => ({ id: `vault-${index + 1}`, ...reward }));
    this.state.pendingRaid = { id: `raid-${Date.now()}`, target, chests, pickedIds: [], picksRemaining: 3, coinsWon: 0, complete: false, awarded: false };
    return structuredClone(this.state.pendingRaid);
  }

  pickRaid(session: RaidSession, chestId: string): RaidSession {
    if (session.complete || session.pickedIds.includes(chestId)) return structuredClone(session);
    const chest = session.chests.find((candidate) => candidate.id === chestId);
    if (!chest) return structuredClone(session);
    const next = structuredClone(session);
    next.pickedIds.push(chestId);
    next.picksRemaining -= 1;
    next.coinsWon += chest.coins;
    next.complete = next.picksRemaining === 0;
    if (next.complete) {
      this.pushHistory({ timestamp: Math.floor(Date.now() / 1000), attackerId: this.state.playerId, defenderId: next.target.playerId, actionType: "RAID", shieldBlocked: false, coinsLost: 0, coinsWon: next.coinsWon });
    }
    if (this.state.pendingRaid?.id === next.id) this.state.pendingRaid = structuredClone(next);
    return next;
  }

  awardRaid(session: RaidSession): RaidSession {
    const next = structuredClone(session);
    if (!next.complete || next.awarded) return next;
    next.awarded = true;
    this.state.coinBank += next.coinsWon;
    if (this.state.pendingRaid?.id === next.id) this.state.pendingRaid = structuredClone(next);
    return next;
  }

  pendingRaidSession(): RaidSession | null {
    return this.state.pendingRaid ? structuredClone(this.state.pendingRaid) : null;
  }

  completeRaidSession(sessionId: string): boolean {
    if (!this.state.pendingRaid || this.state.pendingRaid.id !== sessionId || !this.state.pendingRaid.complete) return false;
    this.state.pendingRaid = null;
    return true;
  }

  snapshot(): PvpState {
    return structuredClone(this.state);
  }

  private coinKing(): RivalProfile {
    return structuredClone(this.state.matchmakingQueue.reduce((richest, rival) => rival.coinBank > richest.coinBank ? rival : richest));
  }

  private eligibleStealTargets(): Array<{ target: RivalProfile; targetIndex: number; cards: Array<{ card: NpcCardState; cardIndex: number }> }> {
    return this.state.matchmakingQueue
      .map((target, targetIndex) => ({
        target,
        targetIndex,
        cards: target.cards
          .map((card, cardIndex) => ({ card, cardIndex }))
          .filter(({ card }) => !card.stolen && !card.protectedTutorial && !card.completedCollection),
      }))
      .filter(({ cards }) => cards.length > 0);
  }

  private pushHistory(entry: PvpState["pvpHistory"][number]): void {
    this.state.pvpHistory = [entry, ...this.state.pvpHistory].slice(0, MAX_HISTORY);
  }
}
