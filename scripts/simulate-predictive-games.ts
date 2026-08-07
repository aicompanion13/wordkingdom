import { recoverFromActual, resolveMoveFromActual, scanBoard, startLevel } from "../game/director";
import { LEVELS } from "../game/config";

const GAME_COUNT = Number(process.argv[2] ?? 1000);
const totals = {
  reshuffles: 0,
  zeroReshuffleGames: 0,
  completed: 0,
  deadBoards: 0,
  falseUnsolvable: 0,
  branchMismatches: 0,
  consecutiveSameZone: 0,
  discoveredTiles: 0,
  topTwoRowTiles: 0,
  distinctZones: 0,
  gamesWithSixZones: 0,
};
const aggregateZoneUsage = Array(9).fill(0);

for (let seed = 1; seed <= GAME_COUNT; seed++) {
  let game = startLevel(seed * 7919, LEVELS.at(-1)!.id);
  let safety = 0;
  while (game.found.length < game.targets.length && safety++ < 20) {
    const remaining = game.targets.filter((word) => !game.found.includes(word));
    if (remaining.length === 0) break;
    let paths = scanBoard(game.board, remaining, game.levelId);
    if (!paths.length) {
      const recovery = recoverFromActual(game);
      if (recovery.status === "completed") { game = recovery.runtime; break; }
      game = recovery.runtime;
      paths = scanBoard(game.board, remaining, game.levelId);
      if (!paths.length) { totals.deadBoards++; break; }
    }
    const choice = paths[(seed + safety * 7) % paths.length];
    const beforeReplans = game.branchReplans;
    const result = resolveMoveFromActual(game, choice.word, choice.coordinates);
    if (result.runtime.branchReplans > beforeReplans) totals.branchMismatches += result.runtime.branchReplans - beforeReplans;
    game = result.runtime;
    if (game.found.length === game.targets.length && result.status !== "completed") totals.falseUnsolvable++;
  }

  if (game.found.length === game.targets.length) totals.completed++;
  totals.reshuffles += game.reshuffleCount;
  if (game.reshuffleCount === 0) totals.zeroReshuffleGames++;
  game.zoneUsage.forEach((count, zone) => { aggregateZoneUsage[zone] += count; });
  const used = game.zoneUsage.filter((count) => count > 0).length;
  totals.distinctZones += used;
  if (used >= 6) totals.gamesWithSixZones++;
  for (let index = 1; index < game.recentZones.length; index++) if (game.recentZones[index] === game.recentZones[index - 1]) totals.consecutiveSameZone++;
  game.usage.forEach((row, rowIndex) => row.forEach((count) => { totals.discoveredTiles += count; if (rowIndex < 2) totals.topTwoRowTiles += count; }));
}

const report = {
  games: GAME_COUNT,
  completed: totals.completed,
  averageReshufflesPerGame: totals.reshuffles / GAME_COUNT,
  zeroReshuffleCompletionPercent: totals.zeroReshuffleGames / GAME_COUNT * 100,
  averageDistinctZonesPerGame: totals.distinctZones / GAME_COUNT,
  gamesUsingAtLeastSixZonesPercent: totals.gamesWithSixZones / GAME_COUNT * 100,
  averageZoneUsagePerGame: aggregateZoneUsage.map((count) => Number((count / GAME_COUNT).toFixed(3))),
  topTwoRowsDiscoveredTilePercent: totals.discoveredTiles ? totals.topTwoRowTiles / totals.discoveredTiles * 100 : 0,
  consecutiveSameZonePlacements: totals.consecutiveSameZone,
  deadBoardCount: totals.deadBoards,
  falseUnsolvableCount: totals.falseUnsolvable,
  branchMismatchCount: totals.branchMismatches,
};

console.log(JSON.stringify(report, null, 2));
if (report.completed !== GAME_COUNT || report.falseUnsolvableCount || report.deadBoardCount || report.consecutiveSameZonePlacements || report.zeroReshuffleCompletionPercent < 99 || report.topTwoRowsDiscoveredTilePercent >= 35) process.exitCode = 1;
