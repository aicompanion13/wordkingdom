import { COMMON_ENGLISH_WORDS } from "./data/common-english-words";

export const MIN_BONUS_WORD_LENGTH = 3;
export const THREE_LETTER_BONUS_POINTS = 25;
export const FOUR_LETTER_BONUS_POINTS = 50;
export const BONUS_LENGTH_STEP_POINTS = 25;

const WORD_PATTERN = /^[A-Z]+$/;

const globalEnglishWords = new Set(
  COMMON_ENGLISH_WORDS
    .map(normalizeDictionaryWord)
    .filter((word): word is string => word !== null),
);

export function normalizeDictionaryWord(value: string): string | null {
  const word = String(value).trim().toUpperCase();
  return word.length >= MIN_BONUS_WORD_LENGTH && WORD_PATTERN.test(word)
    ? word
    : null;
}

export function physicalWordCandidates(physicalWord: string): string[] {
  const forward = physicalWord.toUpperCase();
  const reverse = [...forward].reverse().join("");
  return forward === reverse ? [forward] : [forward, reverse];
}

export function resolveBonusWord(
  physicalWord: string,
): string | null {
  return (
    physicalWordCandidates(physicalWord).find(
      (word) => globalEnglishWords.has(word),
    ) ?? null
  );
}

export function bonusWordPoints(word: string): number {
  const extraLetters = Math.max(0, word.length - 3);
  return THREE_LETTER_BONUS_POINTS + extraLetters * BONUS_LENGTH_STEP_POINTS;
}

export function discoveryPathKey(tileIds: string[]): string {
  const forward = tileIds.join("|");
  const reverse = [...tileIds].reverse().join("|");
  return forward < reverse ? forward : reverse;
}

export function isCuratedRoyalWord(word: string): boolean {
  const normalized = normalizeDictionaryWord(word);
  return normalized !== null && globalEnglishWords.has(normalized);
}
