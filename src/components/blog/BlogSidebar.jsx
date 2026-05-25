import { Link } from "react-router-dom";
import { Calendar, Tag, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import LazyImage from "@/components/shared/LazyImage";
import { useI18n } from "@/components/i18n/i18nProvider";
import { urlFor } from "@/lib/sanityClient";

/**
 * BlogSidebar — shows categories and recent posts in a right/left rail.
 *
 * Props:
 *   categories         — array of { title, slug } or string[]
 *   recentPosts        — array of post objects (up to 5)
 *   selectedCategory   — currently selected category slug
 *   onCategoryChange   — (slug) => void
 */
function BlogSidebar({ categories = [], recentPosts = [], selectedCategory = "", onCategoryChange }) {
  const { isRTL, t } = useI18n();

  const getPostImageUrl = (post) => {
    if (!post.mainImage) return post.coverImage || null;
    if (typeof post.mainImage === "string") return post.mainImage;
    try {
      return urlFor(post.mainImage).width(80).height(80).url();
    } catch {
      return null;
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toLocaleDateString(isRTL ? "he-IL" : "en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <aside className="space-y-6" dir={isRTL ? "rtl" : "ltr"} aria-label={t("blog.sidebar")}>
      {/* Categories */}
      {categories.length > 0 && (
        <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Tag className="h-4 w-4 text-purple-500" aria-hidden="true" />
              {t("blog.categoriesTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-1" role="list">
              {/* All */}
              <li>
                <button
                  onClick={() => onCategoryChange?.("")}
                  className={`w-full text-start px-3 py-2 rounded-lg text-sm transition-colors ${
                    !selectedCategory
                      ? "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                  aria-pressed={!selectedCategory}
                >
                  {t("blog.allCategories")}
                </button>
              </li>

              {categories.map((cat) => {
                const slug = typeof cat === "string" ? cat : (cat.slug?.current || cat.slug || cat.title);
                const title = typeof cat === "string" ? cat : cat.title;
                const isActive = selectedCategory === slug;

                return (
                  <li key={slug}>
                    <button
                      onClick={() => onCategoryChange?.(isActive ? "" : slug)}
                      className={`w-full text-start px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                      aria-pressed={isActive}
                    >
                      {title}
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Recent Posts */}
      {recentPosts.length > 0 && (
        <Card className="border-gray-200 dark:border-gray-800 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-500" aria-hidden="true" />
              {t("blog.recentPostsTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-4" role="list">
              {recentPosts.slice(0, 5).map((post) => {
                const slug = typeof post.slug === "object" ? post.slug?.current : post.slug;
                const imgUrl = getPostImageUrl(post);

                return (
                  <li key={post._id || slug}>
                    <Link
                      to={`/blog/${slug}`}
                      className="flex gap-3 group items-start"
                    >
                      {/* Thumbnail */}
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-purple-50 dark:bg-purple-900/30 shrink-0">
                        {imgUrl ? (
                          <LazyImage
                            src={imgUrl}
                            alt={post.title}
                            className="w-full h-full"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl">
                            📖
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors leading-snug">
                          {post.title}
                        </p>
                        {post.publishedAt && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1">
                            <Calendar className="h-3 w-3 shrink-0" aria-hidden="true" />
                            {formatDate(post.publishedAt)}
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Newsletter CTA */}
      <Card className="border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/50 dark:to-indigo-950/50 shadow-sm">
        <CardContent className="p-5 text-center space-y-3">
          <div className="text-3xl">✉️</div>
          <h3 className="font-bold text-gray-900 dark:text-white text-sm">
            {t("blog.newsletterTitle")}
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-300">
            {t("blog.newsletterDesc")}
          </p>
          <a
            href="mailto:hello@sipurai.ai"
            className="inline-block w-full text-center py-2 px-4 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors"
          >
            {t("blog.subscribeBtn")}
          </a>
        </CardContent>
      </Card>
    </aside>
  );
}

export default BlogSidebar;
