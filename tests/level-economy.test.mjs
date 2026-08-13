import assert from "node:assert/strict";
import test from "node:test";
import { EconomyManagerV3, HINT_POOL_CAP, hintsThatLand } from "../game/v3/economy-manager.ts";
import { TrackManager } from "../game/v3/track-manager.ts";
import chapters from "../game/v3/data/track_data.json" with { type: "json" };
import defaultPlayer from "../game/v3/data/default-player.json" with { type: "json" };

const areas = [{ areaId: 1, displayName: "Ocean", themeKey: "ocean" }];
const track = new TrackManager(chapters.chapters ?? chapters, areas);
const ALL_LEVELS = Array.from({ length: 25 }, (_, index) => index + 1);

const player = (overrides = {}) => structuredClone({ ...defaultPlayer, ...overrides });

test("every level pays coins, a hint and a card pack, so no reward slot is ever dead", () => {
  for (const level of ALL_LEVELS) {
    const { reward } = track.node(level);
    assert.ok(reward.coins > 0, `level ${level} pays no coins`);
    assert.ok((reward.hints ?? 0) > 0, `level ${level} pays no hints`);
    assert.ok(reward.pack, `level ${level} pays no cards`);
  }
});

test("the payout escalates into the hard node and the chapter guardian", () => {
  // Local level 4 is HARD and 5 is BOSS in every chapter.
  assert.deepEqual(
    [track.node(3).reward.pack, track.node(4).reward.pack, track.node(5).reward.pack],
    ["GREEN", "BLUE", "GOLD"],
  );
  assert.ok(track.node(4).reward.hints > track.node(3).reward.hints);
  assert.ok(track.node(5).reward.hints > track.node(4).reward.hints);
});

test("completing a level moves its hints into the pool", () => {
  const economy = new EconomyManagerV3(player({ hints: 0 }));
  const node = track.node(6);
  const after = economy.completeNode(node, 0, 3);
  assert.equal(after.hints, node.reward.hints);
});

test("the hint pool cannot be pushed past its cap", () => {
  const economy = new EconomyManagerV3(player({ hints: HINT_POOL_CAP - 1 }));
  const after = economy.completeNode(track.node(5), 0, 3);
  assert.equal(after.hints, HINT_POOL_CAP, "a level 5 grant of 3 must clamp, not overflow");
});

test("hintsThatLand reports what will actually land, so the panel cannot over-promise", () => {
  assert.equal(hintsThatLand(0, 1), 1);
  assert.equal(hintsThatLand(HINT_POOL_CAP - 1, 3), 1, "only the room that exists is granted");
  assert.equal(hintsThatLand(HINT_POOL_CAP, 2), 0, "a full pool grants nothing");
  assert.equal(hintsThatLand(HINT_POOL_CAP + 5, 2), 0, "an over-full pool cannot report negative");
  assert.equal(hintsThatLand(0, -4), 0);
});

test("hintsThatLand agrees with what the pool actually does", () => {
  for (const held of [0, 1, 5, HINT_POOL_CAP - 1, HINT_POOL_CAP, HINT_POOL_CAP + 5]) {
    for (const grant of [0, 1, 2, 3]) {
      const economy = new EconomyManagerV3(player({ hints: held }));
      const landed = economy.grantHints(grant).hints - held;
      assert.equal(
        hintsThatLand(held, grant),
        landed,
        `predicted grant disagreed with the pool at held=${held} grant=${grant}`,
      );
    }
  }
});

test("a played level still pays coins on top of the run total", () => {
  const economy = new EconomyManagerV3(player({ coins: 0, hints: 0 }));
  const node = track.node(7);
  const after = economy.completeNode(node, 250, 3);
  assert.equal(after.coins, 250 + node.reward.coins);
});
