// ╔════════════════════════════════════════════════════════╗
// ║  POST /api/demo/start                                    ║
// ║  Body: { email, tool: 'shipping'|'listing'|'combo' }    ║
// ║  Creates a 2hr (or 4hr for combo) demo record           ║
// ╚════════════════════════════════════════════════════════╝
import { sb, logAudit } from '../../lib/supabase.js';
import { handleCors, DEMO_HOURS, sendEmail, emailWrap } from '../../lib/helpers.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'POST only' });
  }

  try {
    const email = (req.body?.email || '').toLowerCase().trim();
    const tool  = req.body?.tool  || 'shipping';

    if (!email) return res.status(400).json({ success: false, error: 'email required' });
    if (!['shipping', 'listing', 'combo'].includes(tool)) {
      return res.status(400).json({ success: false, error: 'invalid tool' });
    }

    // ── Check if demo already used for this tool ─────────
    const { data: existing } = await sb
      .from('demos')
      .select('id, expires_at, status')
      .eq('email', email)
      .eq('tool', tool)
      .maybeSingle();

    if (existing) {
      const stillActive = existing.status === 'active' && new Date(existing.expires_at) > new Date();
      return res.status(400).json({
        success: false,
        error: stillActive
          ? 'Demo already active for this tool — wait for it to expire'
          : 'Demo already used — please buy subscription',
        expiresAt: existing.expires_at
      });
    }

    // ── Create demo ──────────────────────────────────────
    const hours    = DEMO_HOURS[tool] || 2;
    const startsAt = new Date();
    const expires  = new Date(Date.now() + hours * 3600 * 1000);

    const { data: created, error } = await sb
      .from('demos')
      .insert({
        email, tool,
        status: 'active',
        started_at: startsAt.toISOString(),
        expires_at: expires.toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    logAudit(email, 'demo_start', tool, { hours });

    // ── Send demo email with download link ───────────────
    sendDemoEmail(email, tool, expires).catch(e =>
      console.warn('demo email failed:', e.message)
    );

    return res.status(200).json({
      success: true,
      tool,
      hours,
      startedAt: startsAt.toISOString(),
      expiresAt: expires.toISOString(),
      message: `${hours} hour demo started for ${tool}`
    });

  } catch (e) {
    console.error('demo/start error:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
}

// ── Demo welcome email ──────────────────────────────────
async function sendDemoEmail(email, tool, expiresAt) {
  const SITE = process.env.SITE_URL || 'https://kiwtech-website.vercel.app';
  const expiry = new Date(expiresAt).toLocaleString('en-IN', {
    dateStyle: 'medium', timeStyle: 'short'
  });

  const toolNames = {
    shipping: '📦 Kiwtech Shipping Optimizer',
    listing:  '🤖 Kiwtech AI Listing Tool',
    combo:    '🎁 Kiwtech Combo Pack (Both Tools)'
  };

  const html = emailWrap(`
    <h2 style="margin-top:0;color:#0e1522;">⚡ Demo Started!</h2>
    <p>Tera FREE demo activate ho gaya hai for <strong>${toolNames[tool]}</strong>.</p>
    <div style="background:#f0fdfa;border-left:4px solid #00c9b1;padding:14px 18px;border-radius:8px;margin:18px 0;">
      <p style="margin:0;font-size:13px;color:#065f46;">⏰ <strong>Demo expires:</strong> ${expiry}</p>
    </div>
    <p>Tool use karne ke liye:</p>
    <ol style="padding-left:20px;">
      <li>Apni dashboard pe jao: <a href="${SITE}/dashboard" style="color:#4d7cfe;">${SITE}/dashboard</a></li>
      <li>Same email se Google login karo</li>
      <li>Tool tile pe "Download" click karo</li>
      <li>Extension install karke Meesho pe use karo</li>
    </ol>
    <p style="margin-top:24px;">Demo khatam hone se pehle subscription le le —
       <a href="${SITE}/dashboard" style="background:#00c9b1;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:700;">Plans Dekho →</a>
    </p>
  `);

  return sendEmail({
    to: email,
    subject: `⚡ Demo started — ${toolNames[tool]}`,
    html
  });
}
