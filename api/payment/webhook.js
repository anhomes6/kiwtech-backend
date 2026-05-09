// ╔════════════════════════════════════════════════════════╗
// ║  POST /api/payment/webhook  (Razorpay → server)         ║
// ║  Server-to-server confirmation as backup to /verify     ║
// ║  Configure in Razorpay dashboard → Webhooks             ║
// ║  Events to subscribe: payment.captured, payment.failed   ║
// ╚════════════════════════════════════════════════════════╝
import crypto from 'crypto';
import { sb, logAudit } from '../../lib/supabase.js';
import { PLANS, getPlanKey } from '../../lib/helpers.js';
import { sendActivationEmail } from '../email/send-zip.js';

// Vercel needs raw body for signature verification
export const config = {
  api: { bodyParser: { sizeLimit: '1mb' } }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'POST only' });
  }

  try {
    const signature = req.headers['x-razorpay-signature'];
    const secret    = process.env.RAZORPAY_WEBHOOK_SECRET;

    // Verify signature
    if (secret && signature) {
      const body = JSON.stringify(req.body);
      const expected = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');
      if (expected !== signature) {
        console.warn('Webhook signature mismatch');
        return res.status(400).json({ success: false, error: 'Invalid signature' });
      }
    }

    const event = req.body?.event;
    const payment = req.body?.payload?.payment?.entity;

    if (event !== 'payment.captured' || !payment) {
      // Just acknowledge other events
      return res.status(200).json({ success: true, ignored: true, event });
    }

    const orderId    = payment.order_id;
    const paymentId  = payment.id;
    const amount     = payment.amount / 100;  // paise → rupees
    const notes      = payment.notes || {};
    const email      = (notes.email || payment.email || '').toLowerCase().trim();
    const tool       = notes.tool || 'shipping';
    const plan       = notes.plan || 'monthly';

    if (!email) {
      console.warn('Webhook: no email in notes');
      return res.status(200).json({ success: true, ignored: true });
    }

    // Idempotency check
    const { data: existing } = await sb
      .from('subscriptions')
      .select('id')
      .eq('razorpay_payment_id', paymentId)
      .maybeSingle();

    if (existing) {
      return res.status(200).json({ success: true, alreadyProcessed: true });
    }

    const planKey = getPlanKey(tool, plan);
    const config  = PLANS[planKey];
    const days    = config?.days || 30;
    const expires = new Date(Date.now() + days * 86400 * 1000);

    await sb.from('subscriptions').insert({
      email, tool, plan,
      status: 'active',
      amount,
      razorpay_order_id:   orderId,
      razorpay_payment_id: paymentId,
      started_at: new Date().toISOString(),
      expires_at: expires.toISOString()
    });

    logAudit(email, 'webhook_payment', tool, { plan, amount, paymentId });

    // Send activation email with ZIP
    sendActivationEmail({ email, tool, plan, expiresAt: expires })
      .catch(e => console.warn('Webhook activation email failed:', e.message));

    return res.status(200).json({ success: true });

  } catch (e) {
    console.error('webhook error:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
}
