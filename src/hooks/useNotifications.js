/**
 * useNotifications — hook for fetching and managing in-app notifications.
 *
 * Integration notes:
 *   - NotificationBell (src/components/social/NotificationBell.jsx) is the primary
 *     consumer; mount it in Layout.jsx's header area next to the user avatar.
 *   - Polls every 30 seconds via React Query's refetchInterval so users see new
 *     notifications without manual refresh.
 *   - markAsRead(id) marks a single notification as read.
 *   - markAllAsRead() bulk-marks all unread notifications as read.
 *
 * @returns {{
 *   notifications: Array,
 *   unreadCount: number,
 *   markAsRead: (id: string) => Promise<void>,
 *   markAllAsRead: () => Promise<void>,
 *   isLoading: boolean
 * }}
 */
import { useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';
import { Notification } from '@/entities/Notification';
import { User } from '@/entities/User';

const QUERY_KEY = ['notifications'];
const POLL_INTERVAL = 30 * 1000; // 30 seconds

export default function useNotifications() {
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

  const { data: notifications = [], isPending, refetch } = useQuery(
    {
      queryKey: QUERY_KEY,
      queryFn: async () => {
        const user = await User.me();
        if (!user?.id) return [];

        // Fetch notifications for the current user (keyed on Clerk id), newest
        // first. RLS already restricts to recipient_id = the caller's sub.
        const results = await Notification.filter(
          { recipient_id: user.id },
          '-created_date',
          50
        );
        return results ?? [];
      },
      staleTime: POLL_INTERVAL,
      refetchInterval: POLL_INTERVAL,
      retry: false,
    },
    queryClient
  );

  const { mutateAsync: doMarkAsRead } = useMutation(
    {
      mutationFn: async (id) => {
        await Notification.update(id, { read: true });
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        refetch();
      },
    },
    queryClient
  );

  const { mutateAsync: doMarkAllAsRead } = useMutation(
    {
      mutationFn: async () => {
        const unread = notifications.filter((n) => !n.read);
        await Promise.allSettled(
          unread.map((n) => Notification.update(n.id, { read: true }))
        );
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        refetch();
      },
    },
    queryClient
  );

  const markAsRead = useCallback(async (id) => {
    await doMarkAsRead(id);
  }, [doMarkAsRead]);

  const markAllAsRead = useCallback(async () => {
    await doMarkAllAsRead();
  }, [doMarkAllAsRead]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    isLoading: isPending,
  };
}

export { useNotifications };
