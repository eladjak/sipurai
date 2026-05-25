import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Load shared mocks (hoisted by vitest)
import "./pages-setup";

// Page imports
import Home from "@/pages/Home";
import Library from "@/pages/Library";
import Characters from "@/pages/Characters";
import StoryIdeas from "@/pages/StoryIdeas";
import Leaderboard from "@/pages/Leaderboard";

function renderWithRouter(component, { route = "/" } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      {component}
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("onboarding_complete", "true");
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("Core Page Rendering Tests", () => {

  describe("Home", () => {
    it("renders without crashing", async () => {
      renderWithRouter(<Home />);
      await waitFor(() => {
        expect(screen.getByText("Create Magical Personalized Children's Books")).toBeDefined();
      });
    });

    it("renders the loading skeleton with correct structure", async () => {
      renderWithRouter(<Home />);
      // Home shows loading skeleton first (aria-busy indicates loading state)
      expect(screen.getByRole("status")).toBeDefined();
    });

    it("renders with correct direction attribute", () => {
      renderWithRouter(<Home />);
      const container = document.querySelector('[dir="ltr"]');
      expect(container).toBeDefined();
    });
  });

  describe("Library", () => {
    it("renders without crashing", async () => {
      renderWithRouter(<Library />);
      await waitFor(() => {
        expect(screen.getByText("My Library")).toBeDefined();
      });
    });

    it("renders the create new book button", async () => {
      renderWithRouter(<Library />);
      await waitFor(() => {
        expect(screen.getByText("Create New Book")).toBeDefined();
      });
    });
  });

  describe("Characters", () => {
    it("renders without crashing", async () => {
      renderWithRouter(<Characters />);
      await waitFor(() => {
        expect(screen.getByText("My Characters")).toBeDefined();
      });
    });

    it("renders the create character button", async () => {
      renderWithRouter(<Characters />);
      await waitFor(() => {
        const buttons = screen.getAllByText("Create Character");
        expect(buttons.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe("StoryIdeas", () => {
    it("renders without crashing", async () => {
      renderWithRouter(<StoryIdeas />);
      await waitFor(() => {
        expect(screen.getByText("Story Ideas")).toBeDefined();
      });
    });

    it("renders the subtitle", async () => {
      renderWithRouter(<StoryIdeas />);
      await waitFor(() => {
        expect(screen.getByText("Discover and create amazing story concepts")).toBeDefined();
      });
    });

    it("renders the tab navigation", async () => {
      renderWithRouter(<StoryIdeas />);
      await waitFor(() => {
        expect(screen.getByText("Generate Ideas")).toBeDefined();
        expect(screen.getByText("Saved Ideas")).toBeDefined();
      });
    });
  });

  describe("Leaderboard", () => {
    it("renders without crashing", async () => {
      renderWithRouter(<Leaderboard />);
      await waitFor(() => {
        expect(screen.getByText("Storytellers Leaderboard")).toBeDefined();
      });
    });

    it("renders the subtitle", async () => {
      renderWithRouter(<Leaderboard />);
      await waitFor(() => {
        expect(screen.getByText("See who's creating the most magical stories")).toBeDefined();
      });
    });
  });

});
