const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const email = req.query.email || req.body?.email;
  const name = req.query.name || req.body?.name || '';
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    const { data: existing } = await supabase
      .from('users').select('*').eq('email', email).single();

    if (!existing) {
      await supabase.from('users').insert({
        email, name, created_at: new Date().toISOString()
      });
    }

    const { data: sub } = await supabase
      .from('subscriptions').select('*').eq('email', email)
      .eq('status', 'active').gte('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false }).limit(1).single();

    const { data: demo } = await supabase
      .from('demos').select('*').eq('email', email).single();

    let isSubscribed = false, plan = null, expiresAt = null;
    const isDemoAvailable = !demo;

    if (sub) { isSubscribed = true; plan = sub.plan; expiresAt = sub.expires_at; }

    return res.status(200).json({
      success: true, email, name,
      isSubscribed, plan, expiresAt, isDemoAvailable
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
