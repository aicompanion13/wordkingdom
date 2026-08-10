export type CleanWorldMapId = "ocean" | "forest";

export type CleanWorldMapPoint = {
  x: number;
  y: number;
  milestone?: "raid" | "album";
};

export type CleanWorldMapLayout = {
  id: CleanWorldMapId;
  asset: string;
  intrinsicWidth: number;
  intrinsicHeight: number;
  levels: readonly number[];
  levelHotspots: Readonly<Record<number, CleanWorldMapPoint>>;
  album: CleanWorldMapPoint;
  raidChest: CleanWorldMapPoint;
  gate: CleanWorldMapPoint;
};

/**
 * Coordinates live in intrinsic image space. The map bitmap and every live
 * control are rendered inside the same aspect-ratio artboard so responsive
 * cropping cannot detach a button from its illustrated platform.
 */
export const CLEAN_WORLD_MAP_LAYOUTS: Readonly<Record<CleanWorldMapId, CleanWorldMapLayout>> = {
  ocean: {
    id: "ocean",
    asset: "/world-maps/ocean-kingdom-map-clean.webp",
    intrinsicWidth: 941,
    intrinsicHeight: 1672,
    levels: [1, 2, 3, 4, 5],
    levelHotspots: {
      1: { x: 53.7, y: 81.5 },
      2: { x: 38.8, y: 61.3 },
      3: { x: 62.0, y: 48.7, milestone: "raid" },
      4: { x: 48.7, y: 36.7 },
      5: { x: 59.0, y: 25.4, milestone: "album" },
    },
    album: { x: 82.5, y: 29.8 },
    raidChest: { x: 82.0, y: 55.0 },
    gate: { x: 69.3, y: 15.5 },
  },
  forest: {
    id: "forest",
    asset: "/world-maps/forest-kingdom-map-clean.webp",
    intrinsicWidth: 887,
    intrinsicHeight: 1774,
    levels: [6, 7, 8, 9, 10],
    levelHotspots: {
      6: { x: 51.2, y: 82.1 },
      7: { x: 41.1, y: 64.3, milestone: "raid" },
      8: { x: 60.4, y: 47.1 },
      9: { x: 50.1, y: 35.5 },
      10: { x: 49.5, y: 25.5, milestone: "album" },
    },
    album: { x: 82.0, y: 70.0 },
    raidChest: { x: 17.0, y: 55.0 },
    gate: { x: 50.0, y: 15.5 },
  },
};
