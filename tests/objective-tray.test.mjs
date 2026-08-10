import assert from "node:assert/strict";
import test from "node:test";
import { buildObjectiveTray, objectiveTileLabel } from "../game/v3/objective-tray-state.ts";

const words = (...ids) => ids.map((id) => ({ id, word: id.toUpperCase(), tileIds: [`${id}-t0`, `${id}-t1`] }));

test("remaining objectives render normal and never glow just for being first", () => {
  const tiles = buildObjectiveTray({ activeWords: words("shore", "wave") });
  assert.deepEqual(tiles.map((t) => t.state), ["normal", "normal"]);
});

test("an explicit tutorial recommendation is the only glowing tile", () => {
  const tiles = buildObjectiveTray({
    activeWords: words("shore", "wave"),
    recommendedObjectiveId: "wave",
  });
  assert.deepEqual(tiles.map((t) => [t.word, t.state]), [["SHORE", "normal"], ["WAVE", "active"]]);
  assert.equal(tiles.filter((t) => t.state === "active").length, 1);
});

test("a real hint activates the word owning the revealed tile", () => {
  const tiles = buildObjectiveTray({
    activeWords: words("shore", "wave"),
    hintedTileId: "wave-t0",
  });
  assert.equal(tiles.find((t) => t.word === "WAVE").state, "active");
  assert.equal(tiles.find((t) => t.word === "SHORE").state, "normal");
});

test("a found word drops out of the tray, leaving only what's outstanding", () => {
  const tiles = buildObjectiveTray({ activeWords: words("wave") });
  assert.deepEqual(tiles.map((t) => t.word), ["WAVE"]);
});

test("a tutorial recommendation outranks a stray hint", () => {
  const tiles = buildObjectiveTray({
    activeWords: words("shore", "wave"),
    recommendedObjectiveId: "shore",
    hintedTileId: "wave-t0",
  });
  assert.equal(tiles.find((t) => t.word === "SHORE").state, "active");
  assert.equal(tiles.filter((t) => t.state === "active").length, 1);
});

test("single-objective and empty boards are handled", () => {
  assert.equal(buildObjectiveTray({ activeWords: words("shore") }).length, 1);
  assert.deepEqual(buildObjectiveTray({ activeWords: [] }), []);
});

test("tiles announce their state for assistive technology", () => {
  assert.equal(objectiveTileLabel({ id: "a", word: "SHORE", state: "normal" }), "SHORE, remaining");
  assert.equal(objectiveTileLabel({ id: "a", word: "SHORE", state: "active" }), "SHORE, current hint");
});

test("tray never carries power-up or badge information", () => {
  const tiles = buildObjectiveTray({ activeWords: words("shore") });
  assert.deepEqual(Object.keys(tiles[0]).sort(), ["id", "state", "word"]);
});
