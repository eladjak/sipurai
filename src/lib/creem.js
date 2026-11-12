/**
 * Creem checkout integration for Sipurai subscriptions.
 *
 * Calls our own serverless endpoint (/api/payments/checkout) which
 * proxies to Creem and keeps the API key server-side.
 *
 * Creem charges in USD only. Price text shown to visitors comes from
 * src/lib/pricing.js (shekels for Israelis, dollars for everyone else).
 */

export const PLANS = {
  free: {
    id: 'free',
    name: { en: 'Free', he: 'חינמי' },
    priceUsd: 0,
    features: {
      en: [
        '5 books per month',
        '6 art styles',
        'Community access',
        '1 PDF export per month',
      ],
      he: [
        '5 ספרים בחודש',
        '6 סגנונות איור',
        'גישה לקהילה',
        'ייצוא PDF אחד בחודש',
      ],
    },
  },
  lite: {
    id: 'lite',
    creemProductId: import.meta.env.VITE_CREEM_PRODUCT_LITE,
    name: { en: 'Lite', he: 'לייט' },
    priceUsd: 3.90,
    features: {
      en: [
        '15 books per month',
        'All 18 art styles',
        'Unlimited PDF export',
        'No ads',
      ],
      he: [
        '15 ספרים בחודש',
        'כל 18 סגנונות האיור',
        'ייצוא PDF ללא הגבלה',
        'ללא פרסומות',
      ],
    },
  },
  premium: {
    id: 'premium',
    creemProductId: import.meta.env.VITE_CREEM_PRODUCT_PREMIUM,
    name: { en: 'Premium', he: 'פרימיום' },
    priceUsd: 7.90,
    popular: true,
    features: {
      en: [
        'Unlimited books',
        'All 18 art styles',
        'PDF export',
        'Priority support',
      ],
      he: [
        'ספרים ללא הגבלה',
        'כל 18 סגנונות האיור',
        'ייצוא PDF',
        'תמיכה מועדפת',
      ],
    },
  },
  family: {
    id: 'family',
    creemProductId: import.meta.env.VITE_CREEM_PRODUCT_FAMILY,
    name: { en: 'Family', he: 'משפחתי' },
    priceUsd: 9.90,
    features: {
      en: [
        'Up to 5 child profiles',
        'All Premium features',
        'Priority support',
        'Early access to new features',
      ],
      he: [
        'עד 5 פרופילי ילדים',
        'כל תכונות הפרימיום',
        'תמיכה מועדפת',
        'גישה מוקדמת לתכונות חדשות',
      ],
    },
  },
};

/**
 * Open Creem checkout for the given plan by calling our serverless proxy.
 * Redirects the user to the hosted Creem checkout page on success.
 */
export async function openCheckout(planId, userEmail) {
  const plan = PLANS[planId];
  if (!plan?.creemProductId) {
    if (import.meta.env.DEV) console.warn('[creem] Unknown planId or no product ID:', planId);
    return;
  }

  const successUrl = `${window.location.origin}/Settings?checkout=success&plan=${planId}`;

  try {
    const response = await fetch('/api/payments/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: plan.creemProductId,
        customerEmail: userEmail || undefined,
        successUrl,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('[creem] Checkout error:', err);
      const error = new Error(err.error || 'Failed to create checkout');
      error.code = err.error;
      error.status = response.status;
      throw error;
    }

    const { checkout_url } = await response.json();
    if (checkout_url) {
      window.location.href = checkout_url;
    }
  } catch (err) {
    console.error('[creem] openCheckout failed:', err);
    throw err;
  }
}

/**
 * Get the user's current plan from their metadata / Supabase row.
 */
export function getUserPlan(user) {
  return user?.subscription_tier || 'free';
}

/** True when the server refused checkout because paid plans are closed for this visitor's country. */
export function isBillingClosedError(err) {
  return err?.status === 409 && (err?.code === 'il_billing_not_open' || err?.code === 'country_unknown');
}

export const BILLING_CLOSED_MESSAGE = {
  he: 'התשלום בשקלים לתוכניות בתשלום ייפתח בקרוב. בינתיים אפשר להמשיך בתוכנית החינמית.',
  en: 'Paid plans are not open in your country yet. You can keep using the free plan.',
};
