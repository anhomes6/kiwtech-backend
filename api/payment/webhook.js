const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const PLAN_DAYS = { monthly: 30, quarterly: 90, yearly: 365 };
const PLAN_LABELS = { monthly: 'Monthly (30 Din)', quarterly: 'Quarterly (90 Din)', yearly: 'Yearly (365 Din)' };
const ZIP_LINK = 'https://drive.google.com/file/d/1YVmrhNT7F-I8KuftoZuswDaXwgXQuyQ5/view?usp=sharing';

// ─── Email Transporter ─────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,  // kiwtechsolution@gmail.com
    pass: process.env.GMAIL_PASS   // App Password
  }
});

// ─── Send Activation Email ─────────────────────────────────────────────────
async function sendActivationEmail(email, plan, expiresAt) {
  const planLabel = PLAN_LABELS[plan] || plan;
  const expiry = new Date(expiresAt).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#00c9b1,#4d7cfe);padding:36px 32px;text-align:center;">
      <div style="font-size:40px;margin-bottom:8px;">🚀</div>
      <h1 style="color:#ffffff;font-size:24px;margin:0;font-weight:800;">Kiwtech Optimizer</h1>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Aapka subscription activate ho gaya!</p>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="font-size:16px;color:#1e293b;margin-bottom:8px;">Namaste! 👋</p>
      <p style="font-size:14px;color:#475569;line-height:1.7;margin-bottom:24px;">
        Aapka <strong>${planLabel}</strong> plan successfully activate ho gaya hai. 
        Ab aap Meesho Supplier Panel pe Kiwtech Optimizer use kar sakte ho!
      </p>

      <!-- Plan Info Box -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:24px;">
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e2e8f0;">
          <span style="color:#64748b;font-size:13px;">Plan</span>
          <span style="color:#1e293b;font-size:13px;font-weight:600;">${planLabel}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e2e8f0;">
          <span style="color:#64748b;font-size:13px;">Email</span>
          <span style="color:#1e293b;font-size:13px;font-weight:600;">${email}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;">
          <span style="color:#64748b;font-size:13px;">Valid Tak</span>
          <span style="color:#10b981;font-size:13px;font-weight:600;">${expiry}</span>
        </div>
      </div>

      <!-- Download Button -->
      <div style="text-align:center;margin-bottom:28px;">
        <p style="font-size:14px;color:#475569;margin-bottom:16px;">
          Neeche se extension download karo aur install karo:
        </p>
        <a href="${ZIP_LINK}" 
           style="display:inline-block;background:linear-gradient(135deg,#00c9b1,#4d7cfe);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:700;">
          📦 Extension Download Karo
        </a>
      </div>

      <!-- Install Steps -->
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin-bottom:24px;">
        <p style="font-size:13px;font-weight:700;color:#166534;margin-bottom:12px;">📋 Install Kaise Karo:</p>
        <ol style="font-size:13px;color:#166534;line-height:2;padding-left:18px;margin:0;">
          <li>ZIP file download karo aur extract karo</li>
          <li>Chrome mein <strong>chrome://extensions</strong> kholo</li>
          <li><strong>Developer mode</strong> ON karo (top right)</li>
          <li><strong>Load unpacked</strong> → extracted folder select karo</li>
          <li>Meesho Supplier Panel kholo → Google se login karo</li>
          <li>Tool automatically active ho jaayega! ✅</li>
        </ol>
      </div>

      <p style="font-size:13px;color:#94a3b8;text-align:center;">
        Koi problem ho toh WhatsApp karo: 
        <a href="https://wa.me/918377065737" style="color:#00c9b1;">+91 83770 65737</a>
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
      <p style="font-size:12px;color:#94a3b8;margin:0;">
        © 2026 Kiwtech / Arshit Traders &nbsp;|&nbsp; 
        <a href="mailto:kiwtechsolution@gmail.com" style="color:#00c9b1;">kiwtechsolution@gmail.com</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  await transporter.sendMail({
    from: `"Kiwtech Optimizer" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `✅ Aapka Kiwtech ${planLabel} Activate Ho Gaya! — Extension Download Link`,
    html
  });
}

// ─── Webhook Handler ───────────────────────────────────────────────────────
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
    const plan  = payment.notes?.plan;

    if (!email || !plan) return res.status(400).json({ error: 'Missing notes' });

    const days = PLAN_DAYS[plan];
    if (!days) return res.status(400).json({ error: 'Invalid plan' });

    // Existing subscription check — extend karo agar pehle se active hai
    const { data: existing } = await supabase
      .from('subscriptions').select('*').eq('email', email)
      .eq('status', 'active').gte('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false }).limit(1).single();

    let expiresAt = existing ? new Date(existing.expires_at) : new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    // Supabase mein save karo
    await supabase.from('subscriptions').insert({
      email, plan, status: 'active',
      razorpay_payment_id: payment.id,
      razorpay_order_id:   payment.order_id,
      amount:              payment.amount / 100,
      started_at:          new Date().toISOString(),
      expires_at:          expiresAt.toISOString()
    });

    // Email bhejo — error aaye toh bhi webhook fail mat karo
    try {
      await sendActivationEmail(email, plan, expiresAt);
      console.log(`✅ Email sent to ${email}`);
    } catch (emailErr) {
      console.error('Email send failed:', emailErr.message);
    }
  }

  return res.status(200).json({ received: true });
};
