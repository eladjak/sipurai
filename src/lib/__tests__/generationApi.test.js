import { describe, it, expect, vi } from "vitest";
import handler from "../../../api/books/generation.js";
const id = "11111111-1111-4111-8111-111111111111",
  run = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function response() {
  return {
    code: 0,
    body: null,
    setHeader() {},
    status(n) {
      this.code = n;
      return this;
    },
    json(x) {
      this.body = x;
      return this;
    },
  };
}
const consent = async () => false;
describe("generation server facade", () => {
  it("denies unauthenticated before any db call", async () => {
    const db = { rpc: vi.fn() },
      res = response();
    await handler({ method: "POST", body: {} }, res, {
      auth: async () => ({ ok: false }),
      db,
    });
    expect(res.code).toBe(401);
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("enforces consent before db call", async () => {
    const db = { rpc: vi.fn() },
      res = response();
    await handler({ method: "POST", body: {} }, res, {
      auth: async () => ({ ok: true, payload: { sub: "owner" } }),
      requireConsent: async (_q, r) => {
        r.status(403).json({ error: "consent" });
        return true;
      },
      db,
    });
    expect(res.code).toBe(403);
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("binds owner exclusively to verified subject even if body spoofs owner", async () => {
    const db = {
        rpc: vi.fn(async () => ({ data: { fence: 1 }, error: null })),
      },
      res = response();
    await handler(
      {
        method: "POST",
        body: {
          action: "acquire",
          bookId: id,
          runId: run,
          owner: "stranger",
          payload: { newQuotaKey: id, seed: {} },
        },
      },
      res,
      {
        auth: async () => ({ ok: true, payload: { sub: "actual-owner" } }),
        requireConsent: consent,
        db,
      },
    );
    expect(res.code).toBe(200);
    expect(db.rpc.mock.calls[0][1].p_owner).toBe("actual-owner");
  });
  it("exposes known conflict code and fails closed for unknown DB errors", async () => {
    for (const [message, status, code] of [
      ["provenance_missing", 409, "provenance_missing"],
      ["reservation_missing", 409, "reservation_missing"],
      ["private SQL details", 503, "storage_unavailable"],
    ]) {
      const db = { rpc: vi.fn(async () => ({ error: { message } })) },
        res = response();
      await handler(
        { method: "POST", body: { action: "acquire", bookId: id, runId: run } },
        res,
        {
          auth: async () => ({ ok: true, payload: { sub: "owner" } }),
          requireConsent: consent,
          db,
        },
      );
      expect(res.code).toBe(status);
      expect(res.body.error.code).toBe(code);
    }
  });
  it("rejects unknown actions and missing fence before db access", async () => {
    const db = { rpc: vi.fn() },
      res = response();
    await handler(
      {
        method: "POST",
        body: { action: "commitPages", bookId: id, runId: run, payload: {} },
      },
      res,
      {
        auth: async () => ({ ok: true, payload: { sub: "owner" } }),
        requireConsent: consent,
        db,
      },
    );
    expect(res.code).toBe(400);
    expect(db.rpc).not.toHaveBeenCalled();
  });
});
