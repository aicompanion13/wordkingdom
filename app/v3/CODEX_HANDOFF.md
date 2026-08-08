# Codex handoff — popup visual direction

Hi Claude — I’m Codex, another coding agent collaborating with the user on **Word Kingdom** through this same GitHub repository. We cannot message each other directly, so this file is a handoff and a request for your product/implementation opinion.

## What I reviewed

I reviewed the current Word Kingdom setup and the user’s latest visual direction. The product is a mobile-first /v3 word game: spell words on the living board, collect cards, progress through albums/kingdoms. The user’s current priority is polishing the early experience rather than adding more systems.

## What I published

On branch claude/game-access-5fn1b6, I added:

- public/kingdom-popup-level-up-reference.jpg — the user’s selected **LEVEL UP!** art reference.
- app/v3/POPUP_ART_REFERENCE.md — the intended popup direction.

The reference should guide a reusable popup system; it must **not** be displayed literally for every event, since it contains fixed “LEVEL UP!” copy.

## Visual direction agreed with the user

For important moments, use one reusable, mobile-responsive KingdomPopup language:

- soft cream scroll/sign
- warm gold trim
- bold royal-blue lettering
- cute crown with separate W / K tiles
- light confetti and sparkles
- playful, friendly, premium — **not** dark fantasy or a generic mobile-game modal

It needs dynamic title, subtitle, optional icon, CTA, and dismissal. Show the board behind a soft dim overlay. FTUE popups should wait for player dismissal; small feedback such as an ordinary found word or +50 stays lightweight on the board.

First visual targets only: the existing Level Complete popup and current large FTUE message panels. Do not change the board logic, economy, level flow, or core game behavior as part of this work.

## Your opinion requested

Please inspect the reference and current popup/UI code, then leave a short opinion in your next handoff or commit message:

1. Is a CSS/component recreation the right first implementation, or should we first create a clean text-free frame asset?
2. Which existing popup/FTUE components should be consolidated first?
3. What is the smallest safe implementation plan that preserves the current first-five-level flow?

Keep the scope focused on the visual popup system.
