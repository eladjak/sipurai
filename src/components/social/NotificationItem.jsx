/**
 * NotificationItem — single row inside the NotificationBell dropdown.
 *
 * Props:
 *   notification  {object}    — Notification entity record
 *   onRead        {function}  — called with notification.id when clicked/marked read
 *   onNavigate    {function}  — called with notification.link to navigate
 */
import { useCallback, useMemo } from 'react';
import { BookOpen, User, Heart, MessageCircle, Trophy } from 'lucide-react';
import { useI18n } from '@/components/i18n/i18nProvider';

// Map notification type → icon component
const TYPE_ICONS = {
  new_book:     BookOpen,
  new_follower: User,
  book_liked:   Heart,
  comment:      MessageCircle,
  badge_earned: Trophy,
};

/**
 * Format a date string as a relative time description using Intl.RelativeTimeFormat.
 * Falls back to a simple locale date string if the API is unavailable.
 *
 * @param {string} dateStr — ISO date string
 * @param {string} locale  — BCP-47 locale tag (e.g. "en", "he")
 * @returns {string}
 */
function relativeTime(dateStr, locale = 'en') {
  if (!dateStr) return '';

  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = then - now; // negative = in the past
  const diffSec = Math.round(diffMs / 1000);

  const thresholds = [
    { unit: 'year',   seconds: 60 * 60 * 24 * 365 },
    { unit: 'month',  seconds: 60 * 60 * 24 * 30  },
    { unit: 'week',   seconds: 60 * 60 * 24 * 7   },
    { unit: 'day',    seconds: 60 * 60 * 24        },
    { unit: 'hour',   seconds: 60 * 60             },
    { unit: 'minute', seconds: 60                  },
    { unit: 'second', seconds: 1                   },
  ];

  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    for (const { unit, seconds } of thresholds) {
      if (Math.abs(diffSec) >= seconds) {
        return rtf.format(Math.round(diffSec / seconds), unit);
      }
    }
    return rtf.format(0, 'second');
  } catch {
    return new Date(dateStr).toLocaleDateString(locale);
  }
}

/**
 * Try to parse notification message as JSON data for i18n rendering.
 * Returns the parsed object or null if it's a plain string.
 */
function tryParseData(message) {
  if (!message || typeof message !== 'string') return null;
  if (!message.startsWith('{')) return null;
  try {
    return JSON.parse(message);
  } catch {
    return null;
  }
}

export default function NotificationItem({ notification, onRead, onNavigate }) {
  if (!notification) return null;

  const { id, type, title, message, link, read, created_date } = notification;
  const { t } = useI18n();

  const Icon = TYPE_ICONS[type] ?? BookOpen;

  // Resolve translated title and message based on notification type + data
  const { displayTitle, displayMessage } = useMemo(() => {
    const data = tryParseData(message);

    // If the title matches a known type key and we have data, render translated text
    const translatedTitleKey = `social.notificationTitle.${type}`;
    const translatedMsgKey = `social.notificationMessage.${type}`;
    const tTitle = t(translatedTitleKey);
    const tMsg = t(translatedMsgKey);

    // Check if translation exists (t() returns the key path if missing)
    const hasTitleTranslation = tTitle && tTitle !== translatedTitleKey;
    const hasMsgTranslation = tMsg && tMsg !== translatedMsgKey;

    let resolvedTitle = title;
    let resolvedMessage = message;

    if (data && hasTitleTranslation) {
      // Replace placeholders like {{authorName}}, {{userName}}, {{bookTitle}}
      resolvedTitle = tTitle.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || '');
    }

    if (data && hasMsgTranslation) {
      resolvedMessage = tMsg.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || '');
    } else if (data) {
      // Fallback: show a meaningful field from data
      resolvedMessage = data.bookTitle || data.userName || message;
    }

    return { displayTitle: resolvedTitle, displayMessage: resolvedMessage };
  }, [type, title, message, t]);

  const handleClick = useCallback(() => {
    if (!read && onRead) onRead(id);
    if (link && onNavigate) onNavigate(link);
  }, [id, read, link, onRead, onNavigate]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }, [handleClick]);

  // Icon color per type
  const iconColorMap = {
    new_book:     'text-purple-500',
    new_follower: 'text-blue-500',
    book_liked:   'text-red-500',
    comment:      'text-green-500',
    badge_earned: 'text-yellow-500',
  };
  const iconColor = iconColorMap[type] ?? 'text-gray-500';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${displayTitle}. ${read ? '' : 'Unread. '}${relativeTime(created_date)}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`
        flex items-start gap-3 px-4 py-3 cursor-pointer
        transition-colors duration-150
        hover:bg-accent focus:outline-none focus:bg-accent
        ${read ? 'opacity-70' : 'bg-accent/20'}
      `}
    >
      {/* Type icon */}
      <div className={`mt-0.5 flex-shrink-0 ${iconColor}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-tight truncate">
          {displayTitle}
        </p>
        {displayMessage && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {displayMessage}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {relativeTime(created_date)}
        </p>
      </div>

      {/* Unread indicator dot */}
      {!read && (
        <span
          className="mt-1.5 flex-shrink-0 h-2 w-2 rounded-full bg-blue-500"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
