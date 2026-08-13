import { POWER_UNLOCK_LEVEL } from "./ftue-flow";

/**
 * When a ready Raid may take over the screen.
 *
 * A Raid is spent on the board, never between games: the tray fills around the seventh
 * word and the vault opens right there, rather than being banked for the results screen.
 * A Raid carried in from a scheduled top-up follows the same rule — it opens on the next
 * live board, not on the map.
 */
export type RaidTriggerInput = {
  screen: "hub" | "board" | "summary";
  /** Another overlay already owns the screen. */
  overlayOpen: boolean;
  /** The level being played. */
  level: number;
  /** Raids the player currently holds. */
  readyRaids: number;
  /** False once the board has been torn down or swapped underneath us. */
  boardAlive: boolean;
};

export function shouldOpenBoardRaid(input: RaidTriggerInput): boolean {
  if (!input.boardAlive || input.screen !== "board") return false;
  if (input.overlayOpen) return false;
  if (input.level < POWER_UNLOCK_LEVEL.raid) return false;
  return input.readyRaids > 0;
}

/**
 * The Raid explainer belongs to the player's first Raid, wherever it actually lands.
 *
 * Level 3's tray can fill on its final word, in which case the board ends before the
 * vault can open and the Raid carries into the next level. Keying the explainer to the
 * level being played would silently skip it for exactly those players.
 */
export const RAID_TUTORIAL_LEVEL = POWER_UNLOCK_LEVEL.raid;
