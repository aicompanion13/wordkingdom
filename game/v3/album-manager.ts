import type { AlbumDefinition, AlbumSetDefinition, PackResult, V3PlayerState } from "./types";

export class AlbumManager {
  constructor(private readonly albums: AlbumDefinition[]) {}

  album(id: string): AlbumDefinition {
    return this.albums.find((album) => album.albumId === id) ?? this.albums[0];
  }

  applyPack(player: V3PlayerState, result: PackResult): V3PlayerState {
    result.cards.forEach((card) => { player.cards[card.cardId] = (player.cards[card.cardId] ?? 0) + 1; });
    player.vaultStars += result.vaultStarsEarned;
    if (result.tier === "GOLD") player.goldPity = result.cards.some((card) => card.isNew) ? 0 : player.goldPity + 1;
    return structuredClone(player);
  }

  setProgress(player: V3PlayerState, set: AlbumSetDefinition): number {
    return set.cards.filter((card) => player.cards[card.cardId] > 0).length;
  }

  isSetComplete(player: V3PlayerState, set: AlbumSetDefinition): boolean {
    return this.setProgress(player, set) === set.cards.length;
  }

  isAlbumComplete(player: V3PlayerState, album: AlbumDefinition): boolean {
    return album.sets.every((set) => this.isSetComplete(player, set));
  }

  claimAlbum(player: V3PlayerState, album: AlbumDefinition): boolean {
    if (!this.isAlbumComplete(player, album) || player.claimedAlbumRewards.includes(album.albumId)) return false;
    player.claimedAlbumRewards.push(album.albumId);
    return true;
  }

  claimSet(player: V3PlayerState, set: AlbumSetDefinition): boolean {
    if (!this.isSetComplete(player, set) || player.claimedSetRewards.includes(set.setId)) return false;
    player.claimedSetRewards.push(set.setId);
    player.energy += set.completionReward.energy;
    player.coins += set.completionReward.coins;
    return true;
  }

  redeemVault(player: V3PlayerState, album: AlbumDefinition): PackResult | null {
    if (player.vaultStars < 100) return null;
    const missing = album.sets.flatMap((set) => set.cards).filter((card) => !player.cards[card.cardId]);
    if (missing.length === 0) return null;
    const card = [...missing].sort((a, b) => b.rarity - a.rarity)[0];
    player.vaultStars -= 100;
    player.energy += 20;
    const result: PackResult = { tier: "GOLD", cards: [{ ...card, isNew: true }], vaultStarsEarned: 0 };
    this.applyPack(player, result);
    return result;
  }
}
