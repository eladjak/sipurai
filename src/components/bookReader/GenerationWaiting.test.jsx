import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import en from "@/components/i18n/locales/en/spxWizard";
import he from "@/components/i18n/locales/he/spxWizard";
import GenerationWaiting from "./GenerationWaiting";

afterEach(cleanup);

describe.each([
  [en, "Drawing the story’s world", "2 of 2 pages written", "1 of 2 illustrations drawn"],
  [he, "מציירים את העולם של הסיפור", "נכתבו 2 מתוך 2 עמודים", "צוירו 1 מתוך 2 איורים"],
])("generation status", (language, drawing, words, artwork) => {
  const t = (key, params = {}) => key.split(".").reduce((obj, part) => obj[part], language)
    .replace(/\{(\w+)\}/g, (_, key) => params[key]);

  it("renders the real stage and counts as a single status, then stops animation when paused", () => {
    const counts = { ready: 2, illustrated: 1, total: 2 };
    const view = render(<GenerationWaiting t={t} compact message={t("spxWizard.waiting.drawing")} counts={counts} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(drawing);
    expect(status).toHaveTextContent(t("spxWizard.waiting.narrator"));
    expect(status).toHaveTextContent(words);
    expect(status).toHaveTextContent(artwork);
    expect(status.querySelector("svg")).toHaveClass("motion-safe:animate-pulse");
    expect(status.querySelector("img")).toHaveAttribute("alt", "");

    view.rerender(<GenerationWaiting t={t} compact message="Paused" counts={counts} active={false} />);
    expect(status).toHaveTextContent("Paused");
    expect(status.querySelector("svg")).toBeNull();
    expect(status).not.toHaveTextContent(t("spxWizard.waiting.narrator"));
  });

  it("announces the stage before counts exist", () => {
    const message = t("spxWizard.waiting.outline");
    render(<GenerationWaiting t={t} title="Creating" message={message} />);
    expect(screen.getByRole("status")).toHaveTextContent(message);
    expect(screen.queryByText(words)).toBeNull();
  });
});
