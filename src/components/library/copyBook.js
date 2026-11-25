import { Book } from '@/entities/Book';
import { Page } from '@/entities/Page';
import { readablePages } from '@/lib/bookProgress';

const storyFields = [
  'description', 'moral', 'art_style', 'length', 'genre', 'age_range', 'language',
  'child_name', 'child_age', 'child_gender', 'tone', 'interests', 'family_members',
  'childNames', 'selectedCharacters', 'cover_image',
];
const pageFields = ['text_content', 'image_url', 'image_prompt', 'layout_type'];

const sameContent = (first, second) =>
  pageFields.every(field => (first[field] ?? null) === (second[field] ?? null));

export async function copyBook({ source, ownerId, title, isCurrent, resume }) {
  if (!isCurrent() || source.created_by !== ownerId) return null;

  let copy = resume?.copy;
  let pages;
  const saved = new Set();
  try {
    if (resume) {
      const [original, destination] = await Promise.all([Book.get(source.id), Book.get(copy.id)]);
      if (!isCurrent()) return null;
      if (original?.id !== source.id || original.created_by !== ownerId ||
          destination?.id !== copy.id || destination.id === source.id ||
          destination.created_by !== ownerId || destination.is_public !== false ||
          !['draft', 'complete'].includes(destination.status) ||
          destination.total_pages !== resume.pages.length) {
        return { kind: 'resumeConflict', copy };
      }
      copy = destination;
    }

    const found = await Page.filter({ book_id: source.id, created_by: ownerId });
    if (!Array.isArray(found)) throw new Error('read');
    pages = readablePages(found);
    if (!isCurrent()) return null;
    if (resume) {
      if (pages.length !== resume.pages.length || pages.some((page, i) => !sameContent(page, resume.pages[i]))) {
        return { kind: 'resumeConflict', copy };
      }
      const existing = await Page.filter({ book_id: copy.id, created_by: ownerId });
      if (!Array.isArray(existing)) throw new Error('read');
      if (!isCurrent()) return null;
      for (const row of existing) {
        const intended = pages[row?.page_number];
        if (row?.book_id !== copy.id || row.created_by !== ownerId || !Number.isInteger(row.page_number) ||
            !intended || saved.has(row.page_number) || !sameContent(row, intended)) {
          return { kind: 'resumeConflict', copy };
        }
        saved.add(row.page_number);
      }
      if (copy.status === 'complete') {
        if (saved.size !== pages.length) return { kind: 'resumeConflict', copy };
        return { kind: 'complete', copy, count: pages.length };
      }
    }
  } catch {
    return resume ? { kind: 'resumeReadError', copy, pages: resume.pages } : { kind: 'readError' };
  }

  if (!resume) {
    try {
      const fields = Object.fromEntries(storyFields.filter(key => Object.hasOwn(source, key)).map(key => [key, source[key]]));
      copy = await Book.create({
        ...fields,
        title,
        created_by: ownerId,
        is_public: false,
        status: 'draft',
        total_pages: pages.length,
      });
    } catch {
      return { kind: 'createError' };
    }
    if (!isCurrent()) return null;
    if (!copy?.id || copy.created_by !== ownerId) return { kind: 'createError' };
  }

  try {
    for (const [page_number, page] of pages.entries()) {
      if (!isCurrent()) return null;
      if (saved.has(page_number)) continue;
      const { text_content, image_url, image_prompt, layout_type } = page;
      await Page.create({
        book_id: copy.id,
        created_by: ownerId,
        page_number,
        text_content,
        image_url,
        image_prompt,
        layout_type,
      });
    }
    if (!isCurrent()) return null;
    if (pages.length) await Book.update(copy.id, { status: 'complete', total_pages: pages.length });
    return { kind: pages.length ? 'complete' : 'emptyDraft', copy, count: pages.length };
  } catch {
    return { kind: 'interrupted', copy, pages };
  }
}
