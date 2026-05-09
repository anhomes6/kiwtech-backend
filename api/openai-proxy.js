// ╔════════════════════════════════════════════════════════╗
// ║  POST /api/openai-proxy                                  ║
// ║  Body: { email, payload (OpenAI request body) }         ║
// ║  Validates listing access → forwards to OpenAI          ║
// ║  CRITICAL: This replaces direct OpenAI calls in extension║
// ║  Old leaked key never gets exposed to clients again.    ║
// ╚════════════════════════════════════════════════════════╝
import { sb, getToolAccess, logAudit } from '../lib/supabase.js';
import { handleCors } from '../lib/helpers.js';

const OPENAI_KEY = process.env.OPENAI_API_KEY;

// Allowed models (whitelist to prevent abuse)
const ALLOWED_MODELS = new Set([
  'gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1-nano',
  'gpt-5-mini', 'gpt-5-nano', 'gpt-5.1',
  'gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'
]);

const MAX_TOKENS_CAP = 4000;

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'POST only' });
  }

  try {
    const email   = (req.body?.email || '').toLowerCase().trim();
    const payload = req.body?.payload;

    if (!email)   return res.status(400).json({ success: false, error: 'email required' });
    if (!payload) return res.status(400).json({ success: false, error: 'payload required' });

    // ── 1. Verify access (subscription OR demo for listing) ──
    const access = await getToolAccess(email, 'listing');
    if (!access.hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'No active listing subscription or demo. Please subscribe at https://kiwtech-website.vercel.app/dashboard'
      });
    }

    // ── 2. Sanitize payload ──────────────────────────────
    if (payload.model && !ALLOWED_MODELS.has(payload.model)) {
      payload.model = 'gpt-4o-mini';  // fallback to cheap model
    }
    if (payload.max_tokens && payload.max_tokens > MAX_TOKENS_CAP) {
      payload.max_tokens = MAX_TOKENS_CAP;
    }

    // ── 3. Forward to OpenAI ─────────────────────────────
    if (!OPENAI_KEY) {
      return res.status(500).json({ success: false, error: 'OpenAI not configured' });
    }

    const oaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const data = await oaiRes.json();

    if (data.error) {
      logAudit(email, 'openai_error', 'listing', { error: data.error.message });
      return res.status(500).json({ success: false, error: data.error.message });
    }

    // Log usage (lightweight)
    const tokens = data.usage?.total_tokens || 0;
    logAudit(email, 'openai_call', 'listing', {
      model: payload.model, tokens, source: access.source
    });

    return res.status(200).json({
      success: true,
      content: data.choices?.[0]?.message?.content || '',
      usage:   data.usage,
      model:   data.model
    });

  } catch (e) {
    console.error('openai-proxy error:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
}
