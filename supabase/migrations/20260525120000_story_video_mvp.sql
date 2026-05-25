-- ============================================================================
-- Story → Video (MVP) — schema DRAFT.  *** DO NOT APPLY AUTOMATICALLY ***
--
-- Council MVP verdict (2026-05-25): Remotion + Ken Burns + existing Gemini TTS,
-- async render queue, per-user budget cap + hash cache, multi-layer moderation.
--
-- This migration adds the columns/table/bucket the video pipeline needs. It is a
-- DRAFT — review against the live `stories` schema before running. Run manually
-- via the Supabase SQL editor or `supabase db push` once verified.
-- ============================================================================

-- ── 1. stories: video render status + result ────────────────────────────────
-- video_status state machine matches src/lib/storyVideo/constants.js VIDEO_STATUS.
alter table if exists public.stories
  add column if not exists video_url          text,
  add column if not exists video_status       text not null default 'none',
  add column if not exists video_rendered_at  timestamptz,
  -- hash-based cache key (storyVideoCacheKey) → skip re-render of unchanged story.
  add column if not exists video_cache_key     text;

-- Constrain status to the known states (drop first so re-runs are idempotent).
alter table if exists public.stories
  drop constraint if exists stories_video_status_chk;
alter table if exists public.stories
  add constraint stories_video_status_chk
  check (video_status in ('none','queued','rendering','ready','failed'));

create index if not exists idx_stories_video_status on public.stories (video_status);
create index if not exists idx_stories_video_cache_key on public.stories (video_cache_key);

-- ── 2. story_scenes: optional per-page narration cache ───────────────────────
-- Caching narration audio + measured duration makes re-renders fast and cheap
-- (council: cache by hash). Optional — the pipeline works without it.
create table if not exists public.story_scenes (
  id                   uuid primary key default gen_random_uuid(),
  story_id             uuid not null references public.stories(id) on delete cascade,
  page_index           int  not null,
  narration_audio_url  text,
  duration_ms          int,
  -- per-scene fingerprint so a single edited page only re-synthesizes that page.
  scene_hash           text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (story_id, page_index)
);

create index if not exists idx_story_scenes_story on public.story_scenes (story_id);

alter table public.story_scenes enable row level security;

-- Owner-only access. Adjust the ownership join to match the real stories schema
-- (assumes stories.user_id = auth.uid()). REVIEW before applying.
drop policy if exists "story_scenes owner read"  on public.story_scenes;
drop policy if exists "story_scenes owner write" on public.story_scenes;

create policy "story_scenes owner read" on public.story_scenes
  for select using (
    exists (
      select 1 from public.stories s
      where s.id = story_scenes.story_id and s.user_id = auth.uid()
    )
  );

create policy "story_scenes owner write" on public.story_scenes
  for all using (
    exists (
      select 1 from public.stories s
      where s.id = story_scenes.story_id and s.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.stories s
      where s.id = story_scenes.story_id and s.user_id = auth.uid()
    )
  );

-- ── 3. per-user monthly render budget counter (optional) ─────────────────────
-- Backs budget.checkRenderBudget(). One row per user per month.
create table if not exists public.story_video_usage (
  user_id        uuid not null,
  period_month   date not null,            -- first day of the month
  renders_used   int  not null default 0,
  updated_at     timestamptz not null default now(),
  primary key (user_id, period_month)
);

alter table public.story_video_usage enable row level security;
drop policy if exists "story_video_usage owner" on public.story_video_usage;
create policy "story_video_usage owner" on public.story_video_usage
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── 4. Storage bucket note ───────────────────────────────────────────────────
-- Create a `story-videos` bucket (public-read, owner-write) for rendered mp4s.
-- Buckets are created via the Storage API/dashboard, not standard SQL DDL.
-- Equivalent SQL against storage.buckets (run in SQL editor if preferred):
--
--   insert into storage.buckets (id, name, public)
--   values ('story-videos', 'story-videos', true)
--   on conflict (id) do nothing;
--
-- Then add Storage RLS policies so only the owner can write:
--   - SELECT: public (or signed URLs)
--   - INSERT/UPDATE/DELETE: auth.uid() = owner
-- See https://supabase.com/docs/guides/storage/security/access-control
