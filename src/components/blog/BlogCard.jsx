import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Calendar, Clock, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import LazyImage from "@/components/shared/LazyImage";
import { useI18n } from "@/components/i18n/i18nProvider";
import { urlFor } from "@/lib/sanityClient";

/**
 * BlogCard — displays a single blog post summary in a grid layout.
 * Handles both Sanity data shape and the local mock data shape.
 *
 * Props:
 *   post        — blog post object
 *   featured    — when true, renders a wider featured-post variant
 *   index       — used for stagger animation delay
 */
function BlogCard({ post, featured = false, index = 0 }) {
  const { isRTL, t } = useI18n();

  // Resolve image URL — handles Sanity asset reference OR plain string URL
  const imageUrl = React.useMemo(() => {
    if (!post.mainImage) return post.coverImage || null;
    if (typeof post.mainImage === "string") return post.mainImage;
    try {
      return urlFor(post.mainImage).width(featured ? 1200 : 640).height(featured ? 480 : 360).url();
    } catch {
      return null;
    }
  }, [post.mainImage, post.coverImage, featured]);

  // Fallback gradient — used when no cover image is available
  const coverGradient = post.coverGradient || "from-purple-500 to-indigo-600";

  // Format date — supports ISO strings with Hebrew/English locale
  const formattedDate = React.useMemo(() => {
    if (!post.publishedAt) return "";
    try {
      return new Date(post.publishedAt).toLocaleDateString(
        isRTL ? "he-IL" : "en-US",
        { year: "numeric", month: "long", day: "numeric" }
      );
    } catch {
      return post.publishedAt;
    }
  }, [post.publishedAt, isRTL]);

  const slug = typeof post.slug === "object" ? post.slug?.current : post.slug;
  const authorName = post.author?.name || post.authorName || "";
  const categories = post.categories || [];
  const readingTime = post.estimatedReadingTime || post.readingTime;

  const postUrl = `/blog/${slug}`;

  if (featured) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: index * 0.08 }}
        className="col-span-full"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <Card className="overflow-hidden hover:shadow-2xl transition-all duration-300 border-purple-100 dark:border-purple-900 group">
          <div className="grid md:grid-cols-2 gap-0">
            {/* Image */}
            <div className={`relative aspect-video md:aspect-auto overflow-hidden min-h-[260px] ${imageUrl ? 'bg-gray-100 dark:bg-gray-800' : `bg-gradient-to-br ${coverGradient}`}`}>
              {imageUrl ? (
                <LazyImage
                  src={imageUrl}
                  alt={post.title}
                  className="absolute inset-0 w-full h-full transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <span className="text-6xl opacity-80">📖</span>
                  <span className="text-white/70 text-sm font-medium px-4 text-center line-clamp-2">{post.title}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
              <Badge className="absolute top-4 start-4 bg-purple-600 text-white shadow-lg">
                {t("blog.featuredBadge")}
              </Badge>
            </div>

            {/* Content */}
            <CardContent className="flex flex-col justify-center p-8 gap-4">
              {/* Categories */}
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {categories.slice(0, 3).map((cat) => {
                    const catTitle = typeof cat === "string" ? cat : cat.title;
                    return (
                      <Badge key={catTitle} variant="outline" className="text-xs border-purple-200 text-purple-700 dark:border-purple-800 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30">
                        {catTitle}
                      </Badge>
                    );
                  })}
                </div>
              )}

              <Link to={postUrl} className="group/title">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white leading-tight group-hover/title:text-purple-600 dark:group-hover/title:text-purple-400 transition-colors">
                  {post.title}
                </h2>
              </Link>

              {post.excerpt && (
                <p className="text-gray-600 dark:text-gray-300 line-clamp-3 text-base leading-relaxed">
                  {post.excerpt}
                </p>
              )}

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-auto pt-2 border-t border-gray-100 dark:border-gray-800">
                {authorName && (
                  <span className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 shrink-0" />
                    {authorName}
                  </span>
                )}
                {formattedDate && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    {formattedDate}
                  </span>
                )}
                {readingTime && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    {readingTime} {t("blog.minRead")}
                  </span>
                )}
              </div>

              <Link
                to={postUrl}
                className="inline-flex items-center gap-2 text-purple-600 dark:text-purple-400 font-semibold hover:text-purple-800 dark:hover:text-purple-200 transition-colors mt-2"
              >
                {t("blog.readMore")}
                <span aria-hidden="true">{isRTL ? "←" : "→"}</span>
              </Link>
            </CardContent>
          </div>
        </Card>
      </motion.div>
    );
  }

  // Standard card
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07 }}
      className="h-full"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <Card className="overflow-hidden h-full flex flex-col hover:shadow-xl transition-all duration-300 border-gray-200 dark:border-gray-800 hover:border-purple-200 dark:hover:border-purple-800 group">
        {/* Image */}
        <Link to={postUrl} className={`block relative aspect-video overflow-hidden shrink-0 ${imageUrl ? 'bg-gray-100 dark:bg-gray-800' : `bg-gradient-to-br ${coverGradient}`}`}>
          {imageUrl ? (
            <LazyImage
              src={imageUrl}
              alt={post.title}
              className="absolute inset-0 w-full h-full transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <span className="text-4xl opacity-80">📖</span>
              <span className="text-white/70 text-xs font-medium px-3 text-center line-clamp-2">{post.title}</span>
            </div>
          )}
        </Link>

        {/* Content */}
        <CardContent className="flex flex-col flex-1 p-5 gap-3">
          {/* Categories */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {categories.slice(0, 2).map((cat) => {
                const catTitle = typeof cat === "string" ? cat : cat.title;
                return (
                  <Badge key={catTitle} variant="outline" className="text-xs border-purple-200 text-purple-700 dark:border-purple-800 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30">
                    {catTitle}
                  </Badge>
                );
              })}
            </div>
          )}

          <Link to={postUrl} className="group/title">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white leading-snug line-clamp-2 group-hover/title:text-purple-600 dark:group-hover/title:text-purple-400 transition-colors">
              {post.title}
            </h3>
          </Link>

          {post.excerpt && (
            <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3 leading-relaxed flex-1">
              {post.excerpt}
            </p>
          )}

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-100 dark:border-gray-800">
            {authorName && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3 shrink-0" />
                {authorName}
              </span>
            )}
            {formattedDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3 shrink-0" />
                {formattedDate}
              </span>
            )}
            {readingTime && (
              <span className="flex items-center gap-1 ms-auto">
                <Clock className="h-3 w-3 shrink-0" />
                {readingTime} {t("blog.minRead")}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default React.memo(BlogCard);
