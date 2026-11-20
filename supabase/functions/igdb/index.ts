// Supabase Edge Function `igdb` (Deno) — the repo's reference copy. Like
// `admin`, it is NOT part of the Vite build or the tsc/vitest runs. Deploy it
// as a function named `igdb` (the Supabase connector's deploy_edge_function,
// the dashboard's Edge Functions editor, or `supabase functions deploy igdb`).
// If the platform's "Verify JWT" setting blocks the OPTIONS preflight, turn it
// off — the in-function sign-in check below is the real gate.
//
// Video game title → cover lookup for the Video Games tier board. IGDB (run by
// Twitch) can't be called from the browser: every request needs an app access
// token minted from a Twitch client SECRET. So this function holds the secret,
// mints and caches the token, and runs one search per call. It needs two
// function secrets (Dashboard → Edge Functions → Secrets):
//
//   TWITCH_CLIENT_ID      from dev.twitch.tv/console → your application
//   TWITCH_CLIENT_SECRET  same page, "New Secret"
//
// Any signed-in user may call it (not just the admin) — it only searches a
// public game catalogue. It returns plain data; the browser builds the cover
// URLs, so stored rows stay plain text/URLs with no IGDB coupling.
import { createClient } from 'npm:@supabase/supabase-js@2'

// Browser origins allowed to call this. Auth is a bearer token (no cookies),
// so this is defense in depth, not the gate.
// The site is served from the Cloudflare Pages domain (plus the custom domain
// once its DNS is pointed there); a deploy preview is a subdomain of it.
const ALLOWED_ORIGINS = [
  'https://cajubinile.com',
  'https://www.cajubinile.com',
  'https://doing-stuff.pages.dev',
  'http://localhost:5173',
]
const PREVIEW_ORIGIN = /^https:\/\/[a-z0-9-]+\.doing-stuff\.pages\.dev$/

const isAllowedOrigin = (origin: string) => ALLOWED_ORIGINS.includes(origin) || PREVIEW_ORIGIN.test(origin)

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0],
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    // Echo what the SDK asks for, so a new SDK header can't break preflight.
    'Access-Control-Allow-Headers':
      req.headers.get('Access-Control-Request-Headers') ??
      'authorization, x-client-info, apikey, content-type, x-retry-count',
    'Access-Control-Max-Age': '86400',
  }
}

const json = (status: number, body: unknown, cors: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

/** New-style key dictionary first ({"default": "..."}), legacy single key second. */
function projectKey(dictEnv: string, legacyEnv: string): string {
  const raw = Deno.env.get(dictEnv)
  if (raw) {
    try {
      const key = JSON.parse(raw)?.default
      if (typeof key === 'string' && key) return key
    } catch {
      // fall through to the legacy key
    }
  }
  const legacy = Deno.env.get(legacyEnv)
  if (!legacy) throw new Error(`Missing ${dictEnv} / ${legacyEnv}`)
  return legacy
}

const NO_SESSION = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }

// --- Twitch app access token ----------------------------------------------------
// Client-credentials tokens last ~60 days. Cached per isolate; refreshed a
// minute early, or right away when IGDB answers 401.
let cachedToken: { value: string; expiresAt: number } | null = null

async function appToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value
  const clientId = Deno.env.get('TWITCH_CLIENT_ID')
  const secret = Deno.env.get('TWITCH_CLIENT_SECRET')
  if (!clientId || !secret) throw new Error('Missing TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET')
  const params = new URLSearchParams({ client_id: clientId, client_secret: secret, grant_type: 'client_credentials' })
  const res = await fetch(`https://id.twitch.tv/oauth2/token?${params}`, { method: 'POST' })
  if (!res.ok) throw new Error(`Twitch token request failed (${res.status})`)
  const data = (await res.json()) as { access_token?: string; expires_in?: number }
  if (!data.access_token) throw new Error('Twitch returned no token')
  cachedToken = { value: data.access_token, expiresAt: Date.now() + ((data.expires_in ?? 3600) - 60) * 1000 }
  return cachedToken.value
}

interface IgdbGame {
  id: number
  name?: string
  first_release_date?: number // unix seconds
  cover?: { image_id?: string }
  involved_companies?: Array<{ developer?: boolean; company?: { name?: string } }>
}

async function igdbSearch(query: string): Promise<IgdbGame[]> {
  const clientId = Deno.env.get('TWITCH_CLIENT_ID') ?? ''
  // Apicalypse: the query sits inside a double-quoted string, so quotes and
  // backslashes are stripped rather than escaped. `version_parent = null`
  // drops editions (GOTY, Deluxe…) that would otherwise crowd the list.
  const body = [
    `search "${query}";`,
    'fields name,first_release_date,cover.image_id,involved_companies.developer,involved_companies.company.name;',
    'where version_parent = null;',
    'limit 8;',
  ].join(' ')
  const run = (token: string) =>
    fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: { 'Client-ID': clientId, Authorization: `Bearer ${token}`, Accept: 'application/json' },
      body,
    })
  let res = await run(await appToken())
  if (res.status === 401) res = await run(await appToken(true))
  if (!res.ok) throw new Error(`IGDB search failed (${res.status})`)
  return (await res.json()) as IgdbGame[]
}

Deno.serve(async (req) => {
  const cors = corsFor(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed.' }, cors)

  try {
    const url = Deno.env.get('SUPABASE_URL')
    if (!url) throw new Error('Missing SUPABASE_URL')

    // Signed-in members only, so the Twitch quota isn't an open proxy.
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
    if (!token) return json(401, { error: 'Not signed in.' }, cors)
    const asCaller = createClient(url, projectKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY'), {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: NO_SESSION,
    })
    const { data: who, error: whoErr } = await asCaller.auth.getUser(token)
    if (whoErr || !who?.user) return json(401, { error: 'Not signed in.' }, cors)

    const payload = await req.json().catch(() => null)
    const raw = payload && typeof payload.query === 'string' ? payload.query : ''
    const query = raw.replace(/["\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100)
    if (query.length < 2) return json(200, { results: [] }, cors)

    const games = await igdbSearch(query)
    const results = games
      .filter((g) => g.name)
      .map((g) => ({
        id: g.id,
        title: g.name,
        year: g.first_release_date ? String(new Date(g.first_release_date * 1000).getUTCFullYear()) : '',
        developer: g.involved_companies?.find((c) => c.developer && c.company?.name)?.company?.name ?? '',
        cover_image_id: g.cover?.image_id ?? '',
      }))
    return json(200, { results }, cors)
  } catch (err) {
    console.error('[igdb]', err instanceof Error ? err.message : err)
    return json(502, { error: 'Game search is unavailable.' }, cors)
  }
})
