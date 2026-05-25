/**
 * Notification entity — in-app notifications sent to individual users.
 *
 * Schema (Clerk-id keyed — see migration 2026-05-25-clerk-sub-ownership):
 *   recipient_id: string   — recipient's Clerk user id (RLS keys reads on this)
 *   actor_id:     string   — the Clerk id of whoever triggered the notification
 *   type:         string   — "new_book" | "new_follower" | "book_liked" | "comment" | "badge_earned"
 *   title:        string   — short notification title
 *   message:      string   — notification body text
 *   link:         string   — deep-link path (e.g. "/BookView?id=xxx")
 *   read:         boolean  — whether the recipient has read it (default false)
 *
 * CREATING notifications is done via the SECURITY DEFINER rpc `notify_user`
 * (see src/lib/profiles.js → notifyUserByEmail) — a client cannot INSERT a
 * notification directly (RLS has no authenticated INSERT policy). This entity is
 * used for the recipient-side read / mark-as-read / delete operations only.
 */
import { createSupabaseEntity } from '../lib/supabaseEntity';
import { createSecureEntity } from '../lib/secureEntity';

export const Notification = createSecureEntity(
  createSupabaseEntity('notifications'),
  { ownerField: 'recipient_id' }
);
