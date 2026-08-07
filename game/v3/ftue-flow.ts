import type { PowerUpKind } from "./pvp-types";

export type FtueTutorialId =
  | "level-1-drag"
  | "level-2-album"
  | "level-3-hint"
  | "level-3-raid"
  | "level-4-bonus"
  | "level-6-shield"
  | "level-7-attack"
  | "level-8-steal";

export type FtueCreditId =
  | "level-2-discovery-pack"
  | "level-3-discovery-pack"
  | "level-4-discovery-pack"
  | "level-5-discovery-pack"
  | "level-3-raid-action"
  | "level-6-shield-action"
  | "level-7-attack-action"
  | "level-8-steal-action";

export type PendingFtueStep =
  | "OPEN_LEVEL_2_ALBUM"
  | "VIEW_LEVEL_2_ALBUM"
  | null;

export type OceanRewardPhase =
  | "RESULTS"
  | "PACK_READY"
  | "STICKER_REVEAL"
  | "ALBUM_ACTIVATED"
  | "ALBUM_GUIDE"
  | "ALBUM_REVEAL"
  | "PACK_COMPLETE"
  | "KINGDOM_COMPLETE"
  | null;

export type Level2RewardPhase = OceanRewardPhase;

export type OceanDiscoveryStickerId =
  | "coral-castle"
  | "pearl"
  | "sea-turtle"
  | "dancing-dolphin"
  | "golden-anchor"
  | "reef-gate"
  | "whale-song"
  | "triton-mark"
  | "sunken-throne"
  | "coral-crown"
  | "ocean-palace"
  | "sunken-crown";

export const LEVEL_2_DISCOVERY_STICKERS: readonly OceanDiscoveryStickerId[] = [
  "coral-castle",
  "pearl",
  "sea-turtle",
] as const;

export const OCEAN_ALBUM_STAGE_PLAN = [
  { level: 2, stickerIds: ["coral-castle", "pearl", "sea-turtle"], stickers: ["Coral Castle", "Pearl", "Sea Turtle"], completesKingdom: false },
  { level: 3, stickerIds: ["dancing-dolphin", "golden-anchor", "reef-gate"], stickers: ["Dancing Dolphin", "Golden Anchor", "Reef Gate"], completesKingdom: false },
  { level: 4, stickerIds: ["whale-song", "triton-mark", "sunken-throne"], stickers: ["Whale Song", "Triton Mark", "Sunken Throne"], completesKingdom: false },
  { level: 5, stickerIds: ["coral-crown", "ocean-palace", "sunken-crown"], stickers: ["Coral Crown", "Ocean Palace", "Sunken Crown"], completesKingdom: true },
] as const;

export const OCEAN_STICKER_LABELS: Record<OceanDiscoveryStickerId, string> = Object.fromEntries(
  OCEAN_ALBUM_STAGE_PLAN.flatMap((stage) => stage.stickerIds.map((id, index) => [id, stage.stickers[index]])),
) as Record<OceanDiscoveryStickerId, string>;

export function oceanStickersForLevel(level: number): readonly OceanDiscoveryStickerId[] {
  return OCEAN_ALBUM_STAGE_PLAN.find((stage) => stage.level === level)?.stickerIds ?? [];
}

export type FtueCompletionResult = {
  score: number;
  combo: number;
  correct: number;
  attempts: number;
  hints: number;
  longestWord: string;
  elapsedSeconds: number;
  accuracy: number;
  stars: number;
  baseCoins: number;
  eventCoins: number;
  totalCoins: number;
  bestCombo: number;
  invalidSelections: number;
};

export type FtueVisualStep =
  | "welcome-guidance"
  | "first-word-guidance"
  | "level-2-rules-guidance"
  | "first-transformation"
  | "level-2-ready-guidance"
  | "level-2-pack-opened"
  | "level-2-album-activated"
  | "level-2-album-guidance"
  | "level-2-album-view";

export type FtueLevelDefinition = {
  level: number;
  tutorial: FtueTutorialId | null;
  feature: "puzzle" | "album" | "hint" | "bonus" | PowerUpKind | "chapter";
  instruction: string | null;
};

export const FTUE_LEVELS: readonly FtueLevelDefinition[] = [
  { level: 1, tutorial: "level-1-drag", feature: "puzzle", instruction: "Swipe across the letters to find SHORE." },
  { level: 2, tutorial: "level-2-album", feature: "album", instruction: "Complete the level to earn your first Discovery Pack." },
  { level: 3, tutorial: "level-3-raid", feature: "raid", instruction: "Collect Raid tokens as you play, then open the Vault Raid for coins and rewards." },
  { level: 4, tutorial: "level-4-bonus", feature: "bonus", instruction: "Bonus Word! It was added to your Royal Dictionary." },
  { level: 5, tutorial: null, feature: "chapter", instruction: null },
  { level: 6, tutorial: "level-6-shield", feature: "shield", instruction: "Shield protects one of your collectibles." },
  { level: 7, tutorial: "level-7-attack", feature: "attack", instruction: "Attack breaks an opponent's Shield." },
  { level: 8, tutorial: "level-8-steal", feature: "steal", instruction: "Steal takes an unprotected collectible." },
] as const;

export const POWER_UNLOCK_LEVEL: Record<PowerUpKind, number> = {
  shield: 6,
  attack: 7,
  steal: 8,
  raid: 3,
};

export function visiblePowerKinds(level: number): PowerUpKind[] {
  return (["shield", "attack", "steal", "raid"] as PowerUpKind[])
    .filter((kind) => level >= POWER_UNLOCK_LEVEL[kind]);
}

export function tutorialDefinition(level: number): FtueLevelDefinition | null {
  return FTUE_LEVELS.find((entry) => entry.level === level) ?? null;
}

export function chapterCompletionCopy(level: number): string | null {
  if (level === 5) return "Ocean Kingdom discovered! Forest Kingdom awaits.";
  if (level === 10) return "Forest Kingdom discovered!";
  return null;
}
