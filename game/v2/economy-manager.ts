import type { AreaBuildingDefinition, AreaDefinition, PlayerSettings, PlayerState } from "./types";

export const ENERGY_CAP = 50;
export const ENERGY_REGEN_MS = 20 * 60 * 1000;

export function buildingCoinCost(building: AreaBuildingDefinition, level: number): number {
  return Math.ceil((building.baseCost * Math.pow(1.62, level)) / 50) * 50;
}

export function buildingStarCost(level: number): number {
  return Math.min(3, 1 + Math.floor(level / 2));
}

export class EconomyManager {
  private player: PlayerState;

  constructor(player: PlayerState, now = Date.now()) {
    this.player = structuredClone(player);
    if (!this.player.energyUpdatedAt) this.player.energyUpdatedAt = now;
    this.regenerate(now);
  }

  regenerate(now = Date.now()): PlayerState {
    if (this.player.energy >= ENERGY_CAP) {
      this.player.energyUpdatedAt = now;
      return this.snapshot();
    }
    const elapsed = Math.max(0, now - this.player.energyUpdatedAt);
    const gained = Math.floor(elapsed / ENERGY_REGEN_MS);
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

  awardRun(coins: number, stars: number, shields = 0): PlayerState {
    this.player.coins += coins;
    this.player.stars += stars;
    this.player.shields = Math.min(5, this.player.shields + shields);
    return this.snapshot();
  }

  buildingLevel(areaId: number, buildingId: string): number {
    return this.player.areaProgress[String(areaId)]?.[buildingId] ?? 0;
  }

  build(area: AreaDefinition, building: AreaBuildingDefinition): boolean {
    const level = this.buildingLevel(area.areaId, building.id);
    if (level >= building.maxLevel) return false;
    const coins = buildingCoinCost(building, level);
    const stars = buildingStarCost(level);
    if (this.player.coins < coins || this.player.stars < stars) return false;
    this.player.coins -= coins;
    this.player.stars -= stars;
    const key = String(area.areaId);
    this.player.areaProgress[key] ??= {};
    this.player.areaProgress[key][building.id] = level + 1;
    return true;
  }

  isAreaComplete(area: AreaDefinition): boolean {
    return area.visualAssets.buildings.every((building) => this.buildingLevel(area.areaId, building.id) >= building.maxLevel);
  }

  claimAreaReward(area: AreaDefinition, nextAreaId?: number): boolean {
    if (!this.isAreaComplete(area) || this.player.claimedAreaRewards.includes(area.areaId)) return false;
    this.player.coins += area.areaCompletionReward.coins;
    this.player.energy = Math.min(ENERGY_CAP, this.player.energy + area.areaCompletionReward.energy);
    this.player.claimedAreaRewards.push(area.areaId);
    if (nextAreaId && !this.player.unlockedAreaIds.includes(nextAreaId)) this.player.unlockedAreaIds.push(nextAreaId);
    if (nextAreaId) this.player.currentAreaId = nextAreaId;
    return true;
  }

  setActiveArea(areaId: number): boolean {
    if (!this.player.unlockedAreaIds.includes(areaId)) return false;
    this.player.currentAreaId = areaId;
    return true;
  }

  advanceLevel(): PlayerState {
    this.player.currentLevel += 1;
    return this.snapshot();
  }

  rememberWords(areaId: number, words: string[]): PlayerState {
    const key = String(areaId);
    const previous = this.player.recentWordsByArea?.[key] ?? [];
    const combined = [...words, ...previous.filter((word) => !words.includes(word))];
    this.player.recentWordsByArea ??= {};
    this.player.recentWordsByArea[key] = combined.slice(0, 18);
    return this.snapshot();
  }

  updateSetting(key: keyof PlayerSettings, value: boolean): PlayerState {
    this.player.settings[key] = value;
    return this.snapshot();
  }

  debugAdd(coins: number, energy: number, stars = 10): PlayerState {
    this.player.coins += coins;
    this.player.stars += stars;
    this.player.energy = Math.min(ENERGY_CAP, this.player.energy + energy);
    return this.snapshot();
  }

  debugCompleteArea(area: AreaDefinition): PlayerState {
    const key = String(area.areaId);
    this.player.areaProgress[key] ??= {};
    area.visualAssets.buildings.forEach((building) => { this.player.areaProgress[key][building.id] = building.maxLevel; });
    return this.snapshot();
  }

  snapshot(): PlayerState {
    return structuredClone(this.player);
  }
}
