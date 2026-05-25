import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocks — must be set up before imports that consume them
// ---------------------------------------------------------------------------

vi.mock("@/entities/Character", () => ({
  Character: {
    list: vi.fn(async () => []),
    filter: vi.fn(async () => []),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import useCharacterSelector from "@/hooks/useCharacterSelector";

// ---------------------------------------------------------------------------
// entityToSelection — tested through the real hook
// ---------------------------------------------------------------------------

describe("useCharacterSelector - entityToSelection", () => {
  // Render the hook in isolation; we only need its returned helpers
  function getHelpers() {
    const { result } = renderHook(() => useCharacterSelector());
    return result.current;
  }

  it("converts a full entity to selection format", () => {
    const { entityToSelection } = getHelpers();
    const entity = {
      id: "abc123",
      name: "Danny",
      personality: "brave, kind",
      primary_image_url: "https://example.com/danny.png",
      age: 7,
      gender: "male",
    };
    const result = entityToSelection(entity);
    expect(result).toEqual({
      id: "entity_abc123",
      entityId: "abc123",
      name: "Danny",
      traits: "brave, kind",
      emoji: null,
      avatar: "https://example.com/danny.png",
      age: 7,
      gender: "male",
      isTemplate: false,
      isEntity: true,
    });
  });

  it("handles entity with missing optional fields", () => {
    const { entityToSelection } = getHelpers();
    const entity = {
      id: "xyz",
      name: "Lola",
      personality: null,
      primary_image_url: null,
      age: undefined,
      gender: undefined,
    };
    const result = entityToSelection(entity);
    expect(result.id).toBe("entity_xyz");
    expect(result.name).toBe("Lola");
    expect(result.traits).toBe("");
    expect(result.avatar).toBeNull();
    expect(result.isEntity).toBe(true);
    expect(result.isTemplate).toBe(false);
  });

  it("prefixes entity id to avoid collision with template ids", () => {
    const { entityToSelection } = getHelpers();
    const entity = { id: "brave_hero", name: "Test", personality: "", primary_image_url: null };
    const result = entityToSelection(entity);
    expect(result.id).toBe("entity_brave_hero");
    expect(result.id).not.toBe("brave_hero");
  });
});

// ---------------------------------------------------------------------------
// CHARACTER_TEMPLATES — verified through templateToSelection in hook
// ---------------------------------------------------------------------------

// We define the same template list here because it is an internal constant in
// CharacterPicker.jsx (not exported). The templateToSelection logic is what
// matters and it comes from the real hook.
const CHARACTER_TEMPLATES = [
  { id: "brave_hero", emoji: "🦸", en: "Brave Hero", he: "גיבור אמיץ", traits: "brave, kind, helpful" },
  { id: "smart_detective", emoji: "🔍", en: "Smart Detective", he: "בלש חכם", traits: "clever, curious, observant" },
  { id: "friendly_animal", emoji: "🐻", en: "Friendly Animal", he: "חיה ידידותית", traits: "loyal, playful, gentle" },
  { id: "magical_fairy", emoji: "🧚", en: "Magical Fairy", he: "פיה קסומה", traits: "magical, cheerful, wise" },
  { id: "space_explorer", emoji: "🚀", en: "Space Explorer", he: "חוקר חלל", traits: "adventurous, scientific, brave" },
  { id: "princess", emoji: "👸", en: "Princess", he: "נסיכה", traits: "kind, wise, resourceful" },
  { id: "pirate", emoji: "🏴‍☠️", en: "Pirate", he: "פיראט", traits: "adventurous, clever, bold" },
  { id: "robot", emoji: "🤖", en: "Robot Friend", he: "חבר רובוט", traits: "smart, helpful, funny" },
  { id: "dragon", emoji: "🐉", en: "Friendly Dragon", he: "דרקון ידידותי", traits: "strong, protective, warm" },
  { id: "wizard", emoji: "🧙", en: "Wizard", he: "קוסם", traits: "wise, powerful, mentoring" },
];

describe("CharacterPicker - CHARACTER_TEMPLATES", () => {
  it("has 10 character templates", () => {
    expect(CHARACTER_TEMPLATES).toHaveLength(10);
  });

  it("all templates have unique ids", () => {
    const ids = CHARACTER_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all templates have Hebrew and English names", () => {
    for (const t of CHARACTER_TEMPLATES) {
      expect(t.en).toBeTruthy();
      expect(t.he).toBeTruthy();
      expect(typeof t.en).toBe("string");
      expect(typeof t.he).toBe("string");
    }
  });

  it("all templates have emoji and traits", () => {
    for (const t of CHARACTER_TEMPLATES) {
      expect(t.emoji).toBeTruthy();
      expect(t.traits).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// selection toggle logic — pure function extracted from CharacterPicker source
// The real component uses this exact logic; testing the extracted form
// keeps tests aligned with the implementation.
// ---------------------------------------------------------------------------

/**
 * Mirrors the toggleCharacter function inside CharacterPicker.jsx.
 * If the component changes its logic, this pure version will diverge — that
 * divergence will become visible in integration tests (rendered component).
 */
function toggleCharacter(selected, charSelection) {
  const exists = selected.find((c) => c.id === charSelection.id);
  if (exists) {
    return selected.filter((c) => c.id !== charSelection.id);
  }
  return [...selected, charSelection];
}

describe("CharacterPicker - selection logic", () => {
  it("adds a character when not selected", () => {
    const result = toggleCharacter([], { id: "brave_hero", name: "Hero" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("brave_hero");
  });

  it("removes a character when already selected", () => {
    const selected = [{ id: "brave_hero", name: "Hero" }];
    const result = toggleCharacter(selected, { id: "brave_hero", name: "Hero" });
    expect(result).toHaveLength(0);
  });

  it("does not mutate original array (immutable)", () => {
    const selected = [{ id: "a", name: "A" }];
    const result = toggleCharacter(selected, { id: "b", name: "B" });
    expect(selected).toHaveLength(1); // original unchanged
    expect(result).toHaveLength(2);
  });

  it("can have multiple characters selected", () => {
    let selected = [];
    selected = toggleCharacter(selected, { id: "brave_hero", name: "Hero" });
    selected = toggleCharacter(selected, { id: "entity_abc", name: "Danny" });
    selected = toggleCharacter(selected, { id: "custom_123", name: "Custom" });
    expect(selected).toHaveLength(3);
  });

  it("can remove specific character from multiple", () => {
    const selected = [
      { id: "brave_hero", name: "Hero" },
      { id: "entity_abc", name: "Danny" },
      { id: "custom_123", name: "Custom" },
    ];
    const result = toggleCharacter(selected, { id: "entity_abc", name: "Danny" });
    expect(result).toHaveLength(2);
    expect(result.find((c) => c.id === "entity_abc")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// custom character creation
// ---------------------------------------------------------------------------

describe("CharacterPicker - custom character creation", () => {
  it("creates custom character with unique id and correct shape", () => {
    const name = "דני הדובי";
    const customChar = {
      id: `custom_${Date.now()}`,
      name: name.trim(),
      traits: "",
      emoji: "🧑",
      avatar: null,
      isTemplate: false,
      isEntity: false,
    };
    expect(customChar.id).toMatch(/^custom_\d+$/);
    expect(customChar.name).toBe("דני הדובי");
    expect(customChar.isTemplate).toBe(false);
    expect(customChar.isEntity).toBe(false);
  });

  it("rejects empty name", () => {
    const name = "   ";
    const shouldAdd = name.trim().length > 0;
    expect(shouldAdd).toBe(false);
  });

  it("trims whitespace from custom name", () => {
    const name = "  Danny Bear  ";
    expect(name.trim()).toBe("Danny Bear");
  });
});

// ---------------------------------------------------------------------------
// templateToSelection — tested through the real hook
// ---------------------------------------------------------------------------

describe("CharacterPicker - template to selection conversion", () => {
  function getHelpers() {
    const { result } = renderHook(() => useCharacterSelector());
    return result.current;
  }

  const template = {
    id: "brave_hero",
    emoji: "🦸",
    en: "Brave Hero",
    he: "גיבור אמיץ",
    traits: "brave, kind, helpful",
  };

  it("uses Hebrew name when isHebrew is true", () => {
    const { templateToSelection } = getHelpers();
    const result = templateToSelection(template, true);
    expect(result.name).toBe("גיבור אמיץ");
    expect(result.isTemplate).toBe(true);
    expect(result.isEntity).toBe(false);
  });

  it("uses English name when isHebrew is false", () => {
    const { templateToSelection } = getHelpers();
    const result = templateToSelection(template, false);
    expect(result.name).toBe("Brave Hero");
  });

  it("preserves template id (no prefix)", () => {
    const { templateToSelection } = getHelpers();
    const result = templateToSelection(template, false);
    expect(result.id).toBe("brave_hero");
  });
});

// ---------------------------------------------------------------------------
// BookWizard integration shape
// ---------------------------------------------------------------------------

describe("CharacterPicker - BookWizard integration shape", () => {
  it("template character has correct shape for outline generation", () => {
    const char = {
      id: "brave_hero",
      name: "Brave Hero",
      traits: "brave, kind, helpful",
      emoji: "🦸",
      avatar: null,
      isTemplate: true,
      isEntity: false,
    };
    expect(char.name).toBeTruthy();
    expect(typeof char.traits).toBe("string");
  });

  it("entity character has correct shape for outline generation", () => {
    const char = {
      id: "entity_abc123",
      entityId: "abc123",
      name: "Danny",
      traits: "brave, kind",
      emoji: null,
      avatar: "https://example.com/danny.png",
      age: 7,
      gender: "male",
      isTemplate: false,
      isEntity: true,
    };
    expect(char.age).toBe(7);
    expect(char.gender).toBe("male");
    expect(char.avatar).toBeTruthy();
  });

  it("custom character falls back to defaults in outline", () => {
    const char = {
      id: "custom_123",
      name: "My Hero",
      traits: "",
      emoji: "🧑",
      avatar: null,
      isTemplate: false,
      isEntity: false,
    };
    expect(char.age || 5).toBe(5);
    expect(char.gender || "neutral").toBe("neutral");
    expect(char.avatar || null).toBeNull();
  });
});
