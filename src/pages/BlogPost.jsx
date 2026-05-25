import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  User,
  Share2,
  Copy,
  Check,
  BookOpen,
  List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/components/i18n/i18nProvider";
import { useBlogPost } from "@/hooks/useSanityContent";
import { urlFor } from "@/lib/sanityClient";
import PortableText, { extractHeadings } from "@/components/blog/PortableText";
import BlogCard from "@/components/blog/BlogCard";
import { updateMeta, resetMeta } from "@/lib/seo";
import DEMO_POSTS, { getPostBySlug } from "@/data/blogPosts";

// ---------------------------------------------------------------------------
// Demo post lookup — uses the shared blogPosts data file
// ---------------------------------------------------------------------------

function getMockPost(slug) {
  const found = getPostBySlug(slug);
  if (found) {
    // Pick up to 2 other posts as related
    const related = DEMO_POSTS.filter((p) => p.slug !== slug).slice(0, 2);
    return { ...found, relatedPosts: related };
  }
  return {
    _id: `mock-${slug}`,
    slug,
    title: null,
    excerpt: null,
    publishedAt: new Date().toISOString(),
    authorName: null,
    readingTime: 3,
    categories: [],
    body: null,
    relatedPosts: [],
  };
}

// ---------------------------------------------------------------------------
// Table of Contents component
// ---------------------------------------------------------------------------

function TableOfContents({ headings, isRTL, t }) {
  if (!headings || headings.length === 0) return null;
  return (
    <nav aria-label={t("blog.tableOfContents")} className="mb-8 p-4 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900">
      <h3 className="font-semibold text-purple-800 dark:text-purple-200 flex items-center gap-2 mb-3 text-sm">
        <List className="h-4 w-4" aria-hidden="true" />
        {t("blog.tableOfContents")}
      </h3>
      <ul className="space-y-1.5">
        {headings.map((h) => (
          <li key={h.id} style={{ paddingInlineStart: `${(h.level - 2) * 12}px` }}>
            <a
              href={`#${h.id}`}
              className="text-sm text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-100 hover:underline transition-colors"
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Author card
// ---------------------------------------------------------------------------

function AuthorCard({ author, authorName, isRTL, t }) {
  const name = author?.name || authorName;
  if (!name) return null;

  let avatarUrl = null;
  if (author?.image) {
    try {
      avatarUrl = urlFor(author.image).width(80).height(80).url();
    } catch {
      avatarUrl = null;
    }
  }

  return (
    <div
      className="flex items-start gap-4 p-5 rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 border border-purple-100 dark:border-purple-900 mt-10"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Avatar */}
      <div className="w-14 h-14 rounded-full overflow-hidden bg-purple-200 dark:bg-purple-800 shrink-0 flex items-center justify-center">
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="w-full h-full object-cover" width="56" height="56" loading="lazy" />
        ) : (
          <User className="h-7 w-7 text-purple-500" aria-hidden="true" />
        )}
      </div>

      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{t("blog.writtenBy")}</p>
        <h3 className="font-bold text-gray-900 dark:text-white">{name}</h3>
        {author?.bio && (
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
            {typeof author.bio === "string" ? author.bio : ""}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Share buttons
// ---------------------------------------------------------------------------

function ShareButtons({ title, isRTL, t }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(`${title} — ${window.location.href}`)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex flex-wrap items-center gap-3 pt-6 border-t border-gray-200 dark:border-gray-800 mt-8" dir={isRTL ? "rtl" : "ltr"}>
      <span className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
        <Share2 className="h-4 w-4" aria-hidden="true" />
        {t("blog.sharePost")}:
      </span>

      <Button
        variant="outline"
        size="sm"
        onClick={handleWhatsApp}
        className="gap-2 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/20 text-green-700 dark:text-green-400"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.136.562 4.14 1.542 5.876L0 24l6.293-1.512A11.93 11.93 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818c-1.98 0-3.826-.546-5.404-1.494l-.388-.23-4.01.964.984-3.914-.254-.403A9.793 9.793 0 0 1 2.182 12C2.182 6.571 6.571 2.182 12 2.182S21.818 6.571 21.818 12 17.429 21.818 12 21.818z" />
        </svg>
        WhatsApp
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handleCopy}
        className="gap-2 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        {copied ? (
          <><Check className="h-4 w-4 text-green-500" aria-hidden="true" /> {t("blog.linkCopied")}</>
        ) : (
          <><Copy className="h-4 w-4" aria-hidden="true" /> {t("blog.copyLink")}</>
        )}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function PostSkeleton({ isRTL }) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10" dir={isRTL ? "rtl" : "ltr"}>
      <Skeleton className="h-5 w-32 mb-6" />
      <Skeleton className="h-72 w-full rounded-xl mb-8" />
      <div className="space-y-3 mb-8">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-8 w-1/2" />
      </div>
      <div className="flex gap-4 mb-8">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className={`h-4 ${i % 3 === 2 ? "w-2/3" : "w-full"}`} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main BlogPost page
// ---------------------------------------------------------------------------

export default function BlogPost() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  // Support ?slug= query param as fallback (in case router uses query params)
  const effectiveSlug = slug || searchParams.get("slug") || "";

  const { isRTL, t } = useI18n();

  // Sanity fetch (disabled when no project ID)
  const { data: sanityPost, isLoading } = useBlogPost(effectiveSlug);

  // Use Sanity data or fall back to mock
  const post = useMemo(
    () => (sanityPost || (!isLoading ? getMockPost(effectiveSlug) : null)),
    [sanityPost, isLoading, effectiveSlug]
  );

  // Resolve image URL
  const coverImageUrl = useMemo(() => {
    if (!post?.mainImage) return null;
    if (typeof post.mainImage === "string") return post.mainImage;
    try {
      return urlFor(post.mainImage).width(1200).height(630).url();
    } catch {
      return null;
    }
  }, [post?.mainImage]);

  // Headings for table of contents
  const headings = useMemo(
    () => (Array.isArray(post?.body) ? extractHeadings(post.body) : []),
    [post?.body]
  );

  const formattedDate = useMemo(() => {
    if (!post?.publishedAt) return "";
    try {
      return new Date(post.publishedAt).toLocaleDateString(isRTL ? "he-IL" : "en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return post.publishedAt;
    }
  }, [post?.publishedAt, isRTL]);

  // Reading time estimate from body string length when not in Sanity data
  const readingTime = post?.estimatedReadingTime || post?.readingTime || null;

  // SEO meta tags
  useEffect(() => {
    if (post?.title) {
      updateMeta({
        title: post.title,
        description: post.excerpt,
        image: coverImageUrl,
        type: 'article',
      });
    }
    return () => resetMeta();
  }, [post?.title, post?.excerpt, coverImageUrl]);

  if (isLoading) return <PostSkeleton isRTL={isRTL} />;

  if (!post) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center" dir={isRTL ? "rtl" : "ltr"}>
        <BookOpen className="h-16 w-16 text-gray-300 dark:text-gray-700 mx-auto mb-4" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">{t("blog.postNotFound")}</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">{t("blog.postNotFoundDesc")}</p>
        <Link to="/blog">
          <Button className="gap-2 bg-purple-600 hover:bg-purple-700 text-white">
            {isRTL ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : <ArrowLeft className="h-4 w-4" aria-hidden="true" />}
            {t("blog.backToBlog")}
          </Button>
        </Link>
      </div>
    );
  }

  const authorName = post.author?.name || post.authorName;
  const categories = post.categories || [];
  const relatedPosts = post.relatedPosts || [];

  return (
    <div className="min-h-dvh bg-white dark:bg-gray-950" dir={isRTL ? "rtl" : "ltr"}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        {/* Back link */}
        <Link
          to="/blog"
          className="inline-flex items-center gap-1.5 text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200 transition-colors text-sm font-medium mb-8 group"
        >
          {isRTL ? (
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
          ) : (
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" aria-hidden="true" />
          )}
          {t("blog.backToBlog")}
        </Link>

        <motion.article
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Cover image */}
          {coverImageUrl && (
            <div className="aspect-video w-full overflow-hidden rounded-2xl mb-8 bg-gray-100 dark:bg-gray-800">
              <img
                src={coverImageUrl}
                alt={post.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Categories */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {categories.map((cat) => {
                const title = typeof cat === "string" ? cat : cat.title;
                const slug = typeof cat === "string" ? cat : (cat.slug?.current || cat.slug || cat.title);
                return (
                  <Link key={slug} to={`/blog?category=${slug}`}>
                    <Badge variant="outline" className="text-xs border-purple-200 text-purple-700 dark:border-purple-800 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-800/50 transition-colors cursor-pointer">
                      {title}
                    </Badge>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white leading-tight mb-6">
            {post.title}
          </h1>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-8 pb-6 border-b border-gray-200 dark:border-gray-800">
            {authorName && (
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4 shrink-0" aria-hidden="true" />
                {authorName}
              </span>
            )}
            {formattedDate && (
              <time dateTime={post.publishedAt} className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
                {formattedDate}
              </time>
            )}
            {readingTime && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                {readingTime} {t("blog.minRead")}
              </span>
            )}
          </div>

          {/* Table of contents (only for long portable text content) */}
          {headings.length >= 3 && (
            <TableOfContents headings={headings} isRTL={isRTL} t={t} />
          )}

          {/* Body */}
          <div className="text-gray-700 dark:text-gray-200 leading-relaxed text-lg">
            <PortableText value={post.body} dir={isRTL ? "rtl" : "ltr"} />
          </div>

          {/* Share buttons */}
          <ShareButtons title={post.title} isRTL={isRTL} t={t} />

          {/* Author card */}
          <AuthorCard
            author={post.author}
            authorName={post.authorName}
            isRTL={isRTL}
            t={t}
          />
        </motion.article>

        {/* Related posts */}
        {relatedPosts.length > 0 && (
          <section className="mt-14 pt-10 border-t border-gray-200 dark:border-gray-800">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              {t("blog.relatedPostsTitle")}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {relatedPosts.map((related, idx) => (
                <BlogCard key={related._id || idx} post={related} index={idx} />
              ))}
            </div>
          </section>
        )}

        {/* Back to blog CTA */}
        <div className="mt-12 text-center">
          <Link to="/blog">
            <Button variant="outline" className="gap-2 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-300">
              {isRTL ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : <ArrowLeft className="h-4 w-4" aria-hidden="true" />}
              {t("blog.backToBlog")}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
