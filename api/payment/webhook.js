const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const PLAN_DAYS = { monthly: 30, quarterly: 90, yearly: 365 };

module.exports = async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers['x-razorpay-signature'];
  const body = JSON.stringify(req.body);
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');

  if (signature !== expected) return res.status(400).json({ error: 'Invalid signature' });

  const event = req.body;

  if (event.event === 'payment.captured') {
    const payment = event.payload.payment.entity;
    const email = payment.notes?.email;
    const plan = payment.notes?.plan;
    if (!email || !plan) return res.status(400).json({ error: 'Missing notes' });

    const days = PLAN_DAYS[plan];
    if (!days) return res.status(400).json({ error: 'Invalid plan' });

    const { data: existing } = await supabase
      .from('subscriptions').select('*').eq('email', email)
      .eq('status', 'active').gte('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false }).limit(1).single();

    let expiresAt = existing ? new Date(existing.expires_at) : new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    await supabase.from('subscriptions').insert({
      email, plan, status: 'active',
      razorpay_payment_id: payment.id,
      razorpay_order_id: payment.order_id,
      amount: payment.amount / 100,
      started_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString()
    });
  }

  return res.status(200).json({ received: true });
};
