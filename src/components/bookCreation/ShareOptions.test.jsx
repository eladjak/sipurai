import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ShareOptions from "./ShareOptions";

const api = vi.hoisted(() => ({
  get: vi.fn(), update: vi.fn(), filter: vi.fn(), create: vi.fn(), rpc: vi.fn(), toast: vi.fn(),
  unshare: vi.fn(), verifyPin: vi.fn(), pinSet: vi.fn(), controls: vi.fn()
}));
vi.mock("@/entities/Book", () => ({ Book: { get: api.get, update: api.update } }));
vi.mock("@/entities/Community", () => ({ Community: { create: api.create, filter: api.filter } }));
vi.mock("@/lib/supabaseClient", () => ({ supabase: { rpc: api.rpc } }));
vi.mock("@/lib/ownerApi", () => ({ unshareBook: api.unshare, deleteBook: vi.fn() }));
vi.mock("@/components/i18n/i18nProvider", () => ({
  useI18n: () => ({ isRTL: true, t: (key) => key })
}));
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: api.toast }) }));
vi.mock("@/utils/content-moderation", () => ({
  getParentalControls: api.controls,
  isPinSet: api.pinSet,
  verifyParentalPin: api.verifyPin,
  moderateInput: (value) => ({ sanitized: value, blocked: value === "blocked" })
}));

const book = { id: "book#1", title: "Moon story", created_by: "owner", is_public: false };
const publicBook = { ...book, is_public: true };
const post = { book_id: book.id, created_by: book.created_by, visibility: "public" };
const link = () => screen.queryByRole("textbox", { name: "sharing.publicLinkLabel" });
const action = (name) => screen.getByRole("button", { name });
const start = () => render(<ShareOptions book={book} bookId={book.id} />);

beforeEach(() => {
  vi.resetAllMocks();
  api.get.mockResolvedValue(book);
  api.rpc.mockResolvedValue({ data: { is_public: true, listing_created: false }, error: null });
  api.filter.mockResolvedValue([]);
  api.create.mockResolvedValue(post);
  api.controls.mockReturnValue({ allowCommunitySharing: true, requireApprovalBeforePublish: false });
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
});

async function chooseCommunity(description = "A short story") {
  fireEvent.click(await screen.findByRole("button", { name: "sharing.communityTitle" }));
  fireEvent.change(screen.getByLabelText("sharing.descriptionLabel"), { target: { value: description } });
}

describe("editor sharing", () => {
  it("withholds private links and creates a public link only after explicit acknowledgement and submit", async () => {
    start();
    await screen.findByText("sharing.privateStatus");
    expect(link()).toBeNull();
    expect(screen.queryByRole("button", { name: "sharing.emailDraft" })).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    fireEvent.click(action("sharing.enablePublicLink"));
    expect(action("sharing.confirmPublicLink")).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(action("bookControls.cancel"));
    expect(api.update).not.toHaveBeenCalled();

    fireEvent.click(action("sharing.enablePublicLink"));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(action("sharing.confirmPublicLink"));
    await screen.findByText("sharing.linkReady");
    expect(api.rpc).toHaveBeenCalledExactlyOnceWith("sipurai_publish_book", { p_book: book.id, p_expected_public: false, p_listing: null });
    expect(api.create).not.toHaveBeenCalled();
    api.get.mockResolvedValue(publicBook);
    fireEvent.click(action("sharing.copyShareLink"));
    const url = await screen.findByRole("textbox", { name: "sharing.publicLinkLabel" });
    expect(url.value).toMatch(/\/BookView\?id=book%231$/i);
  });

  it("does not distribute a link or insert a community listing when visibility remains private", async () => {
    api.rpc.mockRejectedValue(new Error("write failed"));
    start();
    await chooseCommunity();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(action("sharing.publishListing"));
    await screen.findByText("sharing.shareErrorDesc");
    expect(link()).toBeNull();
    expect(api.create).not.toHaveBeenCalled();
    expect(screen.queryByText("sharing.shareSuccessDesc")).toBeNull();
  });

  it("offers a fresh visibility check when the publication result is uncertain", async () => {
    api.get.mockResolvedValueOnce(book).mockResolvedValueOnce(book).mockRejectedValueOnce(new Error("lost read"));
    api.rpc.mockRejectedValueOnce(new Error("lost write response"));
    start();
    await chooseCommunity();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(action("sharing.publishListing"));
    await screen.findByRole("button", { name: "sharing.checkAgain" });
    expect(link()).toBeNull();
    expect(api.create).not.toHaveBeenCalled();
    api.get.mockResolvedValue(publicBook);
    fireEvent.click(action("sharing.checkAgain"));
    await screen.findByRole("button", { name: "sharing.copyShareLink" });
  });

  it("keeps the public link and preserves the form when creating the listing fails", async () => {
    api.get.mockResolvedValueOnce(book).mockResolvedValueOnce(book).mockResolvedValue(publicBook);
    api.rpc.mockRejectedValue(new Error("listing failed"));
    start();
    await chooseCommunity();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(action("sharing.publishListing"));
    await screen.findByText("sharing.listingIncomplete");
    expect(action("sharing.copyShareLink")).toBeInTheDocument();
    expect(screen.getByLabelText("sharing.descriptionLabel")).toHaveValue("A short story");
    expect(screen.queryByText("sharing.shareSuccessDesc")).toBeNull();
  });

  it("requires acknowledgement and a configured, verified PIN even when the link is public", async () => {
    api.get.mockResolvedValue(publicBook);
    api.controls.mockReturnValue({ allowCommunitySharing: true, requireApprovalBeforePublish: true });
    start();
    await chooseCommunity();
    expect(action("sharing.publishListing")).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByLabelText("sharing.parentalApprovalRequired"), { target: { value: "1234" } });
    fireEvent.click(action("sharing.publishListing"));
    await screen.findByText("sharing.pinRequired");
    expect(api.verifyPin).not.toHaveBeenCalled();
    expect(api.create).not.toHaveBeenCalled();

    api.pinSet.mockReturnValue(true);
    api.verifyPin.mockResolvedValue({ locked: true });
    fireEvent.change(screen.getByLabelText("sharing.parentalApprovalRequired"), { target: { value: "1234" } });
    fireEvent.click(action("sharing.publishListing"));
    await screen.findByText("sharing.pinRequired");
    expect(api.create).not.toHaveBeenCalled();

    api.verifyPin.mockResolvedValue(true);
    fireEvent.change(screen.getByLabelText("sharing.parentalApprovalRequired"), { target: { value: "1234" } });
    fireEvent.click(action("sharing.publishListing"));
    await screen.findByText("sharing.shareSuccessDesc");
    expect(api.rpc).toHaveBeenCalledTimes(1);
    expect(api.update).not.toHaveBeenCalled();
  });

  it("checks parental controls again when submitting", async () => {
    start();
    await chooseCommunity();
    fireEvent.click(screen.getByRole("checkbox"));
    api.controls.mockReturnValue({ allowCommunitySharing: false, requireApprovalBeforePublish: false });
    fireEvent.click(action("sharing.publishListing"));
    await screen.findAllByText("sharing.publicationDisabled");
    expect(api.update).not.toHaveBeenCalled();
    expect(api.create).not.toHaveBeenCalled();
  });

  it("reuses a previously published owner listing", async () => {
    api.get.mockResolvedValue(publicBook);
    api.filter.mockResolvedValue([{ ...post, id: "legacy-id" }]);
    start();
    await chooseCommunity();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(action("sharing.publishListing"));
    await screen.findByText("sharing.shareSuccessDesc");
    expect(api.create).not.toHaveBeenCalled();
  });

  it("withholds all publication writes after moderation rejects the form", async () => {
    start();
    await chooseCommunity("blocked");
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(action("sharing.publishListing"));
    await screen.findByText("communityPost.inappropriateDesc");
    expect(api.update).not.toHaveBeenCalled();
    expect(api.create).not.toHaveBeenCalled();
  });

  it("reconciles a lost listing response by reading the matching owner listing", async () => {
    api.get.mockResolvedValueOnce(book).mockResolvedValueOnce(book).mockResolvedValue(publicBook);
    api.filter.mockImplementation(async (filter) => filter.visibility ? [{ ...post, title: "Moon story", description: "A short story", tags: ["story", "children"] }] : []);
    api.rpc.mockRejectedValue(new Error("lost write response"));
    start();
    await chooseCommunity();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(action("sharing.publishListing"));
    await screen.findByText("sharing.shareSuccessDesc");
    expect(api.rpc).toHaveBeenCalledExactlyOnceWith("sipurai_publish_book", { p_book: book.id, p_expected_public: false, p_listing: { title: "Moon story", description: "A short story", tags: ["story", "children"] } });
  });

  it("shows a selectable URL when clipboard access is absent or denied and confirms an actual copy", async () => {
    api.get.mockResolvedValue(publicBook);
    start();
    fireEvent.click(await screen.findByRole("button", { name: "sharing.copyShareLink" }));
    await screen.findByText("sharing.manualCopy");
    expect(link()).toHaveAttribute("readonly");
    expect(link()).toHaveAttribute("dir", "ltr");
    const url = link().value;
    expect(api.toast).not.toHaveBeenCalled();
    const writeText = vi.fn().mockRejectedValueOnce(new Error("permission denied")).mockResolvedValueOnce();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    fireEvent.click(action("sharing.copyInstagram"));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining(url)));
    expect(api.toast).not.toHaveBeenCalled();
    fireEvent.click(action("sharing.copyInstagram"));
    await waitFor(() => expect(api.toast).toHaveBeenCalledWith({ title: "sharing.copiedForInstagram" }));
    expect(screen.queryByText("sharing.manualCopy")).toBeNull();
  });

  it("recovers an owner listing for an already-private book and cleans it without making the book public", async () => {
    api.filter.mockResolvedValue([post]);
    api.unshare.mockResolvedValue({ ok: true });
    start();
    await screen.findByText("sharing.cleanupPending");
    expect(api.filter).toHaveBeenCalledWith({ book_id: book.id, created_by: book.created_by }, undefined, 1);
    expect(link()).toBeNull();
    expect(screen.queryByRole("button", { name: "sharing.enablePublicLink" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /bookControls.stopShare/ }));
    fireEvent.click(action("bookControls.stopShareConfirm"));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(api.update).not.toHaveBeenCalled();
  });

  it("fails closed when the private book's cleanup status cannot be loaded", async () => {
    api.filter.mockRejectedValueOnce(new Error("listing read failed"));
    start();
    await screen.findByText("sharing.listingCheckFailed");
    expect(screen.queryByRole("button", { name: "sharing.enablePublicLink" })).toBeNull();
    fireEvent.click(action("sharing.checkAgain"));
    await screen.findByRole("button", { name: "sharing.enablePublicLink" });
  });

  it("refreshes visibility on window focus and removes every public action after external revocation", async () => {
    api.get.mockResolvedValueOnce(publicBook);
    start();
    await screen.findByRole("button", { name: "sharing.shareWhatsApp" });
    expect(screen.queryByRole("link")).toBeNull();
    fireEvent(window, new Event("focus"));
    await screen.findByText("sharing.privateStatus");
    expect(screen.queryByRole("button", { name: "sharing.shareWhatsApp" })).toBeNull();
    expect(screen.queryByRole("button", { name: "sharing.copyShareLink" })).toBeNull();
    expect(screen.queryByRole("button", { name: "sharing.emailDraft" })).toBeNull();
  });

  it.each(["sharing.shareFacebook", "sharing.copyShareLink", "sharing.emailDraft"])(
    "rechecks public access before %s can distribute a link",
    async (name) => {
      api.get.mockResolvedValueOnce(publicBook);
      const writeText = vi.fn();
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
      start();
      fireEvent.click(await screen.findByRole("button", { name }));
      await screen.findByText("sharing.privateStatus");
      expect(writeText).not.toHaveBeenCalled();
      expect(link()).toBeNull();
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
  );

  it("hides the link and keeps a cleanup retry when unsharing made the book private but failed", async () => {
    api.get.mockResolvedValueOnce(publicBook);
    api.unshare.mockRejectedValueOnce(new Error("listing cleanup failed")).mockResolvedValueOnce({ ok: true });
    start();
    await screen.findByText("sharing.publicStatus");
    fireEvent.click(screen.getByRole("button", { name: /bookControls.stopShare/ }));
    fireEvent.click(action("bookControls.stopShareConfirm"));
    await screen.findByText("sharing.cleanupPending");
    expect(link()).toBeNull();
    fireEvent.click(action("bookControls.stopShareConfirm"));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(api.unshare).toHaveBeenCalledTimes(2);
    expect(document.activeElement).toHaveTextContent(book.title);
    expect(screen.queryByRole("button", { name: /bookControls.stopShare/ })).toBeNull();
  });
});

it("does not claim publication after an ambiguous reply with a different owner listing", async () => {
  api.get.mockResolvedValueOnce(book).mockResolvedValueOnce(book).mockResolvedValue(publicBook);
  api.filter.mockImplementation(async (filter) => filter.visibility ? [{ ...post, title: "Different", description: "A short story", tags: ["story", "children"] }] : []);
  api.rpc.mockResolvedValue({ data: null, error: new Error("lost reply") });
  start();
  await chooseCommunity();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(action("sharing.publishListing"));
  await screen.findByText("sharing.listingIncomplete");
  expect(screen.queryByText("sharing.shareSuccessDesc")).toBeNull();
});

it("passes observed public visibility so a concurrent revoke cannot be silently reversed", async () => {
  api.get.mockResolvedValueOnce(publicBook).mockResolvedValueOnce(publicBook).mockResolvedValue(book);
  api.rpc.mockResolvedValue({ data: false, error: null });
  start();
  await chooseCommunity();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(action("sharing.publishListing"));
  await screen.findByText("sharing.shareErrorDesc");
  expect(api.rpc).toHaveBeenCalledWith("sipurai_publish_book", expect.objectContaining({ p_expected_public: true }));
  expect(screen.queryByText("sharing.shareSuccessDesc")).toBeNull();
});

it("does not accept an existing public listing as a successful write if the RPC is unavailable", async () => {
  api.get.mockResolvedValue(publicBook);
  api.filter.mockResolvedValue([{ ...post, title: book.title, description: "A short story", tags: ["story", "children"] }]);
  api.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "RPC unavailable" }, status: 404 });
  start();
  await chooseCommunity();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(action("sharing.publishListing"));
  await screen.findByText("sharing.shareErrorDesc");
  expect(api.filter).not.toHaveBeenCalled();
  expect(screen.queryByText("sharing.shareSuccessDesc")).toBeNull();
});

it("offers owner cleanup when the server discovers a stale listing hidden by RLS", async () => {
  api.rpc.mockResolvedValue({ data: null, error: { message: "sipurai_cleanup_required" }, status: 400 });
  start();
  fireEvent.click(await screen.findByRole("button", { name: "sharing.enablePublicLink" }));
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(action("sharing.confirmPublicLink"));
  await screen.findByText("sharing.cleanupPending");
  expect(screen.getByRole("button", { name: /bookControls.stopShare/ })).toBeVisible();
  expect(screen.queryByRole("button", { name: "sharing.copyShareLink" })).toBeNull();
});
