import {
  CanonicalBoardModel,
  type CanonicalCell,
  type CanonicalObjective,
} from "./canonical-board-state";
import type { BadgeAssignment } from "@/game/v2/types";
import type {
  BoardSelectionResult,
  SessionActiveWord,
  WordScoringHook,
} from "./board-session";
import {
  bonusWordPoints,
  physicalWordCandidates,
  resolveBonusWord,
} from "./royal-dictionary";

type CanonicalSelectionOptions = {
  canonical: CanonicalBoardModel;
  tileIds: string[];
  matchTimestamp: number;
  onWordSolved: WordScoringHook;
  objectiveWords: ReadonlySet<string>;
  rewardedBonusWords: Set<string>;
  bonusWordId: (word: string) => string;
  cellForTileId: (tileId: string) => CanonicalCell | null;
  normalizeGesturePath: (path: CanonicalCell[]) => CanonicalCell[] | null;
  runtimeWord: (
    objective: CanonicalObjective,
    acceptedPath: CanonicalCell[],
  ) => SessionActiveWord;
  collectRewards: (tileIds: string[]) => BadgeAssignment[];
};

export function acceptCanonicalSelection({
  canonical,
  tileIds,
  matchTimestamp,
  onWordSolved,
  objectiveWords,
  rewardedBonusWords,
  bonusWordId,
  cellForTileId,
  normalizeGesturePath,
  runtimeWord,
  collectRewards,
}: CanonicalSelectionOptions): BoardSelectionResult {
  if (!canonical.canAcceptInput()) {
    return { kind: "invalid", tileIds: [...tileIds] };
  }

  const selectedPath = tileIds
    .map(cellForTileId)
    .filter((cell): cell is CanonicalCell => cell !== null);
  const canonicalPath = normalizeGesturePath(selectedPath);
  if (selectedPath.length !== tileIds.length || !canonicalPath) {
    return { kind: "invalid", tileIds: [...tileIds] };
  }

  const grid = canonical.grid();
  const physicalWord = selectedPath
    .map(([row, column]) => grid[row]?.[column] ?? "")
    .join("");
  const wordCandidates = physicalWordCandidates(physicalWord);
  const objective = canonical.activeObjectives().find(
    (candidate) =>
      wordCandidates.includes(candidate.definition.word) &&
      candidate.expectedPath.length === canonicalPath.length,
  );

  if (!objective) {
    const reservedObjective = wordCandidates.find((word) => objectiveWords.has(word));
    if (reservedObjective) {
      return { kind: "neutral", word: reservedObjective, tileIds: [...tileIds] };
    }

    const bonusWord = resolveBonusWord(physicalWord);
    if (!bonusWord) return { kind: "invalid", tileIds: [...tileIds] };
    if (rewardedBonusWords.has(bonusWord)) {
      return { kind: "neutral", word: bonusWord, tileIds: [...tileIds] };
    }
    rewardedBonusWords.add(bonusWord);
    return {
      kind: "bonus",
      word: bonusWord,
      wordId: bonusWordId(bonusWord),
      points: bonusWordPoints(bonusWord),
      tileIds: [...tileIds],
      rewards: collectRewards(tileIds),
    };
  }

  if (!canonical.beginResolution(objective.id, canonicalPath, matchTimestamp)) {
    return { kind: "invalid", tileIds: [...tileIds] };
  }
  const word = runtimeWord(objective, canonicalPath);
  return {
    kind: "accepted",
    word,
    score: onWordSolved(word, matchTimestamp),
    tileIds: [...tileIds],
    rewards: collectRewards(tileIds),
  };
}
