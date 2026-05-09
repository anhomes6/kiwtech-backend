// ╔════════════════════════════════════════════════════════╗
// ║  POST /api/auth/google                                  ║
// ║  Body: { credential: "google_id_token_jwt" }            ║
// ║  Verifies Google ID token, upserts user, returns email  ║
// ╚════════════════════════════════════════════════════════╝
import { OAuth2Client } from 'google-auth-library';
import { sb, logAudit } from '../../lib/supabase.js';
import { handleCors } from '../../lib/helpers.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'POST only' });
  }

  try {
    const { credential } = req.body || {};
    if (!credential) {
      return res.status(400).json({ success: false, error: 'credential (Google ID token) required' });
    }

    // ── Verify ID token with Google ──────────────────────
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(401).json({ success: false, error: 'Invalid Google token' });
    }

    const email   = payload.email.toLowerCase();
    const name    = payload.name    || '';
    const picture = payload.picture || '';

    // ── Upsert user ──────────────────────────────────────
    const { data: existing } = await sb
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      await sb.from('users').update({
        name, picture, last_login_at: new Date().toISOString()
      }).eq('email', email);
    } else {
      await sb.from('users').insert({
        email, name, picture, last_login_at: new Date().toISOString()
      });
    }

    logAudit(email, 'login', null, { name });

    return res.status(200).json({
      success: true,
      email, name, picture
    });

  } catch (e) {
    console.error('auth/google error:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
}
