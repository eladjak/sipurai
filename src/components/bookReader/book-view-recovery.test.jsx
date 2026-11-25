import { StrictMode } from "react";
import { render, screen, fireEvent, cleanup, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nContext } from "../i18n/i18nProvider";
import BookView from "../../pages/BookView";

const mocks = vi.hoisted(() => ({
  owner: { id: "owner" },
  getBook: vi.fn(),
  getPages: vi.fn(),
  getPublicBook: vi.fn(),
  generate: vi.fn(),
  reserve: vi.fn(),
  clear: vi.fn(),
  isLive: vi.fn(),
}));
vi.mock("@/entities/Book", () => ({ Book: { filter: mocks.getBook, generationStore: {} } }));
vi.mock("@/entities/Page", () => ({ Page: { filter: mocks.getPages } }));
vi.mock("@/entities/PublicBook", () => ({
  PublicBook: { filter: mocks.getPublicBook },
  PublicPage: { filter: mocks.getPages },
}));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ user: mocks.owner }) }));
vi.mock("@/lib/AuthContext", () => ({ useAuth: () => ({ navigateToLogin: vi.fn() }) }));
vi.mock("@/hooks/useGamification", () => ({ default: () => ({ awardXP: vi.fn() }) }));
vi.mock("@/lib/seo", () => ({ updateMeta: vi.fn(), resetMeta: vi.fn() }));
vi.mock("@/lib/generationLock", () => ({ isRunLive: mocks.isLive }));
vi.mock("@/lib/bookGeneration", () => ({ generateBookIncremental: mocks.generate }));
vi.mock("@/lib/bookQuota", () => ({
  reserveBookSlot: mocks.reserve,
  clearActiveBookKey: mocks.clear,
  QuotaError: Error,
}));
vi.mock("@/components/checkout/OrderBookButton", () => ({ OrderBookButton: () => null }));
vi.mock("@/components/bookReader/GiftEditionCTA", () => ({ default: () => null }));

const privateBook = { id: "demo", created_by: "owner", title: "Private book", status: "partial", total_pages: 2, is_public: false, cover_image: "/saved-cover.png" };
const pages = [
  { id: "p0", page_number: 0, text_content: "The cover text", image_url: "/saved-cover.png" },
  { id: "p1", page_number: 1, text_content: "A persisted page", image_url: null },
];
const retry = () => screen.findByRole("button", { name: "bookView.building.retryArt" });

function open() {
  const t = (key, replacements = {}) => [key, ...Object.values(replacements)].join(" ");
  return render(
    <StrictMode>
      <I18nContext.Provider value={{ t, language: "english", isRTL: false }}>
        <MemoryRouter initialEntries={["/BookView?id=demo"]}><BookView /></MemoryRouter>
      </I18nContext.Provider>
    </StrictMode>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("VITE_READER_AUTO_RECOVERY", "true");
  mocks.getBook.mockResolvedValue([privateBook]);
  mocks.getPublicBook.mockResolvedValue([{ id: "demo", title: "Public book", status: "complete", total_pages: 2 }]);
  mocks.getPages.mockResolvedValue(pages);
  mocks.isLive.mockReturnValue(false);
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllEnvs();
});

describe("owner workspace navigation", () => {
  it("links the owner to the unified print tab when enabled, and the standalone proof otherwise", async () => {
    vi.stubEnv("VITE_READER_AUTO_RECOVERY", "");
    vi.stubEnv("VITE_UNIFIED_BOOK_EDITOR", "");
    mocks.getBook.mockResolvedValue([{ ...privateBook, status: "complete" }]);
    const view = open();
    const edit = await screen.findByRole("link", { name: "bookView.editAdvanced" });
    expect(edit).toHaveAttribute("href", "/BookCreation?id=demo");
    expect(edit.querySelector("button")).toHaveClass("flex", "min-h-11");
    expect(screen.getByRole("link", { name: /print/i })).toHaveAttribute("href", "/BookCreation?id=demo&tab=print");
    view.unmount();
    vi.stubEnv("VITE_UNIFIED_BOOK_EDITOR", "false");
    open();
    expect(await screen.findByRole("link", { name: /print/i })).toHaveAttribute("href", "/PrintEdition?id=demo");
  });

  it("keeps the standalone print building state available for partial books", async () => {
    vi.stubEnv("VITE_READER_AUTO_RECOVERY", "");
    vi.stubEnv("VITE_UNIFIED_BOOK_EDITOR", "");
    open();
    expect(await screen.findByRole("link", { name: /print/i })).toHaveAttribute("href", "/PrintEdition?id=demo");
  });
});

describe("reader recovery", () => {
  it("starts once, reports verified progress, and keeps manual retry after a failure and fresh visit", async () => {
    let previousRun;
    let finish;
    mocks.generate.mockImplementationOnce((options) => {
      previousRun = options;
      return new Promise((resolve) => { finish = resolve; });
    });
    const view = open();
    expect(await screen.findByText("spxReader.automaticChecking")).toBeTruthy();
    expect(mocks.generate).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ bookId: "demo", automaticRecoveryOwnerId: "owner" }));
    expect(previousRun).not.toHaveProperty("allowLegacyReservation");
    expect(previousRun).not.toHaveProperty("repairPages");
    expect(screen.getByText("spxWizard.writingCount 2 2")).toBeTruthy();
    expect(screen.getByText("spxWizard.drawingCount 1 2")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "bookView.building.retryArt" })).toBeNull();
    act(() => previousRun.onEvent({ type: "resumed" }));
    expect(await screen.findByText("spxReader.automaticDrawing")).toBeTruthy();
    await act(async () => finish({ status: "partial" }));
    expect(await screen.findByText("spxReader.automaticStopped")).toBeTruthy();
    expect(await retry()).toBeTruthy();
    view.unmount();

    open();
    await retry();
    expect(mocks.generate).toHaveBeenCalledOnce();
    expect(mocks.reserve).not.toHaveBeenCalled();
    expect(mocks.clear).not.toHaveBeenCalled();
    mocks.generate.mockResolvedValueOnce({ status: "complete" });
    fireEvent.click(await retry());
    await waitFor(() => expect(mocks.generate).toHaveBeenCalledTimes(2));
    expect(mocks.generate.mock.calls[1][0].allowLegacyReservation).toBe(false);
  });

  it("leaves the explicit legacy confirmation available after an automatic provenance refusal", async () => {
    const missing = Object.assign(new Error("missing"), { code: "provenance_missing" });
    mocks.generate.mockRejectedValue(missing);
    open();
    await waitFor(() => expect(mocks.generate).toHaveBeenCalledOnce());
    fireEvent.click(await retry());
    const confirm = await screen.findByRole("button", { name: "spxReader.confirmAllowance" });
    expect(mocks.generate.mock.calls[1][0].allowLegacyReservation).toBe(false);
    fireEvent.click(confirm);
    await waitFor(() => expect(mocks.generate.mock.calls[2][0].allowLegacyReservation).toBe(true));
  });

  it.each([
    ["flag off", () => vi.stubEnv("VITE_READER_AUTO_RECOVERY", "")],
    ["public", () => mocks.getBook.mockResolvedValue([{ ...privateBook, is_public: true }])],
    ["another owner", () => mocks.getBook.mockResolvedValue([{ ...privateBook, created_by: "other" }])],
    ["live run", () => mocks.isLive.mockReturnValue(true)],
    ["incomplete manuscript", () => mocks.getPages.mockResolvedValue(pages.slice(0, 1))],
    ["art already present", () => mocks.getPages.mockResolvedValue(pages.map(p => ({ ...p, image_url: "/good.png" })))],
  ])("does not attempt recovery for %s", async (label, prepare) => {
    prepare();
    open();
    await screen.findByRole("heading", { level: 1, name: label === "another owner" ? "Public book" : "Private book" });
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.reserve).not.toHaveBeenCalled();
  });
});

it("retains the currently visible owner folio after a transient metadata refresh and retries it", async () => {
  vi.stubEnv("VITE_READER_AUTO_RECOVERY", "");
  localStorage.setItem("book_demo_page", "1");
  open();
  expect(await screen.findByText("A persisted page")).toBeVisible();

  mocks.getBook.mockRejectedValueOnce(new Error("Offline"));
  fireEvent.online(window);
  await screen.findByText("bookView.loadError");
  expect(screen.getByText("A persisted page")).toBeVisible();
  expect(mocks.getPublicBook).not.toHaveBeenCalled();

  mocks.getPages.mockResolvedValueOnce([{ ...pages[1], text_content: "The updated folio" }]);
  fireEvent.click(screen.getByRole("button", { name: "common.retry" }));
  expect(await screen.findByText("The updated folio")).toBeVisible();
  expect(screen.queryByText("bookView.loadError")).toBeNull();
  expect(mocks.getBook).toHaveBeenLastCalledWith({ id: "demo", created_by: "owner" });
});

it("removes private data as soon as owner access is lost, even when the public lookup fails", async () => {
  vi.stubEnv("VITE_READER_AUTO_RECOVERY", "");
  localStorage.setItem("book_demo_page", "1");
  open();
  expect(await screen.findByText("A persisted page")).toBeVisible();

  mocks.getBook.mockResolvedValue([]);
  mocks.getPublicBook.mockRejectedValueOnce(new Error("Offline")).mockResolvedValue([]);
  fireEvent.online(window);
  await screen.findByText("bookView.loadError");
  expect(screen.queryByText("A persisted page")).toBeNull();
  expect(screen.queryByText("Private book")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "common.retry" }));
  expect(await screen.findByRole("heading", { name: "bookView.noBook.title" })).toBeVisible();
  expect(screen.getByRole("link", { name: "bookView.backToLibrary" })).toHaveAttribute("href", "/Library");
});
