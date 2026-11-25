import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CommunityPage from "./Community";

const mock = vi.hoisted(() => ({ rpc: vi.fn(), get: vi.fn(), filter: vi.fn(), controls: vi.fn(), pinSet: vi.fn(), verify: vi.fn(), toast: vi.fn(), xp: vi.fn(), stat: vi.fn() }));
vi.mock("@/lib/supabaseClient", () => ({ supabase: { rpc: mock.rpc } }));
vi.mock("@/entities/Book", () => ({ Book: { get: mock.get } }));
vi.mock("@/entities/Community", () => ({ Community: { filter: mock.filter } }));
vi.mock("@/entities/User", () => ({ User: { get: vi.fn() } }));
vi.mock("@/entities/Comment", () => ({ Comment: { filter: vi.fn() } }));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ user: { id: "owner" } }) }));
vi.mock("@/hooks/useGamification", () => ({ default: () => ({ awardXP: mock.xp, incrementStat: mock.stat }) }));
vi.mock("@/components/i18n/i18nProvider", () => ({ useI18n: () => ({ t: key => key, isRTL: true }) }));
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: mock.toast }) }));
vi.mock("@/utils/content-moderation", () => ({ getParentalControls: mock.controls, isPinSet: mock.pinSet, verifyParentalPin: mock.verify, moderateInput: value => ({ sanitized: value, blocked: false }) }));
vi.mock("../components/community/ShareBookModal", () => ({ default: ({ isOpen, onShare }) => isOpen && <button onClick={() => onShare({ bookId: "book", title: "Title", description: "Description", tags: ["story"] })}>submit fixture</button> }));
vi.mock("../components/community/CommunityPost", () => ({ default: () => null }));
vi.mock("../components/community/FeaturedStory", () => ({ default: () => null }));

beforeEach(() => {
  vi.resetAllMocks();
  mock.filter.mockResolvedValue([]);
  mock.get.mockResolvedValue({ id: "book", created_by: "owner", is_public: false });
  mock.rpc.mockResolvedValue({ data: { is_public: true, listing_created: true }, error: null });
  mock.controls.mockReturnValue({ allowCommunitySharing: true, requireApprovalBeforePublish: false });
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
async function submit() {
  fireEvent.click(screen.getByRole("button", { name: /community.shareYourBook/ }));
  fireEvent.click(screen.getByText("submit fixture"));
}
describe("community publication", () => {
  it("sends one atomic request and awards after success", async () => {
    render(<CommunityPage />); await submit();
    await waitFor(() => expect(mock.rpc).toHaveBeenCalledWith("sipurai_publish_book", { p_book: "book", p_expected_public: false, p_listing: { title: "Title", description: "Description", tags: ["story"] } }));
    await waitFor(() => expect(mock.xp).toHaveBeenCalledOnce());
  });
  it("shows failure and awards nothing when publication fails", async () => {
    mock.rpc.mockResolvedValue({ data: false, error: null });
    render(<CommunityPage />); await submit();
    await waitFor(() => expect(mock.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive", description: "community.toast.shareError" })));
    expect(mock.xp).not.toHaveBeenCalled();
  });
  it("keeps an existing listing without awarding duplicate credit", async () => {
    mock.rpc.mockResolvedValue({ data: { is_public: true, listing_created: false }, error: null });
    render(<CommunityPage />); await submit();
    await waitFor(() => expect(mock.toast).toHaveBeenCalledWith(expect.objectContaining({ description: "community.toast.shareSuccess" })));
    expect(mock.xp).not.toHaveBeenCalled();
    expect(mock.stat).not.toHaveBeenCalled();
  });
  it("requires actual confirmation and exact true PIN", async () => {
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    mock.controls.mockReturnValue({ allowCommunitySharing: true, requireApprovalBeforePublish: true });
    mock.pinSet.mockReturnValue(true); mock.verify.mockResolvedValue({ locked: true });
    render(<CommunityPage />); await submit(); expect(mock.rpc).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("submit fixture"));
    fireEvent.change(screen.getByPlaceholderText("community.enterPin"), { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: "community.parentApprovalConfirm" }));
    await screen.findByText("community.incorrectPin"); expect(mock.rpc).not.toHaveBeenCalled();
  });
});
