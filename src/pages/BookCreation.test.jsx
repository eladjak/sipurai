import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BookCreation from "./BookCreation";

const mocks = vi.hoisted(() => ({
  user: { id: "owner" },
  loading: false,
  realEditor: false,
  book: vi.fn(),
  pages: vi.fn(),
  getPage: vi.fn(),
  saveText: vi.fn(),
  updatePage: vi.fn(),
  collaborators: vi.fn(),
  print: vi.fn(),
  image: vi.fn(),
  text: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("@/entities/Book", () => ({ Book: { get: mocks.book } }));
vi.mock("@/entities/Page", () => ({ Page: { get: mocks.getPage, filter: mocks.pages, update: mocks.updatePage }, savePageText: mocks.saveText }));
vi.mock("@/entities/Collaboration", () => ({ Collaboration: { filter: mocks.collaborators } }));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ user: mocks.user, isLoading: mocks.loading }) }));
vi.mock("@/hooks/useGamification", () => ({ default: () => ({}) }));
vi.mock("@/hooks/useAutoSave", async importOriginal => ({ ...await importOriginal(), useAutoSave: () => ({}) }));
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/components/i18n/i18nProvider", () => ({ useI18n: () => ({ language: "english", isRTL: false }) }));
vi.mock("@/integrations/Core", () => ({ GenerateImage: mocks.image, InvokeLLM: mocks.text }));
vi.mock("@/components/bookCreation/BookEditorTab", async importOriginal => {
  const { default: Editor } = await importOriginal();
  return { default: props => mocks.realEditor ? <Editor {...props} /> : <>
  <p>Editor tools</p>
  <input aria-label="Page text" value={props.currentPageText} onChange={(event) => props.onTextChange(event.target.value)} />
  <button onClick={() => props.onPageIndexChange(0)}>First page</button>
  <button onClick={() => props.onPageIndexChange(1)}>Second page</button>
  <button onClick={props.onSaveText}>Save page</button>
  <button onClick={props.onAddNikud}>Add page nikud</button>
  <button onClick={props.onConvertToRhyme}>Rhyme page</button>
</> };
});
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

const page = (id, text, number = 1) => ({ id, book_id: "first", page_number: number, text_content: text, image_url: "/page.png" });

const chooseTab = (name) => fireEvent.keyDown(screen.getByRole("tab", { name }), { key: "Enter" });

const book = (id, overrides = {}) => ({ id, created_by: "owner", title: `Story ${id}`, status: "complete", language: "english", ...overrides });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user = { id: "owner" };
  mocks.loading = false;
  mocks.realEditor = false;
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

describe("page drafts", () => {
  it("recovers edits by stable page id after an immediate switch and reload", async () => {
    const first = { id: "page-1", page_number: 1, text_content: "First", image_url: "/first.png" };
    const second = { id: "page-2", page_number: 2, text_content: "Second", image_url: "/second.png" };
    mocks.pages.mockResolvedValue([first, second]);
    const view = open("/BookCreation?id=first");
    expect(await screen.findByRole("textbox", { name: "Page text" })).toHaveValue("First");
    fireEvent.change(screen.getByRole("textbox", { name: "Page text" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Second page" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Page text" }), { target: { value: "Edited second" } });
    fireEvent.click(screen.getByRole("button", { name: "First page" }));
    expect(screen.getByRole("textbox", { name: "Page text" })).toHaveValue("");
    view.unmount();
    mocks.pages.mockResolvedValue([{ ...second, page_number: 1 }, { ...first, page_number: 2 }]);
    open("/BookCreation?id=first");
    expect(await screen.findByRole("textbox", { name: "Page text" })).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "First page" }));
    expect(screen.getByRole("textbox", { name: "Page text" })).toHaveValue("Edited second");
    expect(mocks.saveText).not.toHaveBeenCalled();
  });

  it("leaves a newer text draft in place after a delayed explicit save", async () => {
    const initial = page("page-1", "First");
    mocks.realEditor = true;
    mocks.pages.mockResolvedValue([initial]);
    mocks.getPage.mockResolvedValue(initial);
    let confirm;
    mocks.saveText.mockImplementation(() => new Promise(resolve => { confirm = resolve; }));
    open("/BookCreation?id=first");
    const field = await screen.findByRole("textbox", { name: "Edit Page Text" });
    fireEvent.change(field, { target: { value: "Version I" } });
    expect(screen.getByText("The text draft is saved on this device.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save to book" }));
    await waitFor(() => expect(mocks.saveText).toHaveBeenCalledWith({ pageId: "page-1", bookId: "first", ownerId: "owner", expectedText: "First", text: "Version I" }));
    expect(screen.getByText("Saving to the book…")).toBeInTheDocument();
    fireEvent.change(field, { target: { value: "Version II" } });
    await act(async () => confirm({ ...initial, text_content: "Version I" }));
    expect(field).toHaveValue("Version II");
    expect(screen.queryByText("Saved to the book.")).toBeNull();
    mocks.getPage.mockResolvedValue({ ...initial, text_content: "Version I" });
    mocks.saveText.mockRejectedValueOnce(new Error("connection lost"));
    fireEvent.click(screen.getByRole("button", { name: "Save to book" }));
    expect(await screen.findByText("The text couldn't be saved to the book.")).toBeInTheDocument();
    mocks.saveText.mockResolvedValueOnce({ ...initial, text_content: "Version II" });
    fireEvent.click(screen.getByRole("button", { name: "Try saving again" }));
    expect(await screen.findByText("Saved to the book.")).toBeInTheDocument();
    expect(screen.queryByText("The text draft is saved on this device.")).toBeNull();
  });

  it("requires confirmation against the latest server text and keeps an unpersisted draft in memory", async () => {
    const initial = page("page-1", "First");
    const newer = { ...initial, text_content: "Written elsewhere" };
    mocks.realEditor = true;
    mocks.pages.mockResolvedValue([initial]);
    mocks.getPage.mockResolvedValue(newer);
    const storageWrite = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    open("/BookCreation?id=first");
    const field = await screen.findByRole("textbox", { name: "Edit Page Text" });
    fireEvent.change(field, { target: { value: "My draft" } });
    expect(screen.getByText("The device couldn't save this draft. It is available while the editor is open.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save to book" }));
    expect(await screen.findByRole("button", { name: "Save my draft to the book" })).toBeInTheDocument();
    expect(screen.getAllByText("Written elsewhere").length).toBeGreaterThan(0);
    expect(field).toHaveValue("My draft");
    expect(mocks.saveText).not.toHaveBeenCalled();
    storageWrite.mockRestore();
    mocks.saveText.mockResolvedValue({ ...initial, text_content: "My draft" });
    fireEvent.click(screen.getByRole("button", { name: "Save my draft to the book" }));
    expect(await screen.findByText("Saved to the book.")).toBeInTheDocument();
  });

  it("refreshes conflict choices when other saves win before the conditional write", async () => {
    let storedPage = page("page-1", null);
    mocks.realEditor = true;
    mocks.pages.mockResolvedValue([storedPage]);
    mocks.getPage.mockImplementation(async () => storedPage);
    mocks.saveText
      .mockImplementationOnce(async () => {
        storedPage = { ...storedPage, text_content: "Device B" };
        return null;
      })
      .mockImplementationOnce(async () => {
        storedPage = { ...storedPage, text_content: "" };
        return null;
      })
      .mockImplementation(async ({ expectedText, text }) => {
        if (storedPage.text_content !== expectedText) return null;
        storedPage = { ...storedPage, text_content: text };
        return storedPage;
      });
    open("/BookCreation?id=first");
    const field = await screen.findByRole("textbox", { name: "Edit Page Text" });
    fireEvent.change(field, { target: { value: "Device A" } });
    fireEvent.click(screen.getByRole("button", { name: "Save to book" }));
    expect(await screen.findByText("Device B")).toBeInTheDocument();
    const useMine = screen.getByRole("button", { name: "Save my draft to the book" });
    fireEvent.click(useMine);
    await waitFor(() => expect(mocks.saveText).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("This page has no saved text.")).toBeInTheDocument();
    expect(field).toHaveValue("Device A");
    expect(screen.queryByText("Saved to the book.")).toBeNull();
    expect(storedPage.text_content).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Save my draft to the book" }));
    expect(await screen.findByText("Saved to the book.")).toBeInTheDocument();
    expect(mocks.saveText.mock.calls.map(([request]) => request.expectedText)).toEqual([null, "Device B", ""]);
  });

  it("warns about the reader's saved version from a different page and the preview tab", async () => {
    mocks.realEditor = true;
    mocks.pages.mockResolvedValue([page("page-1", "First"), page("page-2", "Second", 2)]);
    open("/BookCreation?id=first");
    const field = await screen.findByRole("textbox", { name: "Edit Page Text" });
    fireEvent.change(field, { target: { value: "First draft" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Choose a page" }), { target: { value: "1" } });
    expect(field).toHaveValue("Second");
    expect(screen.getByText("The reader shows the last version saved to the book.")).toBeInTheDocument();
    chooseTab("Preview");
    expect(screen.getByText("The reader shows the last version saved to the book.")).toBeInTheDocument();
  });

  it("keeps delayed nikud from replacing newer text or moving to another page", async () => {
    mocks.pages.mockResolvedValue([page("page-1", "First"), page("page-2", "Second", 2)]);
    let reply;
    mocks.text.mockImplementation(() => new Promise(resolve => { reply = resolve; }));
    open("/BookCreation?id=first");
    const field = await screen.findByRole("textbox", { name: "Page text" });
    fireEvent.click(screen.getByRole("button", { name: "Add page nikud" }));
    fireEvent.change(field, { target: { value: "New first" } });
    await act(async () => reply({ text_with_nikud: "Old result" }));
    expect(field).toHaveValue("New first");
    fireEvent.click(screen.getByRole("button", { name: "Add page nikud" }));
    fireEvent.click(screen.getByRole("button", { name: "Second page" }));
    await act(async () => reply({ text_with_nikud: "Wrong page result" }));
    expect(field).toHaveValue("Second");
    fireEvent.click(screen.getByRole("button", { name: "First page" }));
    expect(field).toHaveValue("New first");
  });

  it("keeps a delayed rhyme in the editor and ignores it after a page switch", async () => {
    mocks.pages.mockResolvedValue([page("page-1", "First"), page("page-2", "Second", 2)]);
    let reply;
    mocks.text.mockImplementation(() => new Promise(resolve => { reply = resolve; }));
    open("/BookCreation?id=first");
    const field = await screen.findByRole("textbox", { name: "Page text" });
    fireEvent.click(screen.getByRole("button", { name: "Rhyme page" }));
    fireEvent.click(screen.getByRole("button", { name: "Second page" }));
    await act(async () => reply({ rhyming_text: "Wrong page result" }));
    expect(field).toHaveValue("Second");
  });

  it("isolates scoped drafts from both other books and different owners", async () => {
    mocks.pages.mockResolvedValue([page("same-page", "Original")]);
    const original = open("/BookCreation?id=first");
    fireEvent.change(await screen.findByRole("textbox", { name: "Page text" }), { target: { value: "Private draft" } });
    original.unmount();
    const second = open("/BookCreation?id=second");
    expect(await screen.findByRole("textbox", { name: "Page text" })).toHaveValue("Original");
    second.unmount();
    mocks.user = { id: "second-owner" };
    mocks.book.mockResolvedValue(book("first", { created_by: "second-owner" }));
    open("/BookCreation?id=first");
    expect(await screen.findByRole("textbox", { name: "Page text" })).toHaveValue("Original");
  });

  it("keeps a matching legacy draft available for manual recovery without assigning its index", async () => {
    mocks.realEditor = true;
    mocks.pages.mockResolvedValue([page("page-1", "First")]);
    localStorage.setItem("ey_autosave_book_first", JSON.stringify({ data: { currentPageIndex: 0, currentPageText: "Legacy text" } }));
    open("/BookCreation?id=first");
    expect(await screen.findByRole("textbox", { name: "Edit Page Text" })).toHaveValue("First");
    const summary = screen.getByText("Draft from an earlier editor");
    fireEvent.click(summary);
    expect(summary.parentElement).toHaveAttribute("open");
    expect(screen.getByText("Legacy text")).toBeInTheDocument();
    expect(mocks.saveText).not.toHaveBeenCalled();
  });
});
