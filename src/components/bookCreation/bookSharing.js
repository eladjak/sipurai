import { supabase } from "@/lib/supabaseClient";

function visibilityFrom(row, bookId, ownerId) {
  if (row?.id !== bookId || row?.created_by !== ownerId || typeof row.is_public !== "boolean") {
    return null;
  }
  return row.is_public;
}

export async function readOwnerVisibility(Book, bookId, ownerId) {
  if (!bookId || !ownerId) return null;
  try {
    return visibilityFrom(await Book.get(bookId), bookId, ownerId);
  } catch {
    return null;
  }
}

function matchesOwnerListing(row, bookId, ownerId) {
  return row?.book_id === bookId && row.created_by === ownerId;
}

async function hasOwnerListing(Community, bookId, ownerId, visibility = undefined) {
  const filter = { book_id: bookId, created_by: ownerId, ...(visibility && { visibility }) };
  const rows = await Community.filter(filter, undefined, 1);
  return rows.some((row) => matchesOwnerListing(row, bookId, ownerId) && (!visibility || row.visibility === visibility));
}

export async function readOwnerSharingState({ Book, Community, bookId, ownerId }) {
  const visibility = await readOwnerVisibility(Book, bookId, ownerId);
  if (visibility !== false) return { visibility, cleanupRequired: false, listingReadFailed: false };
  try {
    const cleanupRequired = await hasOwnerListing(Community, bookId, ownerId);
    return { visibility, cleanupRequired, listingReadFailed: false };
  } catch {
    return { visibility, cleanupRequired: false, listingReadFailed: true };
  }
}

/** @returns {Promise<{ visibility: boolean | null, error?: string, cleanupRequired?: boolean, listingReadFailed?: boolean, listingCreated?: boolean }>} */
export async function publishBookShare({ Book, Community, bookId, ownerId, post, isCurrent }) {
  const state = await readOwnerSharingState({ Book, Community, bookId, ownerId });
  let { visibility } = state;
  if (!isCurrent() || visibility === null) {
    return { visibility: null, error: "sharing.visibilityUnavailable" };
  }
  if (state.cleanupRequired || state.listingReadFailed) {
    return { ...state, error: state.cleanupRequired ? "sharing.cleanupPending" : "sharing.listingCheckFailed" };
  }
  let rejected = false;
  try {
    const { data, error, status } = await supabase.rpc("sipurai_publish_book", {
      p_book: bookId,
      p_expected_public: visibility,
      p_listing: post ? { title: post.title, description: post.description, tags: post.tags } : null
    });
    if (!error && data?.is_public === true && typeof data.listing_created === "boolean" && isCurrent()) {
      return { visibility: true, listingCreated: data.listing_created };
    }
    if (isCurrent() && error?.message === "sipurai_cleanup_required") {
      return { visibility: false, cleanupRequired: true, error: "sharing.cleanupPending" };
    }
    rejected = Boolean(error && status >= 400 && status < 500 && status !== 408);
  } catch {
    // A lost response may still mean the transaction committed.
  }
  if (!isCurrent()) return { visibility: null, error: "sharing.visibilityUnavailable" };
  visibility = await readOwnerVisibility(Book, bookId, ownerId);
  if (!isCurrent()) return { visibility: null, error: "sharing.visibilityUnavailable" };
  if (rejected) {
    return { visibility, error: visibility === null ? "sharing.visibilityUnavailable" : "sharing.shareErrorDesc" };
  }
  if (visibility === true && post) {
    try {
      const rows = await Community.filter({ book_id: bookId, created_by: ownerId, visibility: "public" });
      const exact = rows.some((row) => matchesOwnerListing(row, bookId, ownerId)
        && row.visibility === "public" && row.title === post.title && row.description === post.description
        && JSON.stringify(row.tags) === JSON.stringify(post.tags));
      if (exact && isCurrent()) {
        visibility = await readOwnerVisibility(Book, bookId, ownerId);
        if (!isCurrent() || visibility === null) return { visibility: null, error: "sharing.visibilityUnavailable" };
        if (!visibility) return { visibility: false, error: "sharing.shareErrorDesc" };
        return { visibility: true };
      }
    } catch {
      // Do not claim success when listing verification fails.
    }
    return { visibility: true, error: "sharing.listingIncomplete" };
  }
  if (visibility === true && !post) return { visibility: true };
  return { visibility, error: visibility === null ? "sharing.visibilityUnavailable" : "sharing.shareErrorDesc" };
}
