import { describe, it, expect, afterEach, vi } from "vitest";

// isNewShell reads a module-level constant, so each case stubs the env and
// re-imports the module fresh.
async function load(value) {
  vi.resetModules();
  if (value === undefined) vi.stubEnv("VITE_NEW_SHELL", undefined);
  else vi.stubEnv("VITE_NEW_SHELL", value);
  return import("./flags.js");
}

describe("isNewShell", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is false when the variable is unset", async () => {
    const { isNewShell } = await load(undefined);
    expect(isNewShell()).toBe(false);
  });

  it("is true only for the exact string true", async () => {
    const { isNewShell } = await load("true");
    expect(isNewShell()).toBe(true);
  });

  it("is false for 1", async () => {
    const { isNewShell } = await load("1");
    expect(isNewShell()).toBe(false);
  });

  it("is false for TRUE", async () => {
    const { isNewShell } = await load("TRUE");
    expect(isNewShell()).toBe(false);
  });

  it("is false for the empty string and for false", async () => {
    expect((await load("")).isNewShell()).toBe(false);
    expect((await load("false")).isNewShell()).toBe(false);
  });

  it("exports the variable name", async () => {
    const { NEW_SHELL_ENV_NAME } = await load(undefined);
    expect(NEW_SHELL_ENV_NAME).toBe("VITE_NEW_SHELL");
  });
});
