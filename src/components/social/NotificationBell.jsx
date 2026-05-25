/**
 * NotificationBell — header icon with badge count and dropdown panel.
 *
 * Integration notes:
 *   - Mount this component in Layout.jsx's header area, next to the user avatar:
 *       import NotificationBell from '@/components/social/NotificationBell';
 *       // Inside the header JSX:
 *       <NotificationBell />
 *   - The bell polls every 30 s via useNotifications (React Query refetchInterval).
 *   - Clicking a notification marks it as read and navigates to its deep link.
 *   - "Mark all as read" button appears at the top of the dropdown when there are
 *     unread notifications.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import useNotifications from '@/hooks/useNotifications';
import { useI18n } from '@/components/i18n/i18nProvider';
import NotificationItem from './NotificationItem';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const triggerRef = useRef(null);
  const navigate = useNavigate();
  const { t, isRTL } = useI18n();
  const { notifications, unreadCount, markAsRead, markAllAsRead, isLoading } = useNotifications();

  // Close panel when clicking outside
  useEffect(() => {
    if (!open) return;

    const handleOutside = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        triggerRef.current && !triggerRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const handleToggle = useCallback(() => setOpen((o) => !o), []);

  const handleNavigate = useCallback((link) => {
    setOpen(false);
    if (link) navigate(link);
  }, [navigate]);

  const handleMarkAllAsRead = useCallback(async () => {
    await markAllAsRead();
  }, [markAllAsRead]);

  const labelMarkAll = t('social.markAllRead');
  const labelNotifications = t('social.notifications');
  const labelNoNotifications = t('social.noNotifications');
  const labelBellAria = unreadCount > 0
    ? `${labelNotifications} — ${unreadCount} ${t('social.unread')}`
    : labelNotifications;

  return (
    <div className="relative" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Bell trigger button */}
      <Button
        ref={triggerRef}
        variant="ghost"
        size="icon"
        className="relative h-9 w-9"
        onClick={handleToggle}
        aria-label={labelBellAria}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" aria-hidden="true" />

        {/* Unread badge — always visible so users know it's a notification counter */}
        <Badge
          className={`absolute -top-1 -right-1 h-5 min-w-[1.25rem] rounded-full text-white text-[10px] font-bold px-1 flex items-center justify-center border-background border-2 pointer-events-none ${
            unreadCount > 0 ? 'bg-red-500' : 'bg-gray-400 dark:bg-gray-600'
          }`}
          aria-hidden="true"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </Badge>
      </Button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={labelNotifications}
          className={`
            absolute z-50 mt-2 w-80 rounded-lg border border-border bg-background shadow-lg
            ${isRTL ? 'left-0' : 'right-0'}
            max-h-[480px] flex flex-col overflow-hidden
          `}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
            <h2 className="text-sm font-semibold text-foreground">
              {labelNotifications}
            </h2>

            {unreadCount > 0 && (
              <button
                className="text-xs text-purple-600 hover:text-purple-700 font-medium focus:outline-none focus:underline"
                onClick={handleMarkAllAsRead}
                aria-label={labelMarkAll}
              >
                {labelMarkAll}
              </button>
            )}
          </div>

          {/* Notification list */}
          <div
            className="overflow-y-auto flex-1 divide-y divide-border"
            role="list"
            aria-label={labelNotifications}
          >
            {isLoading ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                {t('common.loading')}
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-10 text-center" aria-live="polite">
                <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">{labelNoNotifications}</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div key={notification.id} role="listitem">
                  <NotificationItem
                    notification={notification}
                    onRead={markAsRead}
                    onNavigate={handleNavigate}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
