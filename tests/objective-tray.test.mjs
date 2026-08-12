import assert from "node:assert/strict";
import test from "node:test";
import { FOUND_HOLD_MS, nextObjectiveTrayWakeMs, objectiveTileLabel, reconcileObjectiveTray } from "../game/v3/objective-tray-state.ts";

const words = (...ids) => ids.map((id) => ({ id, word: id.toUpperCase(), tileIds: [`${id}-t0`, `${id}-t1`] }));
const build = (input, previous = [], now = 0) => reconcileObjectiveTray(previous, input, now);
const shape = (tiles) => tiles.map((t) => [t.word, t.state]);

test("remaining objectives render normal and never glow just for being first", () => {
  const tiles = build({ activeWords: words("shore", "wave") });
  assert.deepEqual(shape(tiles), [["SHORE", "normal"], ["WAVE", "normal"]]);
});

test("an explicit tutorial recommendation is the only glowing tile", () => {
  const tiles = build({ activeWords: words("shore", "wave"), recommendedObjectiveId: "wave" });
  assert.deepEqual(shape(tiles), [["SHORE", "normal"], ["WAVE", "active"]]);
});

test("a real hint activates the word owning the revealed tile", () => {
  const tiles = build({ activeWords: words("shore", "wave"), hintedTileId: "wave-t0" });
  assert.equal(tiles.find((t) => t.word === "WAVE").state, "active");
  assert.equal(tiles.find((t) => t.word === "SHORE").state, "normal");
});

test("a tutorial recommendation outranks a stray hint", () => {
  const tiles = build({
    activeWords: words("shore", "wave"),
    recommendedObjectiveId: "shore",
    hintedTileId: "wave-t0",
  });
  assert.equal(tiles.find((t) => t.word === "SHORE").state, "active");
  assert.equal(tiles.filter((t) => t.state === "active").length, 1);
});

test("a found word turns gold and stays in its own slot", () => {
  const first = build({ activeWords: words("shore", "wave") });
  const afterSolvingShore = build({ activeWords: words("wave") }, first);
  assert.deepEqual(shape(afterSolvingShore), [["SHORE", "completed"], ["WAVE", "normal"]]);
});

test("an unsolved word never slides sideways when its neighbour is found", () => {
  const first = build({ activeWords: words("shore", "wave") });
  const after = build({ activeWords: words("shore") }, first);
  assert.equal(after[0].word, "SHORE", "the surviving word keeps its slot");
  assert.equal(after[1].state, "completed");
});

test("a new objective takes the gold slot once the found beat has been seen", () => {
  const first = build({ activeWords: words("shore", "wave") });
  const found = build({ activeWords: words("wave") }, first, 0);
  const refilled = build({ activeWords: words("wave", "tide") }, found, FOUND_HOLD_MS);
  assert.equal(refilled.length, 2, "the tray must not grow past its two wells");
  assert.deepEqual(shape(refilled).sort(), [["TIDE", "normal"], ["WAVE", "normal"]].sort());
});

test("solving a word shows gold even when the next word arrives in the same update", () => {
  // This is the normal case in play: a solve transforms the board and reveals the next
  // objective immediately, so without a hold the gold state would never be seen.
  const first = build({ activeWords: words("shore", "wave") });
  const sameTick = build({ activeWords: words("wave", "coral") }, first, 0);
  assert.deepEqual(shape(sameTick), [["SHORE", "completed"], ["WAVE", "normal"]]);
  assert.ok(!sameTick.some((t) => t.word === "CORAL"), "the arrival waits for the gold slot");

  const afterHold = build({ activeWords: words("wave", "coral") }, sameTick, FOUND_HOLD_MS);
  assert.deepEqual(shape(afterHold).sort(), [["CORAL", "normal"], ["WAVE", "normal"]].sort());
});

test("the tray reports when it needs waking to release a held slot", () => {
  const first = build({ activeWords: words("shore", "wave") });
  const held = build({ activeWords: words("wave", "coral") }, first, 0);
  assert.equal(nextObjectiveTrayWakeMs(held, { activeWords: words("wave", "coral") }, 0), FOUND_HOLD_MS);
  const settled = build({ activeWords: words("shore", "wave") });
  assert.equal(nextObjectiveTrayWakeMs(settled, { activeWords: words("shore", "wave") }, 0), null,
    "nothing waiting means no wake-up");
});

test("gold leftovers are cleared once nothing is left to find", () => {
  const first = build({ activeWords: words("shore", "wave") });
  const oneLeft = build({ activeWords: words("wave") }, first);
  assert.equal(oneLeft.filter((t) => t.state === "completed").length, 1);
  const boardDone = build({ activeWords: [] }, oneLeft);
  assert.deepEqual(boardDone, [], "an empty board leaves no stranded gold pills");
});

test("a found word does not glow, even if a stale recommendation still names it", () => {
  const first = build({ activeWords: words("shore", "wave") });
  const after = build({ activeWords: words("wave"), recommendedObjectiveId: "shore" }, first);
  assert.equal(after.find((t) => t.word === "SHORE").state, "completed");
  assert.equal(after.filter((t) => t.state === "active").length, 0);
});

test("single-objective and empty boards are handled", () => {
  assert.equal(build({ activeWords: words("shore") }).length, 1);
  assert.deepEqual(build({ activeWords: [] }), []);
});

test("tiles announce their state for assistive technology", () => {
  assert.equal(objectiveTileLabel({ id: "a", word: "SHORE", state: "normal" }), "SHORE, remaining");
  assert.equal(objectiveTileLabel({ id: "a", word: "SHORE", state: "active" }), "SHORE, current hint");
  assert.equal(objectiveTileLabel({ id: "a", word: "SHORE", state: "completed" }), "SHORE, found");
});

test("tray never carries power-up or badge information", () => {
  const first = build({ activeWords: words("shore", "wave") });
  const withGold = build({ activeWords: words("wave") }, first, 0);
  const allowed = new Set(["id", "state", "word", "foundAt"]);
  for (const tile of [...first, ...withGold]) {
    for (const key of Object.keys(tile)) {
      assert.ok(allowed.has(key), `unexpected field on an objective tile: ${key}`);
    }
  }
});
