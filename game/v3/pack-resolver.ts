import type { AlbumDefinition, CardDefinition, PackResult, PackTier, V3PlayerState } from "./types";

const PACK_SIZE: Record<PackTier, number> = { GREEN: 2, BLUE: 3, GOLD: 4 };
const VAULT_VALUE = [0, 1, 2, 4, 8, 15];

export class PackResolver {
  private seed: number;

  constructor(seed = Date.now()) {
    this.seed = seed >>> 0;
  }

  open(tier: PackTier, album: AlbumDefinition, player: V3PlayerState): PackResult {
    const pool = album.sets.flatMap((set) => set.cards);
    const missing = pool.filter((card) => !player.cards[card.cardId]);
    const cards: Array<CardDefinition & { isNew: boolean }> = [];
    const guaranteedRarity = tier === "GOLD" ? 4 : tier === "BLUE" ? 3 : 1;
    const pityNew = tier === "GOLD" && player.goldPity >= 2 && missing.length > 0;

    for (let index = 0; index < PACK_SIZE[tier]; index += 1) {
      const guarantee = index === 0;
      const candidates = pool.filter((card) => !guarantee || card.rarity >= guaranteedRarity);
      const missingCandidates = candidates.filter((card) => !player.cards[card.cardId]);
      const newChance = tier === "GOLD" ? 0.62 : tier === "BLUE" ? 0.42 : 0.28;
      const source = (pityNew && index === 0) || (missingCandidates.length > 0 && this.next() < newChance) ? missingCandidates : candidates;
      const card = this.weighted(source.length ? source : candidates);
      cards.push({ ...card, isNew: !player.cards[card.cardId] && !cards.some((item) => item.cardId === card.cardId) });
    }

    const vaultStarsEarned = cards.reduce((sum, card) => sum + (card.isNew ? 0 : VAULT_VALUE[card.rarity]), 0);
    return { tier, cards, vaultStarsEarned };
  }

  private weighted(cards: CardDefinition[]): CardDefinition {
    const weighted = cards.flatMap((card) => Array.from({ length: Math.max(1, 7 - card.rarity) }, () => card));
    return weighted[Math.floor(this.next() * weighted.length)] ?? cards[0];
  }

  private next(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 0x100000000;
  }
}
