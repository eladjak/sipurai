/**
 * The ONE place that says which privacy policy version parents must have accepted.
 * Plain ESM with no imports, so both the Vercel API and the Vite client can import it.
 *
 * Bump this string whenever the policy or terms change in a way a parent should see again.
 * Every parent whose stored consent is for another version is asked again at the gate, and
 * the AI routes refuse them (403) until they accept.
 */
export const CURRENT_POLICY_VERSION = '2026-11-10';

/** The two boxes the parent must tick. Keys are what gets stored in privacy_consents.items. */
export const CONSENT_ITEMS = ['guardian_18', 'policy_and_terms'];
