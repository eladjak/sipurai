import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/apiAuth", () => ({
  getApiAuthHeaders: async () => ({ Authorization: "Bearer test" }),
}));
import { generationStore } from "@/lib/generationStore";
describe("generationStore transport", () => {
  beforeEach(() => vi.restoreAllMocks());
  it("passes lease fence and expected snapshot without flattening it", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({
        ok: true,
        json: async () => ({ data: { updated: 1 } }),
      });
    const item = {
      id: "page",
      expected: {
        text_content: "old",
        image_url: "",
        image_prompt: "",
        layout_type: "standard",
      },
      patch: { text_content: "new" },
    };
    await expect(
      generationStore.commitPages({
        bookId: "book",
        runId: "run",
        fence: 7,
        items: [item],
      }),
    ).resolves.toEqual({ updated: 1 });
    const call = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(call).toEqual({
      action: "commitPages",
      bookId: "book",
      runId: "run",
      fence: 7,
      payload: { items: [item] },
    });
  });
  it("throws exact server conflict code and fails closed on network failure", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { code: "provenance_missing" } }),
      })
      .mockRejectedValueOnce(Error("offline"));
    await expect(
      generationStore.acquire({ bookId: "x", runId: "y" }),
    ).rejects.toMatchObject({ code: "provenance_missing" });
    await expect(
      generationStore.acquire({ bookId: "x", runId: "y" }),
    ).rejects.toMatchObject({ code: "storage_unavailable" });
  });
});
