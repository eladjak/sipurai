import { createClient } from '@sanity/client';
import imageUrlBuilder from '@sanity/image-url';

const SANITY_PROJECT_ID = import.meta.env.VITE_SANITY_PROJECT_ID || 'b0hm1i34';

// Only create a real client when the project ID is configured.
// Prevents crashes on deployments where Sanity is not yet set up.
let sanityClient;
let builder;

if (SANITY_PROJECT_ID) {
  try {
    sanityClient = createClient({
      projectId: SANITY_PROJECT_ID,
      dataset: import.meta.env.VITE_SANITY_DATASET || 'production',
      apiVersion: '2024-03-01',
      useCdn: true,
    });
    builder = imageUrlBuilder(sanityClient);
  } catch (e) {
    // If client creation fails (e.g. invalid projectId) fall through to stub.
    sanityClient = null;
    builder = null;
  }
}

// Stub client returned when Sanity is not configured — fetch always returns [].
if (!sanityClient) {
  sanityClient = {
    fetch: () => Promise.resolve([]),
  };
}

export { sanityClient };

/**
 * Build a URL for a Sanity image asset.
 * Returns null safely when Sanity is not configured.
 * @param {object} source - Sanity image asset reference
 */
export function urlFor(source) {
  if (!builder) return null;
  return builder.image(source);
}
