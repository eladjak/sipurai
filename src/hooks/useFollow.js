/**
 * useFollow — hook for following / unfollowing another user.
 *
 * Architecture (Clerk-id keyed, no email RLS claim):
 *   - A user is targeted by EMAIL (the only identifier the browser knows about
 *     another user). The follow/unfollow WRITES go through SECURITY DEFINER rpcs
 *     (`follow_user` / `unfollow_user`) which resolve email -> Clerk id
 *     server-side and store Clerk ids only.
 *   - READS (am I following X? counts) need the target's Clerk id, which we
 *     resolve from the public `profiles` directory by email. RLS on `follows`
 *     returns only rows where the caller is the follower or the followed.
 *   - After a successful follow, a "new_follower" notification is created for the
 *     followed user via the `notify_user` rpc (fire-and-forget).
 *
 * @param {string} targetEmail — email of the user to follow/unfollow
 * @returns {{
 *   isFollowing: boolean,
 *   followerCount: number,
 *   followingCount: number,
 *   toggleFollow: () => Promise<void>,
 *   isLoading: boolean
 * }}
 */
import { useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';
import { Follow } from '@/entities/Follow';
import { User } from '@/entities/User';
import { supabase } from '@/lib/supabaseClient';
import {
  followUserByEmail,
  unfollowUserByEmail,
  notifyUserByEmail,
} from '@/lib/profiles';
import { trackEvent } from '@/lib/analytics';

/** Resolve a target email to its Clerk id via the public profiles directory. */
async function resolveClerkId(email) {
  if (!email) return null;
  const rows = await supabase
    .from('profiles')
    .select('clerk_id')
    .eq('email', email)
    .limit(1);
  if (rows.error) return null;
  return rows.data?.[0]?.clerk_id ?? null;
}

export default function useFollow(targetEmail) {
  // Use the global QueryClient from the provider when available;
  // fall back to a per-instance client for test environments.
  const fallbackRef = useRef(null);
  let queryClient;
  try {
    queryClient = useQueryClient();
  } catch {
    if (!fallbackRef.current) {
      fallbackRef.current = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    }
    queryClient = fallbackRef.current;
  }

  // Fetch current user's follow relationship to targetEmail (by Clerk id).
  const { data: followData, isPending: followPending, refetch: refetchFollow } = useQuery(
    {
      queryKey: ['follow', targetEmail],
      queryFn: async () => {
        if (!targetEmail) return { existingFollow: null, followerCount: 0, followingCount: 0 };
        const user = await User.me();
        if (!user?.id) return { existingFollow: null, followerCount: 0, followingCount: 0 };

        const targetId = await resolveClerkId(targetEmail);
        if (!targetId) {
          // Target hasn't signed in yet — no follow relationship possible.
          return { currentUserId: user.id, existingFollow: null, followerCount: 0, followingCount: 0 };
        }

        // Run the relationship queries in parallel. RLS only returns rows where
        // the caller is involved, so "followers/following" counts are scoped to
        // pairs the caller participates in (followerCount = does the caller
        // follow targetId; the full public count would need an rpc — see note).
        const [myFollows, asFollower, asFollowing] = await Promise.all([
          // Does the current user already follow targetId?
          Follow.filter({ follower_id: user.id, following_id: targetId }),
          // Rows where targetId is the one being followed AND caller is involved.
          Follow.filter({ following_id: targetId }),
          // Rows where targetId is the follower AND caller is involved.
          Follow.filter({ follower_id: targetId }),
        ]);

        return {
          currentUserId: user.id,
          existingFollow: myFollows.length > 0 ? myFollows[0] : null,
          followerCount: asFollower.length,
          followingCount: asFollowing.length,
        };
      },
      enabled: !!targetEmail,
      staleTime: 30 * 1000, // 30 seconds
      retry: false,
    },
    queryClient
  );

  const { mutateAsync: doToggle, isPending: mutating } = useMutation(
    {
      mutationFn: async () => {
        if (!targetEmail) return;

        const user = await User.me();
        if (!user?.id) throw new Error('Authentication required');

        const existingFollow = followData?.existingFollow;

        if (existingFollow) {
          // Unfollow via rpc (resolves email -> id, deletes the pair).
          await unfollowUserByEmail(targetEmail);
        } else {
          // Follow via rpc (resolves email -> id, inserts follower/following ids).
          await followUserByEmail(targetEmail);

          // Notify the followed user (fire-and-forget). The rpc sets actor_id
          // and resolves recipient_id from the target email.
          const userName = user.full_name || 'Someone';
          notifyUserByEmail({
            targetEmail,
            type: 'new_follower',
            title: 'new_follower',
            message: JSON.stringify({ userName }),
            link: '/Profile',
          }).catch(() => {}); // never let notification failure block the follow action
        }
      },
      onSuccess: () => {
        // Invalidate so the query refetches fresh counts + relationship
        queryClient.invalidateQueries({ queryKey: ['follow', targetEmail] });
        refetchFollow();
      },
    },
    queryClient
  );

  const toggleFollow = useCallback(async () => {
    await doToggle();
    trackEvent('follow_toggled', { action: followData?.existingFollow ? 'unfollow' : 'follow' });
  }, [doToggle, targetEmail, followData?.existingFollow]);

  return {
    isFollowing: !!(followData?.existingFollow),
    followerCount: followData?.followerCount ?? 0,
    followingCount: followData?.followingCount ?? 0,
    toggleFollow,
    isLoading: followPending || mutating,
  };
}

export { useFollow };
