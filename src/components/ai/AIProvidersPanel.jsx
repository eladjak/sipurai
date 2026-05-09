/**
 * AIProvidersPanel — lets the user pick image/TTS providers from a single tile.
 *
 * Image provider:    localStorage.sipurai_image_provider  (gemini | openai)
 * TTS engine:        localStorage.sipurai_tts_engine      (browser | openai | gemini)
 * TTS voice:         localStorage.sipurai_tts_voice       (provider-specific)
 *
 * Created 2026-05-09 night per Elad — surfaces the cloud TTS + OpenAI image work.
 */

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Image as ImageIcon, Volume2 } from "lucide-react";
import { VOICES } from "@/lib/ttsProvider";

const IMAGE_PROVIDERS = [
  { value: "gemini", label: "Gemini (gemini-3-pro-image-preview) — איכות גבוהה, חינם" },
  { value: "openai", label: "OpenAI (gpt-image-1) — תוצאות נקיות, בתשלום" },
];

const TTS_ENGINES = [
  { value: "browser", label: "דפדפן (חינם, רובוטי)" },
  { value: "openai",  label: "OpenAI (gpt-4o-mini-tts) — קול טבעי" },
  { value: "gemini",  label: "Gemini (gemini-2.5-flash-preview-tts) — קול טבעי" },
];

function readLS(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try { return window.localStorage?.getItem(key) || fallback; } catch { return fallback; }
}
function writeLS(key, value) {
  if (typeof window === "undefined") return;
  try { window.localStorage?.setItem(key, value); } catch {}
}

export default function AIProvidersPanel({ isRTL = true }) {
  const [imageProvider, setImageProvider] = useState(() => readLS("sipurai_image_provider", "gemini"));
  const [ttsEngine, setTtsEngine] = useState(() => readLS("sipurai_tts_engine", "browser"));
  const [ttsVoice, setTtsVoice] = useState(() => readLS("sipurai_tts_voice", ""));

  useEffect(() => writeLS("sipurai_image_provider", imageProvider), [imageProvider]);
  useEffect(() => writeLS("sipurai_tts_engine", ttsEngine), [ttsEngine]);
  useEffect(() => writeLS("sipurai_tts_voice", ttsVoice), [ttsVoice]);

  const voicesForEngine = ttsEngine === "openai" ? VOICES.openai : ttsEngine === "gemini" ? VOICES.gemini : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          {isRTL ? "ספקי AI" : "AI Providers"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Image provider */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <ImageIcon className="h-4 w-4" />
            {isRTL ? "ספק תמונות" : "Image provider"}
          </label>
          <select
            value={imageProvider}
            onChange={(e) => setImageProvider(e.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            aria-label="image provider"
          >
            {IMAGE_PROVIDERS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500">
            {isRTL ? "ההגדרה משפיעה על איורי ספרים ודמויות חדשות." : "Affects new book illustrations and character avatars."}
          </p>
        </div>

        {/* TTS engine */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <Volume2 className="h-4 w-4" />
            {isRTL ? "מנוע קריינות (TTS)" : "Narration engine (TTS)"}
          </label>
          <select
            value={ttsEngine}
            onChange={(e) => { setTtsEngine(e.target.value); setTtsVoice(""); }}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            aria-label="tts engine"
          >
            {TTS_ENGINES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {voicesForEngine.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                {isRTL ? "קול" : "Voice"}
              </label>
              <select
                value={ttsVoice}
                onChange={(e) => setTtsVoice(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                aria-label="tts voice"
              >
                <option value="">{isRTL ? "ברירת מחדל לפי שפה" : "Default per language"}</option>
                {voicesForEngine.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          )}

          <p className="text-xs text-gray-500">
            {isRTL
              ? 'מנוע "דפדפן" עובד לוקלית בחינם אבל לעיתים רובוטי בעברית. מנועי AI דורשים חיבור.'
              : 'Browser engine is free + local but can sound robotic. AI engines require connection.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
