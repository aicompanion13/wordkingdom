import { SeededRandom } from "./random";
import type { BoardSnapshot, ClearResult, Position, Tile } from "./types";

const LETTERS = "EEEEEEEEEEEEAAAAAAAARRRRRRRRIIIIIIIIOOOOOOOOTTTTTTTNNNNNNNSSSSSSLLLLLCCCCUUUUDDDDPPPPMMMMHHHHGGGBBBFFYYYWWKVXZQ";
const DIRECTIONS: Position[] = [
  { row: 0, col: 1 }, { row: 0, col: -1 }, { row: 1, col: 0 }, { row: -1, col: 0 },
  { row: 1, col: 1 }, { row: -1, col: -1 }, { row: 1, col: -1 }, { row: -1, col: 1 },
];

export class BoardController {
  readonly size: number;
  private readonly random: SeededRandom;
  private tiles: Tile[][];
  private idCounter = 0;
  private placementHistory: string[] = [];

  constructor(size = 8, seed = Date.now()) {
    this.size = size;
    this.random = new SeededRandom(seed);
    this.tiles = Array.from({ length: size }, (_, row) =>
      Array.from({ length: size }, (_, col) => this.createTile(row, col)),
    );
  }

  snapshot(): BoardSnapshot {
    return { size: this.size, tiles: this.tiles.map((row) => row.map((tile) => ({ ...tile }))) };
  }

  getTile(position: Position): Tile | undefined {
    return this.tiles[position.row]?.[position.col];
  }

  pathBetween(start: Position, end: Position): Position[] {
    const rowDelta = end.row - start.row;
    const colDelta = end.col - start.col;
    if (rowDelta !== 0 && colDelta !== 0 && Math.abs(rowDelta) !== Math.abs(colDelta)) return [];
    const rowStep = Math.sign(rowDelta);
    const colStep = Math.sign(colDelta);
    const length = Math.max(Math.abs(rowDelta), Math.abs(colDelta));
    return Array.from({ length: length + 1 }, (_, index) => ({
      row: start.row + rowStep * index,
      col: start.col + colStep * index,
    }));
  }

  lettersForPath(path: Position[]): string {
    return path.map((position) => this.getTile(position)?.letter ?? "").join("");
  }

  tileIdsForPath(path: Position[]): string[] {
    return path.map((position) => this.getTile(position)?.id ?? "");
  }

  findWord(word: string): Position[] | null {
    const target = word.toUpperCase();
    return this.validPaths(target).find((path) => this.lettersForPath(path) === target) ?? null;
  }

  /** Board-owned placement used when the Director requests a guaranteed active word. */
  ensureWord(word: string, blockedTileIds: ReadonlySet<string> = new Set(), blockedOrientations: ReadonlySet<string> = new Set()): Position[] {
    const normalized = word.toUpperCase().slice(0, this.size);
    const candidates = this.validPaths(normalized).filter((path) =>
      path.every((position) => {
        const tileId = this.getTile(position)?.id;
        return tileId && !blockedTileIds.has(tileId);
      }),
    );
    if (candidates.length === 0) {
      // A full board always has a path, but this deterministic fallback protects unusual future grid sizes.
      return this.ensureWord(normalized);
    }
    const directionallyVaried = candidates.filter((path) => !blockedOrientations.has(this.orientationFamily(path)));
    const directionPool = directionallyVaried.length > 0 ? directionallyVaried : candidates;
    const freshCandidates = directionPool.filter((path) => !this.placementHistory.includes(this.pathSignature(path)));
    const pool = freshCandidates.length > 0 ? freshCandidates : directionPool;
    const exact = pool.filter((path) => this.lettersForPath(path) === normalized);
    const ranked = this.random.shuffle(exact.length > 0 ? exact : pool).sort((first, second) =>
      this.letterConflictCount(first, normalized) - this.letterConflictCount(second, normalized),
    );
    const topBandSize = Math.max(1, Math.ceil(ranked.length * 0.22));
    const path = ranked[this.random.int(topBandSize)];
    path.forEach((position, index) => {
      const tile = this.getTile(position);
      if (tile) tile.letter = normalized[index];
    });
    this.placementHistory.push(this.pathSignature(path));
    if (this.placementHistory.length > 12) this.placementHistory.shift();
    return path;
  }

  clearPath(path: Position[]): ClearResult {
    const removed = new Set(this.tileIdsForPath(path));
    const removedTileIds = [...removed];
    for (let col = 0; col < this.size; col += 1) {
      const survivors: Tile[] = [];
      for (let row = this.size - 1; row >= 0; row -= 1) {
        const tile = this.tiles[row][col];
        if (!removed.has(tile.id)) survivors.push(tile);
      }
      const missing = this.size - survivors.length;
      const column = [
        ...Array.from({ length: missing }, (_, row) => this.createTile(row, col)),
        ...survivors,
      ];
      column.forEach((tile, row) => {
        tile.row = row;
        tile.col = col;
        this.tiles[row][col] = tile;
      });
    }
    return { removedTileIds, snapshot: this.snapshot() };
  }

  reshuffle(): BoardSnapshot {
    const letters = this.random.shuffle(this.tiles.flat().map((tile) => tile.letter));
    this.tiles.flat().forEach((tile, index) => { tile.letter = letters[index]; });
    return this.snapshot();
  }

  private createTile(row: number, col: number): Tile {
    this.idCounter += 1;
    return {
      id: `v2-tile-${this.idCounter}`,
      letter: LETTERS[this.random.int(LETTERS.length)],
      row,
      col,
    };
  }

  private validPaths(word: string): Position[][] {
    const paths: Position[][] = [];
    for (let row = 0; row < this.size; row += 1) {
      for (let col = 0; col < this.size; col += 1) {
        for (const direction of DIRECTIONS) {
          const path = Array.from({ length: word.length }, (_, index) => ({
            row: row + direction.row * index,
            col: col + direction.col * index,
          }));
          if (path.every((position) => this.getTile(position))) paths.push(path);
        }
      }
    }
    return paths;
  }

  private letterConflictCount(path: Position[], word: string): number {
    return path.reduce((count, position, index) => count + (this.getTile(position)?.letter === word[index] ? 0 : 1), 0);
  }

  private pathSignature(path: Position[]): string {
    return path.map((position) => `${position.row}:${position.col}`).join("|");
  }

  private orientationFamily(path: Position[]): string {
    const start = path[0];
    const end = path[path.length - 1];
    if (start.row === end.row) return "horizontal";
    if (start.col === end.col) return "vertical";
    return Math.sign(end.row - start.row) === Math.sign(end.col - start.col) ? "diagonal-down" : "diagonal-up";
  }
}
