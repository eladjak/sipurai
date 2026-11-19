import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import WizardProgress from "./WizardProgress";
import CharacterPicker from "../shared/CharacterPicker";

vi.mock("@/components/i18n/i18nProvider", () => ({
  useI18n: () => ({ t: (key) => key }),
}));
vi.mock("@/hooks/useCharacterSelector", () => ({
  default: () => ({
    savedCharacters: [{ id: "saved-1", name: "Saved hero" }],
    isLoading: false,
    entityToSelection: (x) => ({ ...x, id: `entity_${x.id}`, isEntity: true }),
  }),
}));

describe("wizard interaction regressions", () => {
  it("lets RTL direction determine order without reversing twice", () => {
    render(
      <WizardProgress
        isRTL
        steps={[
          { id: "a", title: "First" },
          { id: "b", title: "Second" },
        ]}
        currentStep={0}
        onStepClick={() => {}}
      />,
    );
    const navigation = screen.getByRole("navigation");
    expect(navigation.dir).toBe("rtl");
    expect(navigation.firstElementChild.className).not.toContain(
      "flex-row-reverse",
    );
    expect(screen.getAllByRole("button")[0].getAttribute("aria-current")).toBe(
      "step",
    );
  });
  it("never adds the same surprise character twice even after repeated clicks", () => {
    localStorage.clear();
    function Harness() {
      const [selected, setSelected] = useState([]);
      return (
        <>
          <CharacterPicker
            selectedCharacters={selected}
            onCharactersChange={setSelected}
            language="english"
          />
          <output data-testid="ids">
            {selected.map((c) => c.id).join(",")}
          </output>
        </>
      );
    }
    render(<Harness />);
    const surprise = screen.getByRole("button", {
      name: "characterPicker.surpriseLabel",
    });
    for (let i = 0; i < 8; i++) fireEvent.click(surprise);
    const ids = screen.getByTestId("ids").textContent.split(",");
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
  });
  it("selects an existing saved character directly", () => {
    localStorage.clear();
    function Harness() {
      const [selected, setSelected] = useState([]);
      return (
        <>
          <CharacterPicker
            selectedCharacters={selected}
            onCharactersChange={setSelected}
            language="english"
          />
          <output data-testid="ids">
            {selected.map((c) => c.id).join(",")}
          </output>
        </>
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Saved hero" }));
    expect(screen.getByTestId("ids").textContent).toBe("entity_saved-1");
  });

  it("adds a custom character to the story using the form with a description", () => {
    const change = vi.fn();
    render(<CharacterPicker selectedCharacters={[]} onCharactersChange={change} language="hebrew" isRTL />);
    const open = screen.getByRole("button", { name: "characterPicker.addCustomButton" });
    fireEvent.click(open);
    const name = screen.getByLabelText("characterPicker.charNameLabel");
    expect(document.activeElement).toBe(name);
    expect(screen.getByRole("button", { name: "characterPicker.addButton" }).disabled).toBe(true);
    fireEvent.change(name, { target: { value: "  דני הדובי  " } });
    fireEvent.change(screen.getByLabelText("characterPicker.customTraits"), { target: { value: "סקרן ואוהב כוכבים" } });
    fireEvent.submit(name.form);
    expect(change).toHaveBeenCalledOnce();
    expect(change.mock.calls[0][0][0]).toMatchObject({
      name: "דני הדובי", traits: "סקרן ואוהב כוכבים", isEntity: false, isTemplate: false,
    });
    expect(open.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(open);
  });

  it("keeps invalid custom character input editable without adding it", () => {
    const change = vi.fn();
    render(<CharacterPicker selectedCharacters={[]} onCharactersChange={change} language="english" />);
    fireEvent.click(screen.getByRole("button", { name: "characterPicker.addCustomButton" }));
    const name = screen.getByLabelText("characterPicker.charNameLabel");
    fireEvent.change(name, { target: { value: "<b></b>" } });
    fireEvent.submit(name.form);
    expect(change).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(name.value).toBe("<b></b>");
  });

  it("does not auto-add a prior browser user name", () => {
    localStorage.setItem("childName", "Private previous child");
    const change = vi.fn();
    render(
      <CharacterPicker
        selectedCharacters={[]}
        onCharactersChange={change}
        language="english"
        ownerId="user-b"
      />,
    );
    expect(change).not.toHaveBeenCalled();
    expect(screen.queryByText("Private previous child")).toBeNull();
    localStorage.clear();
  });
});
