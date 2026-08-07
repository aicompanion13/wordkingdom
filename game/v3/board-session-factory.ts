import type { BoardSession } from "./board-session";
import {
  GENERATED_LEVELS,
  GeneratedLevelSession,
} from "./generated-level-runner";
import type { GeneratedLevelData } from "./generated-level-runner";
import {
  LegacyBoardSession,
} from "./legacy-board-session";
import type {
  LegacyBoardSessionOptions,
} from "./legacy-board-session";
import {
  GOLDEN_LEVEL_1,
  GoldenLevelSession,
} from "./golden-level-session";
import type { AuthoredGoldenLevel } from "./golden-level-types";

export { GENERATED_LEVELS };
export { GOLDEN_LEVEL_1 };

export function generatedLevelForPlayerLevel(
  levelNumber: number,
): GeneratedLevelData {
  const level = GENERATED_LEVELS.find(
    (candidate) => candidate.levelNumber === levelNumber,
  );
  if (!level) {
    throw new Error(`Generated player level ${levelNumber} is unavailable.`);
  }
  return level;
}

export function createLegacyBoardSession(
  options: LegacyBoardSessionOptions,
): BoardSession {
  return new LegacyBoardSession(options);
}

export function createGeneratedBoardSession(
  level: GeneratedLevelData,
  activatedAt: number,
): BoardSession {
  return new GeneratedLevelSession(level, activatedAt);
}

export function createGoldenBoardSession(
  level: AuthoredGoldenLevel = GOLDEN_LEVEL_1,
  activatedAt = Date.now(),
): BoardSession {
  return new GoldenLevelSession(level, activatedAt);
}
