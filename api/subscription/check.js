const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const email = req.query.email || req.body?.email;
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    const { data: sub } = await supabase
      .from('subscriptions').select('*').eq('email', email)
      .eq('status', 'active').gte('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false }).limit(1).single();

    if (sub) {
      return res.json({
        isSubscribed: true, plan: sub.plan, expiresAt: sub.expires_at,
        daysLeft: Math.ceil((new Date(sub.expires_at) - new Date()) / (1000*60*60*24))
      });
    }

    const { data: demo } = await supabase
      .from('demos').select('*').eq('email', email).single();

    if (!demo) return res.json({ isSubscribed: false, isDemoAvailable: true, plan: null });

    if (demo && demo.status === 'active') {
      const demoExpiry = new Date(demo.started_at);
      demoExpiry.setHours(demoExpiry.getHours() + 2);
      if (new Date() < demoExpiry) {
        return res.json({
          isSubscribed: true, plan: 'demo', expiresAt: demoExpiry.toISOString(),
          minutesLeft: Math.ceil((demoExpiry - new Date()) / 60000)
        });
      }
    }

    return res.json({ isSubscribed: false, isDemoAvailable: false, plan: null });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
