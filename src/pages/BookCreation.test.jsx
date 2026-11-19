import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BookCreation from "./BookCreation";

const mocks = vi.hoisted(() => ({
  user: { id: "owner" },
  loading: false,
  book: vi.fn(),
  pages: vi.fn(),
  collaborators: vi.fn(),
  print: vi.fn(),
  image: vi.fn(),
  text: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("@/entities/Book", () => ({ Book: { get: mocks.book } }));
vi.mock("@/entities/Page", () => ({ Page: { filter: mocks.pages } }));
vi.mock("@/entities/Collaboration", () => ({ Collaboration: { filter: mocks.collaborators } }));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ user: mocks.user, isLoading: mocks.loading }) }));
vi.mock("@/hooks/useGamification", () => ({ default: () => ({}) }));
vi.mock("@/hooks/useAutoSave", () => ({ useAutoSave: () => ({}), loadAutoSaved: () => ({}) }));
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/components/i18n/i18nProvider", () => ({ useI18n: () => ({ language: "english", isRTL: false }) }));
vi.mock("@/integrations/Core", () => ({ GenerateImage: mocks.image, InvokeLLM: mocks.text }));
vi.mock("@/components/bookCreation/BookEditorTab", () => ({ default: () => <p>Editor tools</p> }));
vi.mock("@/components/bookCreation/ShareOptions", () => ({ default: () => <p>Share tools</p> }));
vi.mock("@/components/bookCreation/BookStylingTab", () => ({ default: () => null }));
vi.mock("@/components/bookCreation/DraftView", () => ({ default: () => <p>Draft editor</p> }));
vi.mock("./PrintEdition", () => ({
  default: function PrintFixture() {
    const [params] = useSearchParams();
    const [detail, setDetail] = useState("");
    const id = params.get("id");
    mocks.print(id);
    return <>
      <p>Proof for {id}</p>
      <input aria-label="Print note" value={detail} onChange={(e) => setDetail(e.target.value)} />
    </>;
  },
}));

function BrowserControls() {
  const { search } = useLocation();
  const navigate = useNavigate();
  return <>
    <output data-testid="query">{search}</output>
    <button onClick={() => navigate(-1)}>Browser back</button>
    <button onClick={() => navigate("/BookCreation?id=second&tab=print")}>Open second book</button>
  </>;
}

function open(path) {
  return render(<MemoryRouter initialEntries={[path]}>
    <BrowserControls />
    <Routes><Route path="/BookCreation" element={<BookCreation />} /></Routes>
  </MemoryRouter>);
}

const chooseTab = (name) => fireEvent.keyDown(screen.getByRole("tab", { name }), { key: "Enter" });

const book = (id, overrides = {}) => ({ id, created_by: "owner", title: `Story ${id}`, status: "complete", language: "english", ...overrides });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user = { id: "owner" };
  mocks.loading = false;
  mocks.book.mockImplementation(async (id) => book(id));
  mocks.pages.mockResolvedValue([]);
  mocks.collaborators.mockResolvedValue([]);
  vi.stubEnv("VITE_UNIFIED_BOOK_EDITOR", "");
});

afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

describe("unified owner editor", () => {
  it("leaves the legacy editor and URL alone when the flag is off", async () => {
    vi.stubEnv("VITE_UNIFIED_BOOK_EDITOR", "false");
    open("/BookCreation?id=first&tab=print");
    expect(await screen.findByText("Editor tools")).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Print proof" })).toBeNull();
    chooseTab("Preview");
    expect(screen.getByTitle("Book Preview")).toHaveAttribute("src", "/BookView?id=first");
    expect(screen.getByTestId("query")).toHaveTextContent("?id=first&tab=print");
    expect(mocks.print).not.toHaveBeenCalled();
  });

  it("validates unknown tabs, keeps existing query fields and uses browser history", async () => {
    open("/BookCreation?id=first&tab=unknown&source=library");
    expect(await screen.findByText("Editor tools")).toBeTruthy();
    const printTab = screen.getByRole("tab", { name: "Print proof" });
    expect(printTab).toHaveAttribute("aria-selected", "false");
    expect(mocks.print).not.toHaveBeenCalled();
    chooseTab("Preview");
    expect(screen.getByTitle("Book Preview")).toHaveAttribute("src", "/BookView?id=first");
    expect(screen.getByTestId("query")).toHaveTextContent("?id=first&tab=preview&source=library");
    chooseTab("Share");
    expect(screen.getByText("Share tools")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Browser back" }));
    expect(screen.getByTitle("Book Preview")).toBeTruthy();
    expect(mocks.print).not.toHaveBeenCalled();
    expect(mocks.image).not.toHaveBeenCalled();
    expect(mocks.text).not.toHaveBeenCalled();
  });

  it("lazy mounts the deep-linked proof, preserves it within a book, and clears it for a different book", async () => {
    open("/BookCreation?id=first&tab=print");
    expect(await screen.findByText("Proof for first")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Print proof" })).toHaveAttribute("aria-selected", "true");
    fireEvent.change(screen.getByRole("textbox", { name: "Print note" }), { target: { value: "Unsaved print note" } });
    chooseTab("Edit");
    expect(screen.getByText("Editor tools")).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Print note" })).toBeNull();
    chooseTab("Print proof");
    expect(screen.getByRole("textbox", { name: "Print note" })).toHaveValue("Unsaved print note");
    fireEvent.click(screen.getByRole("button", { name: "Open second book" }));
    expect(await screen.findByText("Proof for second")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Print note" })).toHaveValue("");
    expect(screen.queryByText("Proof for first")).toBeNull();
    expect(mocks.pages.mock.calls.map(([filter]) => filter.book_id)).toEqual(["first", "second"]);
  });

  it("keeps a draft in its existing editor even with a print deep link", async () => {
    mocks.book.mockResolvedValue(book("first", {status: "draft"}));
    open("/BookCreation?id=first&tab=print");
    expect(await screen.findByText("Draft editor")).toBeTruthy();
    expect(mocks.print).not.toHaveBeenCalled();
  });

  it("rejects a non-owner row before reads of pages, collaborations or print data", async () => {
    mocks.book.mockResolvedValue(book("first", {created_by: "another-owner", title: "Private title"}));
    open("/BookCreation?id=first&tab=print");
    expect(await screen.findByRole("alert")).toHaveTextContent("unavailable for editing");
    expect(screen.queryByText("Private title")).toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
    expect(mocks.pages).not.toHaveBeenCalled();
    expect(mocks.collaborators).not.toHaveBeenCalled();
    expect(mocks.print).not.toHaveBeenCalled();
  });

  it("does not fetch a private row without an authenticated account", async () => {
    mocks.user = null;
    open("/BookCreation?id=first");
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(mocks.book).not.toHaveBeenCalled();
  });

  it("discards stale private book results when opening a different book", async () => {
    let resolveOld;
    mocks.book.mockImplementation(id => id === "first"
      ? new Promise(resolve => { resolveOld = resolve; })
      : Promise.resolve(book(id)));
    open("/BookCreation?id=first&tab=print");
    await waitFor(() => expect(mocks.book).toHaveBeenCalledWith("first"));
    fireEvent.click(screen.getByRole("button", { name: "Open second book" }));
    expect(await screen.findByText("Proof for second")).toBeTruthy();
    await act(async () => resolveOld(book("first")));
    expect(screen.queryByText("Proof for first")).toBeNull();
    expect(mocks.pages.mock.calls.map(([filter]) => filter.book_id)).toEqual(["second"]);
  });
});
