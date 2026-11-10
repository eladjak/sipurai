import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import RedirectHome, { LEGACY_HOME_PATHS } from "./RedirectHome";

function Where() {
  const { pathname, search, hash } = useLocation();
  return <div data-testid="where">{pathname + search + hash}</div>;
}

function renderAt(url) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/" element={<Where />} />
        {LEGACY_HOME_PATHS.map((p) => (
          <Route key={p} path={p} element={<RedirectHome />} />
        ))}
        <Route path="*" element={<div data-testid="not-found" />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("legacy /Dashboard redirect", () => {
  it.each(["/Dashboard", "/dashboard", "/DASHBOARD"])("%s lands on /", (url) => {
    renderAt(url);
    expect(screen.getByTestId("where").textContent).toBe("/");
    expect(screen.queryByTestId("not-found")).toBeNull();
  });

  it("keeps the query string and hash", () => {
    renderAt("/Dashboard?plan=lite&checkout=ok#top");
    expect(screen.getByTestId("where").textContent).toBe("/?plan=lite&checkout=ok#top");
  });

  it("does not swallow other unknown paths", () => {
    renderAt("/Dashboards");
    expect(screen.getByTestId("not-found")).toBeInTheDocument();
  });
});
