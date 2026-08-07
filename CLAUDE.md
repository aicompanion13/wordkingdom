# Word Kingdom: Spell & Steal

Mobile word-search game (Next.js 16 + React 19 on Cloudflare Workers via
`vinext`). The owner collaborates from a phone; treat pushed commits as
instantly player-visible.

## Scope rules

- **Work only on `/v3`**: `app/v3/` + `game/v3/` (+ shared `app/chatgpt-auth.ts`
  when auth demands it). Do not touch `/` (root game), `/v2`, or `/v4` unless
  explicitly asked.
- **Mobile only.** Design and verify against a phone viewport (e.g. Playwright
  iPhone 13 emulation). Desktop layout is not a goal.
- Develop on branch `claude/game-access-5fn1b6`; never push elsewhere.

## Architecture map

- `app/v3/WordKingdomV3.tsx` — the whole game UI (~2.5k lines): hub, board,
  summaries, albums, PvP overlays, FTUE.
- `app/v3/V3.module.css` — all styling (~3k lines). Design tokens live on
  `.v3Shell/.boardShell/.summaryShell`: `--royal-*` colors, `--game-display`
  font. Match this language for any new visuals.
- `game/v3/` — pure game logic: board sessions, economy, packs/albums, PvP,
  FTUE flow, generated levels (`data/generated-levels/`), golden tutorial
  levels ("golden" = the authored, test-locked levels 1–10).
- `app/api/player/route.ts` — persistence: one D1 table `player_profiles`,
  self-creates via `CREATE TABLE IF NOT EXISTS`.
- `worker/index.ts` — Cloudflare Worker entry (built artifact serves it).
- Juice/FX pattern: CSS custom-property particles (see `JuiceFxLayer.tsx` and
  `celebrationBurst` in the CSS). Extend that pattern; no animation libraries.

## Dev & test recipe (verified in this container)

- Install: `pnpm install` (pnpm is pinned via `packageManager`).
- Dev server: `pnpm exec vite --port 5173` (do NOT use `pnpm dev`; its script
  uses env-var syntax that also breaks on the owner's Windows laptop —
  `pnpm exec vite` works everywhere).
- Auth bypass for local/preview: visit `/local-qa-signin?return_to=/v3`
  (grants a "Royal QA" test profile cookie; enabled on localhost, LAN IPs,
  and `*.workers.dev`).
- Headless testing gotchas:
  - The intro video can't play in sandbox Chromium (no H.264). Fire
    `video.dispatchEvent(new Event('error'))`, then click "ENTER KINGDOM".
  - Dismiss FTUE coachmarks via button "Dismiss tutorial message" before
    clicking things they overlay.
  - In-game debug panel: "⚙ Royal QA Tools" → "Auto-solve current word"
    fast-forwards through levels.
- Type check: `npx tsc --noEmit -p tsconfig.json` — 3 pre-existing errors are
  known (PvpState cast in `app/api/player/route.ts` + `WordKingdomV3.tsx:167`,
  and a stale `backups/` page). Don't add new ones.

## Deploy (Cloudflare Workers Builds — auto on push)

- Live URL: https://wordkingdom-prod.inspectorkush1.workers.dev/v3
  (owner plays here; a push to the branch auto-builds & deploys in ~3 min).
- Config: `wrangler.jsonc` (worker name `wordkingdom-prod` must match the
  dashboard project). The D1 binding `DB` is declared once in
  `vite.config.ts` (real database `word-kingdom-db`,
  id `dac86fe2-...539f`) — `vinext build` merges it into the artifact config.
  Never declare the same binding or `nodejs_compat` in both places
  (duplicates break dev or deploy).
- Build = `pnpm exec vinext build`, deploy = `npx wrangler deploy` (both
  configured in the Cloudflare dashboard; non-production branches deploy
  straight to the live URL).
- Toolchain pins matter: `packageManager` (pnpm 10.33.0), `.node-version`,
  regenerated lockfile — CI installs with a frozen lockfile and fails fast on
  drift. If you change deps, commit the lockfile pnpm 10 produces.
- Verify before pushing config changes:
  `pnpm exec vinext build && npx wrangler deploy --dry-run` (expect exactly
  one `env.DB` + `env.ASSETS` binding), and boot the dev server once.

## Working style with the owner

- They test on their phone at the live URL; screenshots from me are a
  fallback, not a substitute.
- Lead with what changed in play terms, not implementation terms.
- Respect `prefers-reduced-motion` in any new animation, and gate
  celebration-type effects to win states.
