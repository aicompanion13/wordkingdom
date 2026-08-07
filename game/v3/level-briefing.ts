import type { AreaDefinition } from "../v2/types";
import type { TrackNode } from "./types";

export type LevelBriefingCard = {
  id: "mission" | "mechanic" | "kit";
  eyebrow: string;
  title: string;
  body: string;
  icon: string;
  example: string;
};

export type LevelBriefing = {
  level: number;
  theme: string;
  objective: string;
  newMechanic: string | null;
  cards: LevelBriefingCard[];
};

type UnlockBrief = {
  title: string;
  body: string;
  icon: string;
  example: string;
};

const FIRST_UNLOCK_BY_LEVEL: Record<number, UnlockBrief> = {
  1: {
    title: "Living Board",
    body: "Trace either active word and follow the objectives shown above the board.",
    icon: "🔤",
    example: "Drag through W · O · R · D",
  },
  2: {
    title: "Attack",
    body: "Three Attack badges prepare one card strike after the level.",
    icon: "⚔️",
    example: "⚔️ ⚔️ ⚔️ → Attack",
  },
  3: {
    title: "Shield",
    body: "Three Shield badges protect one owned card from one Attack or Steal.",
    icon: "🛡️",
    example: "🛡️ card → blocked hit",
  },
  4: {
    title: "Steal",
    body: "Three Steal badges prepare one random eligible card transfer after the level.",
    icon: "🃏",
    example: "🃏 🃏 🃏 → Steal",
  },
  5: {
    title: "Raid",
    body: "Three Raid badges open a nine-box coin vault after the level. Choose exactly three.",
    icon: "💰",
    example: "3 picks · 9 boxes",
  },
};

function availableTools(level: number): string {
  const tools = [
    ...(level >= 2 ? ["Attack"] : []),
    ...(level >= 3 ? ["Shield"] : []),
    ...(level >= 4 ? ["Steal"] : []),
    ...(level >= 5 ? ["Raid"] : []),
  ];
  return tools.length ? tools.join(" · ") : "Hints · active objectives";
}

export function createLevelBriefing(node: TrackNode, area: AreaDefinition): LevelBriefing {
  const unlock = FIRST_UNLOCK_BY_LEVEL[node.level] ?? null;
  const objective = node.objective.kind === "WORDS"
    ? `Find ${node.objective.target} objective words`
    : node.objective.label;
  const rewardParts = [
    `${node.reward.coins} Coins`,
    node.reward.energy ? `${node.reward.energy} Energy` : null,
    node.reward.pack ? `${node.reward.pack} Pack` : null,
  ].filter(Boolean).join(" · ");
  const cards: LevelBriefingCard[] = [
    {
      id: "mission",
      eyebrow: `LEVEL ${node.level} · ${area.displayName}`,
      title: node.title,
      body: objective,
      icon: area.icon,
      example: `${node.objective.target} objective words`,
    },
  ];

  if (unlock) {
    cards.push({ id: "mechanic", eyebrow: "NEW THIS LEVEL", ...unlock });
  }

  cards.push({
    id: "kit",
    eyebrow: "TOOLS & REWARD",
    title: levelKitTitle(node.level),
    body: `Available: ${availableTools(node.level)}. Finish the objective to earn ${rewardParts}.`,
    icon: node.reward.pack ? "🎁" : "👑",
    example: rewardParts,
  });

  return {
    level: node.level,
    theme: area.displayName,
    objective,
    newMechanic: unlock?.title ?? null,
    cards,
  };
}

function levelKitTitle(level: number): string {
  if (level >= 5) return "Royal Action Kit";
  if (level >= 2) return "Unlocked Tools";
  return "Your First Quest";
}

export function hasAcknowledgedBriefing(levels: readonly number[], level: number): boolean {
  return levels.includes(level);
}

export function acknowledgeBriefing(levels: readonly number[], level: number): number[] {
  return hasAcknowledgedBriefing(levels, level) ? [...levels] : [...levels, level].sort((a, b) => a - b);
}
