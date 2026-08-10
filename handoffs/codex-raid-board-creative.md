# Codex Handoff — Reimagine the Raid Vault Board (creative only)

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

## What you are designing

The **Raid** is Word Kingdom's coin minigame. The player raids a rival kingdom's vault:
nine closed boxes, they choose exactly three, and coins are stolen. One box holds the
jackpot. It is the first PvP-flavoured moment in the game and currently the least
finished-looking screen we have.

You own the **creative only**. All game mechanics, payouts, probabilities and persistence
are already correct and must not be touched (see "Do not change" below).

The Raid is about to become far more prominent: it now triggers **mid-board during Level 3**,
around the seventh word, interrupting live play. It needs to feel like an event worth being
interrupted for.

---

## Theme and style — Word Kingdom Royal

Storybook-royal, warm and tactile. Think aged parchment, polished gold, deep royal blue,
gemstone accents. Everything is dimensional — bevels, inner highlights, soft drop shadows.
Nothing flat, nothing generic-mobile-UI, no emoji-as-art, no web-modal look.

### Exact palette (these are live CSS tokens — match them)

| Role | Value |
|---|---|
| Royal blue, deepest | `#061845` |
| Royal blue, deep | `#0b2867` |
| Royal blue, mid | `#124a98` |
| Royal blue, bright | `#247ac0` |
| Cream, lightest | `#fffdf0` |
| Cream, mid | `#fff1c7` |
| Cream, deep / parchment | `#efd28b` |
| Gold, warm gradient | `#ffe28a` → `#d79a22` |
| Gold, deep / burnt | `#9b541d` |
| Ink (all dark text) | `#142c63` |

### Typography

The game font is **Word Kingdom Royal** (OFL, derived from Bitter Pro).

**It ships only weights 400 and 700 — there is no black or heavy cut.** Do not design comps
that depend on an ultra-bold weight; it will render as browser-faked bold and look wrong.
This has already bitten us once. Titles are 700, and size carries the emphasis, not weight.

### Existing assets to match (your own earlier work — these are the style anchors)

- `public/tutorial/announcement-scroll-v2.png` — the royal scroll used for all announcements
- `public/objective-tray/objective-tray-frame.webp` — gold frame, crown-and-star crest, fleur side ornaments
- `public/objective-tray/word-tile-*.webp` — gold pill tiles, including a glowing "active" state
- `public/raid-boxes/*.webp` — the five boxes you are replacing

The shared ornament vocabulary: crown/star crests, fleur-de-lis corner flourishes, rope and
bevel gold framing, aged cream parchment panels, gemstone highlights.

---

## Deliverables

### 1. The nine vault boxes — five states (required)

- `box-locked` — the closed vault box, the hero object. Nine of these fill the 3×3 grid.
  It should look tempting and pickable, obviously a container of treasure.
- `box-jackpot` — burst open, overflowing, unmistakably the big win
- `box-medium` — open, a solid haul
- `box-small` — open, a modest haul
- `box-empty` — open and bare, disappointing but not punishing or ugly

The four open states must read as **the same object** as `box-locked`, opened — same
construction, same light direction, same footprint. Right now they read as five unrelated
icons, which is the main thing to fix.

**Specs:** square, transparent, **384×384** (the current 240×240 is soft on a 3× phone
screen). PNG is fine — we convert to WebP on integration.

**Critical:** these render at roughly **96×96 CSS pixels** on a phone. Detail that only
reads at full size is wasted. Design them to be legible at 96px first, then add refinement.

### 2. Grid backdrop / frame (optional but wanted)

A parchment-and-gold panel the 3×3 grid sits on, so the boxes feel like they belong to a
vault rather than floating. Follow the objective-tray frame language. Must tolerate a
variable-height panel above and below it.

### 3. Result celebration (required)

The moment after the third pick, showing total coins stolen. Restrained — a royal seal or
banner treatment, not confetti spam. Copy will be **"Royal Raid Complete!"** with the coin
total beneath. Design the frame; leave the text to be rendered live.

### 4. "Picks left" chrome (optional)

Currently a plain blue bar reading "3 PICKS LEFT" with a running coin total. Something more
royal — three gems or seals that extinguish as picks are spent would suit the game better.

---

## Asset rules — every one of these has cost us a round already

1. **True transparency.** Export with a real alpha channel and verify it by compositing over
   pure magenta `#ff00ff` before sending. A PNG that merely *looks* transparent on a dark
   background but carries baked-in black has been shipped to us before and did not fit.
2. **No embedded text of any kind.** No labels, no captions, no numbers, no "JACKPOT". All
   text is rendered live in HTML so it can be localised and restyled. A baked-in caption has
   been shipped before and had to be removed.
3. **No white or coloured rectangular background** behind the subject.
4. **Consistent light direction** across all five boxes — top-left key light, matching the
   existing objective-tray and scroll assets.
5. **Must sit on two different grounds:** the deep royal blue panel `#0b2867` *and* the dark
   translucent scrim behind the overlay. Check both before sending.
6. Square canvas, subject centred, small even margin so nothing clips when scaled.

---

## Do not change

The mechanics are implemented and verified. This is a purely visual pass.

- Nine boxes; the player picks exactly three
- The jackpot position is locked in before the first pick and never moves
- Box contents never change after a selection
- Reward table: 1 jackpot, 2 medium, 4 small, 2 empty
- Coins only — a Raid must never touch cards
- Rewards are granted exactly once and survive a reload
- Authored boards, objective paths, vocabulary, scoring, transformations and protected
  hashes are all out of scope

---

## Constraints

- **Mobile only.** Design and check against a phone viewport (iPhone 13, 390×844). Desktop
  is not a goal.
- Any motion you propose must have a still fallback — the game honours
  `prefers-reduced-motion` everywhere.
- Keep total added weight sensible; we are on Cloudflare Workers. Under ~200KB for the full
  box set after WebP conversion is a good target.

## What to send back

The flat assets plus a one-screen mock of the assembled Raid screen at 390px wide, so we can
judge it at true phone size before integrating. Do not modify the game code — Claude will
wire the assets in and is separately extracting the Raid overlay into its own component so
your art has a clean surface to land on.
