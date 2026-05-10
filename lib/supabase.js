// ╔════════════════════════════════════════════════════════╗
// ║  Supabase client (server-side, service role)           ║
// ╚════════════════════════════════════════════════════════╝
import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE env vars missing!');
}
export const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

// ── Helper: log audit event (non-blocking) ────────────────
export function logAudit(email, event, tool = null, meta = {}) {
  sb.from('audit_log')
    .insert({ email, event, tool, meta })
    .then(({ error }) => { if (error) console.warn('audit log failed:', error.message); });
}

// ── License-key derived emails bypass Supabase check ──────
// Format: license_KWT_XXX_YYY_ZZZ@kiwtech.license
function isLicenseEmail(email) {
  return email.endsWith('@kiwtech.license') && email.startsWith('license_');
}

// ── Helper: get user's active access for a given tool ─────
// Returns: { hasAccess: bool, source: 'subscription'|'demo'|'license'|null, expiresAt, plan }
// Logic: combo subscription unlocks BOTH shipping aur listing
export async function getToolAccess(email, tool) {
  // ★ License-key users: bypass Supabase entirely
  //   Extension already validated the key locally (keys.json / chrome.storage)
  if (isLicenseEmail(email)) {
    return { hasAccess: true, source: 'license', tool, plan: 'license', expiresAt: null };
  }

  const now = new Date().toISOString();

  // 1. Check direct subscription (matching tool OR combo)
  const { data: subs } = await sb
    .from('subscriptions')
    .select('*')
    .eq('email', email)
    .in('tool', [tool, 'combo'])
    .eq('status', 'active')
    .gt('expires_at', now)
    .order('expires_at', { ascending: false })
    .limit(1);
  if (subs && subs.length) {
    return {
      hasAccess: true,
      source: 'subscription',
      tool: subs[0].tool,
      plan: subs[0].plan,
      expiresAt: subs[0].expires_at
    };
  }

  // 2. Check demo (matching tool OR combo)
  const { data: demos } = await sb
    .from('demos')
    .select('*')
    .eq('email', email)
    .in('tool', [tool, 'combo'])
    .eq('status', 'active')
    .gt('expires_at', now)
    .order('expires_at', { ascending: false })
    .limit(1);
  if (demos && demos.length) {
    return {
      hasAccess: true,
      source: 'demo',
      tool: demos[0].tool,
      plan: 'demo',
      expiresAt: demos[0].expires_at
    };
  }

  return { hasAccess: false, source: null };
}
