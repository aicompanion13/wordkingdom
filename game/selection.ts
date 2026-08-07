import type { Board, Coordinate, Direction } from "./types";

export function directionFrom(start: Coordinate, current: Coordinate, directions: Direction[]) {
  const rowDelta = current.row - start.row, colDelta = current.col - start.col;
  const aligned = rowDelta === 0 || colDelta === 0 || Math.abs(rowDelta) === Math.abs(colDelta);
  if (!aligned) return null;
  const dr = Math.sign(rowDelta), dc = Math.sign(colDelta);
  return directions.find((direction) => direction.dr === dr && direction.dc === dc) ?? null;
}

export function selectionPath(start: Coordinate, current: Coordinate, lockedDirection: Direction | null, directions: Direction[], width = 8, height = 8) {
  const direction = lockedDirection ?? directionFrom(start, current, directions);
  if (!direction) return { direction: null, coordinates: [start] };
  const denominator = direction.dr ** 2 + direction.dc ** 2;
  const projection = ((current.row - start.row) * direction.dr + (current.col - start.col) * direction.dc) / denominator;
  let steps = Math.max(0, Math.round(projection));
  while (steps > 0) {
    const row = start.row + direction.dr * steps, col = start.col + direction.dc * steps;
    if (row >= 0 && row < height && col >= 0 && col < width) break;
    steps--;
  }
  return { direction, coordinates: Array.from({ length: steps + 1 }, (_, index) => ({ row: start.row + direction.dr * index, col: start.col + direction.dc * index })) };
}

export function lettersFor(board: Board, coordinates: Coordinate[]) {
  return coordinates.map(({ row, col }) => board[row][col]?.letter ?? "").join("");
}
