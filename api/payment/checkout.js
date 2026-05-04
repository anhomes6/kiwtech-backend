// api/payment/checkout.js
// Razorpay checkout HTML page — opens automatically in user's browser
// Webhook handles actual subscription activation server-side

export default function handler(req, res) {
  const { order_id, amount, email, plan, key } = req.query;

  if (!order_id || !amount || !email || !plan || !key) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(400).send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:40px">
        <h2>❌ Invalid checkout link</h2>
        <p>Missing required parameters. Please try again from the extension.</p>
      </body></html>
    `);
  }

  const planLabels = {
    monthly:   'Monthly Plan (₹699)',
    quarterly: 'Quarterly Plan (₹1499)',
    yearly:    'Yearly Plan (₹3999)'
  };
  const planLabel = planLabels[plan] || 'Subscription';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kiwtech Optimizer — Payment</title>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #fff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 40px;
      max-width: 480px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    }
    .logo {
      font-size: 40px;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 22px;
      margin-bottom: 8px;
      color: #f1f5f9;
    }
    .subtitle {
      color: #94a3b8;
      font-size: 14px;
      margin-bottom: 24px;
    }
    .info-box {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
      text-align: left;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 14px;
    }
    .info-row .label { color: #94a3b8; }
    .info-row .value { color: #f1f5f9; font-weight: 500; }
    .btn {
      background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%);
      color: white;
      border: none;
      padding: 14px 32px;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      transition: transform 0.1s;
    }
    .btn:hover { transform: translateY(-1px); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .status {
      margin-top: 16px;
      padding: 12px;
      border-radius: 8px;
      font-size: 14px;
      display: none;
    }
    .status.success { background: #064e3b; color: #6ee7b7; display: block; }
    .status.error   { background: #7f1d1d; color: #fca5a5; display: block; }
    .status.info    { background: #1e3a8a; color: #93c5fd; display: block; }
    .footer { color: #64748b; font-size: 12px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🚀</div>
    <h1>Kiwtech Optimizer</h1>
    <p class="subtitle">Complete your subscription</p>

    <div class="info-box">
      <div class="info-row"><span class="label">Plan:</span><span class="value">${planLabel}</span></div>
      <div class="info-row"><span class="label">Amount:</span><span class="value">₹${(amount / 100).toFixed(2)}</span></div>
      <div class="info-row"><span class="label">Email:</span><span class="value">${email}</span></div>
    </div>

    <button class="btn" id="pay-btn" onclick="openRazorpay()">💳 Pay Now</button>
    <div class="status" id="status"></div>

    <p class="footer">Secured by Razorpay • SSL encrypted</p>
  </div>

  <script>
    const ORDER_ID = ${JSON.stringify(order_id)};
    const AMOUNT   = ${JSON.stringify(amount)};
    const EMAIL    = ${JSON.stringify(email)};
    const PLAN     = ${JSON.stringify(plan)};
    const KEY      = ${JSON.stringify(key)};
    const PLAN_LABEL = ${JSON.stringify(planLabel)};

    function setStatus(msg, type) {
      const el = document.getElementById('status');
      el.textContent = msg;
      el.className = 'status ' + type;
    }

    function openRazorpay() {
      const btn = document.getElementById('pay-btn');
      btn.disabled = true;
      btn.textContent = 'Opening payment...';

      const options = {
        key: KEY,
        amount: AMOUNT,
        currency: 'INR',
        order_id: ORDER_ID,
        name: 'Kiwtech Optimizer',
        description: PLAN_LABEL,
        prefill: { email: EMAIL },
        theme: { color: '#0ea5e9' },
        handler: function(response) {
          setStatus('✅ Payment successful! Your subscription will activate in a few seconds. You can close this tab.', 'success');
          btn.style.display = 'none';
          // Webhook server-side activate karega — extension auto-refresh karega
          setTimeout(() => {
            document.querySelector('.subtitle').textContent = 'Payment complete! Refresh extension to see your active plan.';
          }, 2000);
        },
        modal: {
          ondismiss: function() {
            btn.disabled = false;
            btn.textContent = '💳 Pay Now';
            setStatus('Payment cancelled. Click "Pay Now" to try again.', 'info');
          }
        }
      };

      try {
        const rzp = new Razorpay(options);
        rzp.on('payment.failed', function(response) {
          setStatus('❌ Payment failed: ' + (response.error?.description || 'Unknown error'), 'error');
          btn.disabled = false;
          btn.textContent = '💳 Pay Now';
        });
        rzp.open();
      } catch (e) {
        setStatus('❌ Could not open payment: ' + e.message, 'error');
        btn.disabled = false;
        btn.textContent = '💳 Pay Now';
      }
    }

    // Auto-open Razorpay on page load
    window.addEventListener('load', () => {
      setTimeout(openRazorpay, 500);
    });
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
}
