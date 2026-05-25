import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/i18n/i18nProvider";

/**
 * BlogHeader — page header with search input and category filter pills.
 *
 * Props:
 *   searchQuery        — controlled search string
 *   onSearchChange     — (string) => void
 *   categories         — array of { title, slug } or string[]
 *   selectedCategory   — currently active category slug/string or ""
 *   onCategoryChange   — (slug) => void
 *   totalPosts         — number — shown in the subtitle
 */
function BlogHeader({
  searchQuery = "",
  onSearchChange,
  categories = [],
  selectedCategory = "",
  onCategoryChange,
  totalPosts = 0,
}) {
  const { isRTL, t } = useI18n();

  const handleSearchChange = (e) => {
    onSearchChange?.(e.target.value);
  };

  const handleClearSearch = () => {
    onSearchChange?.("");
  };

  const handleCategoryClick = (slug) => {
    onCategoryChange?.(selectedCategory === slug ? "" : slug);
  };

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Title + subtitle */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
          {t("blog.title")}
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          {t("blog.subtitle")}
        </p>
        {totalPosts > 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {totalPosts} {t("blog.postsCount")}
          </p>
        )}
      </div>

      {/* Search bar */}
      <div className="max-w-xl mx-auto">
        <div className="relative">
          <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none ${isRTL ? "right-3" : "left-3"}`} />
          <Input
            type="search"
            placeholder={t("blog.searchPlaceholder")}
            value={searchQuery}
            onChange={handleSearchChange}
            className={`${isRTL ? "pr-9 pl-9" : "pl-9 pr-9"} bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 focus-visible:ring-purple-500`}
            aria-label={t("blog.searchPlaceholder")}
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className={`absolute top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors ${isRTL ? "left-3" : "right-3"}`}
              aria-label={t("blog.clearSearch")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Category filter pills */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center">
          {/* "All" pill */}
          <button
            onClick={() => onCategoryChange?.("")}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
              !selectedCategory
                ? "bg-purple-600 text-white shadow-md shadow-purple-200 dark:shadow-purple-900/30"
                : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-700 dark:hover:text-purple-300"
            }`}
            aria-pressed={!selectedCategory}
          >
            {t("blog.allCategories")}
          </button>

          {categories.map((cat) => {
            const slug = typeof cat === "string" ? cat : (cat.slug?.current || cat.slug || cat.title);
            const title = typeof cat === "string" ? cat : cat.title;
            const isActive = selectedCategory === slug;

            return (
              <button
                key={slug}
                onClick={() => handleCategoryClick(slug)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
                  isActive
                    ? "bg-purple-600 text-white shadow-md shadow-purple-200 dark:shadow-purple-900/30"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-700 dark:hover:text-purple-300"
                }`}
                aria-pressed={isActive}
              >
                {title}
              </button>
            );
          })}
        </div>
      )}

      {/* Active filter indicator */}
      {(searchQuery || selectedCategory) && (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <span>{t("blog.filtering")}:</span>
          {searchQuery && (
            <Badge variant="secondary" className="gap-1 pe-1">
              &ldquo;{searchQuery}&rdquo;
              <button onClick={handleClearSearch} className="hover:text-red-500 transition-colors" aria-label={t("blog.clearSearch")}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {selectedCategory && (
            <Badge variant="secondary" className="gap-1 pe-1">
              {categories.find((c) => {
                const s = typeof c === "string" ? c : (c.slug?.current || c.slug || c.title);
                return s === selectedCategory;
              })?.title || selectedCategory}
              <button onClick={() => onCategoryChange?.("")} className="hover:text-red-500 transition-colors" aria-label={t("blog.clearCategory")}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

export default BlogHeader;
