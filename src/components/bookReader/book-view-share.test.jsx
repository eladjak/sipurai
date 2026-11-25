import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
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


const complete = id => ({ id, created_by: "owner", title: id, status: "complete", total_pages: 2, cover_image: "/art.png" });
const pages = [0, 1].map(n => ({ id: `p${n}`, page_number: n, text_content: `Page ${n}`, image_url: "/art.png" }));
function SwitchBook() {
  const navigate = useNavigate();
  return <><button onClick={() => navigate("/BookView?id=second")}>switch book</button><BookView /></>;
}
function open() {
  return render(<I18nContext.Provider value={{ t: key => key, language: "english", isRTL: false }}><MemoryRouter initialEntries={["/BookView?id=first"]}><SwitchBook /></MemoryRouter></I18nContext.Provider>);
}
async function finish() {
  const picker = await screen.findByRole("combobox", { name: "reader.jumpToPage" });
  fireEvent.change(picker, { target: { value: "1" } });
  await screen.findByText("bookView.finishedBook");
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.owner = { id: "owner" };
  mocks.getBook.mockImplementation(async ({ id, created_by }) => id === "first" && created_by === "owner" ? [complete(id)] : []);
  mocks.getPublicBook.mockImplementation(async ({ id }) => [{ ...complete(id), created_by: "someone-else" }]);
  mocks.getPages.mockResolvedValue(pages);
  mocks.isLive.mockReturnValue(false);
});
afterEach(() => { cleanup(); localStorage.clear(); });
describe("ending share action", () => {
  it("links only a verified owner to this book's share tab and removes it on book or auth change", async () => {
    const view = open();
    await finish();
    const share = screen.getByRole("link", { name: "bookView.share" });
    expect(share).toHaveAttribute("href", "/BookCreation?id=first&tab=share");
    expect(share.querySelector("button")).toBeNull();
    fireEvent.click(screen.getByText("switch book"));
    await finish();
    expect(screen.queryByRole("link", { name: "bookView.share" })).toBeNull();
    expect(screen.getByRole("link", { name: "bookView.createNewBook" })).toHaveAttribute("href", "/BookWizard");
    view.unmount();
    const next = open();
    await finish();
    mocks.owner = { id: "other" };
    next.rerender(<I18nContext.Provider value={{ t: key => key, language: "english", isRTL: false }}><MemoryRouter initialEntries={["/BookView?id=first"]}><SwitchBook /></MemoryRouter></I18nContext.Provider>);
    await finish();
    expect(screen.queryByRole("link", { name: "bookView.share" })).toBeNull();
  });
  it("offers a guest sign-in and never an owner share action", async () => {
    mocks.owner = null;
    open();
    await finish();
    expect(screen.getByRole("button", { name: "bookView.signInToCreate" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "bookView.share" })).toBeNull();
  });
});
