// Server-only generation transaction facade. Never accepts an owner from the body.
import { requireClerkAuth } from "../_lib/verifyClerk.js";
import { requireConsent } from "../_lib/consent.js";

const actions = new Set([
  "acquire",
  "renew",
  "release",
  "savePlan",
  "listRows",
  "commitPages",
  "bookWrite",
]);
const codes = new Set([
  "provenance_missing",
  "reservation_missing",
  "quota_key_mismatch",
  "seed_required",
  "seed_immutable",
  "seed_mismatch",
  "lease_busy",
  "lease_lost",
  "book_not_owned",
  "checkpoint_missing",
  "checkpoint_immutable",
  "invalid_checkpoint",
  "invalid_checkpoint_length",
  "duplicate_page_numbers",
  "page_owner_mismatch",
  "book_incomplete",
  "book_complete",
  "invalid_batch",
  "invalid_page_patch",
  "page_conflict",
  "invalid_book_patch",
  "book_conflict",
  "invalid_request",
  "invalid_action",
]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function defaultDb(env) {
  const { createClient } = await import("@supabase/supabase-js");
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  if (!url || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("not_configured");
  return createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}
export default async function handler(req, res, overrides = {}) {
  res.setHeader?.("Cache-Control", "no-store");
  if (req.method !== "POST")
    return res.status(405).json({ error: { code: "method_not_allowed" } });
  const auth = await (overrides.auth || requireClerkAuth)(req);
  const owner = auth?.ok && auth.payload?.sub;
  if (!owner) return res.status(401).json({ error: { code: "unauthorized" } });
  const env = overrides.env || process.env;
  if (
    await (overrides.requireConsent || requireConsent)(req, res, owner, {
      consentStore: overrides.consentStore,
      env,
    })
  )
    return;
  const { action, bookId, runId, fence, payload = {} } = req.body || {};
  if (
    !actions.has(action) ||
    !uuid.test(bookId || "") ||
    !uuid.test(runId || "") ||
    (action !== "acquire" && (!Number.isSafeInteger(fence) || fence < 1)) ||
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    JSON.stringify(payload).length > 1_000_000
  )
    return res.status(400).json({ error: { code: "invalid_request" } });
  try {
    const db = overrides.db || (await defaultDb(env));
    const { data, error } = await db.rpc("sipurai_generation_tx", {
      p_action: action,
      p_owner: owner,
      p_book: bookId,
      p_run: runId,
      p_fence: fence ?? null,
      p_payload: payload,
    });
    if (error) {
      const code = codes.has(error.message)
        ? error.message
        : "storage_unavailable";
      const status =
        code === "book_not_owned"
          ? 403
          : code === "storage_unavailable"
            ? 503
            : 409;
      return res.status(status).json({ error: { code } });
    }
    return res.status(200).json({ data });
  } catch {
    return res.status(503).json({ error: { code: "storage_unavailable" } });
  }
}
