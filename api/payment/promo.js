// ╔════════════════════════════════════════════════════════╗
// ║  POST /api/payment/promo                               ║
// ║  Body: { code, email, tool }                           ║
// ║    tool: 'shipping' | 'listing'                        ║
// ║  Validates promo code, activates 90-day subscription   ║
// ╚════════════════════════════════════════════════════════╝
import { sb, logAudit } from '../../lib/supabase.js';
import { handleCors } from '../../lib/helpers.js';

// ── Promo codes config ─────────────────────────────────────
// Password: kiwtech2025 → 90 days access for the requested tool
const PROMO_CODES = {
  'kiwtech2025': {
    days:  90,
    plan:  'promo-quarterly',
    label: 'Promo Code — 3 Months Free'
  }
};

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'POST only' });
  }

  try {
    const code      = (req.body?.code  || '').trim();
    const email     = (req.body?.email || '').toLowerCase().trim();
    const tool      = (req.body?.tool  || '').toLowerCase().trim(); // 'shipping' | 'listing'

    // ── Basic validation ─────────────────────────────────
    if (!code)  return res.status(400).json({ success: false, error: 'Promo code required' });
    if (!email) return res.status(400).json({ success: false, error: 'Email required' });
    if (!['shipping', 'listing'].includes(tool)) {
      return res.status(400).json({ success: false, error: 'Invalid tool. Use shipping or listing.' });
    }

    // ── Validate promo code ──────────────────────────────
    const promo = PROMO_CODES[code.toLowerCase()];
    if (!promo) {
      logAudit(email, 'promo_invalid_code', tool, { code });
      return res.status(400).json({ success: false, error: 'Invalid promo code' });
    }

    // ── Check: already used promo for this tool? ─────────
    const { data: existing } = await sb
      .from('subscriptions')
      .select('id, expires_at')
      .eq('email', email)
      .eq('tool', tool)
      .eq('plan', promo.plan)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({
        success: false,
        error: `Promo code pehle hi use ho chuka hai is tool ke liye. Expiry: ${new Date(existing.expires_at).toLocaleDateString('en-IN')}`
      });
    }

    // ── Check: already has active paid subscription? ─────
    const now = new Date().toISOString();
    const { data: activeSub } = await sb
      .from('subscriptions')
      .select('id, plan, expires_at')
      .eq('email', email)
      .in('tool', [tool, 'combo'])
      .eq('status', 'active')
      .gt('expires_at', now)
      .maybeSingle();

    if (activeSub && activeSub.plan !== promo.plan) {
      // Already has a paid plan — still allow promo but stack on top
      // (promo activates from now, independent)
    }

    // ── Activate subscription ────────────────────────────
    const startsAt  = new Date();
    const expiresAt = new Date(Date.now() + promo.days * 86400 * 1000);

    const { error: insErr } = await sb.from('subscriptions').insert({
      email,
      tool,
      plan:    promo.plan,
      status:  'active',
      amount:  0,
      razorpay_order_id:   `PROMO_${code.toUpperCase()}_${Date.now()}`,
      razorpay_payment_id: `PROMO_FREE`,
      started_at:  startsAt.toISOString(),
      expires_at:  expiresAt.toISOString()
    });

    if (insErr) throw insErr;

    logAudit(email, 'promo_activated', tool, {
      code, plan: promo.plan, days: promo.days,
      expiresAt: expiresAt.toISOString()
    });

    return res.status(200).json({
      success:   true,
      tool,
      plan:      promo.plan,
      days:      promo.days,
      expiresAt: expiresAt.toISOString(),
      message:   `🎉 ${promo.days} din ka access activate ho gaya! Tool ab use kar sako.`,
      siteUrl:   process.env.SITE_URL
    });

  } catch (e) {
    console.error('payment/promo error:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
}
