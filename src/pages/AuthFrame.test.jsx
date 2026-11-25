vi.mock("@/components/auth/AuthFeedback", () => ({ AuthFeedback: ({ children }) => children }));
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SignIn from "./SignIn";
import SignUp from "./SignUp";
const state = vi.hoisted(() => ({ language: "hebrew", shell: false }));
vi.mock("@/lib/flags", () => ({ isNewShell: () => state.shell }));
vi.mock("@/components/i18n/i18nProvider", () => ({ useI18n: () => ({ language: state.language, isRTL: state.language === "hebrew", t: () => "reassurance" }) }));
vi.mock("@clerk/clerk-react", () => ({ SignIn: () => <div>Clerk sign in</div>, SignUp: () => <div>Clerk sign up</div> }));
afterEach(cleanup);
describe("matching authentication entrances", () => {
  it.each([false, true])("uses the shared brand and illustration in both languages, shell %s", shell => {
    state.shell = shell;
    for (const language of ["hebrew", "english", "en"]) for (const Page of [SignIn, SignUp]) {
      state.language = language;
      const { unmount, container } = render(<MemoryRouter><Page /></MemoryRouter>);
      expect(screen.getByRole("img", { name: language !== "hebrew" ? "Sipurai" : "סיפוראי" })).toBeInTheDocument();
      expect(container.querySelector("img[src=\"/images/spx/hearth.webp\"]")).toBeInTheDocument();
      expect(screen.getByText("reassurance")).toBeInTheDocument();
      expect(container.querySelector("main")).toHaveAttribute("dir", language === "hebrew" ? "rtl" : "ltr");
      unmount();
    }
  });
});
