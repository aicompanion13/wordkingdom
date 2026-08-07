import type { PlayerSettings } from "../v2/types";
import type { PvpState } from "./pvp-types";
import type { V3PlayerState } from "./types";
import { createFtueProgress } from "./golden-tutorial-state";

export type RestartedProgress = {
  player: V3PlayerState;
  pvp: PvpState;
};

function emptyRecentWords(source: V3PlayerState): Record<string, string[]> {
  return Object.fromEntries(
    Object.keys(source.recentWordsByArea).map((areaId) => [areaId, []]),
  );
}

export function createRestartedProgress(
  defaultPlayer: V3PlayerState,
  defaultPvp: PvpState,
  preservedSettings: PlayerSettings,
  now = Date.now(),
): RestartedProgress {
  const player: V3PlayerState = {
    ...structuredClone(defaultPlayer),
    energyUpdatedAt: now,
    stars: 0,
    shields: 0,
    vaultStars: 0,
    currentLevel: 1,
    unlockedChapterIds: ["chapter_ocean"],
    completedLevels: [],
    claimedSetRewards: [],
    claimedAlbumRewards: [],
    cards: {},
    goldPity: 0,
    royalDictionary: [],
    recentWordsByArea: emptyRecentWords(defaultPlayer),
    settings: structuredClone(preservedSettings),
  };

  const pvp: PvpState = {
    ...structuredClone(defaultPvp),
    coinBank: player.coins,
    activeShields: 0,
    shieldFragments: 0,
    pvpHistory: [],
    notificationOutbox: [],
    badgeProgress: { attack: 0, steal: 0, shield: 0, raid: 0 },
    readyActions: { attack: 0, steal: 0, shield: 0, raid: 0 },
    protectedCardIds: [],
    damagedCardIds: [],
    tutorialsCompleted: [],
    levelBriefingsAcknowledged: [],
    pendingSteal: null,
    pendingRaid: null,
    ftueProgress: createFtueProgress(),
  };

  return { player, pvp };
}
