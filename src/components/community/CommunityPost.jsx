import { memo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from "@/utils";
import { formatDistanceToNow } from 'date-fns';
import { he as dateFnsHe } from 'date-fns/locale';
import { useI18n } from "@/components/i18n/i18nProvider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Heart,
  MessageSquare,
  BookOpen,
  Tag,
  MoreHorizontal,
  ExternalLink,
  Flag
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function CommunityPost({ post, onLike, isLiked = false, isOwner = false, onReport }) {
  const { t, language, isRTL } = useI18n();
  if (!post || !post.book) return null;

  const isHebrewOrYiddish = language === "hebrew" || language === "yiddish";

  const formatTimestamp = (dateStr) => {
    if (!dateStr) return "";
    try {
      return formatDistanceToNow(new Date(dateStr), {
        addSuffix: true,
        locale: isHebrewOrYiddish ? dateFnsHe : undefined
      });
    } catch {
      return "";
    }
  };

  const truncate = (text, maxLength = 150) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + '...';
  };
  
  return (
    <Card className="overflow-hidden transition-all hover:shadow-md" dir={isRTL ? 'rtl' : 'ltr'}>
      <CardContent className="p-0">
        <div className={`flex flex-col md:flex-row ${isRTL ? 'md:flex-row-reverse' : ''}`}>
          {/* Book Cover */}
          <div className="md:w-1/4 lg:w-1/5 bg-gray-100 dark:bg-gray-800 aspect-square md:aspect-auto">
            <Link to={`${createPageUrl("CommunityPost")}?id=${post.id}`}>
              {post.book?.cover_image ? (
                <img
                  src={post.book.cover_image}
                  alt={post.book.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full min-h-[140px] flex items-center justify-center">
                  <BookOpen className="h-10 w-10 text-gray-300" />
                </div>
              )}
            </Link>
          </div>
          
          {/* Content */}
          <div className="p-5 flex-1">
            <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
              {/* Author info */}
              <div className={`flex items-center gap-2 mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Avatar className="h-8 w-8">
                  {post.user?.avatar_url ? (
                    <AvatarImage src={post.user.avatar_url} alt={post.user.full_name} />
                  ) : null}
                  <AvatarFallback className="bg-gradient-to-br from-purple-500 to-indigo-500 text-white">
                    {post.user?.full_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{post.user?.full_name || t('common.unknownUser')}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatTimestamp(post.created_date)}
                  </p>
                </div>
              </div>
              
              {/* Actions menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={isRTL ? "start" : "end"}>
                  {isOwner && (
                    <>
                      <DropdownMenuItem>{t('communityPost.editPost')}</DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600">{t('communityPost.deletePost')}</DropdownMenuItem>
                    </>
                  )}
                  {!isOwner && onReport && (
                    <DropdownMenuItem
                      onClick={() => onReport(post.id)}
                      className="text-orange-600"
                    >
                      <Flag className={`h-4 w-4 ${isRTL ? 'ms-2' : 'me-2'}`} />
                      {t('communityPost.report')}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {/* Post title and content */}
            <Link to={`${createPageUrl("CommunityPost")}?id=${post.id}`}>
              <h3 className="text-lg font-semibold mb-2 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
                {post.title}
              </h3>
            </Link>
            
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-3">
              {truncate(post.description)}
            </p>
            
            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {post.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                    <Tag className="me-1 h-3 w-3" />
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Book info */}
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge variant="outline" className="text-xs">
                <BookOpen className="me-1 h-3 w-3" />
                {post.book.title}
              </Badge>
              {post.book.genre && (
                <Badge variant="outline" className="text-xs capitalize">
                  {post.book.genre.replace(/_/g, ' ')}
                </Badge>
              )}
            </div>
            
            {/* Interactions */}
            <div className={`flex items-center gap-4 mt-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                onClick={() => onLike(post.id)}
              >
                <Heart className={`h-4 w-4 ${isLiked ? 'fill-red-500 text-red-500' : ''}`} />
                <span>{post.likes || 0}</span>
              </Button>

              <Link to={`${createPageUrl("CommunityPost")}?id=${post.id}`}>
                <Button variant="ghost" size="sm" className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                  <MessageSquare className="h-4 w-4" />
                  <span>{post.commentCount || 0}</span>
                </Button>
              </Link>

              <div className="ms-auto">
                <Link to={`${createPageUrl("CommunityPost")}?id=${post.id}`}>
                  <Button variant="ghost" size="sm" className="gap-1">
                    <ExternalLink className="h-4 w-4" />
                    {t('communityPost.view')}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default memo(CommunityPost);