/**
 * Vercel Serverless Function — Creem checkout proxy.
 *
 * Creates a Creem checkout session and returns the hosted checkout URL.
 * CREEM_API_KEY is kept server-side and never exposed to the browser.
 *
 * POST { productId, customerEmail, successUrl, cancelUrl }
 * → { checkout_url }
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'https://sipurai.ai',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', CORS_HEADERS['Access-Control-Allow-Origin']);
    res.setHeader('Access-Control-Allow-Methods', CORS_HEADERS['Access-Control-Allow-Methods']);
    res.setHeader('Access-Control-Allow-Headers', CORS_HEADERS['Access-Control-Allow-Headers']);
    return res.status(204).end();
  }

  // Set CORS on all responses
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.setHeader(key, value);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Shekel billing is not open yet: block Israeli visitors before touching Creem.
  const country = String(req.headers?.['x-vercel-ip-country'] || '').toUpperCase();
  if (country === 'IL' && process.env.BILLING_ILS_ENABLED !== 'true') {
    return res.status(409).json({
      error: 'il_billing_not_open',
      message: 'Shekel billing for Israel is not open yet',
    });
  }

  const apiKey = process.env.CREEM_API_KEY;
  if (!apiKey) {
    console.error('[checkout] CREEM_API_KEY is not set');
    return res.status(500).json({ error: 'Payment provider not configured' });
  }

  const {
    productId,
    customerEmail,
    successUrl = 'https://sipurai.ai/settings?checkout=success',
    cancelUrl = 'https://sipurai.ai/settings',
  } = req.body || {};

  if (!productId) {
    return res.status(400).json({ error: 'productId is required' });
  }

  const payload = {
    product_id: productId,
    success_url: successUrl,
  };

  if (customerEmail) {
    payload.customer = { email: customerEmail };
  }

  try {
    const response = await fetch('https://api.creem.io/v1/checkouts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[checkout] Creem API error:', response.status, data);
      return res.status(response.status).json({
        error: data?.message || 'Failed to create checkout session',
      });
    }

    // Creem returns checkout_url (or url) in the response
    const checkoutUrl = data.checkout_url || data.url;
    if (!checkoutUrl) {
      console.error('[checkout] Creem response missing checkout_url:', data);
      return res.status(502).json({ error: 'Invalid response from payment provider' });
    }

    return res.status(200).json({ checkout_url: checkoutUrl });
  } catch (err) {
    console.error('[checkout] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
