import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDailyPrompt } from "./dailyPrompt";

const idea = { title: "t", description: "d" };

describe("getDailyPrompt", () => {
  beforeEach(() => localStorage.clear());

  it("shares one request between concurrent callers (the double-call bug)", async () => {
    let resolve;
    const generate = vi.fn(() => new Promise((r) => { resolve = r; }));
    const a = getDailyPrompt("hebrew", generate, "Mon");
    const b = getDailyPrompt("hebrew", generate, "Mon");
    resolve(idea);
    expect(await a).toEqual(idea);
    expect(await b).toEqual(idea);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("serves from cache on the same day, regenerates on a new day", async () => {
    const generate = vi.fn().mockResolvedValue(idea);
    await getDailyPrompt("hebrew", generate, "Mon");
    await getDailyPrompt("hebrew", generate, "Mon");
    expect(generate).toHaveBeenCalledTimes(1);
    await getDailyPrompt("hebrew", generate, "Tue");
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("keeps a separate entry per language", async () => {
    const generate = vi.fn().mockResolvedValue(idea);
    await getDailyPrompt("hebrew", generate, "Mon");
    await getDailyPrompt("english", generate, "Mon");
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failure and lets the next call retry", async () => {
    const generate = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(idea);
    await expect(getDailyPrompt("hebrew", generate, "Mon")).rejects.toThrow("boom");
    expect(await getDailyPrompt("hebrew", generate, "Mon")).toEqual(idea);
    expect(generate).toHaveBeenCalledTimes(2);
  });
});
