import assert from "node:assert/strict";
import test from "node:test";
import { createGeneratedBoardSession, generatedLevelForPlayerLevel } from "../game/v3/board-session-factory.ts";
import { BadgeManager } from "../game/v3/badge-manager.ts";
import { ScoreManager } from "../game/scoring/score-manager.ts";
import { RAID_TUTORIAL_LEVEL, shouldOpenBoardRaid } from "../game/v3/raid-trigger.ts";
import { createLevelTimer, levelTimeElapsedMs, pauseLevelTimer, resumeLevelTimer } from "../game/v3/level-timer.ts";

const onBoard = {
  screen: "board",
  overlayOpen: false,
  level: 6,
  readyRaids: 1,
  boardAlive: true,
};

test("a ready Raid opens on a live board", () => {
  assert.equal(shouldOpenBoardRaid(onBoard), true);
});

test("a Raid never opens between games", () => {
  assert.equal(shouldOpenBoardRaid({ ...onBoard, screen: "summary" }), false, "not over the results screen");
  assert.equal(shouldOpenBoardRaid({ ...onBoard, screen: "hub" }), false, "not on the map");
});

test("a Raid waits its turn rather than stacking on another overlay", () => {
  assert.equal(shouldOpenBoardRaid({ ...onBoard, overlayOpen: true }), false);
});

test("no Raid before the feature is unlocked", () => {
  for (const level of [1, 2]) {
    assert.equal(shouldOpenBoardRaid({ ...onBoard, level }), false, `level ${level} must not raid`);
  }
  assert.equal(shouldOpenBoardRaid({ ...onBoard, level: RAID_TUTORIAL_LEVEL }), true);
});

test("holding no Raid opens nothing", () => {
  assert.equal(shouldOpenBoardRaid({ ...onBoard, readyRaids: 0 }), false);
});

test("a board torn down underneath the trigger opens nothing", () => {
  assert.equal(shouldOpenBoardRaid({ ...onBoard, boardAlive: false }), false);
});

/**
 * Plays Level 3, collecting badges exactly as the board does, and reports the word the
 * Raid became ready on and whether the board still had play left at that point.
 */
function playLevel3(choices) {
  const session = createGeneratedBoardSession(generatedLevelForPlayerLevel(3), 0);
  const badges = new BadgeManager();
  const scorer = new ScoreManager(0);
  let time = 0;
  let accepted = 0;
  let pair = 0;
  let readyAtWord = null;

  while (accepted < 20) {
    const active = session.activeWords();
    if (!active.length) break;
    const word = active[Math.min(active.length > 1 ? (choices[pair] ?? 0) : 0, active.length - 1)];
    time += 1000;
    const selection = session.acceptSelection(word.tileIds, time, (candidate, at) => scorer.onWordSolved(candidate, at));
    assert.equal(selection.kind, "accepted");
    const collected = badges.collect({ badges: selection.rewards });
    const result = session.solve(word, time);
    session.settleTransitions(time);
    accepted += 1;
    if (collected.readyActions.raid > 0 && readyAtWord === null) readyAtWord = accepted;
    if (accepted % 2 === 0) pair += 1;
    if (result?.complete) break;
  }
  return { readyAtWord, accepted };
}

const ORDERS = Array.from({ length: 16 }, (_, mask) => [mask & 1, (mask >> 1) & 1, (mask >> 2) & 1, (mask >> 3) & 1]);

test("every Level 3 playthrough makes a Raid ready while the board is still up", () => {
  for (const choices of ORDERS) {
    const { readyAtWord, accepted } = playLevel3(choices);
    assert.ok(readyAtWord !== null, `order ${choices.join("")} never filled the tray`);
    assert.ok(readyAtWord <= accepted, `order ${choices.join("")} filled the tray after the board ended`);
  }
});

/*
 * One order in sixteen — taking the first offered word every time — fills the tray on the
 * final word, so the board ends before the vault can open and the Raid carries into the
 * next level. That is why the Raid explainer is keyed to the tutorial level rather than
 * the level being played: those players would otherwise meet their first Raid with no
 * explanation attached.
 */
test("the Raid can fill on the very last word, which is why the explainer is not level-keyed", () => {
  const lastWordOrders = ORDERS.filter((choices) => {
    const { readyAtWord, accepted } = playLevel3(choices);
    return readyAtWord === accepted;
  });
  assert.equal(lastWordOrders.length, 1, "if this count moves, re-check the carry-over path");
  assert.deepEqual(lastWordOrders[0], [0, 0, 0, 0]);
  // Wherever that carried Raid lands, the explainer must still be attached.
  assert.equal(RAID_TUTORIAL_LEVEL, 3);
  assert.equal(shouldOpenBoardRaid({ ...onBoard, level: 4 }), true, "the carried Raid still opens on level 4");
});

test("a Raid that interrupts the board does not spend the player's level time", () => {
  let timer = createLevelTimer(0);
  timer = pauseLevelTimer(timer, 90_000);
  timer = resumeLevelTimer(timer, 210_000);
  assert.equal(levelTimeElapsedMs(timer, 240_000), 120_000);
});

test("the clock stays frozen while the Raid is open, however long the player takes", () => {
  const timer = pauseLevelTimer(createLevelTimer(0), 40_000);
  assert.equal(levelTimeElapsedMs(timer, 40_000), 40_000);
  assert.equal(levelTimeElapsedMs(timer, 400_000), 40_000, "a slow Raid must not drain the board clock");
});
