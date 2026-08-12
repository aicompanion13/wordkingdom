import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/*
 * The announcement shell is now the Royal Ribbon popup rather than the scroll. The
 * filename is kept so the shared branch sees an edit rather than a rename, but the
 * intent of every assertion below is unchanged: one shared art frame, all copy
 * rendered at runtime, and nothing baked into the texture.
 */
test("all ConceptCard announcements use the single Royal Ribbon popup", async () => {
  const [component, styles, v3Styles] = await Promise.all([
    readFile(new URL("../app/v3/FtueCoachmarks.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/v3/TutorialCard.module.css", import.meta.url), "utf8"),
    readFile(new URL("../app/v3/V3.module.css", import.meta.url), "utf8"),
  ]);

  // One shared frame, and none of the shells it replaced.
  assert.match(component, /royal-ribbon-popup\.webp/);
  assert.doesNotMatch(component, /announcement-scroll-v2\.png/);
  assert.doesNotMatch(component, /progression-card-frame\.png/);
  assert.doesNotMatch(component, /tutorialStyles\.illustration/);

  // Geometry is anchored to the artwork's real proportions.
  assert.match(styles, /aspect-ratio:\s*1011\s*\/\s*1181/);
  assert.match(styles, /\.title[\s\S]*top:\s*36\.5%/);
  assert.match(styles, /\.body[\s\S]*top:\s*65%/);
  assert.match(styles, /\.cta[\s\S]*top:\s*89\.7%/);

  // Flat colour on the ribbon — no gradient-clipped text.
  assert.doesNotMatch(styles, /\.title[\s\S]*background-clip/);

  /*
   * The green pill belongs to the artwork, so the button must stay transparent and
   * supply only the label and hit area.
   */
  assert.match(styles, /\.cta[\s\S]*background:\s*transparent/);
  assert.match(styles, /\.cta[\s\S]*border:\s*0/);
  assert.doesNotMatch(styles, /\.cta[\s\S]*url\(/);

  // The global /v3 button font must not win over the display face on this CTA.
  assert.match(v3Styles, /\.v3Shell button[\s\S]*font-family:\s*var\(--game-ui\)/);
  assert.match(styles, /\.cta[\s\S]*font-family:[^;]*var\(--game-display[^;]*!important/);

  /*
   * Word Kingdom Royal ships 400 and 700 only. Asking for a heavier cut renders as
   * browser-synthesised bold, which is what made an earlier CTA look wrong, so the
   * weight here must stay at a real one.
   */
  assert.match(styles, /\.cta[\s\S]*font-weight:\s*700\s*!important/);
  assert.doesNotMatch(styles, /font-weight:\s*(800|900|1000)\s*!important/);

  // A comfortable touch target even though the illustrated pill is small.
  assert.match(styles, /\.cta[\s\S]*min-height:\s*44px/);
});
