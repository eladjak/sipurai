import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/entities/User", () => ({
  User: { me: vi.fn().mockResolvedValue(null), updateMyUserData: vi.fn(), _setClerkUser: vi.fn(), logout: vi.fn() },
}));
vi.mock("@/lib/AuthContext", () => ({
  useAuth: () => ({ user: null, isAuthenticated: false }),
}));

import { I18nProvider } from "@/components/i18n/i18nProvider";
import PageNotFound from "./PageNotFound";

function renderNotFound(language) {
  localStorage.setItem("language", language);
  return render(
    <MemoryRouter initialEntries={["/Nope"]}>
      <I18nProvider>
        <PageNotFound />
      </I18nProvider>
    </MemoryRouter>
  );
}

describe("PageNotFound language", () => {
  beforeEach(() => localStorage.clear());

  it("offers localized recovery in Hebrew without reflecting the path", async () => {
    renderNotFound("hebrew");
    await waitFor(() => expect(screen.getByRole("heading", { name: "הדף הזה לא נמצא במדף" })).toBeVisible());
    expect(screen.getByRole("link", { name: "לדף הבית" })).toHaveAttribute("href", "/");
    expect(screen.queryByText(/Nope/)).toBeNull();
  });

  it("is English in English UI", async () => {
    renderNotFound("english");
    await waitFor(() => expect(screen.getByRole("heading", { name: "This page is not on the shelf" })).toBeVisible());
    expect(screen.getByRole("link", { name: "Sample story" })).toHaveAttribute("href", "/samples/demo-dragons-garden");
    expect(screen.queryByText(/Nope/)).toBeNull();
  });
});

import "../pages/__tests__/legal-content.test.jsx";
