import { LEVELS, getLevelConfig, WEIGHTED_LETTERS } from "./config";
import type { Board, Coordinate, GameRuntime, PreparedMove, Tile, UsageMap, WordOccurrence, ZoneDirectionMap, ZoneId } from "./types";

export class SeededRandom {
  state: number;
  constructor(seed: number) { this.state = (seed >>> 0) || 0x6d2b79f5; }
  next() { let v = (this.state += 0x6d2b79f5); v = Math.imul(v ^ (v >>> 15), v | 1); v ^= v + Math.imul(v ^ (v >>> 7), v | 61); return ((v ^ (v >>> 14)) >>> 0) / 4294967296; }
  int(max: number) { return Math.floor(this.next() * max); }
  shuffle<T>(items: T[]) { const out = [...items]; for (let i = out.length - 1; i > 0; i--) { const j = this.int(i + 1); [out[i], out[j]] = [out[j], out[i]]; } return out; }
}

const randomLetter = (rng: SeededRandom) => WEIGHTED_LETTERS[rng.int(WEIGHTED_LETTERS.length)];
const cellKey = ({ row, col }: Coordinate) => `${row}:${col}`;
const emptyUsage = (): UsageMap => Array.from({ length: 8 }, () => Array(8).fill(0));
const emptyZoneDirections = (): ZoneDirectionMap => Object.fromEntries(Array.from({ length: 9 }, (_, zone) => [zone, {}])) as ZoneDirectionMap;
const cloneBoard = (board: Board): Board => board.map((row) => row.map((tile) => tile ? { ...tile } : null));
const uniqueWords = (items: WordOccurrence[]) => items.filter((item, index) => items.findIndex((other) => other.word === item.word) === index);

export function canonicalBoard(board: Board) { return board.map((row) => row.map((tile) => tile?.letter ?? "_").join("")).join("/"); }
export function zoneOfPoint(row: number, col: number): ZoneId { return (Math.min(2, Math.floor(row / (8 / 3))) * 3 + Math.min(2, Math.floor(col / (8 / 3)))) as ZoneId; }
export function zoneOfOccurrence(item: Pick<WordOccurrence, "start" | "end">) { return zoneOfPoint((item.start.row + item.end.row) / 2, (item.start.col + item.end.col) / 2); }
export function branchKey(revision: number, word: string, coordinates: Coordinate[], remaining: string[]) { return `${revision}|${word}|${coordinates.map(cellKey).join("-")}|${[...remaining].sort().join(",")}`; }

function makeRandomBoard(rng: SeededRandom, nextId: number, animate = false) {
  let id = nextId;
  const board: Board = Array.from({ length: 8 }, (_, row) => Array.from({ length: 8 }, (_, col) => ({ id: `tile-${id++}`, letter: randomLetter(rng), row, col, fromRow: animate ? row - 9 : undefined })));
  return { board, nextId: id };
}

const placementCache = new Map<string, WordOccurrence[]>();
export function allPlacements(word: string, levelId: string): WordOccurrence[] {
  const cacheKey = `${levelId}:${word}`;
  const cached = placementCache.get(cacheKey); if (cached) return cached;
  const level = getLevelConfig(levelId);
  const result: WordOccurrence[] = [];
  for (const direction of level.directions) for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
    const endRow = row + direction.dr * (word.length - 1), endCol = col + direction.dc * (word.length - 1);
    if (endRow < 0 || endRow > 7 || endCol < 0 || endCol > 7) continue;
    const coordinates = Array.from({ length: word.length }, (_, index) => ({ row: row + direction.dr * index, col: col + direction.dc * index }));
    const base = { word, start: coordinates[0], end: coordinates.at(-1)!, direction, coordinates };
    result.push({ ...base, zone: zoneOfOccurrence(base) });
  }
  placementCache.set(cacheKey, result); return result;
}

export function scanBoard(board: Board, words: string[], levelId: string) {
  const found: WordOccurrence[] = [];
  for (const word of words) for (const path of allPlacements(word, levelId)) if (path.coordinates.every((at, index) => board[at.row][at.col]?.letter === word[index])) found.push(path);
  return found;
}

function zoneDistance(a: ZoneId, b: ZoneId) { return Math.abs(Math.floor(a / 3) - Math.floor(b / 3)) + Math.abs((a % 3) - (b % 3)); }
function adjacent(a: ZoneId, b: ZoneId) { return zoneDistance(a, b) <= 1; }
function verticalHalf(zone: ZoneId) { return Math.floor(zone / 3) === 0 ? "top" : Math.floor(zone / 3) === 2 ? "bottom" : "middle"; }

function legalZonesForWords(words: string[], levelId: string) {
  const zones = new Set<ZoneId>(); words.forEach((word) => allPlacements(word, levelId).forEach((path) => zones.add(path.zone))); return [...zones];
}

function chooseTargetZone(words: string[], zoneUsage: number[], recentZones: ZoneId[], excluded: ZoneId[], rng: SeededRandom, levelId: string): ZoneId | null {
  let zones = legalZonesForWords(words, levelId).filter((zone) => !excluded.includes(zone));
  if (!zones.length) zones = legalZonesForWords(words, levelId);
  const unused = zones.filter((zone) => zoneUsage[zone] === 0);
  if (unused.length) zones = unused;
  else { const min = Math.min(...zones.map((zone) => zoneUsage[zone])); zones = zones.filter((zone) => zoneUsage[zone] === min); }
  const notRecent = zones.filter((zone) => !recentZones.slice(0, 2).includes(zone)); if (notRecent.length) zones = notRecent;
  if (recentZones[0] !== undefined) { const notSame = zones.filter((zone) => zone !== recentZones[0]); if (notSame.length) zones = notSame; }
  if (recentZones.length >= 2 && verticalHalf(recentZones[0]) === verticalHalf(recentZones[1])) {
    const differentHalf = zones.filter((zone) => verticalHalf(zone) !== verticalHalf(recentZones[0])); if (differentHalf.length) zones = differentHalf;
  }
  const previous = recentZones[0];
  zones.sort((a, b) => (previous === undefined ? 0 : zoneDistance(b, previous) - zoneDistance(a, previous)) || zoneUsage[a] - zoneUsage[b]);
  const bestDistance = previous === undefined ? 0 : zoneDistance(zones[0], previous);
  const finalists = previous === undefined ? zones : zones.filter((zone) => zoneDistance(zone, previous) === bestDistance);
  return finalists.length ? finalists[rng.int(finalists.length)] : null;
}

function breakAllTargets(board: Board, words: string[], protectedCells: Set<string>, rng: SeededRandom, nextId: number, animate: boolean, levelId: string) {
  let id = nextId;
  for (let attempt = 0; attempt < 40; attempt++) {
    const occurrences = scanBoard(board, words, levelId); if (!occurrences.length) break;
    const victim = occurrences[0].coordinates.find((at) => !protectedCells.has(cellKey(at))); if (!victim) break;
    let letter = randomLetter(rng); while (letter === board[victim.row][victim.col]?.letter) letter = randomLetter(rng);
    board[victim.row][victim.col] = { id: `tile-${id++}`, letter, row: victim.row, col: victim.col, fromRow: animate ? -1 : undefined, injected: animate };
  }
  return id;
}

function collapseWithRecipe(source: Board, removed: Coordinate[], rng: SeededRandom, nextId: number) {
  const board = cloneBoard(source); removed.forEach(({ row, col }) => { board[row][col] = null; });
  const survivorIds = new Set(source.flat().filter((tile): tile is Tile => !!tile && !removed.some((at) => at.row === tile.row && at.col === tile.col)).map((tile) => tile.id));
  const incomingByColumn: Record<number, string[]> = {}; let id = nextId;
  for (let col = 0; col < 8; col++) {
    const survivors = board.map((row) => row[col]).filter((tile): tile is Tile => tile !== null); const missing = 8 - survivors.length; const column: Tile[] = [];
    incomingByColumn[col] = [];
    for (let row = 0; row < missing; row++) { const letter = randomLetter(rng); incomingByColumn[col].push(letter); column.push({ id: `tile-${id++}`, letter, row, col, fromRow: row - missing }); }
    survivors.forEach((tile, index) => { const row = missing + index; column.push({ ...tile, row, col, fromRow: tile.row === row ? undefined : tile.row, injected: false }); });
    column.forEach((tile) => { board[tile.row][col] = tile; });
  }
  return { board, nextId: id, incomingByColumn, survivorIds };
}

function candidatePathInZone(source: Board, word: string, zone: ZoneId, survivorIds: Set<string>, protectedCells: Set<string>, last: WordOccurrence | null, zoneDirections: ZoneDirectionMap, rng: SeededRandom, levelId: string) {
  const paths = allPlacements(word, levelId).filter((path) => path.zone === zone);
  let best: { path: WordOccurrence; score: number } | null = null;
  for (const path of rng.shuffle(paths)) {
    const overlap = last ? path.coordinates.filter((at) => last.coordinates.some((old) => cellKey(old) === cellKey(at))).length : 0;
    if (last && path.zone === last.zone) continue;
    if (overlap > Math.max(1, Math.floor(word.length * .3))) continue;
    let valid = true, existing = 0, matches = 0;
    path.coordinates.forEach((at, index) => {
      const tile = source[at.row][at.col]; if (protectedCells.has(cellKey(at)) && tile?.letter !== word[index]) valid = false;
      if (tile && survivorIds.has(tile.id)) existing++; if (tile?.letter === word[index]) matches++;
    });
    if (!valid || (survivorIds.size > 0 && existing < Math.ceil(word.length / 2))) continue;
    const topCells = path.coordinates.filter((at) => at.row < 2).length;
    const score = existing * 30 + matches * 12 - topCells * 10 - (zoneDirections[zone][path.direction.name] ?? 0) * 18;
    if (!best || score > best.score) best = { path, score };
  }
  return best?.path ?? null;
}

function directByZones(source: Board, remaining: string[], rng: SeededRandom, nextId: number, zoneUsage: number[], recentZones: ZoneId[], zoneDirections: ZoneDirectionMap, survivorIds: Set<string>, last: WordOccurrence | null, animate: boolean, levelId: string) {
  const level = getLevelConfig(levelId);
  const board = cloneBoard(source); let id = nextId; const plannedWords: string[] = [], chosen: WordOccurrence[] = [], protectedCells = new Set<string>();
  id = breakAllTargets(board, remaining, protectedCells, rng, id, animate, levelId);
  const desired = Math.min(level.desiredAvailableWords, remaining.length); const unusedWords = [...remaining]; const selectedZones: ZoneId[] = [];
  while (chosen.length < desired && unusedWords.length) {
    const nonAdjacentExcluded = selectedZones.length ? legalZonesForWords(unusedWords, levelId).filter((zone) => adjacent(zone, selectedZones[0])) : [];
    const zone = chooseTargetZone(unusedWords, zoneUsage, recentZones, [...selectedZones, ...nonAdjacentExcluded], rng, levelId);
    if (zone === null) break;
    const compatibleWords = rng.shuffle(unusedWords.filter((word) => allPlacements(word, levelId).some((path) => path.zone === zone)));
    let placed = false;
    for (const word of compatibleWords) {
      const path = candidatePathInZone(board, word, zone, survivorIds, protectedCells, last, zoneDirections, rng, levelId); if (!path) continue;
      path.coordinates.forEach((at, index) => {
        const current = board[at.row][at.col]; if (current?.letter === word[index]) return;
        // Preserve the falling tile's identity: the branch recipe changes only
        // canonical letters and incoming column letters are stored separately.
        board[at.row][at.col] = { ...(current ?? { id: `tile-${id++}` }), letter: word[index], row: at.row, col: at.col, injected: animate && !current, fromRow: current?.fromRow };
      });
      path.coordinates.forEach((at) => protectedCells.add(cellKey(at))); chosen.push(path); selectedZones.push(zone); plannedWords.push(word); unusedWords.splice(unusedWords.indexOf(word), 1); placed = true; break;
    }
    if (!placed) { selectedZones.push(zone); if (selectedZones.length > 8) break; }
  }
  id = breakAllTargets(board, remaining.filter((word) => !chosen.some((item) => item.word === word)), protectedCells, rng, id, animate, levelId);
  const available = uniqueWords(scanBoard(board, remaining, levelId)).filter((item) => chosen.some((planned) => planned.word === item.word)).slice(0, level.maximumAvailableWords);
  return { board, nextId: id, available, plannedWords };
}

function updatedHistory(runtime: Pick<GameRuntime, "usage" | "zoneUsage" | "zoneActivity" | "recentZones" | "zoneDirections">, occurrence: WordOccurrence) {
  const usage = runtime.usage.map((row) => [...row]), zoneUsage = [...runtime.zoneUsage], zoneActivity = [...runtime.zoneActivity], zoneDirections = structuredClone(runtime.zoneDirections);
  occurrence.coordinates.forEach(({ row, col }) => { usage[row][col]++; zoneActivity[zoneOfPoint(row, col)]++; });
  zoneUsage[occurrence.zone]++; zoneDirections[occurrence.zone][occurrence.direction.name] = (zoneDirections[occurrence.zone][occurrence.direction.name] ?? 0) + 1;
  return { usage, zoneUsage, zoneActivity, zoneDirections, recentZones: [occurrence.zone, ...runtime.recentZones.filter((zone) => zone !== occurrence.zone)].slice(0, 2) as ZoneId[] };
}

function buildOutcome(runtime: GameRuntime, occurrence: WordOccurrence, remainingAfter: string[]): PreparedMove | null {
  const history = updatedHistory(runtime, occurrence); const seed = runtime.rngState ^ runtime.boardRevision * 104729 ^ occurrence.coordinates.reduce((sum, at) => sum + at.row * 97 + at.col * 193, 0); const rng = new SeededRandom(seed);
  const collapsed = collapseWithRecipe(runtime.board, occurrence.coordinates, rng, runtime.nextId);
  const directed = directByZones(collapsed.board, remainingAfter, rng, collapsed.nextId, history.zoneUsage, history.recentZones, history.zoneDirections, collapsed.survivorIds, occurrence, true, runtime.levelId);
  if (remainingAfter.length && !directed.available.length) return null;
  return { key: branchKey(runtime.boardRevision, occurrence.word, occurrence.coordinates, remainingAfter), boardRevision: runtime.boardRevision, word: occurrence.word, removed: occurrence.coordinates, canonicalParent: canonicalBoard(runtime.board), incomingByColumn: collapsed.incomingByColumn, board: directed.board, available: directed.available, plannedWords: directed.plannedWords, rngState: rng.state, nextId: directed.nextId, ...history, lastOccurrence: occurrence, depthTwoValid: remainingAfter.length === 0 || directed.available.length > 0 };
}

function prepareMoves(runtime: GameRuntime): GameRuntime {
  const remaining = runtime.targets.filter((word) => !runtime.found.includes(word));
  if (remaining.length === 0) return { ...runtime, preparedMoves: {}, recoveryLocked: false };
  const playable = scanBoard(runtime.board, remaining, runtime.levelId); const preparedMoves: Record<string, PreparedMove> = {};
  for (const occurrence of playable) {
    const after = remaining.filter((word) => word !== occurrence.word), outcome = buildOutcome(runtime, occurrence, after); if (!outcome) continue;
    outcome.depthTwoValid = after.length === 0 || outcome.available.every((future) => {
      const childRuntime: GameRuntime = { ...runtime, board: outcome.board, boardRevision: runtime.boardRevision + 1, found: [...runtime.found, occurrence.word], plannedWords: outcome.plannedWords, rngState: outcome.rngState, nextId: outcome.nextId, usage: outcome.usage, zoneUsage: outcome.zoneUsage, zoneActivity: outcome.zoneActivity, recentZones: outcome.recentZones, zoneDirections: outcome.zoneDirections, lastOccurrence: occurrence, preparedMoves: {} };
      return buildOutcome(childRuntime, future, after.filter((word) => word !== future.word)) !== null;
    });
    if (outcome.depthTwoValid) preparedMoves[outcome.key] = outcome;
  }
  return { ...runtime, preparedMoves };
}

function freshRuntimeBase(board: Board, targets: string[], rng: SeededRandom, nextId: number, levelId: string): GameRuntime {
  return { levelId, board, boardRevision: 1, targets, found: [], plannedWords: [], rngState: rng.state, nextId, lastShuffle: false, reshuffleCount: 0, recoveryLocked: false, usage: emptyUsage(), zoneUsage: Array(9).fill(0), zoneActivity: Array(9).fill(0), recentZones: [], zoneDirections: emptyZoneDirections(), lastOccurrence: null, preparedMoves: {}, hintsRemaining: getLevelConfig(levelId).hints, branchReplans: 0 };
}

export function startLevel(seed: number, levelId = LEVELS[0].id): GameRuntime {
  const level = getLevelConfig(levelId);
  const rng = new SeededRandom(seed), targets = rng.shuffle(level.wordBank).slice(0, level.targetCount), random = makeRandomBoard(rng, 1);
  let runtime = freshRuntimeBase(random.board, targets, rng, random.nextId, levelId);
  const directed = directByZones(runtime.board, targets, rng, runtime.nextId, runtime.zoneUsage, [], runtime.zoneDirections, new Set(), null, false, levelId);
  runtime = { ...runtime, board: directed.board, plannedWords: directed.plannedWords, rngState: rng.state, nextId: directed.nextId };
  return prepareMoves(runtime);
}

export function resolveMoveFromActual(runtime: GameRuntime, word: string, coordinates: Coordinate[]) {
  const remaining = runtime.targets.filter((target) => !runtime.found.includes(target));
  if (remaining.length === 0) return { status: "completed" as const, runtime: { ...runtime, preparedMoves: {}, recoveryLocked: false } };
  const actualPaths = scanBoard(runtime.board, remaining, runtime.levelId); if (actualPaths.length === 0) return { status: "recovery" as const, runtime };
  const occurrence = actualPaths.find((item) => item.word === word && item.coordinates.every((at, index) => cellKey(at) === cellKey(coordinates[index]))); if (!occurrence) return { status: "active" as const, runtime };
  const after = remaining.filter((target) => target !== word); const key = branchKey(runtime.boardRevision, word, coordinates, after);
  let prepared: PreparedMove | undefined = runtime.preparedMoves[key]; let replanned = runtime;
  if (!prepared) { replanned = prepareMoves({ ...runtime, preparedMoves: {}, branchReplans: runtime.branchReplans + 1 }); prepared = replanned.preparedMoves[key]; }
  if (!prepared) prepared = buildOutcome(replanned, occurrence, after) ?? undefined;
  if (!prepared) return { status: "active" as const, runtime: replanned };
  const found = [...runtime.found, word];
  if (after.length === 0) return { status: "completed" as const, runtime: { ...runtime, found, boardRevision: runtime.boardRevision + 1, preparedMoves: {}, recoveryLocked: false, lastOccurrence: occurrence, ...updatedHistory(runtime, occurrence) } };
  const next = prepareMoves({ ...runtime, board: prepared.board, boardRevision: runtime.boardRevision + 1, found, plannedWords: prepared.plannedWords, rngState: prepared.rngState, nextId: prepared.nextId, usage: prepared.usage, zoneUsage: prepared.zoneUsage, zoneActivity: prepared.zoneActivity, recentZones: prepared.recentZones, zoneDirections: prepared.zoneDirections, lastOccurrence: occurrence, preparedMoves: {}, lastShuffle: false, recoveryLocked: false, branchReplans: replanned.branchReplans });
  return { status: "active" as const, runtime: next };
}

export function recoverFromActual(runtime: GameRuntime) {
  const remaining = runtime.targets.filter((word) => !runtime.found.includes(word));
  if (remaining.length === 0) return { status: "completed" as const, runtime: { ...runtime, preparedMoves: {}, recoveryLocked: false } };
  const playable = scanBoard(runtime.board, remaining, runtime.levelId); if (playable.length) return { status: "active" as const, runtime: prepareMoves({ ...runtime, preparedMoves: {}, recoveryLocked: false }) };
  if (runtime.recoveryLocked) return { status: "recovery" as const, runtime };
  const rng = new SeededRandom(runtime.rngState ^ runtime.boardRevision * 65537); const directed = directByZones(runtime.board, remaining, rng, runtime.nextId, runtime.zoneUsage, runtime.recentZones, runtime.zoneDirections, new Set(runtime.board.flat().filter((tile): tile is Tile => !!tile).map((tile) => tile.id)), runtime.lastOccurrence, true, runtime.levelId);
  if (directed.available.length) return { status: "active" as const, runtime: prepareMoves({ ...runtime, board: directed.board, boardRevision: runtime.boardRevision + 1, plannedWords: directed.plannedWords, rngState: rng.state, nextId: directed.nextId, recoveryLocked: false, lastShuffle: false }) };
  if (runtime.reshuffleCount >= 1) return { status: "recovery" as const, runtime: { ...runtime, recoveryLocked: true } };
  const rebuilt = makeRandomBoard(rng, runtime.nextId, true); const repaired = directByZones(rebuilt.board, remaining, rng, rebuilt.nextId, runtime.zoneUsage, runtime.recentZones, runtime.zoneDirections, new Set(), runtime.lastOccurrence, true, runtime.levelId);
  return { status: "active" as const, runtime: prepareMoves({ ...runtime, board: repaired.board, boardRevision: runtime.boardRevision + 1, plannedWords: repaired.plannedWords, rngState: rng.state, nextId: repaired.nextId, reshuffleCount: runtime.reshuffleCount + 1, lastShuffle: true, recoveryLocked: false }) };
}

export function clearMotion(board: Board): Board { return board.map((row) => row.map((tile) => tile ? { ...tile, fromRow: undefined, injected: false } : null)); }
