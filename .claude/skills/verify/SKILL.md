---
name: verify
description: Drive the running app in a browser to verify UI changes end-to-end (keyless seed mode, Playwright).
---

# Verifying changes in this repo

The surface is a browser GUI. Drive it with Playwright against the Vite dev
server in **keyless seed mode** — no login needed, deterministic seed data.

## Launch

```bash
# Blank the Supabase keys so the app skips auth and uses the in-memory seed.
# (Process env overrides .env.local in Vite.)
VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npm run dev   # http://localhost:5173
```

## Drive

Playwright isn't a project dep (keep it that way). Install it in a scratch dir
and use the system Chrome — no browser download needed:

```bash
cd "$SCRATCH" && npm init -y && npm i playwright
node -e "require('playwright').chromium.launch({channel:'chrome'})..."
```

## Gotchas (learned the hard way)

- **Mantine Select is a combobox, not `<select>`** — click the visible input,
  then pick from `[role="option"]:visible`. The `:visible` matters: closed
  Selects elsewhere on the page (e.g. the Sort control) keep hidden option
  nodes in the DOM.
- **Mantine inputs come with hidden siblings** — use `input:visible` with
  nth(), or target by placeholder.
- **Rating**: click `.mantine-Rating-root label` (needs `{ force: true }`).
- **AppShell.Navbar stays in the DOM when collapsed** — `isVisible()` lies on
  mobile; screenshot to confirm the drawer actually closed.
- `/favicon.ico` 404s in the console — pre-existing, no favicon is set.

## Flows worth driving

- All routes: `/`, `/wishlist`, `/map` (wait for `.leaflet-container` + ~1.5s
  for tiles), `/calendar`, `/movies`, `/tv`, `/french-toast`; unknown paths
  redirect to `/`.
- Screen toggle + header feature nav navigate and update the URL; browser
  back works; hard-load deep links work.
- Doing-stuff state (search/filter) must survive Log→Map→Log — all four
  routes render one `DoingStuffPage`, so its store must not remount.
- New-entry modal: category → activity → title → rating → "Add entry";
  the button stays disabled until activity + rating are set.
- Mobile (390×844): burger opens the drawer, navigating closes it.
