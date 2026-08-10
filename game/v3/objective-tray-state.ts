export type ObjectiveTileState = "normal" | "active";

export type ObjectiveTile = {
  id: string;
  word: string;
  state: ObjectiveTileState;
};

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

export function buildObjectiveTray(input: ObjectiveTrayInput): ObjectiveTile[] {
  const activeId = resolveActiveId(input);
  return input.activeWords.map((word) => ({
    id: word.id,
    word: word.word,
    state: (word.id === activeId ? "active" : "normal") as ObjectiveTileState,
  }));
}

export function objectiveTileLabel(tile: ObjectiveTile): string {
  if (tile.state === "active") return `${tile.word}, current hint`;
  return `${tile.word}, remaining`;
}
