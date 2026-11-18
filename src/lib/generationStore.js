import { getApiAuthHeaders } from "@/lib/apiAuth";

/** Server-enforced owner/lease transaction API; no direct checkpoint table access. */
async function invoke(action, { bookId, runId, fence, ...payload }) {
  let response;
  try {
    response = await fetch("/api/books/generation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await getApiAuthHeaders()),
      },
      body: JSON.stringify({ action, bookId, runId, fence, payload }),
    });
  } catch {
    throw Object.assign(new Error("storage_unavailable"), {
      code: "storage_unavailable",
    });
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = body?.error?.code || "storage_unavailable";
    throw Object.assign(new Error(code), { code });
  }
  return body.data;
}
export const generationStore = {
  acquire: (args) => invoke("acquire", args),
  renew: (args) => invoke("renew", args),
  release: (args) => invoke("release", args),
  savePlan: (args) => invoke("savePlan", args),
  listRows: (args) => invoke("listRows", args),
  commitPages: (args) => invoke("commitPages", args),
  bookWrite: (args) => invoke("bookWrite", args),
};
