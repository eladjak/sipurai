import { useReducer, useRef } from "react";

const fields = ["text_content", "image_prompt"];

export function useEditorPageDrafts(ownerId, bookId) {
  const entries = useRef(new Map());
  const [, render] = useReducer((revision) => revision + 1, 0);

  function key(pageId, field) {
    return `sipurai:editor-draft:${JSON.stringify([ownerId, bookId, pageId, field])}`;
  }

  function restore(pages) {
    for (const { id } of pages) {
      for (const field of fields) {
        const storageKey = key(id, field);
        if (entries.current.has(storageKey)) continue;
        try {
          const data = JSON.parse(localStorage.getItem(storageKey));
          if (typeof data?.value === "string" && typeof data.base === "string") {
            entries.current.set(storageKey, { ...data, local: true });
          }
        } catch {
          // An inaccessible or invalid browser entry should not block the book.
        }
      }
    }
  }

  function read(pageId, field) {
    return entries.current.get(key(pageId, field));
  }

  function store(storageKey, value, base) {
    let local = true;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ value, base }));
    } catch {
      local = false;
    }
    entries.current.set(storageKey, { value, base, local });
    render();
  }

  function edit(page, field, value) {
    if (!page?.id || !ownerId || !bookId) return;
    store(key(page.id, field), value, read(page.id, field)?.base ?? page[field] ?? "");
  }

  function acknowledge(pageId, field, sent, savedValue) {
    const storageKey = key(pageId, field);
    const latest = entries.current.get(storageKey);
    if (latest !== sent) {
      if (!latest || latest.base !== sent.base) return;
      // Preserve another tab's newer stored draft if this write resolves late.
      let matchesStorage = false;
      try {
        const stored = JSON.parse(localStorage.getItem(storageKey));
        matchesStorage = stored?.value === latest.value && stored.base === latest.base;
      } catch {
        // Keep the newer edit in memory if storage is inaccessible.
      }
      if (matchesStorage) store(storageKey, latest.value, savedValue);
      else {
        entries.current.set(storageKey, { ...latest, base: savedValue, local: false });
        render();
      }
      return;
    }
    entries.current.delete(storageKey);
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey));
      if (stored?.value === sent.value && stored.base === sent.base) localStorage.removeItem(storageKey);
    } catch {
      // The confirmed server text is still available if browser storage fails.
    }
    render();
  }

  return { restore, read, edit, acknowledge };
}
