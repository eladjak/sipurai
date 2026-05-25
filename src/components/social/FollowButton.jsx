/**
 * FollowButton — toggle follow/unfollow for a target user.
 *
 * Integration notes:
 *   - Profile page: render <FollowButton targetEmail={profileUser.email} />
 *     next to the user's avatar/name when viewing someone else's profile.
 *   - CommunityPost: render <FollowButton targetEmail={post.book?.created_by} />
 *     in the author info section so readers can follow creators inline.
 *   - When a follow is created, a "new_follower" Notification is automatically
 *     sent to the followed user via useFollow hook.
 *
 * Props:
 *   targetEmail {string}   — email of the user to follow/unfollow
 *   className   {string?}  — optional extra Tailwind classes
 *   size        {string?}  — "sm" | "md" (default "md")
 */
import { UserPlus, UserCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import useFollow from '@/hooks/useFollow';
import { useI18n } from '@/components/i18n/i18nProvider';

export default function FollowButton({ targetEmail, className = '', size = 'md' }) {
  const { t, isRTL } = useI18n();
  const { isFollowing, followerCount, toggleFollow, isLoading } = useFollow(targetEmail);

  if (!targetEmail) return null;

  const sizeClasses = size === 'sm'
    ? 'h-7 px-2 text-xs gap-1'
    : 'h-9 px-3 text-sm gap-1.5';

  const label = isFollowing
    ? t('social.following')
    : t('social.follow');

  const ariaLabel = isFollowing
    ? `${t('social.unfollow')} ${targetEmail}`
    : `${t('social.follow')} ${targetEmail}`;

  return (
    <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''} ${className}`}>
      <Button
        variant={isFollowing ? 'secondary' : 'default'}
        className={`${sizeClasses} transition-all duration-150`}
        onClick={toggleFollow}
        disabled={isLoading}
        aria-label={ariaLabel}
        aria-pressed={isFollowing}
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : isFollowing ? (
          <UserCheck className="h-3.5 w-3.5" />
        ) : (
          <UserPlus className="h-3.5 w-3.5" />
        )}
        <span>{label}</span>
      </Button>

      {followerCount > 0 && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {followerCount} {t('social.followers')}
        </span>
      )}
    </div>
  );
}
