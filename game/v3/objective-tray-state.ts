export type ObjectiveTileState = "normal" | "active" | "completed";

export type ObjectiveTile = {
  id: string;
  word: string;
  state: ObjectiveTileState;
};

export type ObjectiveTrayInput = {
  /** Objectives still to find, in board order. */
  activeWords: Array<{ id: string; word: string; tileIds: string[] }>;
  /** Words already found this run, oldest first (BoardSession.shownWords()). */
  completedWords: string[];
  /** Objective the tutorial is explicitly pointing at, if any. */
  recommendedObjectiveId?: string | null;
  /** Tile currently revealed by a real Hint, if any. */
  hintedTileId?: string | null;
};

/**
 * The tray shows the most recent find alongside what is still outstanding, so the
 * player keeps a sense of progress without the tray growing.
 */
const VISIBLE_COMPLETED = 1;

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
  const recent = input.completedWords.slice(-VISIBLE_COMPLETED).map((word, index) => ({
    id: `completed-${input.completedWords.length - VISIBLE_COMPLETED + index}-${word}`,
    word,
    state: "completed" as const,
  }));
  const outstanding = input.activeWords.map((word) => ({
    id: word.id,
    word: word.word,
    state: (word.id === activeId ? "active" : "normal") as ObjectiveTileState,
  }));
  return [...recent, ...outstanding];
}

export function objectiveTileLabel(tile: ObjectiveTile): string {
  if (tile.state === "completed") return `${tile.word}, completed`;
  if (tile.state === "active") return `${tile.word}, current hint`;
  return `${tile.word}, remaining`;
}
