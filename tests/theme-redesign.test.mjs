import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { CHAPTER_THEMES, chapterThemeForLevel } from "../game/v3/chapter-theme.ts";

test("the first ten levels use five-level Coral and Forest chapters", () => {
  for (let level = 1; level <= 5; level += 1) {
    assert.equal(chapterThemeForLevel(level).id, "coral");
    assert.equal(chapterThemeForLevel(level).chapterTitle, "Coral Kingdom");
  }
  for (let level = 6; level <= 10; level += 1) {
    assert.equal(chapterThemeForLevel(level).id, "forest");
    assert.equal(chapterThemeForLevel(level).chapterTitle, "Forest Kingdom");
  }
});

test("every configured chapter occupies exactly five levels", () => {
  for (const theme of CHAPTER_THEMES) {
    assert.equal(theme.endLevel - theme.startLevel + 1, 5);
    assert.match(theme.chapterTitle, / Kingdom$/);
  }
});

test("the V3 gameplay rail hides mission UI and never couples powers to objectives", async () => {
  const [component, css] = await Promise.all([
    readFile(new URL("../app/v3/WordKingdomV3.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/v3/V3.module.css", import.meta.url), "utf8"),
  ]);

  const trayStart = component.indexOf("<ObjectiveTray");
  const objectiveRail = component.slice(trayStart, component.indexOf("/>", trayStart));
  assert.match(objectiveRail, /activeWords={activeWords}/);
  assert.doesNotMatch(objectiveRail, /BADGES|badgeByTile|readyActions|lockedWord|objectiveProgress/);
  assert.match(css, /\.boardShell \.objectiveBar[\s\S]*display: none!important/);
  assert.match(css, /\[class\*="cascadeTrack"\]/);
  assert.match(css, /\[class\*="activeRail"\]/);
  assert.match(component, /const POWER_ORDER: readonly BadgeType\[\] = \["shield", "attack", "steal", "raid"\]/);
});

test("responsive tiles separate their square hitbox, face, letter, and blue base", async () => {
  const [component, css] = await Promise.all([
    readFile(new URL("../app/v3/WordKingdomV3.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/v3/V3.module.css", import.meta.url), "utf8"),
  ]);
  assert.match(component, /styles\.tileFace/);
  assert.match(component, /styles\.tileLetter/);
  assert.match(css, /\.boldTile[\s\S]*aspect-ratio: 1/);
  assert.match(css, /\.tileFace[\s\S]*background: linear-gradient/);
  assert.match(css, /\.replacementLetterTile \.tileLetter/);
  assert.match(css, /touch-action: none!important/);
});
