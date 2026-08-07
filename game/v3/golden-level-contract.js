import {
  CANONICAL_BOARD_SIZE,
  canonicalDirectionForPath,
} from "./direction-contract.js";

export const GOLDEN_LEVEL_SCHEMA_VERSION = 1;

export const GOLDEN_ZONE_BANDS = Object.freeze([
  Object.freeze({ index: 0, key: "TOP_OR_LEFT", cells: Object.freeze([0, 1, 2]) }),
  Object.freeze({ index: 1, key: "MIDDLE", cells: Object.freeze([3, 4]) }),
  Object.freeze({ index: 2, key: "BOTTOM_OR_RIGHT", cells: Object.freeze([5, 6, 7]) }),
]);

// The border between bands is assigned to the lower-numbered band. This makes
// half-cell centres (2.5 and 4.5) deterministic under the 3-2-3 contract.
export function zoneBandForCentre(centre) {
  if (centre <= 2.5) return 0;
  if (centre <= 4.5) return 1;
  return 2;
}

export function primaryZoneForPath(path) {
  if (!Array.isArray(path) || path.length === 0) {
    throw new Error("A golden target path must contain at least one cell.");
  }
  const centreRow = path.reduce((sum, cell) => sum + cell[0], 0) / path.length;
  const centreColumn = path.reduce((sum, cell) => sum + cell[1], 0) / path.length;
  const rowBand = zoneBandForCentre(centreRow);
  const columnBand = zoneBandForCentre(centreColumn);
  return {
    id: `R${rowBand + 1}C${columnBand + 1}`,
    rowBand,
    columnBand,
    centre: [centreRow, centreColumn],
  };
}

export function canonicalBoardHash(grid) {
  if (
    !Array.isArray(grid) ||
    grid.length !== CANONICAL_BOARD_SIZE ||
    grid.some((row) => !Array.isArray(row) || row.length !== CANONICAL_BOARD_SIZE)
  ) {
    throw new Error("Canonical board hashes require an 8x8 grid.");
  }
  const input = grid.flat().join("");
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a32:${hash.toString(16).padStart(8, "0")}`;
}

export function goldenStateId(completedA, completedB) {
  return `a${completedA}-b${completedB}`;
}

export function goldenBranchId(stateId, objectiveId) {
  return `${stateId}--${objectiveId}`;
}

export function validateGoldenPlacement(objective) {
  const direction = canonicalDirectionForPath(objective.path);
  const zone = primaryZoneForPath(objective.path);
  return {
    directionMatches: Boolean(direction && direction.key === objective.direction),
    zoneMatches: zone.id === objective.primaryZone,
    direction,
    zone,
  };
}
