import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AppShell from "../AppShell";

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({ user: { font_size: "large", text_density: "low" } }),
}));
vi.mock("@/components/i18n/i18nProvider", () => ({
  useI18n: () => ({ t: (key) => key, language: "hebrew", isRTL: true }),
}));

function mount(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppShell>
        <p>Child content</p>
      </AppShell>
    </MemoryRouter>,
  );
}

describe("app shell", () => {
  it.each([
    ["/", "shell.tonight"],
    ["/shelf", "shell.shelf"],
    ["/heroes", "shell.heroes"],
    ["/parents", "shell.parents"],
  ])("marks %s as current and renders four tabs", (path, label) => {
    mount(path);
    const nav = screen.getByRole("navigation", { name: "shell.navigation" });
    const links = nav.querySelectorAll("a");
    expect([...links].map((link) => link.getAttribute("href"))).toEqual([
      "/",
      "/shelf",
      "/heroes",
      "/parents",
    ]);
    expect(
      screen.getAllByText(label)[0].closest("a").getAttribute("aria-current"),
    ).toBe("page");
    expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });
  it("renders the desktop rail, child and accessible skip destination", () => {
    mount();
    expect(screen.getByRole("complementary")).toBeTruthy();
    expect(screen.getByText("Child content")).toBeTruthy();
    const skip = screen.getByText("shell.skip");
    expect(skip.getAttribute("href")).toBe("#main-content");
    fireEvent.click(skip);
    expect(document.activeElement).toBe(screen.getByRole("main"));
    expect(screen.getByRole("main").closest(".sp-shell").className).toContain(
      "text-lg",
    );
  });
});
