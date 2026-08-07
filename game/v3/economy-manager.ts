import type { PlayerSettings } from "../v2/types";
import type { PackResult, TrackNode, V3PlayerState } from "./types";

export const ENERGY_CAP = 50;
export const ENERGY_REGEN_MS = 20 * 60 * 1000;

export class EconomyManagerV3 {
  private player: V3PlayerState;

  constructor(player: V3PlayerState, now = Date.now()) {
    this.player = structuredClone(player);
    if (!this.player.energyUpdatedAt) this.player.energyUpdatedAt = now;
    this.regenerate(now);
  }

  regenerate(now = Date.now()): V3PlayerState {
    if (this.player.energy >= ENERGY_CAP) {
      this.player.energyUpdatedAt = now;
      return this.snapshot();
    }
    const gained = Math.floor(Math.max(0, now - this.player.energyUpdatedAt) / ENERGY_REGEN_MS);
    if (gained > 0) {
      this.player.energy = Math.min(ENERGY_CAP, this.player.energy + gained);
      this.player.energyUpdatedAt += gained * ENERGY_REGEN_MS;
    }
    return this.snapshot();
  }

  spendEnergy(amount = 1): boolean {
    if (this.player.energy < amount) return false;
    this.player.energy -= amount;
    return true;
  }

  completeNode(node: TrackNode, runCoins: number, stars: number, unlockGateway = true): V3PlayerState {
    if (!this.player.completedLevels.includes(node.level)) this.player.completedLevels.push(node.level);
    this.player.coins += runCoins + node.reward.coins;
    this.player.stars += stars;
    this.player.energy += node.reward.energy ?? 0;
    if (unlockGateway && node.gatewayTo && !this.player.unlockedChapterIds.includes(node.gatewayTo)) this.player.unlockedChapterIds.push(node.gatewayTo);
    this.player.currentLevel = Math.max(
      this.player.currentLevel,
      Math.min(25, node.level + 1),
    );
    return this.snapshot();
  }

  unlockChapter(chapterId: string): V3PlayerState {
    if (!this.player.unlockedChapterIds.includes(chapterId)) this.player.unlockedChapterIds.push(chapterId);
    return this.snapshot();
  }

  applyPack(result: PackResult): void {
    result.cards.forEach((card) => { this.player.cards[card.cardId] = (this.player.cards[card.cardId] ?? 0) + 1; });
    this.player.vaultStars += result.vaultStarsEarned;
    if (result.tier === "GOLD") this.player.goldPity = result.cards.some((card) => card.isNew) ? 0 : this.player.goldPity + 1;
  }

  rememberWords(areaId: number, words: string[]): void {
    const key = String(areaId);
    const previous = this.player.recentWordsByArea[key] ?? [];
    this.player.recentWordsByArea[key] = [...words, ...previous.filter((word) => !words.includes(word))].slice(0, 18);
  }

  discoverBonusWord(word: string): V3PlayerState {
    const normalized = word.trim().toUpperCase();
    if (normalized && !this.player.royalDictionary.includes(normalized)) {
      this.player.royalDictionary.push(normalized);
      this.player.royalDictionary.sort();
    }
    return this.snapshot();
  }

  awardBonusWord(word: string, coins: number): V3PlayerState {
    this.discoverBonusWord(word);
    this.player.coins += Math.max(0, Math.round(coins));
    return this.snapshot();
  }

  updateSetting(key: keyof PlayerSettings, value: boolean): V3PlayerState {
    this.player.settings[key] = value;
    return this.snapshot();
  }

  debugAdd(): V3PlayerState {
    this.player.coins += 5000;
    this.player.stars += 20;
    this.player.energy += 25;
    this.player.vaultStars += 50;
    return this.snapshot();
  }

  debugLevel(level: number): V3PlayerState {
    this.player.currentLevel = Math.max(1, Math.min(25, level));
    const chapter =
      level > 20
        ? "chapter_frost"
        : level > 15
          ? "chapter_space"
          : level > 10
            ? "chapter_desert"
            : level > 5
              ? "chapter_forest"
              : "chapter_ocean";
    if (!this.player.unlockedChapterIds.includes(chapter)) this.player.unlockedChapterIds.push(chapter);
    return this.snapshot();
  }

  replace(player: V3PlayerState): V3PlayerState {
    this.player = structuredClone(player);
    return this.snapshot();
  }

  snapshot(): V3PlayerState { return structuredClone(this.player); }
}
