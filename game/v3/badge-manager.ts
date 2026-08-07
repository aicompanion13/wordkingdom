import type { PowerUpCounter, PowerUpKind } from "./pvp-types";

export type BadgeKind = PowerUpKind;

export type BadgeCarrier = {
  badges: Array<{ type: BadgeKind; tileId: string }>;
};

export type BadgeArrival = {
  id: string;
  type: BadgeKind;
  sourceTileId: string;
  targetSlotIndex: number;
  completesTray: boolean;
};

export type BadgeCollectionResult = {
  counts: Record<BadgeKind, number>;
  displayCounts: Record<BadgeKind, number>;
  arrivals: BadgeArrival[];
  readyActions: PowerUpCounter;
  createdActions: PowerUpKind[];
};

const EMPTY_COUNTS: Record<BadgeKind, number> = {
  attack: 0,
  steal: 0,
  raid: 0,
  shield: 0,
};

/**
 * Owns badge tray rules only. Rendering, animation and PvP resolution are
 * intentionally delegated to consumers of BadgeCollectionResult.
 */
export class BadgeManager {
  private counts: PowerUpCounter;
  private readyActions: PowerUpCounter;
  private sequence = 0;

  constructor(counts: Partial<PowerUpCounter> = {}, readyActions: Partial<PowerUpCounter> = {}) {
    this.counts = { ...EMPTY_COUNTS, ...counts };
    this.readyActions = { ...EMPTY_COUNTS, ...readyActions };
  }

  collect(carrier: BadgeCarrier): BadgeCollectionResult {
    const arrivals: BadgeArrival[] = [];
    const displayCounts = this.snapshot();
    const createdActions: PowerUpKind[] = [];

    for (const badge of carrier.badges) {
      const targetSlotIndex = this.counts[badge.type];
      const completesTray = targetSlotIndex === 2;
      this.counts[badge.type] = targetSlotIndex + 1;
      displayCounts[badge.type] = this.counts[badge.type];
      arrivals.push({
        id: `badge-${badge.type}-${++this.sequence}`,
        type: badge.type,
        sourceTileId: badge.tileId,
        targetSlotIndex,
        completesTray,
      });

      if (completesTray) {
        this.counts[badge.type] = 0;
        this.readyActions[badge.type] += 1;
        createdActions.push(badge.type);
      }
    }

    return {
      counts: this.snapshot(),
      displayCounts,
      arrivals,
      readyActions: this.actionSnapshot(),
      createdActions,
    };
  }

  debugFill(type: BadgeKind): BadgeCollectionResult {
    this.counts[type] = 0;
    this.readyActions[type] += 1;
    return { counts: this.snapshot(), displayCounts: this.snapshot(), arrivals: [], readyActions: this.actionSnapshot(), createdActions: [type] };
  }

  reset(): Record<BadgeKind, number> {
    this.counts = { ...EMPTY_COUNTS };
    return this.snapshot();
  }

  snapshot(): Record<BadgeKind, number> {
    return { ...this.counts };
  }

  actionSnapshot(): PowerUpCounter {
    return { ...this.readyActions };
  }
}
