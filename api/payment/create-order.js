const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const PLANS = {
  monthly:   { amount: 69900,  label: '1 Month'  },
  quarterly: { amount: 149900, label: '3 Months' },
  yearly:    { amount: 399900, label: '1 Year'   }
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { plan, email } = req.body || {};
  if (!plan || !email) return res.status(400).json({ error: 'Plan and email required' });

  const planInfo = PLANS[plan];
  if (!planInfo) return res.status(400).json({ error: 'Invalid plan' });

  try {
    const order = await razorpay.orders.create({
      amount: planInfo.amount, currency: 'INR',
      receipt: `kiwtech_${plan}_${Date.now()}`,
      notes: { email, plan }
    });
    return res.json({
      success: true, orderId: order.id,
      amount: planInfo.amount, currency: 'INR',
      plan, label: planInfo.label,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
