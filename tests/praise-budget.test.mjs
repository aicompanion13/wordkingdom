import assert from "node:assert/strict";
import test from "node:test";
import {
  considerCelebration,
  createPraiseBudget,
  isPraiseBanner,
  MAX_PRAISE_BANNERS_PER_BOARD,
} from "../game/v3/praise-budget.ts";

/** Plays a run of banners, spacing each on its own solve unless told otherwise. */
function play(kinds, { budget = createPraiseBudget(), startSolve = 1, sameSolve = false } = {}) {
  const shown = [];
  let solve = startSolve;
  for (const kind of kinds) {
    const verdict = considerCelebration(kind, budget, solve);
    budget = verdict.budget;
    if (verdict.show) shown.push(kind);
    if (!sameSolve) solve += 1;
  }
  return { shown, budget };
}

test("no more than three praise banners show on one board", () => {
  const { shown } = play(["royal-combo", "keep-going", "great-word", "great-word", "keep-going", "on-fire"]);
  assert.equal(shown.length, MAX_PRAISE_BANNERS_PER_BOARD);
  assert.deepEqual(shown, ["royal-combo", "keep-going", "great-word"]);
});

test("routine praise cannot starve the board of its combo milestone", () => {
  // A long-word streak early on must still leave room for "On fire!".
  const { budget, shown } = play(["great-word", "great-word", "great-word", "great-word", "great-word"]);
  assert.equal(shown.length, 2, "routine praise is capped at two of the three slots");
  assert.equal(budget.routineShown, 2);

  const milestone = considerCelebration("on-fire", budget, 20);
  assert.equal(milestone.show, true, "the reserved slot belongs to the milestone");
  assert.equal(milestone.budget.shown, MAX_PRAISE_BANNERS_PER_BOARD);
});

test("the reserved milestone slot never pushes the board past three banners", () => {
  // Two routine banners (keep-going is exempt from the consecutive rule) fill the
  // routine allowance, then the milestone takes the third and last slot.
  const { budget, shown } = play(["great-word", "keep-going"]);
  assert.equal(shown.length, 2);

  const onFire = considerCelebration("on-fire", budget, 30);
  assert.equal(onFire.show, true);
  assert.equal(onFire.budget.shown, MAX_PRAISE_BANNERS_PER_BOARD);

  // Everything after the cap stays quiet, milestone or not.
  assert.equal(considerCelebration("royal-combo", onFire.budget, 31).show, false);
  assert.equal(considerCelebration("keep-going", onFire.budget, 32).show, false);
  assert.equal(considerCelebration("great-word", onFire.budget, 33).show, false);
});

test("a fresh budget resets the allowance for a new level or replay", () => {
  const { budget } = play(["great-word", "keep-going", "on-fire", "royal-combo"]);
  assert.equal(budget.shown, MAX_PRAISE_BANNERS_PER_BOARD);

  const replay = play(["great-word"], { budget: createPraiseBudget() });
  assert.deepEqual(replay.shown, ["great-word"]);
});

test("informational banners are exempt and never consume the allowance", () => {
  let budget = createPraiseBudget();
  for (const kind of ["one-more", "bonus-found", "one-more", "bonus-found"]) {
    const verdict = considerCelebration(kind, budget, 1);
    assert.equal(verdict.show, true, `${kind} should always show`);
    budget = verdict.budget;
  }
  assert.equal(budget.shown, 0);

  // The full praise allowance is still intact afterwards.
  assert.equal(play(["great-word", "keep-going", "on-fire"], { budget }).shown.length, 3);
});

test("exempt banners still show after the praise budget is spent", () => {
  const { budget } = play(["great-word", "keep-going", "on-fire"]);
  assert.equal(considerCelebration("great-word", budget, 9).show, false);
  assert.equal(considerCelebration("one-more", budget, 9).show, true);
  assert.equal(considerCelebration("bonus-found", budget, 9).show, true);
});

test("great word does not fire on two consecutive solves", () => {
  let budget = createPraiseBudget();
  const first = considerCelebration("great-word", budget, 1);
  budget = first.budget;
  assert.equal(first.show, true);

  const backToBack = considerCelebration("great-word", budget, 2);
  assert.equal(backToBack.show, false, "consecutive solve should stay quiet");
  assert.equal(backToBack.budget.shown, 1, "a suppressed banner must not spend budget");

  const spaced = considerCelebration("great-word", backToBack.budget, 3);
  assert.equal(spaced.show, true);
});

test("combo milestones still speak on a solve right after praise", () => {
  const first = considerCelebration("great-word", createPraiseBudget(), 1);
  assert.equal(considerCelebration("on-fire", first.budget, 2).show, true);
  assert.equal(considerCelebration("royal-combo", first.budget, 2).show, true);
});

test("only the four praise banners are rationed", () => {
  for (const kind of ["great-word", "royal-combo", "on-fire", "keep-going"]) {
    assert.equal(isPraiseBanner(kind), true, `${kind} should be praise`);
  }
  for (const kind of ["one-more", "bonus-found"]) {
    assert.equal(isPraiseBanner(kind), false, `${kind} should be exempt`);
  }
});

test("a suppressed banner leaves the budget untouched so nothing is silently burned", () => {
  const spent = play(["great-word", "keep-going", "on-fire"]).budget;
  const before = { ...spent };
  const verdict = considerCelebration("keep-going", spent, 12);
  assert.equal(verdict.show, false);
  assert.deepEqual(verdict.budget, before);
});
