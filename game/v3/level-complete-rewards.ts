export type LevelRewardKind = "coins" | "hints" | "card";

export type LevelRewardSlot = {
  kind: LevelRewardKind;
  /** How many were granted. Zero means the level did not award this one. */
  amount: number;
  earned: boolean;
};

export type LevelRewardInput = {
  /** Coins from the run itself, already multiplied by the star bonus. */
  runCoins: number;
  /** Flat coin bonus attached to the level. */
  levelCoins: number;
  /** Hints granted by this completion, if any. */
  hints?: number;
  /** Cards actually opened from a pack, if the level granted one. */
  cards?: number;
};

/**
 * The tray always shows all three rewards. A reward the level did not grant stays in
 * place, dimmed, so an empty slot reads as something still to earn rather than as a
 * missing element — which is what an actually-absent slot would look like.
 */
export function levelRewardSlots(input: LevelRewardInput): LevelRewardSlot[] {
  const coins = Math.max(0, Math.round(input.runCoins + input.levelCoins));
  const hints = Math.max(0, input.hints ?? 0);
  const cards = Math.max(0, input.cards ?? 0);
  return [
    { kind: "coins", amount: coins, earned: coins > 0 },
    { kind: "hints", amount: hints, earned: hints > 0 },
    { kind: "card", amount: cards, earned: cards > 0 },
  ];
}

export function levelRewardLabel(slot: LevelRewardSlot): string {
  const noun = slot.kind === "coins" ? "coins" : slot.kind === "hints" ? "hints" : "cards";
  if (!slot.earned) return `No ${noun} from this level`;
  return `${slot.amount} ${slot.amount === 1 ? noun.replace(/s$/, "") : noun}`;
}

/** Rendered inside the slot; coins are abbreviated so a big number cannot overflow. */
export function formatRewardAmount(slot: LevelRewardSlot): string {
  if (!slot.earned) return "—";
  if (slot.amount >= 1000) {
    const compact = slot.amount / 1000;
    return `${compact >= 10 ? Math.round(compact) : compact.toFixed(1).replace(/\.0$/, "")}K`;
  }
  return `${slot.kind === "coins" ? "" : "+"}${slot.amount}`;
}
