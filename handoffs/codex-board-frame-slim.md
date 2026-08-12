# Codex Handoff — Slim Crown Jewel board frame (creative only)

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

## Why this is a re-draw

The Crown Jewel board frame you delivered was built and tested on device. It looks
excellent, but it cannot ship: **its border is 12.6% of its own width**, so the tile grid
had to shrink by about 20% to fit inside it. Letter tiles are the only touch target in the
game, and they were already at the edge of what is comfortable — the frame would have taken
them to 34px, well under the 44px minimum that both Apple and Google publish.

Nine-slicing was tried as a way out. It does not work here: the crest and corner jewels are
158px of a 1254px image, so rendering them at a thin border crushes them into unreadable
slivers.

So the frame needs re-drawing to a hard size budget. Everything else about the design —
palette, gold rail, gem accents, crest — is right and should carry over.

---

## The hard constraint

**The inner opening must be at least 92% of the frame's width.** The rail may be at most
4% per side.

For reference, the frame renders 384px wide on a 390px phone. Here is what the rail
thickness costs in tile size:

| Rail per side | Rail % | Inner opening | Tile size | |
|---|---|---|---|---|
| 8px | 2.1% | 95.8% | 43.8px | tiles unchanged from today |
| 12px | 3.1% | 93.8% | 42.8px | comfortable |
| **15px** | **3.9%** | **92.2%** | **42.0px** | **target — the most we can spend** |
| 20px | 5.2% | 89.6% | 40.8px | too tight |
| 30px | 7.8% | 84.4% | 38.2px | too tight |
| 48px | 12.5% | 75.0% | 33.8px | the frame you sent |

Aim for the **92–94% opening** band. Anything below 92% will be rejected on playability,
not taste.

A 15px rail at 3× is 45 device pixels — plenty for a bevelled gold rail with a highlight
and a shadow. It is not enough for a chunky jewelled border, which is the change.

## How to keep the ornaments

Do not thin the crest and jewels down to nothing. Instead, **let them overhang outward**,
the way the crown already overhangs the objective tray. The rail stays slim; the ornaments
sit proud of it, in the transparent margin.

Overhang budget, as a percentage of the frame's width:

- **Top: up to 6%.** There is a 29px gap between the objective tray and the board.
- **Bottom: up to 8%.** There is plenty of clear space below the board.
- **Sides: none.** The board sits 3px from the screen edge. Anything hanging off the left
  or right will be clipped by the phone.

So: a crest cresting over the top rail, jewels tucked into the corners *within* the rail
line or dropping below the bottom rail. No side ornaments.

## The centre must be transparent

The board keeps its own deep blue gradient behind the letter tiles. **Do not paint a centre
fill.** The frame is a border only — everything inside the inner rail is fully transparent.
The version you sent had a painted blue centre, which washed the board out when composited.

---

## Theme and palette

Unchanged from the approved system. Match the objective tray and the top bar.

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

Reference assets now live in the game — match their light direction and finish:
`public/objective-tray/tray-frame-v2.webp`, `public/topbar/word-kingdom-topbar-v2.webp`,
`public/tutorial/royal-ribbon-popup.webp`.

## Asset rules

Each of these has cost us a round already.

1. **Square canvas**, 1536×1536 or larger. At 1536, a 4% rail is about 61px.
2. **Real alpha**, verified by compositing over magenta `#ff00ff` before sending.
3. **Fully opaque edges.** Trimming to the alpha bounding box is not enough — the last
   round left columns at alpha 31 and 64, which composite as background and showed as a
   visible sliver of sky down each side of the top bar. The rail's outer edge should reach
   full opacity within a pixel or two.
4. **No embedded text.**
5. **No painted centre**, per above.
6. Consistent top-left key light, matching the tray and top bar.

## Do not change

The 8×8 grid, the tile art, live letters, and every tile state (selected, hinted, clearing,
accepted, bonus, obstacle) stay exactly as they are. This is a frame behind the grid, not a
new gameplay layer. No A–Z letter images are needed.

## What to send back

The flat asset, plus a mock at 390px wide showing the frame around a real 8×8 grid with
42px tiles, so the fit can be judged at true phone size. State the inner opening as a
percentage of the canvas so it can be verified rather than eyeballed.

Do not modify game code — Claude will integrate it.
