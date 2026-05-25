import { Link } from 'react-router-dom';
import { createPageUrl } from "@/utils";
import { format } from 'date-fns';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Heart,
  MessageSquare,
  Star,
  BookOpen
} from 'lucide-react';
import { useI18n } from "@/components/i18n/i18nProvider";

export default function FeaturedStory({ post, onLike, isLiked = false }) {
  const { t } = useI18n();
  if (!post || !post.book) return null;

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md bg-gradient-to-b from-amber-50 to-white dark:from-amber-900/20 dark:to-gray-800">
      <CardContent className="p-0 flex flex-col">
        {/* Cover image with overlay gradient — gradient is taller on mobile */}
        <div className="relative flex-shrink-0">
          <div className="aspect-[3/2] bg-gray-100 dark:bg-gray-800">
            {post.book.cover_image ? (
              <img
                src={post.book.cover_image}
                alt={post.book.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <BookOpen className="h-16 w-16 text-gray-300" />
              </div>
            )}
          </div>

          {/* Bottom gradient: taller on mobile (pb-16) vs desktop (pb-8) so text beneath is never obscured */}
          <div className="absolute bottom-0 left-0 right-0 h-16 sm:h-10 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />

          <div className="absolute top-2 right-2">
            <Badge className="bg-amber-500 text-white">
              <Star className="h-3 w-3 me-1 fill-white" />
              {t("community.featured.badge")}
            </Badge>
          </div>
        </div>

        {/* Text content — padding ensures no overflow on small screens */}
        <div className="p-3 sm:p-4 flex flex-col flex-1">
          <Link to={`${createPageUrl("CommunityPost")}?id=${post.id}`}>
            <h3 className="font-bold text-base sm:text-lg mb-1 sm:mb-2 hover:text-purple-600 dark:hover:text-purple-400 transition-colors leading-snug">
              {post.title}
            </h3>
          </Link>

          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 sm:mb-3 line-clamp-2">
            {post.description}
          </p>

          <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-3">
            {t("community.featured.sharedBy")} {post.user?.full_name || t("community.featured.unknownUser")} • {format(new Date(post.created_date || Date.now()), 'MMM d')}
          </div>

          <div className="flex justify-between items-center mt-auto">
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 px-2"
                onClick={() => onLike(post.id)}
              >
                <Heart className={`h-4 w-4 ${isLiked ? 'fill-red-500 text-red-500' : ''}`} />
                <span>{post.likes || 0}</span>
              </Button>

              <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                <MessageSquare className="h-4 w-4" />
                <span>{post.commentCount || 0}</span>
              </div>
            </div>

            <Link to={`${createPageUrl("CommunityPost")}?id=${post.id}`}>
              <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white text-xs sm:text-sm">
                {t("community.featured.readMore")}
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}