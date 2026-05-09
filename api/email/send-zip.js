// ╔════════════════════════════════════════════════════════╗
// ║  Email helper: activation email with ZIP download links  ║
// ║  Uses signed URLs to download tools from Supabase Storage ║
// ║  (or static URLs if you host ZIPs elsewhere)             ║
// ╚════════════════════════════════════════════════════════╝
import { sb } from '../../lib/supabase.js';
import { sendEmail, emailWrap, handleCors } from '../../lib/helpers.js';

// ── Config: where ZIP files are hosted ───────────────────
// OPTION A: Upload to Supabase Storage bucket 'tools' (recommended)
// OPTION B: Static URLs (Google Drive direct download links / GitHub releases)
const ZIP_URLS = {
  shipping: process.env.SHIPPING_ZIP_URL || 'https://github.com/anhomes6/kiwtech-tools/releases/latest/download/shipping.zip',
  listing:  process.env.LISTING_ZIP_URL  || 'https://github.com/anhomes6/kiwtech-tools/releases/latest/download/listing.zip'
};

const TOOL_LABELS = {
  shipping: '📦 Kiwtech Shipping Optimizer',
  listing:  '🤖 Kiwtech AI Listing Tool',
  combo:    '🎁 Kiwtech Combo Pack'
};

// ── Main: send activation/download email with ZIP link(s) ─
export async function sendActivationEmail({ email, tool, plan, expiresAt, isDemo = false }) {
  const SITE = process.env.SITE_URL || 'https://kiwtech-website.vercel.app';
  const expiry = new Date(expiresAt).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  const toolsToSend = tool === 'combo' ? ['shipping', 'listing'] : [tool];

  // Build download buttons
  const downloadButtons = toolsToSend.map(t => `
    <div style="margin:14px 0;">
      <a href="${ZIP_URLS[t]}"
         style="display:inline-block;background:linear-gradient(135deg,#00c9b1,#4d7cfe);color:#fff;
                padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">
        ⬇️ Download ${TOOL_LABELS[t]}
      </a>
    </div>
  `).join('');

  const headerText = isDemo ? '⚡ Demo Tool Download' : '🎉 Subscription Activated!';
  const introText = isDemo
    ? `Aapka FREE demo active hai for <strong>${TOOL_LABELS[tool]}</strong>. Niche se tool download karo.`
    : `Bahut shukriya! Aapka <strong>${TOOL_LABELS[tool]}</strong> activate ho gaya hai.`;

  const html = emailWrap(`
    <h2 style="margin-top:0;color:#0e1522;">${headerText}</h2>
    <p>${introText}</p>

    <div style="background:#f0fdfa;border-left:4px solid #00c9b1;padding:14px 18px;border-radius:8px;margin:18px 0;">
      <p style="margin:0;font-size:13px;color:#065f46;">
        <strong>${isDemo ? 'Demo' : 'Plan'}:</strong> ${plan.toUpperCase()}<br/>
        <strong>Valid till:</strong> ${expiry}<br/>
        <strong>Account:</strong> ${email}
      </p>
    </div>

    <h3 style="margin-top:24px;font-size:16px;">📥 Download Karo:</h3>
    ${downloadButtons}

    <h3 style="margin-top:24px;font-size:16px;">🚀 Install Steps:</h3>
    <ol style="padding-left:20px;line-height:2;">
      <li>ZIP download karke extract karo</li>
      <li>Chrome mein khol: <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;">chrome://extensions</code></li>
      <li>Top right pe <strong>"Developer mode"</strong> ON karo</li>
      <li><strong>"Load Unpacked"</strong> click karke extracted folder select karo</li>
      <li>Meesho supplier panel khol — tool button automatically aa jayega</li>
      <li>Tool mein <strong>${email}</strong> se Google login karo (same email)</li>
    </ol>

    <p style="margin-top:24px;text-align:center;">
      <a href="${SITE}/dashboard" style="background:#0e1522;color:#fff;padding:10px 22px;border-radius:8px;text-decoration:none;font-weight:700;">
        🏠 Dashboard pe jao
      </a>
    </p>

    <p style="margin-top:24px;font-size:13px;color:#6b7a99;">
      Koi dikkat? WhatsApp pe message karo:
      <a href="https://wa.me/918377065737" style="color:#4d7cfe;">+91 8377065737</a>
    </p>
  `);

  const subjectPrefix = isDemo ? '⚡ Demo Tool —' : '✅';
  return sendEmail({
    to: email,
    subject: `${subjectPrefix} ${TOOL_LABELS[tool]}`,
    html
  });
}

// ── HTTP endpoint version (for manual re-send / dashboard download button) ─
export default async function handler(req, res) {
  // FIX: Handle CORS preflight
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

    const now = new Date().toISOString();

    // ── Check active subscription first (matching tool OR combo) ─
    const { data: sub } = await sb
      .from('subscriptions')
      .select('plan, expires_at, tool')
      .eq('email', email)
      .in('tool', [tool, 'combo'])
      .eq('status', 'active')
      .gt('expires_at', now)
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sub) {
      try {
        await sendActivationEmail({
          email, tool,
          plan: sub.plan,
          expiresAt: sub.expires_at,
          isDemo: false
        });
        console.log('✅ activation email sent to:', email);
        return res.status(200).json({ success: true });
      } catch (emailErr) {
        console.error('❌ activation email failed:', emailErr.message);
        return res.status(500).json({ success: false, error: 'Email send failed: ' + emailErr.message });
      }
    }

    // ── No subscription? Check active demo (allow demo download too) ─
    const { data: demo } = await sb
      .from('demos')
      .select('expires_at, tool')
      .eq('email', email)
      .in('tool', [tool, 'combo'])
      .eq('status', 'active')
      .gt('expires_at', now)
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (demo) {
      try {
        await sendActivationEmail({
          email, tool,
          plan: 'demo',
          expiresAt: demo.expires_at,
          isDemo: true
        });
        console.log('✅ demo download email sent to:', email);
        return res.status(200).json({ success: true });
      } catch (emailErr) {
        console.error('❌ demo download email failed:', emailErr.message);
        return res.status(500).json({ success: false, error: 'Email send failed: ' + emailErr.message });
      }
    }

    // ── No active subscription or demo ──────────────────────
    return res.status(403).json({
      success: false,
      error: 'No active subscription or demo found for this tool'
    });

  } catch (e) {
    console.error('send-zip error:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
}
