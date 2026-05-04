const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    const { data: existing } = await supabase
      .from('demos').select('*').eq('email', email).single();

    if (existing) return res.status(400).json({ error: 'Demo already used', alreadyUsed: true });

    await supabase.from('demos').insert({
      email, started_at: new Date().toISOString(), status: 'active'
    });

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 2);

    return res.json({ success: true, expiresAt: expiresAt.toISOString(), minutesLeft: 120 });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
