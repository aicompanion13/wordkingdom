# Codex Handoff — Level Complete panel, text-free, plus reward chest

## CRITICAL: canonical branch, route, and shared-agent workflow

This rule applies to every Claude task, Codex task, handoff, prompt, implementation plan, and release:

- Work on **Word Kingdom `/v3` only** unless the owner explicitly requests another version.
- The production Worker is **`wordkingdom-prod`** and the canonical player URL is **https://wordkingdom-prod.inspectorkush1.workers.dev/v3**.
- The shared repository is `aicompanion13/wordkingdom`; the shared deployment branch is **`claude/game-access-5fn1b6`**.
- Codex and Claude share this branch. Before every edit, inspect the latest remote head and reconcile the other agent's work.
- Never force-push, reset away, or silently overwrite newer collaborator commits. Push only a reconciled fast-forward update.
- After validation, commit and push the complete intended change so both agents use the same canonical source, then confirm the `wordkingdom-prod` `/v3` deployment.
- Every handoff or generated prompt must repeat this critical routing note.
- If these requirements cannot be followed, stop and report the blocker before editing or publishing.

---

## What this is

The Level Complete panel you sent is the right design. Three things need changing before it
can be used, and there is one new asset to add.

The composition, palette, crown, star row, stat boxes, reward strip and green button should
all carry over unchanged. This is a re-export, not a redesign.

## Change 1 — remove every baked word

The delivered panel has `LEVEL COMPLETE!`, `SCORE`, `TIME`, `ACCURACY`, `LONGEST WORD`,
`HINTS` and `LEVEL REWARD` painted into the texture. All of it must come out; the game
renders text at runtime.

**Keep the shapes the text sits on.** The blue title banner, the coloured label chips (blue
`SCORE`, blue `TIME`, green `ACCURACY`, purple `LONGEST WORD`, red `HINTS`), the blue
`LEVEL REWARD` ribbon and the cream value boxes are all good design — deliver them empty.

This also buys something useful: with the title as a runtime layer, one panel serves both
the win and the "objective not met" cases instead of needing two.

## Change 2 — all three stars empty

The panel currently has the first star painted gold and the other two empty, which locks it
to a one-star result. **Deliver all three sockets empty.** The game lights them using the
three-gold-star asset you already supplied, which is exactly right and needs no change.

## Change 3 — the middle reward icon becomes a hint, not energy

The reward strip has three slots: coin, lightning bolt, card. The rewards are actually
**coins, hints and cards** — energy is not a scarce resource in this game (the cap is 50, a
level costs 1, and it regenerates 72 a day, so a player cannot run out). Hints are the
thing players genuinely run short of.

Replace the lightning bolt with a **hint icon in the same style** — the game already uses a
lightbulb for hints, so a royal lightbulb or a glowing gem-lamp would sit naturally beside
the crown coin and the card. Keep the coin and the card exactly as they are, and keep the
three pale cell backgrounds (cream, blue, purple).

## New asset — the reward chest

Levels 1 to 3 of each chapter show their rewards in the strip. Levels 4 and 5 — the Hard
and Boss levels — additionally open a **chest**, because those are the ones that grant real
randomised card packs and deserve a moment.

Deliver:

- **Chest closed** — sitting, latched, inviting a tap. Give it a subtle glow so it reads as
  interactive.
- **Chest open** — lid back, light pouring out, empty enough inside that the game can
  animate the actual cards and coins out of it. **Do not paint rewards inside the chest**;
  the contents are randomised at runtime.

Square canvases, both states the same size and the same footprint, so the swap does not
shift the chest on screen.

---

## Theme and palette

Unchanged. Match the assets already live in the game — `public/tutorial/royal-ribbon-popup.webp`,
`public/objective-tray/tray-frame-v2.webp`, `public/topbar/word-kingdom-topbar-v2.webp`.

| Role | Value |
|---|---|
| Royal blue, deepest | `#061845` |
| Royal blue, deep | `#0b2867` |
| Royal blue, mid | `#124a98` |
| Royal blue, bright | `#247ac0` |
| Cream, lightest | `#fffdf0` |
| Cream, deep | `#efd28b` |
| Gold, warm gradient | `#ffe28a` → `#d79a22` |
| Gold, deep | `#9b541d` |

## Size

The delivered panel is 866×1815, an aspect of 0.477. That fits, but only just — on a 320×700
phone it renders 288×604 with 56px to spare. **Do not make it any taller.** Aspect 0.48 or
wider is safe; a little wider would be welcome. If removing the baked text frees vertical
space, spend it on shortening the panel rather than enlarging the boxes.

## Asset rules

Every one of these has cost us a round already.

1. **Real alpha**, verified by compositing over magenta `#ff00ff` before sending.
2. **Fully opaque edges.** Trimming to the alpha bounding box is not enough — a previous
   asset left edge columns at alpha 31 and 64, which composite as background and showed as
   a visible sliver of sky down each side of the top bar in the live game.
3. **No embedded text anywhere**, including inside the chest or on the button.
4. Consistent top-left key light, matching the existing assets.
5. PNG is fine; we convert to WebP on integration.

## What to send back

The flat assets, plus one mock at 390px wide showing the panel with placeholder numbers in
the boxes, three stars lit, and the three reward slots filled — so the fit can be judged at
true phone size. Do not modify game code; Claude will integrate.
