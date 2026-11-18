import { describe, expect, it } from "vitest";
import { createDraftEditionManifest, editionDraft } from "./model";

describe("paper preferences", () => {
  it.each(["standard", "chrome-matte-130", "chrome-matte-170", "premium"])("preserves %s through a saved edition", paper => {
    expect(editionDraft({ version: 1, paper }).paper).toBe(paper);
  });
  it.each([["standard", "white-110gsm"], ["chrome-matte-130", "chrome-matte-130"], ["chrome-matte-170", "chrome-matte-170"]])("passes %s to the proof without a silent substitution", (paper, expected) => {
    const edition = editionDraft({ version: 1, paper });
    const manifest = createDraftEditionManifest({ id: "b", title: "Book", language: "hebrew" }, [], edition, x => x);
    expect(manifest.paper).toBe(expected);
    expect(manifest.requestedFinishing.paper).toBe(paper);
  });
});

it("refuses a legacy unspecified stock before preparing proof", () => {
  const edition = editionDraft({ version: 1, paper: "premium" });
  expect(() => createDraftEditionManifest({ id: "b", title: "Book", language: "hebrew" }, [], edition, x => x)).toThrow("Paper choice required");
});
