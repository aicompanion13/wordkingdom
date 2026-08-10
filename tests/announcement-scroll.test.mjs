import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("all ConceptCard announcements use the single transparent royal scroll", async () => {
  const [component, styles, v3Styles] = await Promise.all([
    readFile(new URL("../app/v3/FtueCoachmarks.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/v3/TutorialCard.module.css", import.meta.url), "utf8"),
    readFile(new URL("../app/v3/V3.module.css", import.meta.url), "utf8"),
  ]);

  assert.match(component, /announcement-scroll-v2\.png/);
  assert.doesNotMatch(component, /progression-card-frame\.png/);
  assert.doesNotMatch(component, /tutorialStyles\.illustration/);
  assert.match(styles, /aspect-ratio:\s*1108\s*\/\s*1420/);
  assert.match(styles, /\.copy[\s\S]*top:\s*27%/);
  assert.match(styles, /\.title[\s\S]*color:\s*#173f73/);
  assert.doesNotMatch(styles, /\.title[\s\S]*background-clip/);
  assert.match(styles, /\.actions[\s\S]*bottom:\s*6\.2%/);
  assert.match(styles, /\.cta[\s\S]*min-height:\s*0/);
  assert.match(styles, /\.cta[\s\S]*font-family:[^;]*var\(--game-display[^;]*!important/);
  assert.match(styles, /\.cta[\s\S]*font-size:\s*clamp\(20px[^;]*!important/);
  assert.match(styles, /\.cta[\s\S]*font-weight:\s*1000\s*!important/);
  assert.match(styles, /\.cta[\s\S]*background:\s*transparent/);
  assert.match(v3Styles, /\.v3Shell button[\s\S]*font-family:\s*var\(--game-ui\)/);
});
