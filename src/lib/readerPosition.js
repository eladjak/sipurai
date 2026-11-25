// Both readers and Tonight use the legacy zero-based index. The companion
// anchors BookView to a folio while retaining the numeric index for older readers.
export function readReaderPosition(storage, bookId, pages) {
  const key = `book_${bookId}_page`;
  const saved = storage.getItem(key);
  const index = saved !== null && /^\d+$/.test(saved) ? Number(saved) : null;
  if (index !== null) {
    try {
      const anchor = JSON.parse(storage.getItem(`${key}_anchor`));
      if (Array.isArray(anchor) && Number.isInteger(anchor[0]) && anchor[0] >= 0 && anchor[1] === index) {
        return anchor[0];
      }
    } catch {
      // A corrupt companion must not invalidate an older bookmark.
    }
  }
  return pages[index ?? 0]?.page_number ?? pages[0]?.page_number;
}

export function writeReaderPosition(storage, bookId, pageNumber, index) {
  const key = `book_${bookId}_page`;
  storage.setItem(key, String(index));
  storage.setItem(`${key}_anchor`, JSON.stringify([pageNumber, index]));
}
