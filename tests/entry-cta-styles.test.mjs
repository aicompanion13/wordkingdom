import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("entry and scroll announcement CTAs keep the approved presentation", async () => {
  const [screenCss, tutorialCss] = await Promise.all([
    readFile(new URL("../app/v3/V3.module.css", import.meta.url), "utf8"),
    readFile(new URL("../app/v3/TutorialCard.module.css", import.meta.url), "utf8"),
  ]);

  const enterStart = screenCss.indexOf(".loginIntroChrome button{");
  const enterEnd = screenCss.indexOf("}", enterStart);
  const enterRule = screenCss.slice(enterStart, enterEnd + 1);
  assert.match(enterRule, /#fff3bd/);
  assert.match(enterRule, /#d79a22/);
  assert.doesNotMatch(enterRule, /#5bd45a|#1f9b3f/);

  const ctaStart = tutorialCss.indexOf(".cta {");
  const ctaEnd = tutorialCss.indexOf("}", ctaStart);
  const ctaRule = tutorialCss.slice(ctaStart, ctaEnd + 1);
  assert.match(ctaRule, /background:\s*transparent/);
  assert.match(ctaRule, /border:\s*0/);
  assert.match(ctaRule, /box-shadow:\s*none/);
  assert.doesNotMatch(ctaRule, /url\(/);
});
