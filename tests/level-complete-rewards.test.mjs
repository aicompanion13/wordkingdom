import assert from "node:assert/strict";
import test from "node:test";
import { formatRewardAmount, levelRewardLabel, levelRewardSlots } from "../game/v3/level-complete-rewards.ts";

test("the tray always shows all three rewards, in a stable order", () => {
  const slots = levelRewardSlots({ runCoins: 400, levelCoins: 195 });
  assert.deepEqual(slots.map((s) => s.kind), ["coins", "hints", "card"]);
});

test("run coins and the level bonus are added together", () => {
  const [coins] = levelRewardSlots({ runCoins: 406, levelCoins: 195 });
  assert.equal(coins.amount, 601);
  assert.equal(coins.earned, true);
});

test("a reward the level did not grant stays present but unearned", () => {
  const slots = levelRewardSlots({ runCoins: 400, levelCoins: 180 });
  const [, hints, card] = slots;
  assert.equal(hints.earned, false);
  assert.equal(card.earned, false);
  assert.equal(slots.length, 3, "the slot must not disappear, or the panel looks broken");
  assert.equal(formatRewardAmount(hints), "—");
});

test("hints and cards are marked earned when the level grants them", () => {
  const [, hints, card] = levelRewardSlots({ runCoins: 900, levelCoins: 1600, hints: 2, cards: 3 });
  assert.deepEqual([hints.amount, hints.earned], [2, true]);
  assert.deepEqual([card.amount, card.earned], [3, true]);
  assert.equal(formatRewardAmount(hints), "+2");
});

test("large coin totals are abbreviated so they cannot overflow the cell", () => {
  const big = (n) => formatRewardAmount(levelRewardSlots({ runCoins: n, levelCoins: 0 })[0]);
  assert.equal(big(940), "940");
  assert.equal(big(1200), "1.2K");
  assert.equal(big(2000), "2K");
  assert.equal(big(15400), "15K");
});

test("negative or missing inputs cannot produce a negative reward", () => {
  const slots = levelRewardSlots({ runCoins: -50, levelCoins: 0, hints: -3 });
  assert.equal(slots[0].amount, 0);
  assert.equal(slots[0].earned, false);
  assert.equal(slots[1].amount, 0);
});

test("labels read naturally for assistive technology, including the singular", () => {
  const [coins, hints, card] = levelRewardSlots({ runCoins: 0, levelCoins: 500, hints: 1, cards: 0 });
  assert.equal(levelRewardLabel(coins), "500 coins");
  assert.equal(levelRewardLabel(hints), "1 hint");
  assert.equal(levelRewardLabel(card), "No cards from this level");
});
