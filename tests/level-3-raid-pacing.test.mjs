import assert from "node:assert/strict";
import test from "node:test";
import { createGeneratedBoardSession, generatedLevelForPlayerLevel } from "../game/v3/board-session-factory.ts";
import { BadgeManager } from "../game/v3/badge-manager.ts";
import { ScoreManager } from "../game/scoring/score-manager.ts";

/**
 * Plays Level 3 to completion, choosing between the two words a stage offers with the
 * supplied bit pattern, and reports when the Raid tray filled.
 */
function playLevel3(choices) {
  const session = createGeneratedBoardSession(generatedLevelForPlayerLevel(3), 0);
  const badges = new BadgeManager();
  const scorer = new ScoreManager(0);
  let time = 0;
  let accepted = 0;
  let pair = 0;
  let readyAtWord = null;
  let raidTokens = 0;

  while (accepted < 20) {
    const active = session.activeWords();
    if (!active.length) break;
    const choice = active.length > 1 ? (choices[pair] ?? 0) : 0;
    const word = active[Math.min(choice, active.length - 1)];
    time += 1000;

    const selection = session.acceptSelection(word.tileIds, time, (candidate, at) => scorer.onWordSolved(candidate, at));
    assert.equal(selection.kind, "accepted", `${word.word} should be accepted`);
    raidTokens += selection.rewards.filter((reward) => reward.type === "raid").length;
    const collected = badges.collect({ badges: selection.rewards });
    const result = session.solve(word, time);
    session.settleTransitions(time);
    accepted += 1;
    if ((collected.createdActions ?? []).includes("raid") && readyAtWord === null) readyAtWord = accepted;
    if (accepted % 2 === 0) pair += 1;
    if (result?.complete) break;
  }
  return { readyAtWord, accepted, raidTokens };
}

const ORDERS = Array.from({ length: 16 }, (_, mask) => [mask & 1, (mask >> 1) & 1, (mask >> 2) & 1, (mask >> 3) & 1]);

test("Level 3 always hands the player a Raid, whatever order the words are solved in", () => {
  const failures = ORDERS.filter((choices) => playLevel3(choices).readyAtWord === null);
  assert.deepEqual(failures, [], "every playthrough must fill the Raid tray");
});

test("the Raid becomes ready around the seventh word, with board still left to play", () => {
  for (const choices of ORDERS) {
    const { readyAtWord, accepted } = playLevel3(choices);
    assert.ok(
      readyAtWord >= 7 && readyAtWord <= 8,
      `order ${choices.join("")} made Raid ready at word ${readyAtWord}, expected 7-8`,
    );
    assert.ok(readyAtWord <= accepted, "the Raid must arrive during the board, not after it");
  }
});

test("exactly three Raid tokens are on the Level 3 board — no farming, no shortfall", () => {
  for (const choices of ORDERS) {
    assert.equal(playLevel3(choices).raidTokens, 3, `order ${choices.join("")} collected the wrong token count`);
  }
});

test("Level 3 still completes in its authored eight objective words", () => {
  for (const choices of ORDERS) {
    assert.equal(playLevel3(choices).accepted, 8);
  }
});

test("neighbouring levels keep the ordinary random badge distribution", () => {
  // Level 3's scripted schedule must not leak into levels either side of it.
  for (const levelNumber of [2, 4]) {
    const session = createGeneratedBoardSession(generatedLevelForPlayerLevel(levelNumber), 0);
    const scorer = new ScoreManager(0);
    let time = 0;
    let raidTokens = 0;
    let guard = 0;
    while (guard++ < 20) {
      const active = session.activeWords();
      if (!active.length) break;
      const word = active[0];
      time += 1000;
      const selection = session.acceptSelection(word.tileIds, time, (c, at) => scorer.onWordSolved(c, at));
      if (selection.kind !== "accepted") break;
      raidTokens += selection.rewards.filter((reward) => reward.type === "raid").length;
      const result = session.solve(word, time);
      session.settleTransitions(time);
      if (result?.complete) break;
    }
    assert.ok(raidTokens < 3, `level ${levelNumber} should not hand out a scripted Raid (got ${raidTokens})`);
  }
});
