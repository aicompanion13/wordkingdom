export const CANONICAL_BOARD_SIZE = 8;

export const CANONICAL_DIRECTIONS = Object.freeze([
  Object.freeze({ key: "H", label: "LEFT_TO_RIGHT", rowStep: 0, columnStep: 1 }),
  Object.freeze({ key: "V", label: "TOP_TO_BOTTOM", rowStep: 1, columnStep: 0 }),
  Object.freeze({ key: "D", label: "TOP_LEFT_TO_BOTTOM_RIGHT", rowStep: 1, columnStep: 1 }),
  Object.freeze({ key: "A", label: "TOP_RIGHT_TO_BOTTOM_LEFT", rowStep: 1, columnStep: -1 }),
]);

export const CANONICAL_DIRECTION_KEYS = Object.freeze(
  CANONICAL_DIRECTIONS.map((direction) => direction.key),
);

function coordinateParts(coordinate) {
  return Array.isArray(coordinate)
    ? { row: coordinate[0], column: coordinate[1] }
    : { row: coordinate.row, column: coordinate.col };
}

export function canonicalDirectionForPath(path) {
  if (!Array.isArray(path) || path.length < 2) return null;
  const start = coordinateParts(path[0]);
  const next = coordinateParts(path[1]);
  const rowStep = next.row - start.row;
  const columnStep = next.column - start.column;
  const direction = CANONICAL_DIRECTIONS.find(
    (candidate) =>
      candidate.rowStep === rowStep &&
      candidate.columnStep === columnStep,
  );
  if (!direction) return null;

  const seen = new Set();
  for (let index = 0; index < path.length; index += 1) {
    const coordinate = coordinateParts(path[index]);
    const key = `${coordinate.row},${coordinate.column}`;
    if (
      seen.has(key) ||
      coordinate.row !== start.row + direction.rowStep * index ||
      coordinate.column !== start.column + direction.columnStep * index
    ) {
      return null;
    }
    seen.add(key);
  }
  return direction;
}

export function isCanonicalForwardPath(path) {
  return canonicalDirectionForPath(path) !== null;
}

export function normalizeCanonicalGesturePath(path) {
  if (!Array.isArray(path)) return null;
  if (isCanonicalForwardPath(path)) return path.map((cell) => [...cell]);
  const reversed = [...path].reverse().map((cell) => [...cell]);
  return isCanonicalForwardPath(reversed) ? reversed : null;
}

export function pathForDirection(
  startRow,
  startColumn,
  length,
  direction,
) {
  const endRow = startRow + direction.rowStep * (length - 1);
  const endColumn = startColumn + direction.columnStep * (length - 1);
  if (
    startRow < 0 ||
    startColumn < 0 ||
    endRow < 0 ||
    endRow >= CANONICAL_BOARD_SIZE ||
    endColumn < 0 ||
    endColumn >= CANONICAL_BOARD_SIZE
  ) {
    return null;
  }
  return Array.from({ length }, (_, index) => [
    startRow + direction.rowStep * index,
    startColumn + direction.columnStep * index,
  ]);
}

export function allCanonicalPaths(length, rows = CANONICAL_BOARD_SIZE, cols = CANONICAL_BOARD_SIZE) {
  const paths = [];
  for (const direction of CANONICAL_DIRECTIONS) {
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < cols; column += 1) {
        const endRow = row + direction.rowStep * (length - 1);
        const endColumn = column + direction.columnStep * (length - 1);
        if (
          endRow < 0 ||
          endRow >= rows ||
          endColumn < 0 ||
          endColumn >= cols
        ) {
          continue;
        }
        paths.push({
          direction,
          path: Array.from({ length }, (_, index) => [
            row + direction.rowStep * index,
            column + direction.columnStep * index,
          ]),
        });
      }
    }
  }
  return paths;
}

export function pathSpellsWord(grid, word, path) {
  return (
    typeof word === "string" &&
    path.length === word.length &&
    path.every(([row, column], index) => grid[row]?.[column] === word[index])
  );
}

export function scanCanonicalWord(grid, word) {
  const normalized = String(word).trim().toUpperCase();
  return allCanonicalPaths(normalized.length, grid.length, grid[0]?.length ?? 0)
    .filter(({ path }) => pathSpellsWord(grid, normalized, path))
    .map(({ path, direction }) => ({
      word: normalized,
      path,
      direction: direction.key,
      directionLabel: direction.label,
    }));
}

export function scanCanonicalTargets(grid, words) {
  return [...new Set(words.map((word) => String(word).trim().toUpperCase()))]
    .flatMap((word) => scanCanonicalWord(grid, word));
}
