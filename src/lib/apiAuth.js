/**
 * Shared Clerk token accessor for first-party API routes (/api/ai/*).
 *
 * AuthContext registers Clerk's getToken() here once Clerk is loaded. The AI /
 * TTS providers use getApiAuthHeaders() to attach the user's Clerk session JWT
 * so the serverless routes can verify the caller is authenticated (preventing
 * anonymous visitors from burning Gemini/OpenAI quota).
 *
 * Note: this uses the DEFAULT Clerk session token (not the 'supabase' template).
 * The server route (api/_lib/verifyClerk.js) verifies its RS256 signature
 * against the Clerk JWKS.
 */

let _getToken = null;

/** @param {((opts?: { template?: string }) => Promise<string|null>) | null} fn */
export function setApiTokenGetter(fn) {
  _getToken = fn;
}

/**
 * Returns an object with an Authorization header carrying the Clerk session
 * token, or an empty object if no token is available (signed-out / not loaded).
 * @returns {Promise<Record<string,string>>}
 */
export async function getApiAuthHeaders() {
  if (!_getToken) return {};
  try {
    const token = await _getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}
