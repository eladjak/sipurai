/**
 * Profiles bridge — the email <-> Clerk-id directory.
 *
 * The social graph (follows / notifications) lets a user act on a TARGET by
 * email (the only identifier the browser knows about another user). The DB
 * stores Clerk ids only and RLS keys purely on auth.jwt()->>'sub'. This module
 * (a) ensures each signed-in user has a `profiles` row mapping their own
 * clerk_id -> email, and (b) exposes the SECURITY DEFINER RPCs that resolve a
 * target email to a Clerk id server-side.
 *
 * See scripts/migrations/2026-05-25-clerk-sub-ownership.sql.
 */
import { supabase } from './supabaseClient';

/**
 * Upsert the current user's own profile row. Safe to call repeatedly (e.g. on
 * every sign-in). RLS guarantees a user can only write their OWN row
 * (clerk_id = auth.jwt()->>'sub'); email is immutable once set.
 *
 * @param {{ id: string, email?: string, display_name?: string, avatar_url?: string }} user
 * @returns {Promise<void>}
 */
export async function ensureProfile(user) {
  if (!user?.id || !user?.email) return;
  // onConflict on the primary key (clerk_id): insert first time, no-op update
  // after. We do NOT send email on update (the trigger forbids changing it), so
  // ignoreDuplicates avoids tripping the immutable-email guard on repeat logins.
  const { error } = await supabase
    .from('profiles')
    .upsert(
      {
        clerk_id: user.id,
        email: user.email,
        display_name: user.display_name || user.full_name || null,
        avatar_url: user.avatar_url || null,
      },
      { onConflict: 'clerk_id', ignoreDuplicates: true },
    );
  // Profile-sync failures must never block the app; surface only in dev.
  if (error && import.meta.env.DEV) {
    console.warn('ensureProfile failed:', error.message);
  }
}

/**
 * Follow a user identified by email. The RPC resolves email -> clerk_id and
 * writes follower_id = caller's sub, following_id = target's sub.
 * @param {string} targetEmail
 */
export async function followUserByEmail(targetEmail) {
  const { error } = await supabase.rpc('follow_user', { target_email: targetEmail });
  if (error) throw new Error(error.message);
}

/**
 * Unfollow a user identified by email. No-op if not currently following.
 * @param {string} targetEmail
 */
export async function unfollowUserByEmail(targetEmail) {
  const { error } = await supabase.rpc('unfollow_user', { target_email: targetEmail });
  if (error) throw new Error(error.message);
}

/**
 * Create an in-app notification for a target user (by email). The RPC sets
 * actor_id = caller's sub and recipient_id = the resolved target sub. No-ops if
 * the target has no profile yet.
 * @param {{ targetEmail: string, type: string, title?: string, message?: string, link?: string }} args
 */
export async function notifyUserByEmail({ targetEmail, type, title = '', message = '', link = '' }) {
  const { error } = await supabase.rpc('notify_user', {
    target_email: targetEmail,
    p_type: type,
    p_title: title,
    p_message: message,
    p_link: link,
  });
  if (error) throw new Error(error.message);
}
