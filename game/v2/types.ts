export type BadgeType = "attack" | "steal" | "raid" | "shield";

export type Position = { row: number; col: number };

export type Tile = Position & {
  id: string;
  letter: string;
};

export type BadgeAssignment = {
  type: BadgeType;
  tileId: string;
};

export type ActiveWord = {
  id: string;
  word: string;
  path: Position[];
  tileIds: string[];
  badges: BadgeAssignment[];
  revealedTileId?: string;
};

export type BoardSnapshot = {
  size: number;
  tiles: Tile[][];
};

export type ClearResult = {
  removedTileIds: string[];
  snapshot: BoardSnapshot;
};

export type DirectorDecision = {
  activeWords: ActiveWord[];
  wave: number;
  reason: "initial" | "cascade" | "deadlock-recovery";
  suppressedShieldConversions?: number;
};

export type AreaBuildingDefinition = {
  id: string;
  name: string;
  icon: string;
  maxLevel: number;
  baseCost: number;
};

export type AreaObstacleDefinition = {
  key: string;
  name: string;
  icon: string;
};

export type AreaDefinition = {
  areaId: number;
  themeKey: string;
  displayName: string;
  subtitle: string;
  icon: string;
  accent: string;
  themeDictionary: string[];
  visualAssets: {
    backgroundSprite: string;
    musicTrack: string;
    particleEffect: string;
    buildings: AreaBuildingDefinition[];
  };
  obstaclePalette: AreaObstacleDefinition[];
  areaCompletionReward: {
    coins: number;
    energy: number;
    chestType: "SILVER" | "GOLD" | "ROYAL";
  };
};

export type PlayerSettings = {
  sfx: boolean;
  bgm: boolean;
  haptics: boolean;
};

export type PlayerState = {
  version: 3;
  energy: number;
  energyUpdatedAt: number;
  coins: number;
  stars: number;
  shields: number;
  currentLevel: number;
  currentAreaId: number;
  unlockedAreaIds: number[];
  areaProgress: Record<string, Record<string, number>>;
  claimedAreaRewards: number[];
  recentWordsByArea: Record<string, string[]>;
  settings: PlayerSettings;
};

export type ScoreSnapshot = {
  score: number;
  combo: number;
  correct: number;
  attempts: number;
  hints: number;
  longestWord: string;
};

export type RunSummary = ScoreSnapshot & {
  elapsedSeconds: number;
  accuracy: number;
  stars: number;
  baseCoins: number;
  eventCoins: number;
  totalCoins: number;
};

export type MetaEvent = {
  type: BadgeType;
  title: string;
  description: string;
};
