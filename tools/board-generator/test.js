import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { applyTransmuteMap } from "./grid.js";
import { generateLevel } from "./generator.js";
import { verifyLevel, VerificationError } from "./verifier.js";

const configUrl = new URL("./gen_config.json", import.meta.url);
const dictionaryUrl = new URL("./data/wordlist.txt", import.meta.url);

async function loadFixtures() {
  const config = JSON.parse(await readFile(configUrl, "utf8"));
  const dictionary = (await readFile(dictionaryUrl, "utf8"))
    .split(/\r?\n/)
    .filter(Boolean);
  return { config, dictionary };
}

test("transmutation changes only mapped cells and never moves tiles", () => {
  const grid = [
    ["A", "B", "C"],
    ["D", "E", "F"],
  ];
  const result = applyTransmuteMap(grid, [
    { cell: [0, 1], letter: "X" },
    { cell: [1, 2], letter: "Y" },
  ]);

  assert.deepEqual(result, [
    ["A", "X", "C"],
    ["D", "E", "Y"],
  ]);
  assert.deepEqual(grid, [
    ["A", "B", "C"],
    ["D", "E", "F"],
  ]);
});

test("same config and seed produce byte-identical verified output", async () => {
  const { config, dictionary } = await loadFixtures();
  const first = generateLevel(config, dictionary);
  const second = generateLevel(config, dictionary);

  assert.equal(first.serialized, second.serialized);
  assert.equal("refillQueues" in first.level, false);
  assert.equal(first.level.obstacles.length, config.obstacleConfig.count);
  const result = verifyLevel(first.level);
  assert.equal(result.allStagesVerified, true);
  assert.equal(result.solveOrderIndependent, true);
  assert.equal(result.stagesVerified, 4);
  assert.equal(result.postTransmuteStatesVerified, 12);
});

test("verification rejects overlapping active words", async () => {
  const { config, dictionary } = await loadFixtures();
  const { level } = generateLevel(config, dictionary);
  const broken = structuredClone(level);
  broken.stages[0].activeWords[1].path =
    broken.stages[0].activeWords[0].path.map((coordinate) => [...coordinate]);

  assert.throws(() => verifyLevel(broken), VerificationError);
});
