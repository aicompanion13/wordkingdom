import assert from "node:assert/strict";
import test from "node:test";
import { CLEAN_WORLD_MAP_LAYOUTS } from "../game/v3/clean-world-map-layouts.ts";

for (const [id, map] of Object.entries(CLEAN_WORLD_MAP_LAYOUTS)) {
  test(`${id} has exactly five safe, distinct level hotspots`, () => {
    assert.equal(map.levels.length, 5);
    assert.equal(Object.keys(map.levelHotspots).length, 5);
    const points = map.levels.map((level) => map.levelHotspots[level]);
    assert.equal(new Set(points.map(({ x, y }) => `${x}:${y}`)).size, 5);
    points.forEach(({ x, y }) => {
      assert.ok(x >= 15 && x <= 85, `${id} x ${x} is unsafe`);
      assert.ok(y >= 20 && y <= 85, `${id} y ${y} is unsafe`);
    });
  });

  test(`${id} progresses upward from first to fifth level`, () => {
    const y = map.levels.map((level) => map.levelHotspots[level].y);
    for (let index = 1; index < y.length; index += 1) assert.ok(y[index] < y[index - 1]);
  });

  test(`${id} has valid intrinsic dimensions and auxiliary controls`, () => {
    assert.ok(map.intrinsicWidth > 0 && map.intrinsicHeight > 0);
    [map.album, map.raidChest, map.gate].forEach(({ x, y }) => {
      assert.ok(x >= 0 && x <= 100);
      assert.ok(y >= 0 && y <= 100);
    });
  });
}
