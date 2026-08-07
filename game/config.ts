import type { Direction } from "./types";

export type ThemeId = "ocean" | "forest" | "space" | "ruins" | "arctic";

const RIGHT: Direction = { name: "right", dr: 0, dc: 1, label: "right" };
const LEFT: Direction = { name: "left", dr: 0, dc: -1, label: "left" };
const DOWN: Direction = { name: "down", dr: 1, dc: 0, label: "down" };
const UP: Direction = { name: "up", dr: -1, dc: 0, label: "up" };
const DOWN_RIGHT: Direction = { name: "down-right", dr: 1, dc: 1, label: "diagonal down-right" };
const DOWN_LEFT: Direction = { name: "down-left", dr: 1, dc: -1, label: "diagonal down-left" };
const UP_RIGHT: Direction = { name: "up-right", dr: -1, dc: 1, label: "diagonal up-right" };
const UP_LEFT: Direction = { name: "up-left", dr: -1, dc: -1, label: "diagonal up-left" };

export const DIRECTIONS: Direction[] = [RIGHT, LEFT, DOWN, UP, DOWN_RIGHT, DOWN_LEFT, UP_RIGHT, UP_LEFT];

export const WORLD_WORDS: Record<ThemeId, string[]> = {
  ocean: ["OCEAN", "WHALE", "SHARK", "CORAL", "REEF", "WAVE", "SHELL", "SQUID", "CRAB", "PEARL", "DOLPHIN", "TURTLE", "OCTOPUS", "SEAL", "FISH", "TIDE", "KELP", "RAY", "SAND", "BOAT"],
  forest: ["FOREST", "TREE", "LEAF", "MOSS", "FERN", "DEER", "FOX", "OWL", "BEAR", "PINE", "ACORN", "GROVE", "TRAIL", "RIVER", "BIRCH", "ROOT", "WOOD", "FAWN", "LYNX", "CANOPY"],
  space: ["SPACE", "STAR", "MOON", "MARS", "COMET", "ORBIT", "NOVA", "ALIEN", "ROCKET", "PLANET", "SATURN", "SOLAR", "LUNAR", "METEOR", "VENUS", "EARTH", "NEBULA", "COSMOS", "GALAXY", "ASTRO"],
  ruins: ["RUINS", "TEMPLE", "RELIC", "STONE", "SAND", "TOMB", "TORCH", "STATUE", "CRYPT", "SCROLL", "ALTAR", "ARCH", "VAULT", "BRICK", "CROWN", "GOLD", "MAP", "OASIS", "DUNE", "PHARAOH"],
  arctic: ["ARCTIC", "ICE", "SNOW", "GLACIER", "FROST", "POLAR", "SEAL", "WHALE", "IGLOO", "TUNDRA", "STORM", "WINTER", "SLED", "AURORA", "BERG", "OWL", "BEAR", "CHILL", "PEAK", "WIND"],
};

export type GameLevelConfig = {
  id: string;
  title: string;
  eyebrow: string;
  objective: string;
  theme: ThemeId;
  themeLabel: string;
  wordLabel: string;
  symbol: string;
  menuBlurb: string;
  targetCount: number;
  desiredAvailableWords: number;
  maximumAvailableWords: number;
  hints: number;
  animationMs: number;
  directions: Direction[];
  wordBank: string[];
  directionSummary: string;
};

const wordsUpTo = (theme: ThemeId, length: number) => WORLD_WORDS[theme].filter((word) => word.length <= length);

export const LEVELS: GameLevelConfig[] = [
  {
    id: "shallow-reef", title: "Shallow Reef", eyebrow: "WORLD 01", objective: "Find 6 words in a calm tropical current", theme: "ocean", themeLabel: "Ocean", wordLabel: "Ocean words", symbol: "≈", menuBlurb: "Warm water, bright reefs, gentle directions.",
    targetCount: 6, desiredAvailableWords: 3, maximumAvailableWords: 3, hints: 3, animationMs: 520, directions: [RIGHT, DOWN], wordBank: wordsUpTo("ocean", 5), directionSummary: "Right · Down",
  },
  {
    id: "whispering-woods", title: "Whispering Woods", eyebrow: "WORLD 02", objective: "Follow 7 words through the growing canopy", theme: "forest", themeLabel: "Forest", wordLabel: "Forest words", symbol: "♧", menuBlurb: "Leaves, wildlife, and the first diagonals.",
    targetCount: 7, desiredAvailableWords: 3, maximumAvailableWords: 3, hints: 3, animationMs: 540, directions: [RIGHT, DOWN, DOWN_RIGHT], wordBank: wordsUpTo("forest", 6), directionSummary: "Right · Down · Diagonal",
  },
  {
    id: "starbound", title: "Starbound", eyebrow: "WORLD 03", objective: "Chart 8 words across a shifting starfield", theme: "space", themeLabel: "Space", wordLabel: "Cosmic words", symbol: "✦", menuBlurb: "Orbits cross as the board opens wider.",
    targetCount: 8, desiredAvailableWords: 3, maximumAvailableWords: 3, hints: 2, animationMs: 560, directions: [RIGHT, DOWN, DOWN_RIGHT, DOWN_LEFT], wordBank: [...WORLD_WORDS.space], directionSummary: "Forward · Vertical · Diagonal",
  },
  {
    id: "sunken-temple", title: "Sunken Temple", eyebrow: "WORLD 04", objective: "Unseal 9 ancient words in every direction", theme: "ruins", themeLabel: "Ruins", wordLabel: "Ancient words", symbol: "◇", menuBlurb: "Relics wait inside a maze of directions.",
    targetCount: 9, desiredAvailableWords: 2, maximumAvailableWords: 2, hints: 2, animationMs: 580, directions: DIRECTIONS, wordBank: [...WORLD_WORDS.ruins], directionSummary: "All 8 directions",
  },
  {
    id: "aurora-reach", title: "Aurora Reach", eyebrow: "WORLD 05", objective: "Master 10 frozen words with one final hint", theme: "arctic", themeLabel: "Arctic", wordLabel: "Arctic words", symbol: "✣", menuBlurb: "A frozen final world beneath the aurora.",
    targetCount: 10, desiredAvailableWords: 2, maximumAvailableWords: 2, hints: 1, animationMs: 600, directions: DIRECTIONS, wordBank: [...WORLD_WORDS.arctic], directionSummary: "All 8 directions",
  },
];

export const DAILY_LEVELS: GameLevelConfig[] = LEVELS.map((level) => ({
  ...level,
  id: `daily-${level.id}`,
  title: `Daily ${level.themeLabel}`,
  eyebrow: "DAILY QUEST",
  objective: `One ${level.themeLabel.toLowerCase()} board. One score to beat.`,
  targetCount: 10,
  desiredAvailableWords: 2,
  maximumAvailableWords: 2,
  hints: 2,
  directions: DIRECTIONS,
  directionSummary: "All 8 directions",
}));

export function getDailyLevel(dayKey: string) {
  const index = dayKey.split("").reduce((value, character) => value + character.charCodeAt(0), 0) % DAILY_LEVELS.length;
  return DAILY_LEVELS[index];
}

export function getLevelConfig(levelId: string) {
  return [...LEVELS, ...DAILY_LEVELS].find((level) => level.id === levelId) ?? LEVELS[0];
}

export const WEIGHTED_LETTERS = "EEEEEEEEEEEEAAAAAAAAAIIIIIIIIIOOOOOOOONNNNNNRRRRRRTTTTTTLLLLSSSSUUUUDDDDGGGBBCCMMPPFFHHVVWWYYKJXQZ";
