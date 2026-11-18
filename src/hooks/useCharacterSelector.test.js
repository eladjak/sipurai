import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock secureEntity to pass through in tests
vi.mock("@/lib/secureEntity", () => ({
  createSecureEntity: (entity) => entity,
}));

vi.mock("@/entities/Character", () => ({
  Character: {
    list: vi.fn().mockResolvedValue([
      { id: "char-1", name: "Hero", personality: "brave", primary_image_url: "http://img.com/hero.png", age: 10, gender: "boy" },
      { id: "char-2", name: "Sidekick", personality: "funny", primary_image_url: null, age: 8, gender: "girl" },
    ]),
  },
}));

import useCharacterSelector from "./useCharacterSelector";
import { Character } from "@/entities/Character";

// Fresh QueryClient per test to avoid cache leaking between tests
function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }) => React.createElement(QueryClientProvider, { client: qc }, children);
}

describe("useCharacterSelector hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Character.list).mockResolvedValue([
      { id: "char-1", name: "Hero", personality: "brave", primary_image_url: "http://img.com/hero.png", age: 10, gender: "boy" },
      { id: "char-2", name: "Sidekick", personality: "funny", primary_image_url: null, age: 8, gender: "girl" },
    ]);
  });

  it("does not request characters before account identity is known", () => {
    const { result } = renderHook(() => useCharacterSelector(null), { wrapper: createWrapper() });
    expect(Character.list).not.toHaveBeenCalled();
    expect(result.current.savedCharacters).toEqual([]);
  });

  it("never returns account A cached characters while loading account B", async () => {
    vi.mocked(Character.list).mockResolvedValueOnce([{id:"a",name:"Private A"}]).mockResolvedValueOnce([{id:"b",name:"Private B"}]);
    const { result, rerender } = renderHook(({ owner }) => useCharacterSelector(owner), { wrapper: createWrapper(), initialProps: { owner: "user-a" } });
    await waitFor(() => expect(result.current.savedCharacters[0]?.name).toBe("Private A"));
    rerender({ owner: "user-b" });
    expect(result.current.savedCharacters.some(c => c.name === "Private A")).toBe(false);
    await waitFor(() => expect(result.current.savedCharacters[0]?.name).toBe("Private B"));
  });

  it("returns initial loading state", () => {
    const { result } = renderHook(() => useCharacterSelector("user-a"), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
  });

  it("loads characters from entity", async () => {
    const { result } = renderHook(() => useCharacterSelector("user-a"), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.savedCharacters).toHaveLength(2);
    expect(result.current.savedCharacters[0].name).toBe("Hero");
    expect(result.current.savedCharacters[1].name).toBe("Sidekick");
  });

  it("returns empty array when no characters exist", async () => {
    vi.mocked(Character.list).mockResolvedValueOnce([]);

    const { result } = renderHook(() => useCharacterSelector("user-a"), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.savedCharacters).toHaveLength(0);
  });

  it("handles error gracefully without crashing", async () => {
    vi.mocked(Character.list).mockRejectedValueOnce(new Error("Failed to load"));

    const { result } = renderHook(() => useCharacterSelector("user-a"), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Should not crash — silently handled
    expect(result.current.isLoading).toBe(false);
    expect(Array.isArray(result.current.savedCharacters)).toBe(true);
  });

  it("entityToSelection converts entity correctly", async () => {
    const { result } = renderHook(() => useCharacterSelector("user-a"), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const entity = { id: "char-1", name: "Hero", personality: "brave", primary_image_url: "http://img.com/hero.png", age: 10, gender: "boy" };
    const selection = result.current.entityToSelection(entity);

    expect(selection.id).toBe("entity_char-1");
    expect(selection.entityId).toBe("char-1");
    expect(selection.name).toBe("Hero");
    expect(selection.traits).toBe("brave");
    expect(selection.age).toBe(10);
    expect(selection.gender).toBe("boy");
  });

  it("entityToSelection sets isEntity=true and isTemplate=false", async () => {
    const { result } = renderHook(() => useCharacterSelector("user-a"), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const entity = { id: "char-1", name: "Hero", personality: "brave", primary_image_url: null, age: 10, gender: "boy" };
    const selection = result.current.entityToSelection(entity);

    expect(selection.isEntity).toBe(true);
    expect(selection.isTemplate).toBe(false);
  });

  it("entityToSelection uses primary_image_url as avatar", async () => {
    const { result } = renderHook(() => useCharacterSelector("user-a"), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const entityWithImage = { id: "c1", name: "A", personality: "", primary_image_url: "http://img.com/hero.png", age: 5, gender: "boy" };
    const entityNoImage = { id: "c2", name: "B", personality: "", primary_image_url: null, age: 5, gender: "girl" };

    expect(result.current.entityToSelection(entityWithImage).avatar).toBe("http://img.com/hero.png");
    expect(result.current.entityToSelection(entityNoImage).avatar).toBeNull();
  });

  it("templateToSelection converts template correctly", async () => {
    const { result } = renderHook(() => useCharacterSelector("user-a"), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const template = { id: "tmpl-1", en: "Brave Hero", he: "גיבור אמיץ", traits: "brave, strong", emoji: "🦸" };
    const selection = result.current.templateToSelection(template, false);

    expect(selection.id).toBe("tmpl-1");
    expect(selection.name).toBe("Brave Hero");
    expect(selection.traits).toBe("brave, strong");
    expect(selection.emoji).toBe("🦸");
    expect(selection.avatar).toBeNull();
  });

  it("templateToSelection sets isTemplate=true and isEntity=false", async () => {
    const { result } = renderHook(() => useCharacterSelector("user-a"), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const template = { id: "tmpl-1", en: "Brave Hero", he: "גיבור אמיץ", traits: "brave", emoji: "🦸" };
    const selection = result.current.templateToSelection(template, false);

    expect(selection.isTemplate).toBe(true);
    expect(selection.isEntity).toBe(false);
  });

  it("templateToSelection uses Hebrew name when isHebrew is true", async () => {
    const { result } = renderHook(() => useCharacterSelector("user-a"), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const template = { id: "tmpl-1", en: "Brave Hero", he: "גיבור אמיץ", traits: "brave", emoji: "🦸" };
    const selectionEn = result.current.templateToSelection(template, false);
    const selectionHe = result.current.templateToSelection(template, true);

    expect(selectionEn.name).toBe("Brave Hero");
    expect(selectionHe.name).toBe("גיבור אמיץ");
  });

  it("reload function triggers character reload", async () => {
    const { result } = renderHook(() => useCharacterSelector("user-a"), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const callCountBefore = vi.mocked(Character.list).mock.calls.length;

    await act(async () => {
      await result.current.reload();
    });

    expect(vi.mocked(Character.list).mock.calls.length).toBeGreaterThan(callCountBefore);
  });
});
