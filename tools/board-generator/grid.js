export function cloneGrid(grid) {
  return grid.map((row) => [...row]);
}

export function cellKey([row, column]) {
  return `${row},${column}`;
}

export function pathKey(path) {
  return path.map(cellKey).join(";");
}

export function occurrenceKey(word, path) {
  return `${word}|${pathKey(path)}`;
}

export function pathMatches(grid, word, path) {
  return (
    typeof word === "string" &&
    path.length === word.length &&
    path.every(
      ([row, column], index) => grid[row]?.[column] === word[index],
    )
  );
}

export function pathsOverlap(left, right) {
  const leftCells = new Set(left.map(cellKey));
  return right.some((coordinate) => leftCells.has(cellKey(coordinate)));
}

export function applyTransmuteMap(grid, transmuteMap) {
  const nextGrid = cloneGrid(grid);
  for (const replacement of transmuteMap) {
    const [row, column] = replacement.cell;
    nextGrid[row][column] = replacement.letter;
  }
  return nextGrid;
}

export function applyTransmuteMaps(grid, transmuteMaps) {
  return transmuteMaps.reduce(
    (currentGrid, transmuteMap) =>
      applyTransmuteMap(currentGrid, transmuteMap),
    grid,
  );
}
