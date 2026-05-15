import { useQuery } from '@tanstack/react-query';
import { sanityClient } from '@/lib/sanityClient';
import {
  BLOG_POSTS_QUERY,
  BLOG_POST_BY_SLUG_QUERY,
  FEATURED_BLOG_POSTS_QUERY,
  BLOG_POSTS_BY_TAG_QUERY,
  LANDING_PAGE_QUERY,
  AUTHORS_QUERY,
  TAGS_QUERY,
} from '@/lib/sanityQueries';

// ---------------------------------------------------------------------------
// Base fetcher
// ---------------------------------------------------------------------------

/**
 * Generic hook for running a GROQ query against Sanity.
 *
 * @param {string}  queryKey  - Stable cache key prefix (e.g. 'blogPosts')
 * @param {string}  query     - GROQ query string
 * @param {object}  [params]  - Query params
 * @param {object}  [options] - Extra React Query options
 */
export function useSanityQuery(queryKey, query, params = {}, options = {}) {
  const isSanityConfigured = !!import.meta.env.VITE_SANITY_PROJECT_ID;
  const result = useQuery({
    queryKey: ['sanity', queryKey, JSON.stringify(params)],
    queryFn: () => sanityClient.fetch(query, params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: isSanityConfigured,
    ...options,
  });
  // When Sanity isn't configured (no VITE_SANITY_PROJECT_ID), React Query keeps
  // isLoading=true forever because `enabled:false` never settles. Consumers like
  // BlogPost.jsx fall back to mock data only when isLoading=false → page sticks
  // on skeleton. Override here so callers always reach a non-loading state.
  // Sprint 7.25e fix (2026-05-15).
  if (!isSanityConfigured) {
    return { ...result, data: undefined, isLoading: false, isFetching: false };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Blog hooks
// ---------------------------------------------------------------------------

/**
 * Fetch all published blog posts for Sipurai.
 */
export function useBlogPosts() {
  return useSanityQuery('blogPosts', BLOG_POSTS_QUERY);
}

/**
 * Fetch a single blog post by its slug.
 * @param {string} slug
 */
export function useBlogPost(slug) {
  return useSanityQuery(
    `blogPost-${slug}`,
    BLOG_POST_BY_SLUG_QUERY,
    { slug },
    { enabled: !!slug && !!import.meta.env.VITE_SANITY_PROJECT_ID }
  );
}

/**
 * Fetch featured blog posts (most recent 6).
 */
export function useFeaturedBlogPosts() {
  return useSanityQuery('featuredBlogPosts', FEATURED_BLOG_POSTS_QUERY);
}

/**
 * Fetch blog posts filtered by tag.
 * @param {string} tag
 */
export function useBlogPostsByTag(tag) {
  return useSanityQuery(
    `blogPosts-tag-${tag}`,
    BLOG_POSTS_BY_TAG_QUERY,
    { tag },
    { enabled: !!tag && !!import.meta.env.VITE_SANITY_PROJECT_ID }
  );
}

// ---------------------------------------------------------------------------
// Landing page hook
// ---------------------------------------------------------------------------

/**
 * Fetch landing page content (slug: "home").
 */
export function useLandingPage() {
  return useSanityQuery('landingPage', LANDING_PAGE_QUERY);
}

// ---------------------------------------------------------------------------
// Authors & Tags hooks
// ---------------------------------------------------------------------------

/**
 * Fetch all authors.
 */
export function useAuthors() {
  return useSanityQuery('authors', AUTHORS_QUERY);
}

/**
 * Fetch unique tags from published posts.
 */
export function useTags() {
  return useSanityQuery('tags', TAGS_QUERY);
}
