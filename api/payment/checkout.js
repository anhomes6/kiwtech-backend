// ╔════════════════════════════════════════════════════════╗
// ║  GET /api/payment/checkout                               ║
// ║  Query: order_id, amount, email, tool, plan, key        ║
// ║  Returns HTML page that loads Razorpay checkout SDK     ║
// ╚════════════════════════════════════════════════════════╝
import { handleCors } from '../../lib/helpers.js';

export default function handler(req, res) {
  if (handleCors(req, res)) return;

  const { order_id, amount, email, tool = 'shipping', plan = 'monthly', key } = req.query || {};

  if (!order_id || !amount || !email || !key) {
    res.status(400).send('Missing required params');
    return;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Kiwtech — Payment</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;600&display=swap" rel="stylesheet"/>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{
    font-family:'DM Sans',sans-serif;
    background:linear-gradient(135deg,#080c14,#0e1522);
    color:#e8edf8;min-height:100vh;
    display:flex;align-items:center;justify-content:center;padding:20px;
  }
  .card{
    background:#0e1522;border:1px solid #1a2540;
    border-radius:18px;padding:36px;max-width:440px;width:100%;
    text-align:center;
  }
  h1{font-family:'Syne',sans-serif;font-size:22px;margin-bottom:8px;
     background:linear-gradient(90deg,#00c9b1,#4d7cfe);
     -webkit-background-clip:text;-webkit-text-fill-color:transparent;}
  .summary{
    background:#080c14;border:1px solid #1a2540;border-radius:12px;
    padding:20px;margin:24px 0;text-align:left;
  }
  .row{display:flex;justify-content:space-between;padding:8px 0;font-size:14px;}
  .row b{font-weight:700;color:#00c9b1;}
  .amt{font-family:'Syne',sans-serif;font-size:32px;font-weight:800;
       background:linear-gradient(90deg,#00c9b1,#4d7cfe);
       -webkit-background-clip:text;-webkit-text-fill-color:transparent;
       margin:8px 0;}
  .btn{
    background:linear-gradient(135deg,#00c9b1,#4d7cfe);
    color:#fff;font-weight:700;font-size:15px;padding:14px 32px;
    border:none;border-radius:10px;cursor:pointer;width:100%;
    margin-top:8px;
  }
  .btn:disabled{opacity:0.5;cursor:not-allowed;}
  .status{margin-top:16px;font-size:13px;color:#6b7a99;min-height:18px;}
  .err{color:#ef4444;}
  .ok{color:#22c55e;}
  .spinner{
    width:36px;height:36px;border:3px solid #1a2540;
    border-top-color:#00c9b1;border-radius:50%;
    animation:spin 0.8s linear infinite;margin:18px auto;display:none;
  }
  @keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>
  <div class="card">
    <h1>⚡ Kiwtech</h1>
    <p style="color:#6b7a99;font-size:13px;">Secure Payment — Razorpay</p>
    <div class="summary">
      <div class="row"><span>Tool</span><b>${escapeHtml(tool.toUpperCase())}</b></div>
      <div class="row"><span>Plan</span><b>${escapeHtml(plan.toUpperCase())}</b></div>
      <div class="row"><span>Email</span><b style="font-size:11px;">${escapeHtml(email)}</b></div>
    </div>
    <div style="font-size:12px;color:#6b7a99;">Total Amount</div>
    <div class="amt">₹${escapeHtml(amount)}</div>
    <button class="btn" id="payBtn" onclick="startPayment()">💳 Pay Now</button>
    <div class="spinner" id="spinner"></div>
    <div class="status" id="status">🔒 UPI / Cards / Net Banking — sab supported</div>
  </div>
<script>
  const ORDER_ID = ${JSON.stringify(order_id)};
  const AMOUNT   = ${JSON.stringify(amount)};
  const EMAIL    = ${JSON.stringify(email)};
  const TOOL     = ${JSON.stringify(tool)};
  const PLAN     = ${JSON.stringify(plan)};
  const KEY      = ${JSON.stringify(key)};

  function startPayment() {
    document.getElementById('payBtn').disabled = true;
    document.getElementById('spinner').style.display = 'block';
    document.getElementById('status').textContent = 'Razorpay khul raha hai...';

    const opts = {
      key: KEY,
      amount: parseInt(AMOUNT) * 100,
      currency: 'INR',
      name: 'Kiwtech',
      description: TOOL.toUpperCase() + ' — ' + PLAN,
      order_id: ORDER_ID,
      prefill: { email: EMAIL },
      theme: { color: '#00c9b1' },
      handler: function(response) {
        const s = document.getElementById('status');
        s.className = 'status ok';
        s.textContent = '✅ Payment successful! Tool activate ho raha hai...';
        document.getElementById('spinner').style.display = 'none';

        // Notify backend (server-side webhook will also confirm)
        fetch('/api/payment/verify', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({
            razorpay_order_id:    response.razorpay_order_id,
            razorpay_payment_id:  response.razorpay_payment_id,
            razorpay_signature:   response.razorpay_signature,
            email: EMAIL, tool: TOOL, plan: PLAN
          })
        }).then(r => r.json()).then(d => {
          if (d.success) {
            s.textContent = '✅ Payment confirmed! Tool email pe bhej diya hai. Dashboard pe jao →';
            setTimeout(() => {
              window.location.href = (d.siteUrl || 'https://kiwtech-website.vercel.app') + '/dashboard';
            }, 2000);
          } else {
            s.className = 'status err';
            s.textContent = '⚠️ Payment ho gaya but activation pending — WhatsApp pe contact karo';
          }
        }).catch(() => {
          s.className = 'status ok';
          s.textContent = '✅ Payment ho gaya — webhook se confirm hoga 1-2 min mein';
        });
      },
      modal: {
        ondismiss: function() {
          document.getElementById('payBtn').disabled = false;
          document.getElementById('spinner').style.display = 'none';
          const s = document.getElementById('status');
          s.className = 'status err';
          s.textContent = 'Payment cancel kiya gaya. Wapas try karo?';
        }
      }
    };
    const rzp = new Razorpay(opts);
    rzp.open();
    rzp.on('payment.failed', function(response) {
      const s = document.getElementById('status');
      s.className = 'status err';
      s.textContent = '❌ Payment failed: ' + (response.error.description || 'Try again');
      document.getElementById('payBtn').disabled = false;
      document.getElementById('spinner').style.display = 'none';
    });
  }

  // Auto-start checkout on load (small delay so page renders first)
  setTimeout(startPayment, 500);
</script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
