const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const PLAN_CONFIG = {
  699:  { plan: 'monthly',   days: 30,  label: 'Monthly (30 Din)' },
  1499: { plan: 'quarterly', days: 90,  label: 'Quarterly (90 Din)' },
  3999: { plan: 'yearly',    days: 365, label: 'Yearly (365 Din)' },
  499:  { plan: 'other',     days: 30,  label: 'Other Tool (30 Din)' },
  10:   { plan: 'test',      days: 1,   label: 'Test Plan' },
};

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

async function sendActivationEmail(email, planLabel, expiresAt) {
  const expiry = new Date(expiresAt).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  const downloadLink = 'https://drive.google.com/file/d/1lu9Tvd0pUUBDa29LudxtHiUIzYAe1rsm/view?usp=sharing';

  const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,sans-serif;"><div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);"><div style="background:linear-gradient(135deg,#00c9b1,#4d7cfe);padding:36px 32px;text-align:center;"><div style="font-size:40px;margin-bottom:8px;">🚀</div><h1 style="color:#ffffff;font-size:24px;margin:0;font-weight:800;">Kiwtech Optimizer</h1><p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Aapka subscription activate ho gaya!</p></div><div style="padding:32px;"><p style="font-size:16px;color:#1e293b;margin-bottom:8px;">Namaste! 👋</p><p style="font-size:14px;color:#475569;line-height:1.7;margin-bottom:24px;">Aapka <strong>' + planLabel + '</strong> plan successfully activate ho gaya hai.</p><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:24px;"><div style="padding:8px 0;border-bottom:1px solid #e2e8f0;"><span style="color:#64748b;font-size:13px;">Plan: </span><span style="color:#1e293b;font-size:13px;font-weight:600;">' + planLabel + '</span></div><div style="padding:8px 0;border-bottom:1px solid #e2e8f0;"><span style="color:#64748b;font-size:13px;">Email: </span><span style="color:#1e293b;font-size:13px;font-weight:600;">' + email + '</span></div><div style="padding:8px 0;"><span style="color:#64748b;font-size:13px;">Valid Tak: </span><span style="color:#10b981;font-size:13px;font-weight:600;">' + expiry + '</span></div></div><div style="text-align:center;margin-bottom:28px;"><p style="font-size:14px;color:#475569;margin-bottom:16px;">Extension download karo aur install karo:</p><a href="' + downloadLink + '" style="display:inline-block;background:linear-gradient(135deg,#00c9b1,#4d7cfe);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:700;">📦 Extension Download Karo</a></div><div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin-bottom:24px;"><p style="font-size:13px;font-weight:700;color:#166534;margin-bottom:12px;">📋 Install Kaise Karo:</p><ol style="font-size:13px;color:#166534;line-height:2;padding-left:18px;margin:0;"><li>ZIP file download karo aur extract karo</li><li>Chrome mein chrome://extensions kholo</li><li>Developer mode ON karo (top right)</li><li>Load unpacked - extracted folder select karo</li><li>Meesho Supplier Panel kholo - Google se login karo</li><li>Tool automatically active ho jaayega!</li></ol></div><p style="font-size:13px;color:#94a3b8;text-align:center;">Koi problem ho toh WhatsApp karo: <a href="https://wa.me/918377065737" style="color:#00c9b1;">+91 83770 65737</a></p></div><div style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;"><p style="font-size:12px;color:#94a3b8;margin:0;">2026 Kiwtech / Arshit Traders | <a href="mailto:kiwtechsolution@gmail.com" style="color:#00c9b1;">kiwtechsolution@gmail.com</a></p></div></div></body></html>';

  await transporter.sendMail({
    from: '"Kiwtech Optimizer" <' + process.env.GMAIL_USER + '>',
    to: email,
    subject: 'Aapka Kiwtech ' + planLabel + ' Activate Ho Gaya! - Extension Download Link',
    html: html
  });
}

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  try {
    const rawBody = await getRawBody(req);
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    if (signature !== expected) {
      console.log('Signature mismatch!');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(rawBody);
    console.log('Event:', event.event);

    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      const email = payment.email || payment.notes?.email;
      const amount = payment.amount / 100;

      console.log('Payment: ' + amount + ' Email: ' + email);

      const config = PLAN_CONFIG[amount];
      if (!config) {
        console.log('Unknown amount: ' + amount);
        return res.status(200).json({ received: true });
      }

      const { days, label } = config;

      const { data: existing } = await supabase
        .from('subscriptions').select('*').eq('email', email)
        .eq('status', 'active').gte('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: false }).limit(1).single();

      let expiresAt = existing ? new Date(existing.expires_at) : new Date();
      expiresAt.setDate(expiresAt.getDate() + days);

      await supabase.from('subscriptions').insert({
        email, plan: config.plan, status: 'active',
        razorpay_payment_id: payment.id,
        razorpay_order_id: payment.order_id,
        amount: amount,
        started_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString()
      });

      try {
        await sendActivationEmail(email, label, expiresAt);
        console.log('Email sent to ' + email);
      } catch (emailErr) {
        console.error('Email failed: ' + emailErr.message);
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook error: ' + err.message);
    return res.status(500).json({ error: err.message });
  }
};

module.exports.config = {
  api: { bodyParser: false }
};
