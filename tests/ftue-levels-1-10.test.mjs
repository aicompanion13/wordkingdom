import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  acknowledgeLevelOneResults,
  beginLevelTwoAlbumGuide,
  beginLevelTwoAlbumReveal,
  beginOceanStickerReveal,
  completeFtueVisualStep,
  completeOceanStickerPack,
  continueToOceanPack,
  createFtueProgress,
  dismissOceanAlbumMessage,
  dismissOceanPackMessage,
  finishOceanReward,
  migrateFtueProgress,
  openOceanDiscoveryPack,
  parseFtueProgress,
  recordLevelOneCompletion,
  recordOceanLevelCompletion,
  revealNextOceanSticker,
  serializeFtueProgress,
  unseenAlbumPages,
  viewAlbumPage,
} from "../game/v3/golden-tutorial-state.ts";
import { OCEAN_ALBUM_STAGE_PLAN, oceanStickersForLevel } from "../game/v3/ftue-flow.ts";

const result = { score: 1200, combo: 1.5, correct: 8, attempts: 9, hints: 0, longestWord: "DOLPHIN", elapsedSeconds: 42, accuracy: 8 / 9, stars: 2, baseCoins: 150, eventCoins: 0, totalCoins: 188, bestCombo: 2, invalidSelections: 1 };

function openAndRevealPack(state) {
  let next = continueToOceanPack(state);
  next = dismissOceanPackMessage(next);
  next = beginOceanStickerReveal(openOceanDiscoveryPack(next));
  for (let index = 0; index < 3; index += 1) next = revealNextOceanSticker(next);
  return completeOceanStickerPack(next);
}

test("fresh FTUE exposes no Album or Ocean reward", () => {
  const state = createFtueProgress();
  assert.equal(state.version, 6);
  assert.equal(state.albumUnlocked, false);
  assert.equal(state.level1CompletionResult, null);
  assert.equal(state.oceanRewardPhase, null);
  assert.deepEqual(state.oceanCollectedStickers, []);
});

test("Level 1 records results only and continues directly to Level 2", () => {
  const recorded = recordLevelOneCompletion(createFtueProgress(), result);
  assert.deepEqual(recorded.level1CompletionResult, result);
  assert.equal(recorded.albumUnlocked, false);
  assert.deepEqual(recorded.oceanRewardedLevels, []);
  const acknowledged = acknowledgeLevelOneResults(recorded);
  assert.equal(acknowledged.level1CompletionResult, null);
  assert.equal(acknowledged.pendingMandatoryStep, null);
});

test("Levels 2–5 packs are deterministic, unique, and one-time", () => {
  let state = createFtueProgress();
  const all = [];
  for (const level of [2, 3, 4, 5]) {
    state = recordOceanLevelCompletion(state, level, result);
    const duplicate = recordOceanLevelCompletion(state, level, { ...result, score: 9999 });
    assert.deepEqual(duplicate, state);
    state = openAndRevealPack(state);
    all.push(...oceanStickersForLevel(level));
    if (level < 5 && level > 2) state = finishOceanReward(state);
    if (level === 2) state = viewAlbumPage(beginLevelTwoAlbumReveal(beginLevelTwoAlbumGuide(dismissOceanAlbumMessage(state))), 2);
  }
  assert.equal(new Set(all).size, 12);
  assert.equal(state.oceanCollectedStickers.length, 12);
  assert.equal(state.oceanRewardPhase, "KINGDOM_COMPLETE");
  assert.equal(state.grantedCredits.filter((id) => id.includes("discovery-pack")).length, 4);
});

test("Level 2 pack cannot open before its persistent message is dismissed", () => {
  const ready = continueToOceanPack(recordOceanLevelCompletion(createFtueProgress(), 2, result));
  assert.equal(openOceanDiscoveryPack(ready).oceanRewardPhase, "PACK_READY");
  const opened = openOceanDiscoveryPack(dismissOceanPackMessage(ready));
  assert.equal(opened.oceanRewardPhase, "STICKER_READY");
  assert.equal(beginOceanStickerReveal(opened).oceanRewardPhase, "STICKER_REVEAL");
});

test("Level 2 Album guide waits for the real Album action", () => {
  let state = openAndRevealPack(recordOceanLevelCompletion(createFtueProgress(), 2, result));
  assert.equal(state.oceanRewardPhase, "ALBUM_ACTIVATED");
  assert.equal(beginLevelTwoAlbumGuide(state).oceanRewardPhase, "ALBUM_ACTIVATED");
  state = beginLevelTwoAlbumGuide(dismissOceanAlbumMessage(state));
  assert.equal(state.pendingMandatoryStep, "OPEN_LEVEL_2_ALBUM");
  state = beginLevelTwoAlbumReveal(state);
  assert.equal(state.pendingMandatoryStep, "VIEW_LEVEL_2_ALBUM");
  state = viewAlbumPage(state, 2);
  assert.equal(state.oceanRewardPhase, null);
  assert.equal(state.pendingMandatoryStep, null);
  assert.ok(state.completedTutorials.includes("level-2-album"));
});

test("Ocean Kingdom remains incomplete through Level 4 and completes at Level 5", () => {
  assert.deepEqual(OCEAN_ALBUM_STAGE_PLAN.map((stage) => stage.completesKingdom), [false, false, false, true]);
  let state = createFtueProgress();
  for (const level of [2, 3, 4]) {
    state = openAndRevealPack(recordOceanLevelCompletion(state, level, result));
    if (level === 2) state = viewAlbumPage(beginLevelTwoAlbumReveal(beginLevelTwoAlbumGuide(dismissOceanAlbumMessage(state))), 2);
    else state = finishOceanReward(state);
    assert.ok(state.oceanCollectedStickers.length < 12);
  }
  state = openAndRevealPack(recordOceanLevelCompletion(state, 5, result));
  assert.equal(state.oceanCollectedStickers.length, 12);
  assert.equal(state.oceanRewardPhase, "KINGDOM_COMPLETE");
});

test("reload preserves an interrupted deterministic sticker reveal", () => {
  let state = beginOceanStickerReveal(openOceanDiscoveryPack(dismissOceanPackMessage(continueToOceanPack(recordOceanLevelCompletion(createFtueProgress(), 3, result)))));
  state = revealNextOceanSticker(revealNextOceanSticker(state));
  const restored = parseFtueProgress(serializeFtueProgress(state));
  assert.equal(restored.oceanRewardLevel, 3);
  assert.equal(restored.oceanStickerRevealCount, 2);
  assert.equal(restored.oceanRewardPhase, "STICKER_REVEAL");
});

test("version 5 accounts migrate without duplicating their Level 2 pack", () => {
  const versionFive = { ...createFtueProgress(), version: 5, level2RewardGranted: true, level2RewardPhase: "STICKER_REVEAL", level2StickerRevealCount: 2, level2CompletionResult: result };
  delete versionFive.oceanRewardLevel;
  delete versionFive.oceanRewardPhase;
  const migrated = parseFtueProgress(JSON.stringify(versionFive));
  assert.deepEqual(migrated.oceanRewardedLevels, [2]);
  assert.equal(migrated.oceanStickerRevealCount, 2);
  assert.equal(migrated.oceanRewardPhase, "STICKER_REVEAL");
});

test("version 5 accounts infer completed Ocean rewards without replay grants", () => {
  const versionFive = { ...createFtueProgress(), version: 5, level2RewardGranted: true, level2StickerRevealCount: 3 };
  const migrated = migrateFtueProgress(versionFive, createFtueProgress(), [1, 2, 3, 4]);
  assert.deepEqual(migrated.oceanRewardedLevels, [2, 3, 4]);
  assert.equal(migrated.oceanCollectedStickers.length, 9);
  assert.equal(migrated.albumUnlocked, true);
});

test("legacy completed Levels 1–4 migrate to an incomplete 9-of-12 Ocean Album", () => {
  const state = migrateFtueProgress({ version: 4 }, createFtueProgress(), [1, 2, 3, 4]);
  assert.equal(state.albumUnlocked, true);
  assert.equal(state.oceanCollectedStickers.length, 9);
  assert.equal(state.oceanRewardPhase, null);
});

test("visual beats remain idempotent", () => {
  const state = completeFtueVisualStep(completeFtueVisualStep(createFtueProgress(), "first-word-guidance"), "first-word-guidance");
  assert.deepEqual(state.completedVisualSteps, ["first-word-guidance"]);
});

test("coach messages are dismissible and block click-through", () => {
  const source = fs.readFileSync(path.resolve("app/v3/FtueCoachmarks.tsx"), "utf8");
  assert.match(source, /dismissLayer/);
  assert.match(source, /onDismiss/);
  assert.doesNotMatch(source, /setTimeout/);
});

test("Level 1-10 concept announcements use the reusable illustrated card and live CTAs", () => {
  const source = fs.readFileSync(path.resolve("app/v3/WordKingdomV3.tsx"), "utf8");
  for (const copy of [
    "Welcome to Word Kingdom",
    "Swipe to Spell",
    "Need a Hint?",
    "Your Album Is Open",
    "Raid the Royal Vault",
    "Shield Your Collection",
    "Launch an Attack",
    "Steal a Royal Card",
    "Forest Kingdom",
  ]) assert.match(source, new RegExp(copy.replace(/[?]/g, "\\?")), copy);
  for (const cta of ["LET'S GO!", "GOT IT", "SHOW ME", "START RAID", "CHOOSE A CARD", "STEAL A CARD", "CONTINUE"]) {
    assert.match(source, new RegExp(cta.replace(/[!?]/g, "\\$&")), cta);
  }
  const powerPrompt = source.slice(source.indexOf("function PowerTutorialPrompt"), source.indexOf("function Result"));
  assert.match(powerPrompt, /return <ConceptCard/);
  assert.doesNotMatch(powerPrompt, /role="status"/);
  assert.match(source, /data-pvp-primary-action/);
});

test("Level 1 completion contains no Pack, Album, currency, or kingdom completion UI and returns to the map", () => {
  const source = fs.readFileSync(path.resolve("app/v3/WordKingdomV3.tsx"), "utf8");
  const block = source.slice(source.indexOf("function LevelOneResults"), source.indexOf("function ConquestCompletePanel"));
  assert.doesNotMatch(block, /Pack|Album|Energy|Raid|Kingdom discovered/);
  assert.match(block, /RETURN TO OCEAN MAP/);
});

test("Levels 1–5 keep obstacle wrappers disabled and power badges state-gated", () => {
  const source = fs.readFileSync(path.resolve("app/v3/WordKingdomV3.tsx"), "utf8");
  assert.match(source, /const allowed = new Set\(visiblePowerKinds\(level\)\)/);
  assert.match(source, /const blocked = currentRunLevel > 5/);
  assert.doesNotMatch(source, /levelOneDiscoveryTracker/);
});

test("Album notifications derive from unseen Ocean pack pages", () => {
  const state = { ...createFtueProgress(), albumUnlocked: true, unlockedAlbumPages: [2, 3], viewedAlbumPages: [2] };
  assert.deepEqual(unseenAlbumPages(state), [3]);
});

test("Ocean Album is configured as one scene with 12 predefined sticker positions", () => {
  const config = JSON.parse(fs.readFileSync(path.resolve("game/v3/data/ocean_album.json"), "utf8"));
  assert.equal(config.title, "Ocean Kingdom");
  assert.equal(config.stickers.length, 12);
  assert.equal(new Set(config.stickers.map((slot) => slot.id)).size, 12);
});

test("active FTUE sources contain no mojibake replacement sequences", () => {
  for (const file of ["app/v3/WordKingdomV3.tsx", "app/v3/V3.module.css", "app/v3/FtueCoachmarks.tsx", "app/v3/FtueCoachmarks.module.css", "game/v3/ftue-flow.ts", "game/v3/golden-tutorial-state.ts"]) {
    const source = fs.readFileSync(path.resolve(file), "utf8");
    assert.doesNotMatch(source, /Ã|â|ð|�/, file);
  }
});


test("Ocean reward visuals use the transparent pack, scroll announcement, real Album finger, and staged transition", () => {
  const source = fs.readFileSync(path.resolve("app/v3/WordKingdomV3.tsx"), "utf8");
  const styles = fs.readFileSync(path.resolve("app/v3/V3.module.css"), "utf8");
  assert.match(source, /ocean-discovery-pack-v2\.png/);
  assert.doesNotMatch(source, /<i>OCEAN<\/i><b>STICKER PACK<\/b>/);
  assert.match(source, /title="New Ocean Stickers!"/);
  assert.match(source, /testId="level-2-album-gesture"/);
  assert.match(source, /targetRef=\{albumButtonRef\}/);
  assert.match(source, /destinationSwitchMs/);
  assert.match(source, /setAlbumPageLevel\(level\)[\s\S]*setAlbumTransition\(null\)/);
  assert.match(styles, /\.oceanDiscoveryPack/);
});
