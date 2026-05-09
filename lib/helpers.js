// ╔════════════════════════════════════════════════════════╗
// ║  Common helpers — CORS, email, plan config              ║
// ╚════════════════════════════════════════════════════════╝
import nodemailer from 'nodemailer';

// ── CORS — allow extension + website ──────────────────────
export function setCors(res, origin = '*') {
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export function handleCors(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

// ── PLAN CONFIG (change pricing here) ─────────────────────
export const PLANS = {
  // Shipping Optimizer
  shipping_monthly:   { tool: 'shipping', plan: 'monthly',   amount: 699,  days: 30,  label: 'Shipping Monthly'   },
  shipping_quarterly: { tool: 'shipping', plan: 'quarterly', amount: 1499, days: 90,  label: 'Shipping Quarterly' },
  shipping_yearly:    { tool: 'shipping', plan: 'yearly',    amount: 3999, days: 365, label: 'Shipping Yearly'    },

  // AI Listing Tool
  listing_monthly:    { tool: 'listing',  plan: 'monthly',   amount: 699,  days: 30,  label: 'Listing Monthly'    },
  listing_quarterly:  { tool: 'listing',  plan: 'quarterly', amount: 1499, days: 90,  label: 'Listing Quarterly'  },
  listing_yearly:     { tool: 'listing',  plan: 'yearly',    amount: 3999, days: 365, label: 'Listing Yearly'     },

  // Combo (~30% saving)
  combo_monthly:      { tool: 'combo',    plan: 'monthly',   amount: 999,  days: 30,  label: 'Combo Monthly'      },
  combo_quarterly:    { tool: 'combo',    plan: 'quarterly', amount: 2199, days: 90,  label: 'Combo Quarterly'    },
  combo_yearly:       { tool: 'combo',    plan: 'yearly',    amount: 5499, days: 365, label: 'Combo Yearly'       }
};

export function getPlanKey(tool, plan) {
  return `${tool}_${plan}`;
}

// ── Demo duration ─────────────────────────────────────────
export const DEMO_HOURS = {
  shipping: 2,
  listing:  2,
  combo:    4   // combo demo = 4 hours since user gets both tools
};

// ── Email helper (Gmail SMTP via app password) ────────────
let _transporter = null;
function getTransporter() {
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });
  return _transporter;
}

export async function sendEmail({ to, subject, html, attachments = [] }) {
  const t = getTransporter();
  return t.sendMail({
    from: `"Kiwtech" <${process.env.GMAIL_USER}>`,
    to, subject, html, attachments
  });
}

// ── HTML wrapper for branded emails ───────────────────────
export function emailWrap(bodyHtml) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:30px 20px;background:#f4f6fb;">
    <div style="background:linear-gradient(135deg,#00c9b1,#4d7cfe);padding:28px;border-radius:14px 14px 0 0;text-align:center;">
      <h1 style="color:#fff;font-size:26px;margin:0;letter-spacing:1px;">⚡ KIWTECH</h1>
    </div>
    <div style="background:#fff;padding:30px;border-radius:0 0 14px 14px;color:#1f2937;line-height:1.7;">
      ${bodyHtml}
    </div>
    <p style="text-align:center;color:#6b7a99;font-size:12px;margin-top:18px;">
      © ${new Date().getFullYear()} Kiwtech / Arshit Traders<br/>
      Need help? WhatsApp: <a href="https://wa.me/918377065737" style="color:#4d7cfe;">+91 8377065737</a>
    </p>
  </div>`;
}
