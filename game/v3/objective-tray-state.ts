export type ObjectiveTileState = "normal" | "active" | "completed";

export type ObjectiveTile = {
  id: string;
  word: string;
  state: ObjectiveTileState;
  /** When this tile turned gold, so the found beat can be held before it is replaced. */
  foundAt?: number;
};

/**
 * Solving a word usually reveals the next one in the same update, so without a hold the
 * gold state would be replaced in the same frame and the player would never see it.
 */
export const FOUND_HOLD_MS = 900;

/** The artwork provides two wells. */
export const SLOT_COUNT = 2;

export type ObjectiveTrayInput = {
  /** Objectives still to find, in board order. */
  activeWords: Array<{ id: string; word: string; tileIds: string[] }>;
  /** Objective the tutorial is explicitly pointing at, if any. */
  recommendedObjectiveId?: string | null;
  /** Tile currently revealed by a real Hint, if any. */
  hintedTileId?: string | null;
};

/**
 * Rule 4 of the handoff: the glow means "the game is directing you here" — a tutorial
 * pointing at a word, or a Hint the player just spent. Being first in the list is not
 * enough, so an ordinary board never glows.
 */
function resolveActiveId(input: ObjectiveTrayInput): string | null {
  const { activeWords, recommendedObjectiveId, hintedTileId } = input;
  if (recommendedObjectiveId && activeWords.some((word) => word.id === recommendedObjectiveId)) {
    return recommendedObjectiveId;
  }
  if (hintedTileId) {
    const hinted = activeWords.find((word) => word.tileIds.includes(hintedTileId));
    if (hinted) return hinted.id;
  }
  return null;
}

/**
 * Reconciles what the tray is showing against what is still outstanding.
 *
 * A solved word does not vanish the instant it is accepted — it stays in the slot it
 * occupied, turned gold, until a new objective needs that slot. That is what makes the
 * gold state readable: the player sees the word they just found sitting where it was.
 *
 * Slots are matched by identity, never by position, so an unsolved word never slides
 * sideways because a neighbour was completed.
 */
export function reconcileObjectiveTray(
  previous: readonly ObjectiveTile[],
  input: ObjectiveTrayInput,
  now = Date.now(),
): ObjectiveTile[] {
  const activeId = resolveActiveId(input);
  const active = new Map(input.activeWords.map((word) => [word.id, word]));

  // Keep existing entries in place; an entry that left activeWords has just been found.
  const kept: ObjectiveTile[] = previous.map((tile) => {
    const still = active.get(tile.id);
    if (!still) return tile.state === "completed" ? tile : { ...tile, state: "completed", foundAt: now };
    return { id: tile.id, word: still.word, state: still.id === activeId ? "active" : "normal" };
  });

  const shown = new Set(kept.map((tile) => tile.id));
  const arrivals = input.activeWords
    .filter((word) => !shown.has(word.id))
    .map((word) => ({
      id: word.id,
      word: word.word,
      state: (word.id === activeId ? "active" : "normal") as ObjectiveTileState,
    }));

  /*
   * New objectives take a gold slot once its hold has elapsed, so the tray never grows
   * past its wells. Until then the arrival waits — the word is already findable on the
   * board, and letting it wait is what makes the found beat readable.
   */
  const result = [...kept];
  for (const arrival of arrivals) {
    const reusable = result.findIndex(
      (tile) => tile.state === "completed" && now - (tile.foundAt ?? 0) >= FOUND_HOLD_MS,
    );
    if (reusable >= 0) result[reusable] = arrival;
    else if (result.length < SLOT_COUNT) result.push(arrival);
  }

  // Nothing left to find: drop the gold leftovers rather than stranding them on screen.
  if (active.size === 0) return result.filter((tile) => tile.state !== "completed");
  return result;
}

/** Milliseconds until a held gold slot frees up, or null if nothing is waiting. */
export function nextObjectiveTrayWakeMs(
  tiles: readonly ObjectiveTile[],
  input: ObjectiveTrayInput,
  now = Date.now(),
): number | null {
  const shown = new Set(tiles.map((tile) => tile.id));
  const waiting = input.activeWords.some((word) => !shown.has(word.id));
  if (!waiting) return null;
  const holds = tiles
    .filter((tile) => tile.state === "completed")
    .map((tile) => FOUND_HOLD_MS - (now - (tile.foundAt ?? 0)));
  if (!holds.length) return null;
  return Math.max(0, Math.min(...holds));
}

export function objectiveTileLabel(tile: ObjectiveTile): string {
  if (tile.state === "completed") return `${tile.word}, found`;
  if (tile.state === "active") return `${tile.word}, current hint`;
  return `${tile.word}, remaining`;
}
