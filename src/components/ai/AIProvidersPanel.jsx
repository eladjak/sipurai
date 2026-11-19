import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Image as ImageIcon } from "lucide-react";
const IMAGE_PROVIDERS = [
  { value: "gemini", label: "Gemini (מהיר) — איור ברירת מחדל, חינם" },
  { value: "openai", label: "OpenAI (gpt-image-1) — תוצאות נקיות, בתשלום" },
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
  useEffect(() => writeLS("sipurai_image_provider", imageProvider), [imageProvider]);

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
      </CardContent>
    </Card>
  );
}
