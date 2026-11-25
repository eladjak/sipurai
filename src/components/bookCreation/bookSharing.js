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

/** @returns {Promise<{ visibility: boolean | null, error?: string, cleanupRequired?: boolean, listingReadFailed?: boolean }>} */
export async function publishBookShare({ Book, Community, bookId, ownerId, post, isCurrent }) {
  const state = await readOwnerSharingState({ Book, Community, bookId, ownerId });
  let { visibility } = state;
  if (!isCurrent() || visibility === null) {
    return { visibility: null, error: "sharing.visibilityUnavailable" };
  }
  if (state.cleanupRequired || state.listingReadFailed) {
    return { ...state, error: state.cleanupRequired ? "sharing.cleanupPending" : "sharing.listingCheckFailed" };
  }
  if (visibility === false) {
    try {
      visibility = visibilityFrom(await Book.update(bookId, { is_public: true }), bookId, ownerId);
    } catch {
      visibility = null;
    }
    if (visibility === null) visibility = await readOwnerVisibility(Book, bookId, ownerId);
    if (visibility !== true) {
      return { visibility, error: visibility === null ? "sharing.visibilityUnavailable" : "sharing.shareErrorDesc" };
    }
  }

  if (post && isCurrent()) {
    const hasListing = () => hasOwnerListing(Community, bookId, ownerId, "public");
    try {
      if (!await hasListing() && isCurrent()) {
        const row = await Community.create({ ...post, id: bookId, book_id: bookId, user_id: ownerId, visibility: "public" });
        if (!matchesOwnerListing(row, bookId, ownerId) || row.visibility !== "public") throw new Error("Listing creation not confirmed");
      }
    } catch {
      try {
        if (await hasListing()) return { visibility: true };
      } catch {
        // The current listing state remains unknown.
      }
      return { visibility: true, error: "sharing.listingIncomplete" };
    }
  }
  return { visibility: true };
}
