import React, { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/components/i18n/i18nProvider";
import { useBlogPosts } from "@/hooks/useSanityContent";
import BlogCard from "@/components/blog/BlogCard";
import BlogHeader from "@/components/blog/BlogHeader";
import BlogSidebar from "@/components/blog/BlogSidebar";
import { updateMeta, resetMeta } from "@/lib/seo";
import DEMO_POSTS from "@/data/blogPosts";

// ---------------------------------------------------------------------------
// Mock / demo data shown when Sanity is not configured
// ---------------------------------------------------------------------------

const MOCK_POSTS = DEMO_POSTS;

const POSTS_PER_PAGE = 6;

// ---------------------------------------------------------------------------
// Loading skeletons
// ---------------------------------------------------------------------------

function PostSkeleton() {
  return (
    <Card className="overflow-hidden border-gray-200 dark:border-gray-800">
      <Skeleton className="aspect-video w-full" />
      <CardContent className="p-5 space-y-3">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex gap-4 pt-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ isFiltered }) {
  const { isRTL, t } = useI18n();
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="col-span-full flex flex-col items-center justify-center py-20 text-center"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="text-6xl mb-6">📚</div>
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
        {isFiltered ? t("blog.noResultsTitle") : t("blog.emptyTitle")}
      </h3>
      <p className="text-gray-500 dark:text-gray-400 max-w-md text-lg">
        {isFiltered ? t("blog.noResultsDesc") : t("blog.emptyDesc")}
      </p>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main Blog page
// ---------------------------------------------------------------------------

export default function Blog() {
  const { isRTL, t } = useI18n();

  // Sanity data (enabled only when VITE_SANITY_PROJECT_ID is set)
  const { data: sanityPosts, isLoading } = useBlogPosts();

  // Use Sanity data when available, fall back to mock posts
  const allPosts = useMemo(
    () => {
      const bySlug = new Map();
      for (const post of [...(sanityPosts || []), ...MOCK_POSTS]) {
        const slug = typeof post.slug === 'object' ? post.slug?.current : post.slug;
        if (slug && !bySlug.has(slug)) bySlug.set(slug, post);
      }
      return [...bySlug.values()].sort((a,b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0));
    },
    [sanityPosts]
  );

  // Derive unique categories from posts
  const allCategories = useMemo(() => {
    const seen = new Set();
    const cats = [];
    for (const post of allPosts) {
      for (const cat of post.categories || []) {
        const slug = typeof cat === "string" ? cat : (cat.slug?.current || cat.slug || cat.title);
        if (!seen.has(slug)) {
          seen.add(slug);
          cats.push(typeof cat === "string" ? { title: cat, slug: cat } : cat);
        }
      }
    }
    return cats;
  }, [allPosts]);

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [visibleCount, setVisibleCount] = useState(POSTS_PER_PAGE);

  // Reset visible count when filters change
  const handleSearchChange = useCallback((val) => {
    setSearchQuery(val);
    setVisibleCount(POSTS_PER_PAGE);
  }, []);

  const handleCategoryChange = useCallback((slug) => {
    setSelectedCategory(slug);
    setVisibleCount(POSTS_PER_PAGE);
  }, []);

  // Filtered posts (client-side)
  const filteredPosts = useMemo(() => {
    let result = allPosts;

    if (selectedCategory) {
      result = result.filter((post) =>
        (post.categories || []).some((cat) => {
          const slug = typeof cat === "string" ? cat : (cat.slug?.current || cat.slug || cat.title);
          return slug === selectedCategory;
        })
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (post) =>
          post.title?.toLowerCase().includes(q) ||
          post.excerpt?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [allPosts, selectedCategory, searchQuery]);

  // Featured post = first post with featured=true, or just the first post
  const featuredPost = useMemo(
    () => (!searchQuery && !selectedCategory)
      ? (filteredPosts.find((p) => p.featured) || filteredPosts[0] || null)
      : null,
    [filteredPosts, searchQuery, selectedCategory]
  );

  // Grid posts (everything except featured, limited by visibleCount)
  const gridPosts = useMemo(() => {
    const withoutFeatured = featuredPost
      ? filteredPosts.filter((p) => p._id !== featuredPost._id)
      : filteredPosts;
    return withoutFeatured.slice(0, visibleCount);
  }, [filteredPosts, featuredPost, visibleCount]);

  const totalGridPosts = useMemo(() => {
    return featuredPost
      ? filteredPosts.filter((p) => p._id !== featuredPost._id).length
      : filteredPosts.length;
  }, [filteredPosts, featuredPost]);

  const hasMore = totalGridPosts > visibleCount;

  const handleLoadMore = useCallback(() => {
    setVisibleCount((prev) => prev + POSTS_PER_PAGE);
  }, []);

  const isFiltered = !!(searchQuery || selectedCategory);

  // SEO meta tags
  React.useEffect(() => {
    updateMeta({
      title: t("blog.title"),
      description: t("blog.metaDescription"),
    });
    return () => resetMeta();
  }, [t]);

  return (
    <div className="min-h-dvh bg-gray-50 dark:bg-gray-950" dir={isRTL ? "rtl" : "ltr"}>
      {/* Hero / header section */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <BlogHeader
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            categories={allCategories}
            selectedCategory={selectedCategory}
            onCategoryChange={handleCategoryChange}
            totalPosts={filteredPosts.length}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col lg:flex-row gap-10">
          {/* Posts area */}
          <main className="flex-1 min-w-0">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <PostSkeleton key={i} />
                ))}
              </div>
            ) : filteredPosts.length === 0 ? (
              <EmptyState isFiltered={isFiltered} />
            ) : (
              <div className="space-y-8">
                {/* Featured post (only when not filtering) */}
                {featuredPost && (
                  <section aria-label={t("blog.featuredBadge")}>
                    <BlogCard post={featuredPost} featured={true} index={0} />
                  </section>
                )}

                {/* Posts grid */}
                {gridPosts.length > 0 && (
                  <section>
                    {featuredPost && (
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                        {t("blog.latestPostsTitle")}
                      </h2>
                    )}

                    <AnimatePresence mode="popLayout">
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                        {gridPosts.map((post, idx) => (
                          <BlogCard key={post._id} post={post} index={idx} />
                        ))}
                      </div>
                    </AnimatePresence>

                    {/* Load more */}
                    {hasMore && (
                      <div className="flex justify-center mt-10">
                        <Button
                          variant="outline"
                          size="lg"
                          onClick={handleLoadMore}
                          className="gap-2 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                        >
                          <ChevronDown className="h-4 w-4" aria-hidden="true" />
                          {t("blog.loadMore")}
                        </Button>
                      </div>
                    )}
                  </section>
                )}
              </div>
            )}
          </main>

          {/* Sidebar */}
          <div className="lg:w-72 xl:w-80 shrink-0">
            <BlogSidebar
              categories={allCategories}
              recentPosts={allPosts.slice(0, 5)}
              selectedCategory={selectedCategory}
              onCategoryChange={handleCategoryChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
