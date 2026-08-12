import assert from "node:assert/strict";
import test from "node:test";
import {
  createLevelTimer,
  formatLevelClock,
  isLevelTimeUp,
  isLevelTimeUrgent,
  levelTimeElapsedMs,
  levelTimeRemainingMs,
  pauseLevelTimer,
  resumeLevelTimer,
  LEVEL_TIME_LIMIT_SECONDS,
  LEVEL_TIME_URGENT_SECONDS,
} from "../game/v3/level-timer.ts";

const T0 = 1_000_000;
const MIN = 60_000;

test("a fresh level starts with the full ten minutes", () => {
  const timer = createLevelTimer(T0);
  assert.equal(LEVEL_TIME_LIMIT_SECONDS, 600);
  assert.equal(levelTimeRemainingMs(timer, T0), 600_000);
  assert.equal(formatLevelClock(levelTimeRemainingMs(timer, T0)), "10:00");
});

test("the clock counts down with wall time", () => {
  const timer = createLevelTimer(T0);
  assert.equal(formatLevelClock(levelTimeRemainingMs(timer, T0 + 90_000)), "8:30");
  assert.equal(levelTimeElapsedMs(timer, T0 + 90_000), 90_000);
});

test("pausing freezes the clock, and paused time is never charged to the player", () => {
  let timer = createLevelTimer(T0);
  timer = pauseLevelTimer(timer, T0 + 2 * MIN);          // two minutes played
  const during = levelTimeRemainingMs(timer, T0 + 5 * MIN); // three minutes paused
  assert.equal(formatLevelClock(during), "8:00", "clock must not move while paused");

  timer = resumeLevelTimer(timer, T0 + 5 * MIN);
  assert.equal(formatLevelClock(levelTimeRemainingMs(timer, T0 + 6 * MIN)), "7:00");
});

test("several pauses accumulate correctly", () => {
  let timer = createLevelTimer(T0);
  for (const [pauseAt, resumeAt] of [[1, 3], [4, 9], [10, 12]]) {
    timer = pauseLevelTimer(timer, T0 + pauseAt * MIN);
    timer = resumeLevelTimer(timer, T0 + resumeAt * MIN);
  }
  // 13 minutes of wall time; pauses of 2 + 5 + 2 = 9, so 4 minutes actually played.
  assert.equal(levelTimeElapsedMs(timer, T0 + 13 * MIN), 4 * MIN);
  assert.equal(formatLevelClock(levelTimeRemainingMs(timer, T0 + 13 * MIN)), "6:00");
});

test("repeated pause or resume calls are harmless", () => {
  let timer = createLevelTimer(T0);
  timer = pauseLevelTimer(timer, T0 + MIN);
  const doublePaused = pauseLevelTimer(timer, T0 + 2 * MIN);
  assert.deepEqual(doublePaused, timer, "a second pause must not restart the pause window");

  timer = resumeLevelTimer(doublePaused, T0 + 3 * MIN);
  const doubleResumed = resumeLevelTimer(timer, T0 + 4 * MIN);
  assert.deepEqual(doubleResumed, timer, "a second resume must not credit extra time");
  assert.equal(formatLevelClock(levelTimeRemainingMs(timer, T0 + 3 * MIN)), "9:00");
});

test("the last minute is urgent, and only the last minute", () => {
  const timer = createLevelTimer(T0);
  assert.equal(LEVEL_TIME_URGENT_SECONDS, 60);
  assert.equal(isLevelTimeUrgent(timer, T0 + 538_000), false, "62s left is not yet urgent");
  assert.equal(isLevelTimeUrgent(timer, T0 + 545_000), true, "55s left is urgent");
  assert.equal(isLevelTimeUrgent(timer, T0 + 600_000), false, "expired is not urgent, it is up");
});

test("the clock floors at zero and reports time up without going negative", () => {
  const timer = createLevelTimer(T0);
  assert.equal(isLevelTimeUp(timer, T0 + 599_000), false);
  assert.equal(isLevelTimeUp(timer, T0 + 600_000), true);
  assert.equal(levelTimeRemainingMs(timer, T0 + 900_000), 0, "must not run negative");
  assert.equal(formatLevelClock(levelTimeRemainingMs(timer, T0 + 900_000)), "0:00");
});

test("a clock paused past its limit still reads zero rather than negative", () => {
  let timer = createLevelTimer(T0);
  timer = pauseLevelTimer(timer, T0 + 700_000);
  assert.equal(levelTimeRemainingMs(timer, T0 + 900_000), 0);
});

test("the clock formats as m:ss with padded seconds", () => {
  assert.equal(formatLevelClock(600_000), "10:00");
  assert.equal(formatLevelClock(65_000), "1:05");
  assert.equal(formatLevelClock(9_000), "0:09");
  assert.equal(formatLevelClock(0), "0:00");
  assert.equal(formatLevelClock(-5_000), "0:00");
});

test("a backwards clock reading cannot award extra time", () => {
  const timer = createLevelTimer(T0);
  assert.equal(levelTimeRemainingMs(timer, T0 - 60_000), 600_000);
});
