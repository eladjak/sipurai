import { useState, useCallback } from 'react';
import { Player } from '@remotion/player';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Film, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import StoryVideo from '@/remotion/StoryVideo.jsx';
import { buildRenderInput } from '@/lib/storyVideo/pipeline';
import { createRenderJob, transition } from '@/lib/storyVideo/renderQueue';
import { VIDEO_STATUS, FPS, VIDEO_WIDTH, VIDEO_HEIGHT } from '@/lib/storyVideo/constants';

/**
 * "צור וידאו מהסיפור" — enqueues an async render job and shows its status.
 *
 * MVP wiring:
 *  - Builds the Remotion input props from the story via the pure pipeline
 *    (no TTS network call here — narration is synthesized server-side at render;
 *    this preview uses the existing illustrations + Ken Burns + RTL captions).
 *  - Models the async render lifecycle (queued → rendering → ready) per council
 *    verdict; the real worker (Edge/Vercel/CLI) does the heavy mp4 render and
 *    sets stories.video_url. Here we show a live in-browser <Player> preview so
 *    the creator sees exactly what the rendered video will look like.
 *
 * @param {{ story: object, userTier?: string, usedThisMonth?: number }} props
 */
export default function StoryVideoButton({ story, userTier = 'free', usedThisMonth = 0 }) {
  const [job, setJob] = useState(null);
  const [inputProps, setInputProps] = useState(null);
  const [durationInFrames, setDurationInFrames] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);

  const status = job?.status ?? VIDEO_STATUS.NONE;
  const pageCount = Array.isArray(story?.pages) ? story.pages.length : 0;

  const handleEnqueue = useCallback(async () => {
    setErrorMsg(null);
    // 1. Build render input through the guarded pipeline (budget + cache + moderation).
    const res = await buildRenderInput(story, { tier: userTier, usedThisMonth });
    if (res.isErr) {
      setErrorMsg(res.error()?.message || 'בניית הווידאו נכשלה');
      return;
    }
    const out = res.value();

    // 2. Budget guard.
    if (!out.budget.allowed) {
      setErrorMsg('הגעת למכסת הווידאו החודשית. שדרגו את החבילה כדי ליצור עוד.');
      return;
    }

    setInputProps(out.inputProps);
    setDurationInFrames(out.durationInFrames);

    // 3. Cache hit → already rendered.
    if (out.budget.cached && out.budget.videoUrl) {
      const cachedJob = transition(
        transition(
          createRenderJob({
            storyId: story?.id ?? 'preview',
            cacheKey: out.cacheKey,
            durationInFrames: out.durationInFrames,
            inputProps: out.inputProps,
          }),
          VIDEO_STATUS.RENDERING
        ),
        VIDEO_STATUS.READY,
        { videoUrl: out.budget.videoUrl }
      );
      setJob(cachedJob);
      return;
    }

    // 4. Enqueue (async). The worker picks this up; here we model the lifecycle.
    const queued = createRenderJob({
      storyId: story?.id ?? 'preview',
      cacheKey: out.cacheKey,
      durationInFrames: out.durationInFrames,
      inputProps: out.inputProps,
    });
    setJob(queued);

    // Simulate the worker transitioning the job (real worker = Edge/Vercel/CLI).
    // The UI never blocks on the render — it polls video_status in production.
    setJob((j) => transition(j, VIDEO_STATUS.RENDERING));
  }, [story, userTier, usedThisMonth]);

  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Film className="h-5 w-5 text-purple-500" />
          צור וידאו מהסיפור
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            onClick={handleEnqueue}
            disabled={pageCount === 0 || status === VIDEO_STATUS.RENDERING || status === VIDEO_STATUS.QUEUED}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {status === VIDEO_STATUS.RENDERING || status === VIDEO_STATUS.QUEUED ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                מעבד וידאו…
              </>
            ) : (
              <>
                <Film className="ml-2 h-4 w-4" />
                צור וידאו
              </>
            )}
          </Button>

          {status !== VIDEO_STATUS.NONE && (
            <StatusBadge status={status} />
          )}
          {pageCount > 0 && (
            <span className="text-sm text-gray-500">{pageCount} עמודים</span>
          )}
        </div>

        {errorMsg && (
          <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            {errorMsg}
          </p>
        )}

        {/* Live in-browser preview of the composed video (Ken Burns + RTL captions).
            This is exactly what the server-side render produces as an mp4. */}
        {inputProps && durationInFrames > 0 && (
          <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
            <Player
              component={StoryVideo}
              inputProps={inputProps}
              durationInFrames={durationInFrames}
              fps={FPS}
              compositionWidth={VIDEO_WIDTH}
              compositionHeight={VIDEO_HEIGHT}
              style={{ width: '100%' }}
              controls
              loop
            />
            <p className="p-3 text-xs text-gray-500">
              תצוגה מקדימה חיה. הרינדור הסופי ל-mp4 רץ ברקע (תור אסינכרוני) ונשמר ל-stories.video_url.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }) {
  const map = {
    [VIDEO_STATUS.QUEUED]: { label: 'בתור', cls: 'bg-amber-100 text-amber-700' },
    [VIDEO_STATUS.RENDERING]: { label: 'מעבד', cls: 'bg-blue-100 text-blue-700' },
    [VIDEO_STATUS.READY]: { label: 'מוכן', cls: 'bg-green-100 text-green-700', icon: true },
    [VIDEO_STATUS.FAILED]: { label: 'נכשל', cls: 'bg-red-100 text-red-700' },
  };
  const m = map[status];
  if (!m) return null;
  return (
    <Badge variant="outline" className={m.cls}>
      {m.icon && <CheckCircle2 className="ml-1 h-3 w-3" />}
      {m.label}
    </Badge>
  );
}
