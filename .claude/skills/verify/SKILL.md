---
name: verify
description: Drive the running app in a browser to verify UI changes end-to-end (keyless seed mode, Playwright).
---

# Verifying changes in this repo

The surface is a browser GUI. `@playwright/test` is a dev dependency with a
persistent suite in `e2e/` — run that first; write ad-hoc driving scripts only
for things the suite doesn't cover (visual checks, new flows mid-development).

## The suite

```bash
npm run test:e2e                     # whole suite (starts its own dev server)
npx playwright test e2e/tier-list.spec.ts   # one file
npx playwright test --project=desktop        # skip the mobile project
```

The config (`playwright.config.ts`) launches Vite on **port 5199** with the
Supabase keys blanked, so tests always run against **keyless seed mode** —
deterministic data, no login, no real backend. It never reuses your normal
:5173 dev server. Uses system Chrome (`channel: 'chrome'`) — no browser
download.

Spec map: `routes` (every route hard-loads), `navigation` (header nav, screen
toggle, back button), `doing-stuff` (store survives screen switches, entry
modal gating), `tier-list` (board derivation, You/Partner, per-person book
reads, tag filter, watchlist), `mobile` (390×844 burger drawer). Shared
Mantine helpers live in `e2e/helpers.ts` — use them instead of re-deriving
selectors.

**Keep drag-and-drop out of the suite.** dnd-kit drags simulated through
Playwright are flaky (sensor activation, pointer timing). Drag *logic* is
covered by `derive.test.ts` (vitest); when you touch the drag wiring itself,
verify by hand-driving below.

New UI behavior worth keeping → add a spec (or extend one) in `e2e/`, using
seed data from the two `useXStore.ts` `seed()` functions for assertions.
`BoardView` exposes `data-board-row` / `data-board-shelf` for scoping.

## Ad-hoc driving (things the suite can't assert)

```bash
# Keyless dev server, same trick as the config:
VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npm run dev   # http://localhost:5173
# Then drive with the installed dep:
node -e "require('@playwright/test').chromium.launch({channel:'chrome'})..."
```

Screenshot into the scratchpad dir, not the repo.

## Mantine gotchas (encoded in e2e/helpers.ts — for ad-hoc scripts too)

- **Select is a combobox, not `<select>`** — click the visible input, then
  pick from `[role="option"]:visible`. The `:visible` matters: closed Selects
  elsewhere keep hidden option nodes in the DOM.
- **Inputs come with hidden siblings** — target by placeholder/label or
  `input:visible`.
- **Rating**: click `.mantine-Rating-root label` (needs `{ force: true }`).
- **AppShell.Navbar stays in the DOM when collapsed** — `isVisible()` lies on
  mobile; use `toBeInViewport()` instead.
- Map: wait for `.leaflet-container` + ~1.5s for tiles before screenshots.
- `/favicon.ico` 404s in the console — pre-existing, no favicon is set.
