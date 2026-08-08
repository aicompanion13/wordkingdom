# Kingdom popup visual reference

Use [`/kingdom-popup-level-up-reference.jpg`](/kingdom-popup-level-up-reference.jpg)
as the single visual base for high-importance Word Kingdom popups.

## What must carry through

- Cream parchment/sign center with warm-gold trim.
- Bold royal-blue display lettering; cute chunky crown with separate `W` and
  `K` letter tiles.
- Light, friendly, playful celebration: confetti and small sparkles. It must
  not become a dark-fantasy, battle, or generic mobile-game modal.
- Keep the centre readable and flexible for dynamic title, short subtitle,
  optional icon, and CTA.

## Where to use it

Use the visual language for level complete/unlocked, card pack earned/opened,
new album, card found, big word combo, kingdom/album complete, and important
Levels 1–5 FTUE messages. Do not use a large popup for ordinary found words,
small score gains, or other moment-to-moment board feedback.

## Implementation scope

Build one responsive reusable `KingdomPopup` component for `/v3`. Keep the
game visible behind a soft dim layer. CTA, outside-tap, and an accessible close
action dismiss it; important FTUE messages must wait for an intentional user
dismissal, never auto-close. Respect `prefers-reduced-motion`.

Start by replacing the existing level-complete popup and large FTUE panels.
Do not change gameplay, levels, progression, or the economy in this visual
task.
