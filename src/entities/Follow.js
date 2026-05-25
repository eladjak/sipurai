/**
 * Follow entity — tracks follower/following relationships between users.
 *
 * Schema (Clerk-id keyed — see migration 2026-05-25-clerk-sub-ownership):
 *   created_by:   string  — the follower's Clerk id (== follower_id)
 *   follower_id:  string  — Clerk id of the user who is following
 *   following_id: string  — Clerk id of the user being followed
 *   created_date: string  — ISO date
 *
 * CREATING / DELETING a follow is done via the SECURITY DEFINER rpcs
 * `follow_user(target_email)` / `unfollow_user(target_email)` (see
 * src/lib/profiles.js), which resolve a target EMAIL to a Clerk id server-side.
 * This entity is used for reads (compute followers / following) via filter().
 */
import { createSupabaseEntity } from '../lib/supabaseEntity';
import { createSecureEntity } from '../lib/secureEntity';

export const Follow = createSecureEntity(createSupabaseEntity('follows'));
