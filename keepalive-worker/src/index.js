// Calls the keepalive() RPC (see supabase/schema.sql) so the request counts
// as real database activity, not just a gateway health check. Throwing marks
// the cron run as errored in the Cloudflare dashboard.
export default {
  async scheduled(_event, env, _ctx) {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/keepalive`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`keepalive ping failed: ${res.status} ${body}`);
    console.log(`keepalive ok: ${body}`);
  },
};
