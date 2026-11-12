/**
 * The ONE place that says which privacy policy version parents must have accepted.
 * Plain ESM with no imports, so both the Vercel API and the Vite client can import it.
 *
 * Bump this string whenever the policy or terms change in a way a parent should see again.
 * Every parent whose stored consent is for another version is asked again at the gate, and
 * the AI routes refuse them (403) until they accept.
 */
export const CURRENT_POLICY_VERSION = '2026-11-12';

/**
 * Grace for the version before this one: a parent who accepted it keeps the AI routes working until
 * this moment, so a child is never cut off mid-story by a deploy. The browser gate still asks once at
 * app load. After this date the previous version no longer opens the AI routes.
 */
export const PREVIOUS_POLICY_VERSION = '2026-11-10';
export const PREVIOUS_VERSION_ACCEPTED_UNTIL = '2026-12-15T23:59:59+02:00';

/** The three boxes the parent must tick. Keys are what gets stored in privacy_consents.items. */
export const CONSENT_ITEMS = ['guardian_18', 'privacy_children_abroad', 'terms'];
