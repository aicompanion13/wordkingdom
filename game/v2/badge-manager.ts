import type { ActiveWord, BadgeType, MetaEvent } from "./types";

const META_COPY: Record<BadgeType, MetaEvent> = {
  attack: { type: "attack", title: "Castle Attack!", description: "Choose a weak point and strike the rival keep." },
  steal: { type: "steal", title: "Card Steal!", description: "Take one eligible rival card." },
  raid: { type: "raid", title: "Bank Raid!", description: "Pick a vault and steal a royal coin stash." },
  shield: { type: "shield", title: "Shield Fragment Earned!", description: "Add one rare fragment to your 3-part Shield Meter." },
};

export class BadgeManager {
  private counts: Record<BadgeType, number> = { attack: 0, steal: 0, raid: 0, shield: 0 };

  collect(word: ActiveWord): { counts: Record<BadgeType, number>; event: MetaEvent | null } {
    let event: MetaEvent | null = null;
    for (const badge of word.badges) {
      this.counts[badge.type] += 1;
      if (this.counts[badge.type] >= 3) {
        this.counts[badge.type] = 0;
        event = META_COPY[badge.type];
      }
    }
    return { counts: this.snapshot(), event };
  }

  debugFill(type: BadgeType): MetaEvent {
    this.counts[type] = 0;
    return META_COPY[type];
  }

  snapshot(): Record<BadgeType, number> {
    return { ...this.counts };
  }
}
