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

export async function publishBookShare({ Book, Community, bookId, ownerId, post, isCurrent }) {
  let visibility = await readOwnerVisibility(Book, bookId, ownerId);
  if (!isCurrent() || visibility === null) {
    return { visibility: null, error: "sharing.visibilityUnavailable" };
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
    const filter = { book_id: bookId, created_by: ownerId, visibility: "public" };
    const matches = (row) => row?.book_id === bookId && row.created_by === ownerId && row.visibility === "public";
    const hasListing = async () => (await Community.filter(filter, undefined, 1)).some(matches);
    try {
      if (!await hasListing() && isCurrent()) {
        const row = await Community.create({ ...post, id: bookId, book_id: bookId, user_id: ownerId, visibility: "public" });
        if (!matches(row)) throw new Error("Listing creation not confirmed");
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
