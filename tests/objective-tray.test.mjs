import assert from "node:assert/strict";
import test from "node:test";
import { buildObjectiveTray, objectiveTileLabel } from "../game/v3/objective-tray-state.ts";

const words = (...ids) => ids.map((id) => ({ id, word: id.toUpperCase(), tileIds: [`${id}-t0`, `${id}-t1`] }));

test("remaining objectives render normal and never glow just for being first", () => {
  const tiles = buildObjectiveTray({ activeWords: words("shore", "wave"), completedWords: [] });
  assert.deepEqual(tiles.map((t) => t.state), ["normal", "normal"]);
});

test("an explicit tutorial recommendation is the only glowing tile", () => {
  const tiles = buildObjectiveTray({
    activeWords: words("shore", "wave"),
    completedWords: [],
    recommendedObjectiveId: "wave",
  });
  assert.deepEqual(tiles.map((t) => [t.word, t.state]), [["SHORE", "normal"], ["WAVE", "active"]]);
  assert.equal(tiles.filter((t) => t.state === "active").length, 1);
});

test("a real hint activates the word owning the revealed tile", () => {
  const tiles = buildObjectiveTray({
    activeWords: words("shore", "wave"),
    completedWords: [],
    hintedTileId: "wave-t0",
  });
  assert.equal(tiles.find((t) => t.word === "WAVE").state, "active");
  assert.equal(tiles.find((t) => t.word === "SHORE").state, "normal");
});

test("the latest found word stays visible while successors remain outstanding", () => {
  const tiles = buildObjectiveTray({
    activeWords: words("wave"),
    completedWords: ["SHORE"],
  });
  assert.deepEqual(tiles.map((t) => [t.word, t.state]), [["SHORE", "completed"], ["WAVE", "normal"]]);
});

test("only the most recent completion is kept, so the tray cannot grow unbounded", () => {
  const tiles = buildObjectiveTray({
    activeWords: words("reef"),
    completedWords: ["SHORE", "WAVE", "TIDE"],
  });
  assert.deepEqual(tiles.map((t) => t.word), ["TIDE", "REEF"]);
});

test("a stale recommendation for an already-found word does not glow", () => {
  const tiles = buildObjectiveTray({
    activeWords: words("wave"),
    completedWords: ["SHORE"],
    recommendedObjectiveId: "shore",
  });
  assert.equal(tiles.filter((t) => t.state === "active").length, 0);
});

test("a tutorial recommendation outranks a stray hint", () => {
  const tiles = buildObjectiveTray({
    activeWords: words("shore", "wave"),
    completedWords: [],
    recommendedObjectiveId: "shore",
    hintedTileId: "wave-t0",
  });
  assert.equal(tiles.find((t) => t.word === "SHORE").state, "active");
  assert.equal(tiles.filter((t) => t.state === "active").length, 1);
});

test("single-objective and empty boards are handled", () => {
  assert.equal(buildObjectiveTray({ activeWords: words("shore"), completedWords: [] }).length, 1);
  assert.deepEqual(buildObjectiveTray({ activeWords: [], completedWords: [] }), []);
});

test("tiles announce their state for assistive technology", () => {
  assert.equal(objectiveTileLabel({ id: "a", word: "SHORE", state: "normal" }), "SHORE, remaining");
  assert.equal(objectiveTileLabel({ id: "a", word: "SHORE", state: "active" }), "SHORE, current hint");
  assert.equal(objectiveTileLabel({ id: "a", word: "SHORE", state: "completed" }), "SHORE, completed");
});

test("tray never carries power-up or badge information", () => {
  const tiles = buildObjectiveTray({ activeWords: words("shore"), completedWords: [] });
  assert.deepEqual(Object.keys(tiles[0]).sort(), ["id", "state", "word"]);
});
