/**
 * GROQ queries for Sanity CMS content.
 *
 * The Sanity post schema uses simple string fields (not localized objects),
 * with a `language` field ('he'|'en'|'yi') and a `siteId` field for filtering.
 * Posts for Sipurai use siteId == "eyai-kids".
 */

// ---------------------------------------------------------------------------
// Blog Posts
// ---------------------------------------------------------------------------

/**
 * Fetch all published blog posts for Sipurai, ordered by date descending.
 */
export const BLOG_POSTS_QUERY = `*[_type == "post" && siteId == "eyai-kids" && status == "published" && !(_id in path("drafts.**"))] | order(publishedAt desc) {
  _id,
  slug,
  publishedAt,
  mainImage,
  title,
  excerpt,
  body,
  language,
  tags,
  author->{name, image}
}`;

/**
 * Fetch a single blog post by its slug.
 * Required params: { slug: string }
 */
export const BLOG_POST_BY_SLUG_QUERY = `*[_type == "post" && siteId == "eyai-kids" && slug.current == $slug && status == "published" && !(_id in path("drafts.**"))][0] {
  _id,
  slug,
  publishedAt,
  mainImage,
  title,
  excerpt,
  body,
  language,
  tags,
  author->{name, image, bio},
  "relatedPosts": *[_type == "post" && siteId == "eyai-kids" && _id != ^._id && status == "published" && !(_id in path("drafts.**"))][0..2] {
    _id, slug, title, mainImage, publishedAt
  }
}`;

/**
 * Fetch only featured blog posts (most recent 6).
 */
export const FEATURED_BLOG_POSTS_QUERY = `*[_type == "post" && siteId == "eyai-kids" && status == "published" && !(_id in path("drafts.**"))] | order(publishedAt desc)[0..5] {
  _id,
  slug,
  publishedAt,
  mainImage,
  title,
  excerpt,
  tags,
  author->{name, image}
}`;

/**
 * Fetch blog posts filtered by tag.
 * Required params: { tag: string }
 */
export const BLOG_POSTS_BY_TAG_QUERY = `*[_type == "post" && siteId == "eyai-kids" && status == "published" && $tag in tags && !(_id in path("drafts.**"))] | order(publishedAt desc) {
  _id,
  slug,
  publishedAt,
  mainImage,
  title,
  excerpt,
  tags,
  author->{name, image}
}`;

// ---------------------------------------------------------------------------
// Landing Page (CMS-managed, optional — app has static fallback)
// ---------------------------------------------------------------------------

/**
 * Fetch landing page content. Uses landingPage type if it exists in Sanity.
 */
export const LANDING_PAGE_QUERY = `*[_type == "landingPage" && slug.current == "home"][0] {
  heroTitle,
  heroSubtitle,
  heroCta,
  heroImage,
  features[] {
    icon,
    title,
    description
  },
  testimonials[] {
    quote,
    authorName,
    authorRole,
    authorImage
  },
  stats[] {
    value,
    label
  }
}`;

// ---------------------------------------------------------------------------
// Authors
// ---------------------------------------------------------------------------

/**
 * Fetch all authors.
 */
export const AUTHORS_QUERY = `*[_type == "author"] {
  _id,
  name,
  image,
  bio
}`;

/**
 * Fetch unique tags used across Sipurai posts.
 */
export const TAGS_QUERY = `array::unique(*[_type == "post" && siteId == "eyai-kids" && status == "published"].tags[])`;
