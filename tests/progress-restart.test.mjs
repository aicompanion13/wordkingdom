import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { createRestartedProgress } from "../game/v3/progress-reset.ts";
import {
  createFtueProgress,
  parseFtueProgress,
  serializeFtueProgress,
} from "../game/v3/golden-tutorial-state.ts";

async function readJson(path) {
  return JSON.parse(await readFile(resolve(process.cwd(), path), "utf8"));
}

test("restart progress survives an account save and browser reload", async () => {
  const defaultPlayer = await readJson("game/v3/data/default-player.json");
  const defaultPvp = await readJson("game/v3/data/pvp_state.json");
  const deviceSettings = { sfx: false, bgm: true, haptics: false };
  const resetAt = 1_800_000_000_000;

  const reset = createRestartedProgress(
    {
      ...defaultPlayer,
      currentLevel: 10,
      stars: 37,
      completedLevels: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      unlockedChapterIds: ["chapter_ocean", "chapter_forest"],
      claimedSetRewards: ["ocean_set_1"],
      claimedAlbumRewards: ["album_ocean"],
      cards: { ocean_01: 4 },
      vaultStars: 89,
      royalDictionary: ["TIDE", "WAVE"],
      recentWordsByArea: { "1": ["WAVE"], "2": ["MOSS"] },
      settings: deviceSettings,
    },
    {
      ...defaultPvp,
      activeShields: 3,
      shieldFragments: 2,
      pvpHistory: [{ actionType: "RAID" }],
      notificationOutbox: [{ id: "old-reward" }],
    },
    deviceSettings,
    resetAt,
  );

  // D1 and localStorage both serialize values before a browser reload.
  const accountAfterReload = JSON.parse(JSON.stringify(reset));
  const ftueAfterReload = parseFtueProgress(
    serializeFtueProgress(createFtueProgress()),
  );

  assert.equal(accountAfterReload.player.currentLevel, 1);
  assert.equal(accountAfterReload.player.stars, 0);
  assert.equal(accountAfterReload.player.vaultStars, 0);
  assert.equal(accountAfterReload.player.shields, 0);
  assert.equal(accountAfterReload.player.energyUpdatedAt, resetAt);
  assert.deepEqual(accountAfterReload.player.unlockedChapterIds, ["chapter_ocean"]);
  assert.deepEqual(accountAfterReload.player.completedLevels, []);
  assert.deepEqual(accountAfterReload.player.claimedSetRewards, []);
  assert.deepEqual(accountAfterReload.player.claimedAlbumRewards, []);
  assert.deepEqual(accountAfterReload.player.cards, {});
  assert.deepEqual(accountAfterReload.player.royalDictionary, []);
  assert.deepEqual(accountAfterReload.player.recentWordsByArea, { "1": [], "2": [] });
  assert.deepEqual(accountAfterReload.player.settings, deviceSettings);
  assert.equal(accountAfterReload.pvp.activeShields, 0);
  assert.equal(accountAfterReload.pvp.shieldFragments, 0);
  assert.deepEqual(accountAfterReload.pvp.pvpHistory, []);
  assert.deepEqual(accountAfterReload.pvp.notificationOutbox, []);
  assert.equal(accountAfterReload.pvp.ftueProgress.version, 6);
  assert.deepEqual(accountAfterReload.pvp.ftueProgress.unlockedAlbumPages, []);
  assert.equal(accountAfterReload.pvp.ftueProgress.level1CompletionResult, null);
  assert.equal(accountAfterReload.pvp.ftueProgress.oceanRewardPhase, null);
  assert.deepEqual(accountAfterReload.pvp.ftueProgress.oceanRewardedLevels, []);
  assert.deepEqual(accountAfterReload.pvp.ftueProgress.oceanCollectedStickers, []);
  assert.equal(accountAfterReload.pvp.ftueProgress.oceanStickerRevealCount, 0);
  assert.equal(accountAfterReload.pvp.ftueProgress.oceanCompletionResult, null);
  assert.deepEqual(ftueAfterReload, createFtueProgress());
});

test("settings require two confirmations with the requested warning", async () => {
  const source = await readFile(resolve(process.cwd(), "app/v3/WordKingdomV3.tsx"), "utf8");
  assert.match(
    source,
    /Restart from Level 1\? All game progress will be deleted\./,
  );
  assert.match(source, /setRestartStage\(1\)/);
  assert.match(source, /setRestartStage\(2\)/);
  assert.match(source, /YES, RESTART/);
});
