import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InvokeLLM } from "@/integrations/Core";
import { buildRecipe } from "@/lib/bookRecipe";
import StoryStructure from "./StoryStructure";
import RhymeOptions from "@/components/bookCreation/RhymeOptions";
import wizardLabels from "@/components/i18n/locales/he/spxWizard";

vi.mock("@/integrations/Core", () => ({ InvokeLLM: vi.fn() }));
vi.mock("@/components/i18n/i18nProvider", () => ({
  useI18n: () => ({
    t(key, values) {
      const phrase = key.split(".").reduce((messages, keyPart) => messages?.[keyPart], wizardLabels);
      return (phrase || key).replace(/\{(\w+)\}/g, (_match, name) => values?.[name] ?? "");
    },
  }),
}));

const characters = [{ id: "hero", name: "תמר" }];
const bookData = { title: "מעבר להר", language: "hebrew", art_style: "watercolor" };
const fixtureScenes = [
  { id: "forest", role: "beginning", title: "מגיעים ליער", description: "תמר נכנסת ליער.", characters: ["hero"] },
  { id: "spring", role: "conflict", title: "מחפשים מים", description: "תמר יוצאת לחפש מעיין.", characters: ["hero"] },
  { id: "house", role: "end", title: "חוזרים הביתה", description: "תמר חוזרת הביתה.", characters: ["hero"] },
];

function Fixture({ initial = [] }) {
  const [scenes, setScenes] = useState(initial);
  return <>
    <StoryStructure scenes={scenes} onScenesChange={setScenes} isRTL language="hebrew"
      topic="custom" customIdea="טיול בשביל ההר" selectedCharacters={characters} />
    <output data-testid="checkpoint" hidden>{JSON.stringify(buildRecipe({ scenes, bookData, characters }).checkpointInputs())}</output>
  </>;
}

const checkpoint = () => JSON.parse(screen.getByTestId("checkpoint").textContent);
const tiles = () => screen.getAllByRole("listitem");

describe("storyboard", () => {
  it("previews selected inputs and opens six blank stations for editing without generation", () => {
    render(<Fixture />);
    const direction = screen.getByRole("region", { name: "כיוון הסיפור" });
    expect(within(direction).getByText("טיול בשביל ההר")).toBeTruthy();
    expect(within(direction).getByText("תמר")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "storyBuilder.structure.six" }));
    fireEvent.click(screen.getByRole("button", { name: "לכתוב את התחנות בעצמנו" }));
    expect(checkpoint().scenes).toHaveLength(6);
    expect(checkpoint().scenes[0].characters).toEqual(["hero"]);
    const first = tiles()[0];
    fireEvent.click(first.querySelector("summary"));
    const title = within(first).getByLabelText("storyBuilder.scene.title");
    fireEvent.change(title, { target: { value: "תמר מוצאת מפה" } });
    fireEvent.click(first.querySelector("summary"));
    expect(first.querySelector("details").open).toBe(false);
    expect(checkpoint().scenes[0].title).toBe("תמר מוצאת מפה");
    expect(InvokeLLM).not.toHaveBeenCalled();
  });

  it("reorders real DOM cards, keeps the editor open and supplies the same sequence to the outline recipe", async () => {
    render(<Fixture initial={fixtureScenes} />);
    const initialTile = tiles()[1];
    fireEvent.click(initialTile.querySelector("summary"));
    const earlier = within(initialTile).getByRole("button", { name: "להקדים את מחפשים מים" });
    earlier.focus();
    fireEvent.click(earlier);
    expect(tiles()[0]).toBe(initialTile);
    expect(initialTile.querySelector("details").open).toBe(true);
    const { scenes } = checkpoint();
    expect(scenes.map(scene => scene.id)).toEqual(["spring", "forest", "house"]);
    expect(buildRecipe({ scenes, bookData, characters }).outlinePrompt).toContain(
      JSON.stringify(scenes.map(({ title, description }) => ({ title, description }))),
    );
    await waitFor(() => expect(document.activeElement.getAttribute("aria-label")).toBe("לאחר את מחפשים מים"));
    expect(await screen.findByText("התחנה ״מחפשים מים״ עברה למקום 1.")).toBeTruthy();
  });

  it("holds the station order while an existing single-station request is pending", async () => {
    let resolve;
    vi.mocked(InvokeLLM).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    render(<Fixture initial={fixtureScenes} />);
    const second = tiles()[1];
    fireEvent.click(second.querySelector("summary"));
    fireEvent.click(within(second).getByRole("button", { name: "storyBuilder.scene.regenerate" }));
    const earlier = within(second).getByRole("button", { name: "להקדים את מחפשים מים" });
    expect(earlier.matches(":disabled")).toBe(true);
    fireEvent.click(earlier);
    expect(checkpoint().scenes.map(scene => scene.id)).toEqual(["forest", "spring", "house"]);
    resolve({ role: "conflict", title: "יורד גשם", description: "המעיין מתמלא.", characters: ["hero"] });
    await waitFor(() => expect(checkpoint().scenes[1].title).toBe("יורד גשם"));
    expect(checkpoint().scenes.map(scene => scene.id)).toEqual(["forest", "spring", "house"]);
  });

  it("shows only supported rhyme controls in the wizard with a concrete verse example", () => {
    render(<RhymeOptions patternOnly rhymeSettings={{ pattern: "aabb" }} setRhymeSettings={vi.fn()} />);
    expect(screen.getByRole("combobox")).toBeTruthy();
    expect(screen.queryByText("rhyme.meter.label")).toBeNull();
    expect(screen.getByText("הראשונה והשנייה מתחרזות. השלישית והרביעית מתחרזות.")).toBeTruthy();
    fireEvent.click(screen.getByText("דוגמת חריזה"));
    expect(screen.getByText(/תמר טיפסה על סולם/)).toBeTruthy();
  });

  it("retains the default rhyme flag and requested pattern in the standard recipe", () => {
    const pattern = { pattern: "abab", meter: "free", complexity: "simple" };
    const input = { bookData, characters, scenes: fixtureScenes, rhymeSettings: pattern };
    const prose = buildRecipe(input);
    const rhyming = buildRecipe({ ...input, useRhyming: true });
    expect(prose.pageTextPrompt({}, 1)).not.toContain("ABAB");
    expect(rhyming.pageTextPrompt({}, 1)).toContain("ABAB");
    expect(rhyming.checkpointInputs()).toMatchObject({ useRhyming: true, rhymeSettings: pattern });
  });
});
