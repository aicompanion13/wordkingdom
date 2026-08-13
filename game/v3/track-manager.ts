import type { AreaDefinition } from "../v2/types";
import type { ChapterDefinition, TrackNode, TrackNodeKind } from "./types";

const LEVEL_TITLES: Record<number, string> = {
  1: "Find Your First Word",
  2: "The Reef Responds",
  3: "Cross the Current",
  4: "Across the Lagoon",
  5: "Choose the Tide",
  6: "Into the Green",
  7: "Branching Paths",
  8: "Heart of the Grove",
  9: "Thornwood Trial",
  10: "Guardian of the Grove",
};

export class TrackManager {
  constructor(private readonly chapters: ChapterDefinition[], private readonly areas: AreaDefinition[]) {}

  chapterForLevel(level: number): ChapterDefinition {
    return this.chapters.find((chapter) => level >= chapter.startLevel && level <= chapter.endLevel) ?? this.chapters[this.chapters.length - 1];
  }

  chapter(id: string): ChapterDefinition | undefined {
    return this.chapters.find((chapter) => chapter.chapterId === id);
  }

  node(level: number): TrackNode {
    const chapter = this.chapterForLevel(level);
    const area = this.areas.find((candidate) => candidate.areaId === chapter.areaId) ?? this.areas[0];
    const localLevel = level - chapter.startLevel + 1;
    const kind: TrackNodeKind = localLevel === 5 ? "BOSS" : localLevel === 4 ? "HARD" : "STANDARD";
    const objective = {
      kind: "WORDS" as const,
      target: 8,
      label:
        kind === "BOSS"
          ? `Complete the ${area.displayName} transmutation`
          : kind === "HARD"
            ? "Complete 8 planned word flips"
            : "Complete 8 living words",
    };
    // Every level pays all three currencies so the Level Complete tray never shows a dead
    // slot: coins and a hint on a standard node, escalating into a card pack on the hard
    // node and the chapter guardian.
    const reward = kind === "HARD"
        ? { coins: 900, hints: 2, pack: "BLUE" as const }
        : kind === "BOSS"
          ? { coins: 1600, energy: 15, hints: 3, pack: "GOLD" as const }
          : { coins: 180 + localLevel * 15, hints: 1, pack: "GREEN" as const };
    return {
      level,
      chapterId: chapter.chapterId,
      areaId: chapter.areaId,
      kind,
      title: LEVEL_TITLES[level] ?? (kind === "BOSS" ? "Chapter Guardian" : kind === "HARD" ? "Hard Level" : "Living Board"),
      objective,
      reward,
      gatewayTo: kind === "BOSS" ? chapter.gatewayTo : undefined,
    };
  }

  nodesForChapter(chapterId: string): TrackNode[] {
    const chapter = this.chapter(chapterId) ?? this.chapters[0];
    return Array.from({ length: chapter.endLevel - chapter.startLevel + 1 }, (_, index) => this.node(chapter.startLevel + index));
  }
}
