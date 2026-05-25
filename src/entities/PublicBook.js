/**
 * Public, PII-free read of a SHARED book.
 *
 * Anonymous visitors of a shared book link (/BookView?id=xxx) cannot read the
 * base `books` / `pages` tables — those carry child PII (child_name, child_age,
 * child_gender, family_members, child_names) and anon has NO grant on them
 * (see migration 2026-05-25-public-pii-safe-views.sql, mandated by the
 * council-of-sages 3-of-3 PII caveat).
 *
 * Instead, public reads go through the sanitized DB views `public_books` /
 * `public_pages`, which project ONLY non-PII presentation columns of rows where
 * books.is_public = true. These are READ-ONLY (no create/update/delete).
 *
 * The owner-side read still uses the full `Book` / `Page` entities (RLS scopes
 * them to the owner). BookView tries the owner read first, then falls back to
 * these public entities for guests / non-owners.
 */
import { createSupabaseEntity } from '../lib/supabaseEntity';

const baseBook = createSupabaseEntity('public_books', {
  columnMap: {
    selectedCharacters: 'selected_characters', // harmless if absent in the view
  },
});

const basePage = createSupabaseEntity('public_pages');

/** Read-only public book view (sanitized, is_public=true rows only). */
export const PublicBook = {
  get: baseBook.get,
  filter: baseBook.filter,
  list: baseBook.list,
};

/** Read-only public pages view (pages of a public book, sanitized). */
export const PublicPage = {
  get: basePage.get,
  filter: basePage.filter,
  list: basePage.list,
};
