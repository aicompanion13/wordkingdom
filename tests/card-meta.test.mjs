import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { BadgeManager } from "../game/v3/badge-manager.ts";
import { PvpManager } from "../game/v3/pvp-manager.ts";
import { createRestartedProgress } from "../game/v3/progress-reset.ts";
import { createLevelBriefing } from "../game/v3/level-briefing.ts";

async function json(path) {
  return JSON.parse(await readFile(resolve(process.cwd(), path.replace(/^\.\.\//, "")), "utf8"));
}

test("three badges convert once and progress/actions survive serialization", () => {
  const badges = new BadgeManager({ raid: 2 }, { attack: 1 });
  const result = badges.collect({ badges: [{ type: "raid", tileId: "tile-1" }] });
  assert.equal(result.counts.raid, 0);
  assert.equal(result.readyActions.raid, 1);
  assert.equal(result.readyActions.attack, 1);
  assert.deepEqual(result.createdActions, ["raid"]);
  assert.deepEqual(JSON.parse(JSON.stringify(result.readyActions)), result.readyActions);
});

test("Attack damages a chosen card and a card Shield blocks exactly once", async () => {
  const state = await json("../game/v3/data/pvp_state.json");
  state.readyActions.attack = 2;
  const manager = new PvpManager(state, 9);
  const target = manager.firstOpponent();
  const shielded = target.cards.find((card) => card.shielded);
  const open = target.cards.find((card) => !card.shielded);
  const blocked = manager.attackCard(target.playerId, shielded.cardId);
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.card.damaged, false);
  assert.equal(manager.snapshot().matchmakingQueue[0].cards.find((card) => card.cardId === shielded.cardId).shielded, false);
  const damaged = manager.attackCard(target.playerId, open.cardId);
  assert.equal(damaged.damaged, true);
  assert.equal(damaged.card.damaged, true);
});

test("Steal transfers only eligible NPC cards and consumes a blocking Shield", async () => {
  const state = await json("../game/v3/data/pvp_state.json");
  state.readyActions.steal = 2;
  state.matchmakingQueue[0].cards.forEach((card) => { card.shielded = false; });
  const manager = new PvpManager(state, 4);
  const first = manager.stealRandomCard(state.matchmakingQueue[0].playerId);
  assert.ok(first.card);
  assert.equal(first.blocked, false);
  assert.equal(first.card.protectedTutorial, false);
  assert.equal(first.card.completedCollection, false);
  assert.equal(manager.snapshot().matchmakingQueue[0].cards.find((card) => card.cardId === first.card.cardId).stolen, true);

  const remaining = manager.snapshot().matchmakingQueue[0].cards.find((card) => !card.stolen && !card.protectedTutorial && !card.completedCollection);
  remaining.shielded = true;
  const blockedState = manager.snapshot();
  blockedState.matchmakingQueue[0].cards.find((card) => card.cardId === remaining.cardId).shielded = true;
  const blockedManager = new PvpManager(blockedState, 4);
  const blocked = blockedManager.stealRandomCard(blockedState.matchmakingQueue[0].playerId);
  assert.equal(blocked.blocked, true);
  assert.equal(blockedManager.snapshot().matchmakingQueue[0].cards.find((card) => card.cardId === blocked.card.cardId).shielded, false);
});

test("Steal falls back to another NPC, consumes only on resolution, and survives reload", async () => {
  const state = await json("../game/v3/data/pvp_state.json");
  state.readyActions.steal = 1;
  state.matchmakingQueue.forEach((rival) => rival.cards.forEach((card) => { card.stolen = true; }));
  const eligible = state.matchmakingQueue[1].cards[1];
  eligible.stolen = false;
  eligible.protectedTutorial = false;
  eligible.completedCollection = false;
  eligible.shielded = true;

  const manager = new PvpManager(state, 17);
  const pending = manager.beginStealSession(state.matchmakingQueue[0].playerId);
  assert.ok(pending);
  assert.equal(pending.targetId, state.matchmakingQueue[1].playerId);
  assert.equal(manager.snapshot().readyActions.steal, 1, "Use Later must not consume the action");

  const reloaded = new PvpManager(JSON.parse(JSON.stringify(manager.snapshot())), 17);
  assert.equal(reloaded.pendingStealSession().id, pending.id);
  const resolved = reloaded.resolveStealSession(pending.id);
  assert.equal(resolved.result.blocked, true);
  assert.equal(resolved.result.card.cardId, eligible.cardId);
  assert.equal(reloaded.snapshot().readyActions.steal, 0);
  assert.equal(reloaded.snapshot().matchmakingQueue[1].cards.find((card) => card.cardId === eligible.cardId).shielded, false);

  const duplicate = reloaded.resolveStealSession(pending.id);
  assert.deepEqual(duplicate.result, resolved.result);
  assert.equal(reloaded.snapshot().readyActions.steal, 0);
  assert.equal(reloaded.snapshot().pvpHistory.filter((entry) => entry.actionType === "STEAL").length, 1);
});

test("Steal no-card fallback preserves the action and duplicate rewards are impossible", async () => {
  const state = await json("../game/v3/data/pvp_state.json");
  state.readyActions.steal = 1;
  state.matchmakingQueue.forEach((rival) => rival.cards.forEach((card) => { card.stolen = true; }));
  const emptyManager = new PvpManager(state, 3);
  assert.equal(emptyManager.beginStealSession(), null);
  assert.equal(emptyManager.snapshot().readyActions.steal, 1);

  const playable = await json("../game/v3/data/pvp_state.json");
  playable.readyActions.steal = 1;
  playable.matchmakingQueue.forEach((rival) => rival.cards.forEach((card) => { card.shielded = false; }));
  const manager = new PvpManager(playable, 8);
  const pending = manager.beginStealSession();
  const resolved = manager.resolveStealSession(pending.id);
  assert.equal(resolved.result.blocked, false);
  assert.equal(manager.claimStealReward(pending.id), true);
  assert.equal(manager.claimStealReward(pending.id), false);
  assert.equal(manager.snapshot().readyActions.steal, 0);
});

test("owned-card Shield blocks one incoming action, then is gone", async () => {
  const state = await json("../game/v3/data/pvp_state.json");
  state.readyActions.shield = 1;
  const manager = new PvpManager(state, 1);
  manager.protectCard("ocean_01");
  assert.equal(manager.simulateIncomingCardAction("ocean_01").blocked, true);
  const second = manager.simulateIncomingCardAction("ocean_01");
  assert.equal(second.blocked, false);
  assert.ok(manager.snapshot().damagedCardIds.includes("ocean_01"));
});

test("Raid fixes nine boxes before play, allows three picks, and always pays", async () => {
  const state = await json("../game/v3/data/pvp_state.json");
  state.readyActions.raid = 1;
  const manager = new PvpManager(state, 77);
  let raid = manager.createRaid();
  assert.equal(raid.chests.length, 9);
  assert.equal(raid.chests.filter((chest) => chest.tier === "jackpot").length, 1);
  const lockedContents = JSON.stringify(raid.chests);
  for (const chest of raid.chests.slice(0, 3)) raid = manager.pickRaid(raid, chest.id);
  assert.equal(raid.complete, true);
  assert.equal(raid.pickedIds.length, 3);
  assert.ok(raid.coinsWon > 0);
  assert.equal(JSON.stringify(raid.chests), lockedContents);
});

test("tutorials unlock in order once and reset clears all meta progress", async () => {
  const defaultPlayer = await json("../game/v3/data/default-player.json");
  const defaultPvp = await json("../game/v3/data/pvp_state.json");
  const manager = new PvpManager(defaultPvp, 2);
  assert.equal(manager.pendingTutorial(1), null);
  assert.equal(manager.pendingTutorial(3), "raid");
  assert.equal(manager.pendingTutorial(5), null);
  assert.equal(manager.pendingTutorial(6), "shield");
  assert.equal(manager.pendingTutorial(7), "attack");
  assert.equal(manager.pendingTutorial(8), "steal");
  assert.equal(manager.pendingTutorial(9), null);
  assert.equal(manager.pendingTutorial(10), null);
  defaultPvp.badgeProgress = { attack: 2, steal: 1, shield: 2, raid: 2 };
  defaultPvp.readyActions = { attack: 3, steal: 2, shield: 1, raid: 4 };
  defaultPvp.protectedCardIds = ["ocean_01"];
  defaultPvp.damagedCardIds = ["ocean_02"];
  defaultPvp.tutorialsCompleted = ["album", "attack"];
  const reset = createRestartedProgress(defaultPlayer, defaultPvp, defaultPlayer.settings);
  assert.deepEqual(reset.pvp.badgeProgress, { attack: 0, steal: 0, shield: 0, raid: 0 });
  assert.deepEqual(reset.pvp.readyActions, { attack: 0, steal: 0, shield: 0, raid: 0 });
  assert.deepEqual(reset.pvp.protectedCardIds, []);
  assert.deepEqual(reset.pvp.damagedCardIds, []);
  assert.deepEqual(reset.pvp.tutorialsCompleted, []);
  assert.deepEqual(reset.pvp.levelBriefingsAcknowledged, []);
  assert.equal(reset.pvp.pendingSteal, null);
  assert.equal(reset.pvp.ftueProgress.albumUnlocked, false);
});

test("legacy level briefing data reveals no hidden word information", async () => {
  const state = await json("../game/v3/data/pvp_state.json");
  const manager = new PvpManager(state, 1);
  assert.equal(manager.isLevelBriefingAcknowledged(4), false);
  manager.acknowledgeLevelBriefing(4);
  const reloaded = new PvpManager(JSON.parse(JSON.stringify(manager.snapshot())), 1);
  assert.equal(reloaded.isLevelBriefingAcknowledged(4), true);

  const node = {
    level: 4,
    chapterId: "chapter_ocean",
    areaId: 1,
    kind: "HARD",
    title: "Across the Lagoon",
    objective: { kind: "WORDS", target: 8, label: "Complete 8 planned word flips" },
    reward: { coins: 900, pack: "BLUE" },
  };
  const area = { areaId: 1, displayName: "Coral Kingdom", icon: "🐚" };
  const briefing = createLevelBriefing(node, area);
  assert.equal(briefing.newMechanic, "Steal");
  const visibleCopy = JSON.stringify(briefing).toLowerCase();
  assert.doesNotMatch(visibleCopy, /bonus word|transformation|power-up word|contains a|hidden word/);
  assert.doesNotMatch(visibleCopy, /raid/, "Level 4 must not explain Raid before it unlocks");
});

test("Objective tray does not render badge icons or reveal reward-bearing words", async () => {
  // The tray owns objective presentation; it must never surface power-up information.
  const tray = await readFile(resolve(process.cwd(), "app/v3/ObjectiveTray.tsx"), "utf8");
  assert.ok(tray.length > 0);
  assert.doesNotMatch(tray, /word\.badges|data-badge|BADGES\[/);

  const model = await readFile(resolve(process.cwd(), "game/v3/objective-tray-state.ts"), "utf8");
  assert.doesNotMatch(model, /badges|BADGES\[/);

  // The call site must not pass badge data into the tray either.
  const source = await readFile(resolve(process.cwd(), "app/v3/WordKingdomV3.tsx"), "utf8");
  const trayStart = source.indexOf("<ObjectiveTray");
  const trayEnd = source.indexOf("/>", trayStart);
  const usage = source.slice(trayStart, trayEnd);
  assert.ok(usage.length > 0);
  assert.doesNotMatch(usage, /word\.badges|data-badge|BADGES\[/);
});

test("Steal and briefing controls expose the guarded actions required by the UI flow", async () => {
  const source = await readFile(resolve(process.cwd(), "app/v3/WordKingdomV3.tsx"), "utf8");
  assert.match(source, /STEAL A CARD/);
  assert.match(source, /USE LATER/);
  assert.match(source, /Steal Blocked\./);
  assert.doesNotMatch(source, /I Understand — Start Level/);
  assert.doesNotMatch(source, /LevelBriefingModal/);
  assert.match(source, /How to Play/);
});
