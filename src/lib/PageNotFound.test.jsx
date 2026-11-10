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

  it("is fully Hebrew in Hebrew UI (no English words around the page name)", async () => {
    renderNotFound("hebrew");
    await waitFor(() => expect(screen.getByText("הדף לא נמצא")).toBeInTheDocument());
    const p = screen.getByText(/"Nope"/).closest("p");
    expect(p.textContent).toBe("הדף \"Nope\" לא נמצא.");
    expect(p.textContent).not.toMatch(/The page/);
  });

  it("is English in English UI", async () => {
    renderNotFound("english");
    await waitFor(() => expect(screen.getByText("Page Not Found")).toBeInTheDocument());
    const p = screen.getByText(/"Nope"/).closest("p");
    expect(p.textContent).toBe("The page \"Nope\" could not be found.");
  });
});
