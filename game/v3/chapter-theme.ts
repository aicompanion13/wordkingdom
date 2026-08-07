export type ChapterThemeId = "coral" | "forest" | "desert" | "sky" | "ice";

export type ChapterTheme = {
  id: ChapterThemeId;
  themeKey: string;
  startLevel: number;
  endLevel: number;
  chapterTitle: string;
  backgroundImage: string | null;
  accent: string;
  accentDark: string;
  soft: string;
  veil: string;
  ornaments: readonly [string, string];
  albumTransition: "bubbles" | "vines" | "fade";
};

export const CHAPTER_THEMES: readonly ChapterTheme[] = [
  {
    id: "coral",
    themeKey: "OCEAN_ABYSS",
    startLevel: 1,
    endLevel: 5,
    chapterTitle: "Coral Kingdom",
    backgroundImage: "/word-kingdom-coral-bg.png",
    accent: "#16b9cf",
    accentDark: "#07598f",
    soft: "#c8f5f1",
    veil: "rgba(3, 35, 84, .38)",
    albumTransition: "bubbles",
    ornaments: ["🐚", "🫧"],
  },
  {
    id: "forest",
    themeKey: "ENCHANTED_FOREST",
    startLevel: 6,
    endLevel: 10,
    chapterTitle: "Forest Kingdom",
    backgroundImage: "/word-kingdom-forest-bg.png",
    accent: "#65b84a",
    accentDark: "#245f38",
    soft: "#dff2ba",
    veil: "rgba(9, 45, 31, .38)",
    albumTransition: "vines",
    ornaments: ["🍃", "🌰"],
  },
  {
    id: "desert",
    themeKey: "DESERT_RUINS",
    startLevel: 11,
    endLevel: 15,
    chapterTitle: "Desert Kingdom",
    backgroundImage: null,
    accent: "#dc8f27",
    accentDark: "#7f451f",
    soft: "#f8df9d",
    veil: "rgba(72, 38, 18, .36)",
    albumTransition: "fade",
    ornaments: ["☀️", "🏺"],
  },
  {
    id: "sky",
    themeKey: "STARFALL_REALM",
    startLevel: 16,
    endLevel: 20,
    chapterTitle: "Sky Kingdom",
    backgroundImage: null,
    accent: "#7f62d9",
    accentDark: "#3b2d78",
    soft: "#e1d8ff",
    veil: "rgba(27, 23, 72, .38)",
    albumTransition: "fade",
    ornaments: ["☁️", "✨"],
  },
  {
    id: "ice",
    themeKey: "FROZEN_KEEP",
    startLevel: 21,
    endLevel: 25,
    chapterTitle: "Ice Kingdom",
    backgroundImage: null,
    accent: "#55b9e9",
    accentDark: "#245f91",
    soft: "#d9f5ff",
    veil: "rgba(18, 53, 91, .38)",
    albumTransition: "fade",
    ornaments: ["❄️", "💎"],
  },
] as const;

export function chapterThemeForLevel(level: number, themeKey?: string): ChapterTheme {
  const byLevel = CHAPTER_THEMES.find((theme) => level >= theme.startLevel && level <= theme.endLevel);
  if (byLevel) return byLevel;
  return CHAPTER_THEMES.find((theme) => theme.themeKey === themeKey) ?? CHAPTER_THEMES[0];
}
