// ╔════════════════════════════════════════════════════════╗
// ║  GET/POST /api/subscription/check                       ║
// ║  Query/Body: { email, tool? }                           ║
// ║  If tool given: returns access for that tool only       ║
// ║  Else: returns access for shipping + listing both       ║
// ╚════════════════════════════════════════════════════════╝
import { sb, getToolAccess } from '../../lib/supabase.js';
import { handleCors } from '../../lib/helpers.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  try {
    const email = (req.query?.email || req.body?.email || '').toLowerCase().trim();
    const tool  = req.query?.tool  || req.body?.tool  || null;

    if (!email) {
      return res.status(400).json({ success: false, error: 'email required' });
    }

    // ── Single tool check ────────────────────────────────
    if (tool) {
      const access = await getToolAccess(email, tool);
      return res.status(200).json({
        success:    true,
        isLoggedIn: true,
        email,
        tool,
        isSubscribed:    access.hasAccess && access.source === 'subscription',
        isDemoActive:    access.hasAccess && access.source === 'demo',
        plan:            access.plan       || null,
        expiresAt:       access.expiresAt  || null,
        // demo availability: demo not yet used for this tool
        isDemoAvailable: await isDemoAvailable(email, tool)
      });
    }

    // ── Multi-tool check (for dashboard) ─────────────────
    const [shippingAccess, listingAccess] = await Promise.all([
      getToolAccess(email, 'shipping'),
      getToolAccess(email, 'listing')
    ]);

    const [shippingDemoAvail, listingDemoAvail, comboDemoAvail] = await Promise.all([
      isDemoAvailable(email, 'shipping'),
      isDemoAvailable(email, 'listing'),
      isDemoAvailable(email, 'combo')
    ]);

    return res.status(200).json({
      success: true,
      isLoggedIn: true,
      email,
      shipping: {
        hasAccess:       shippingAccess.hasAccess,
        source:          shippingAccess.source,
        plan:            shippingAccess.plan,
        expiresAt:       shippingAccess.expiresAt,
        isDemoAvailable: shippingDemoAvail
      },
      listing: {
        hasAccess:       listingAccess.hasAccess,
        source:          listingAccess.source,
        plan:            listingAccess.plan,
        expiresAt:       listingAccess.expiresAt,
        isDemoAvailable: listingDemoAvail
      },
      // Combo specific demo availability (shows combo card status)
      comboDemoAvailable: comboDemoAvail
    });

  } catch (e) {
    console.error('subscription/check error:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
}

// ── Helper: has user used demo for this tool? ────────────
// Returns true if NO demo exists yet for this tool (available)
async function isDemoAvailable(email, tool) {
  const { data } = await sb
    .from('demos')
    .select('id')
    .eq('email', email)
    .eq('tool', tool)
    .limit(1);
  return !data || data.length === 0;
}
