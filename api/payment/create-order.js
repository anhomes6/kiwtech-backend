// ╔════════════════════════════════════════════════════════╗
// ║  POST /api/payment/create-order                          ║
// ║  Body: { tool, plan, email }                            ║
// ║    tool: 'shipping' | 'listing' | 'combo'               ║
// ║    plan: 'monthly' | 'quarterly' | 'yearly'             ║
// ║  Creates Razorpay order, returns order details          ║
// ╚════════════════════════════════════════════════════════╝
import Razorpay from 'razorpay';
import { handleCors, PLANS, getPlanKey } from '../../lib/helpers.js';
import { logAudit } from '../../lib/supabase.js';

const rzp = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'POST only' });
  }

  try {
    const email = (req.body?.email || '').toLowerCase().trim();
    let   tool  = req.body?.tool  || 'shipping';
    let   plan  = req.body?.plan  || 'monthly';

    // BACKWARD COMPAT: old shipping landing page sends only "plan"
    // (e.g. plan: "monthly") without "tool". Default to shipping.
    if (!req.body?.tool && req.body?.plan) tool = 'shipping';

    if (!email) return res.status(400).json({ success: false, error: 'email required' });

    const planKey = getPlanKey(tool, plan);
    const config  = PLANS[planKey];
    if (!config) {
      return res.status(400).json({
        success: false,
        error: `Invalid combo: tool="${tool}", plan="${plan}"`,
        validPlans: Object.keys(PLANS)
      });
    }

    // ── Create Razorpay order ────────────────────────────
    const order = await rzp.orders.create({
      amount:   config.amount * 100,  // paise
      currency: 'INR',
      receipt:  `${tool.slice(0,3)}_${plan.slice(0,1)}_${Date.now()}`.slice(0, 40),
      notes:    { email, tool, plan }
    });

    logAudit(email, 'order_created', tool, {
      plan, amount: config.amount, orderId: order.id
    });

    return res.status(200).json({
      success:  true,
      orderId:  order.id,
      amount:   config.amount,        // INR rupees
      amountPaise: order.amount,       // paise
      currency: 'INR',
      tool, plan,
      label:    config.label
    });

  } catch (e) {
    console.error('payment/create-order error:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
}
