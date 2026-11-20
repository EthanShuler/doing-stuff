// Supabase Edge Function `admin` (Deno) — the repo's reference copy. It is NOT
// part of the Vite build or the tsc/vitest runs (tsconfig only includes src/,
// e2e/ and the config files). Deploy it as a function named `admin`: paste
// this file into the dashboard's Edge Functions editor, or use the Supabase
// connector's deploy_edge_function tool (or `supabase functions deploy admin`).
// If the platform's "Verify JWT" setting blocks the OPTIONS preflight, turn it
// off — the in-function check below is the real gate.
//
// Admin-only auth operations that need the service role. Everything else
// (memberships, spaces, display names) is a SECURITY DEFINER RPC called from
// the browser — keep it out of here.
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
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  const cors = corsFor(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed.' }, cors)

  try {
    const url = Deno.env.get('SUPABASE_URL')
    if (!url) throw new Error('Missing SUPABASE_URL')

    // 1. Who is calling? Ask the Auth server, so a revoked session or a
    //    deleted/banned user fails here.
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
    if (!token) return json(401, { error: 'Not signed in.' }, cors)
    const asCaller = createClient(url, projectKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY'), {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: NO_SESSION,
    })
    const { data: who, error: whoErr } = await asCaller.auth.getUser(token)
    if (whoErr || !who?.user) return json(401, { error: 'Not signed in.' }, cors)

    // 2. Are they the admin? Asked AS THE CALLER, so the answer comes from the
    //    same is_admin() the database trusts.
    const { data: isAdmin, error: adminErr } = await asCaller.rpc('is_admin')
    if (adminErr) return json(500, { error: 'Could not check admin status.' }, cors)
    if (isAdmin !== true) return json(403, { error: 'Admins only.' }, cors)

    // 3. Only now build the service client.
    const service = createClient(url, projectKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY'), {
      auth: NO_SESSION,
    })

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return json(400, { error: 'Expected a JSON body.' }, cors)

    /** A one-time recovery token for `email`. Never logged. */
    const recoveryToken = async (email: string): Promise<{ token_hash: string | null; error: string | null }> => {
      const { data, error } = await service.auth.admin.generateLink({ type: 'recovery', email })
      const hash = data?.properties?.hashed_token
      if (error || !hash) return { token_hash: null, error: error?.message ?? 'No token returned.' }
      return { token_hash: hash, error: null }
    }

    if (body.action === 'create_user') {
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      const displayName = typeof body.display_name === 'string' ? body.display_name.trim() : ''
      if (!EMAIL.test(email) || email.length > 254) return json(400, { error: 'Enter a valid email.' }, cors)
      if (displayName.length > 80) return json(400, { error: 'That name is too long.' }, cors)

      const { data, error } = await service.auth.admin.createUser({
        email,
        email_confirm: true, // no confirmation email; they sign in via the link
        ...(displayName ? { user_metadata: { display_name: displayName } } : {}),
      })
      if (error || !data?.user) {
        const exists = error?.code === 'email_exists' || error?.status === 422
        return json(exists ? 409 : 400, { error: error?.message ?? 'Could not create the user.' }, cors)
      }
      // The account exists either way; a failed link can be re-requested.
      const link = await recoveryToken(email)
      return json(200, { user_id: data.user.id, email, token_hash: link.token_hash, link_error: link.error }, cors)
    }

    if (body.action === 'password_link') {
      const userId = typeof body.user_id === 'string' ? body.user_id : ''
      if (!UUID.test(userId)) return json(400, { error: 'Bad user id.' }, cors)
      const { data, error } = await service.auth.admin.getUserById(userId)
      const email = data?.user?.email
      if (error || !email) return json(404, { error: 'No such user.' }, cors)
      const link = await recoveryToken(email)
      if (!link.token_hash) return json(502, { error: link.error ?? 'Could not create a link.' }, cors)
      return json(200, { user_id: userId, email, token_hash: link.token_hash }, cors)
    }

    return json(400, { error: 'Unknown action.' }, cors)
  } catch (err) {
    console.error('[admin]', err instanceof Error ? err.message : err)
    return json(500, { error: 'Something went wrong.' }, cors)
  }
})
