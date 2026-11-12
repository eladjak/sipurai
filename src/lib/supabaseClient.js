/**
 * Supabase Client — shared instance for Storage, Database, and Auth.
 *
 * Auth is handled by Clerk. The Clerk JWT token is injected into every
 * Supabase request via a custom fetch wrapper, so RLS policies can
 * identify the authenticated user via auth.jwt().
 */

import { imageProxyUrl } from './imageUrl.js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  if (import.meta.env.DEV) console.warn(
    'Missing Supabase environment variables. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env'
  );
}

// ─── Clerk JWT Integration ──────────────────────────────────────────────────
// AuthContext calls setClerkTokenGetter() once Clerk is loaded.
// Every Supabase request then includes the Clerk JWT as Authorization header,
// enabling RLS policies to use auth.jwt() claims.

let _getToken = null;

/**
 * Register the Clerk getToken function so all Supabase requests are authenticated.
 * Called once from AuthContext when Clerk initializes.
 * @param {((options?: { template?: string }) => Promise<string|null>) | null} fn
 */
export function setClerkTokenGetter(fn) {
  _getToken = fn;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: async (url, options = {}) => {
      const headers = new Headers(options?.headers);
      if (_getToken) {
        try {
          const token = await _getToken({ template: 'supabase' });
          if (token) {
            headers.set('Authorization', `Bearer ${token}`);
          }
        } catch {
          // Token fetch failed — proceed without auth (anon role)
        }
      }
      return fetch(url, { ...options, headers });
    },
  },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

// ─── Storage Helpers ────────────────────────────────────────────────────────

const STORAGE_BUCKET = 'sipurai-images';

/**
 * Upload a File to Supabase Storage and return its same-origin proxy URL (/api/img?p=...).
 *
 * @param {File} file - The file to upload
 * @param {string} [folder='uploads'] - Subfolder inside the bucket
 * @returns {Promise<{ file_url: string }>} - Matches Base44's UploadFile return shape
 */
export async function uploadFileToSupabase(file, folder = 'uploads') {
  const ext = file.name?.split('.').pop() || 'png';
  const uniqueName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(uniqueName, file, {
      contentType: file.type || 'image/png',
      cacheControl: '31536000', // 1 year cache
      upsert: false,
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  // The bucket is private: images are read through the /api/img proxy, not a public URL.
  return { file_url: imageProxyUrl(data.path) };
}
