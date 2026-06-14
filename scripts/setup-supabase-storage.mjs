/**
 * One-time setup script: creates Supabase Storage bucket + RLS policies.
 * Run with: node scripts/setup-supabase-storage.mjs
 *
 * Uses the service role key (bypasses RLS) to set up policies
 * that allow the anon key to upload and read images.
 */

import { createClient } from '@supabase/supabase-js';

// Credentials come from the environment — NEVER hardcode the service_role key
// (it bypasses all RLS and was previously committed to git; rotate it in Supabase).
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://furviizyohryyqubosut.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error(
    'Missing SUPABASE_SERVICE_ROLE_KEY env var. Set it before running this one-time setup script.'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function setup() {
  console.log('Setting up Supabase Storage for Sipurai...\n');

  // 1. Check if bucket exists
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.id === 'sipurai-images');

  if (exists) {
    console.log('✓ Bucket "sipurai-images" already exists');
  } else {
    const { error } = await supabase.storage.createBucket('sipurai-images', {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: [
        'image/png',
        'image/jpeg',
        'image/webp',
        'image/gif',
        'image/svg+xml',
        'application/pdf',
      ],
    });
    if (error) {
      console.error('✗ Failed to create bucket:', error.message);
    } else {
      console.log('✓ Created bucket "sipurai-images"');
    }
  }

  // 2. Test upload with service role key
  const testBlob = new Blob(['test'], { type: 'text/plain' });
  const testPath = `_test/setup-check-${Date.now()}.txt`;

  const { error: uploadError } = await supabase.storage
    .from('sipurai-images')
    .upload(testPath, testBlob, { contentType: 'text/plain' });

  if (uploadError) {
    console.error('✗ Test upload failed:', uploadError.message);
  } else {
    console.log('✓ Test upload succeeded');
    // Clean up test file
    await supabase.storage.from('sipurai-images').remove([testPath]);
    console.log('✓ Cleaned up test file');
  }

  // 3. Get public URL format
  const { data: urlData } = supabase.storage
    .from('sipurai-images')
    .getPublicUrl('example.png');

  console.log(`\n✓ Public URL format: ${urlData.publicUrl}`);

  console.log('\n─── SQL policies needed ───');
  console.log('Run this SQL in Supabase Dashboard > SQL Editor:\n');
  console.log(`
-- Allow anyone to read files from sipurai-images (public bucket)
CREATE POLICY "sipurai_public_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'sipurai-images');

-- Allow anyone to upload files to sipurai-images
-- (Will be tightened in Phase 4 when Supabase Auth is added)
CREATE POLICY "sipurai_public_insert"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'sipurai-images');
  `);

  console.log('Setup complete!');
}

setup().catch(console.error);
