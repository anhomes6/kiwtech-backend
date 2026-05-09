// ╔════════════════════════════════════════════════════════╗
// ║  POST /api/payment/verify                                ║
// ║  Validates Razorpay signature, activates subscription,   ║
// ║  sends ZIP file via email                                ║
// ╚════════════════════════════════════════════════════════╝
import crypto from 'crypto';
import { sb, logAudit } from '../../lib/supabase.js';
import { handleCors, PLANS, getPlanKey } from '../../lib/helpers.js';
import { sendActivationEmail } from '../email/send-zip.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'POST only' });
  }

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      email, tool = 'shipping', plan = 'monthly'
    } = req.body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Missing payment params' });
    }

    // ── Verify signature ─────────────────────────────────
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expected !== razorpay_signature) {
      logAudit(email, 'payment_invalid_signature', tool, {
        orderId: razorpay_order_id, paymentId: razorpay_payment_id
      });
      return res.status(400).json({ success: false, error: 'Invalid signature' });
    }

    // ── Get plan config ──────────────────────────────────
    const planKey = getPlanKey(tool, plan);
    const config  = PLANS[planKey];
    if (!config) {
      return res.status(400).json({ success: false, error: 'Invalid plan' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const startsAt   = new Date();
    const expiresAt  = new Date(Date.now() + config.days * 86400 * 1000);

    // ── Idempotency: skip if already saved ───────────────
    const { data: existing } = await sb
      .from('subscriptions')
      .select('id')
      .eq('razorpay_payment_id', razorpay_payment_id)
      .maybeSingle();

    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'Already processed',
        siteUrl: process.env.SITE_URL
      });
    }

    // ── Insert subscription ──────────────────────────────
    const { error: insErr } = await sb.from('subscriptions').insert({
      email: cleanEmail,
      tool, plan,
      status: 'active',
      amount: config.amount,
      razorpay_order_id,
      razorpay_payment_id,
      started_at: startsAt.toISOString(),
      expires_at: expiresAt.toISOString()
    });
    if (insErr) throw insErr;

    logAudit(cleanEmail, 'payment_success', tool, {
      plan, amount: config.amount, paymentId: razorpay_payment_id
    });

    // ── Send activation email with ZIP (non-blocking) ────
    sendActivationEmail({ email: cleanEmail, tool, plan, expiresAt })
      .catch(e => console.warn('Activation email failed:', e.message));

    return res.status(200).json({
      success: true,
      tool, plan,
      expiresAt: expiresAt.toISOString(),
      siteUrl:   process.env.SITE_URL
    });

  } catch (e) {
    console.error('payment/verify error:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
}
