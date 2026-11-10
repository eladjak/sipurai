import { describe, it, expect } from "vitest";
import { LANGUAGE_STATUS, isHidden, isBeta } from "./languageStatus";

describe("languageStatus", () => {
  it("has exactly the agreed statuses", () => {
    expect(LANGUAGE_STATUS).toEqual({ hebrew: "live", english: "live", yiddish: "hidden" });
  });

  it("only uses allowed values", () => {
    for (const v of Object.values(LANGUAGE_STATUS)) {
      expect(["live", "beta", "hidden"]).toContain(v);
    }
  });

  it("hides yiddish and shows hebrew and english", () => {
    expect(isHidden("english")).toBe(false);
    expect(isHidden("hebrew")).toBe(false);
    expect(isHidden("yiddish")).toBe(true);
  });

  it("isBeta is false for every language today", () => {
    expect(isBeta("english")).toBe(false);
    expect(isBeta("hebrew")).toBe(false);
    expect(isBeta("yiddish")).toBe(false);
  });

  it("fails closed: unknown, empty and non-string languages are hidden and not beta", () => {
    for (const l of ["klingon", "", undefined, null, 42, "toString", "__proto__", "constructor"]) {
      expect(isHidden(l)).toBe(true);
      expect(isBeta(l)).toBe(false);
    }
  });
});
