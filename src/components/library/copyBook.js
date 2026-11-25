import { Book } from '@/entities/Book';
import { Page } from '@/entities/Page';
import { readablePages } from '@/lib/bookProgress';

const storyFields = [
  'description', 'moral', 'art_style', 'length', 'genre', 'age_range', 'language',
  'child_name', 'child_age', 'child_gender', 'tone', 'interests', 'family_members',
  'childNames', 'selectedCharacters', 'cover_image',
];

export async function copyBook({ source, ownerId, title, isCurrent }) {
  if (!isCurrent() || source.created_by !== ownerId) return null;

  let pages;
  try {
    const found = await Page.filter({ book_id: source.id, created_by: ownerId });
    if (!Array.isArray(found)) return { kind: 'readError' };
    pages = readablePages(found);
  } catch {
    return { kind: 'readError' };
  }

  if (!isCurrent()) return null;
  let copy;
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

  try {
    for (const [page_number, page] of pages.entries()) {
      if (!isCurrent()) return null;
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
    return { kind: 'interrupted', copy };
  }
}
