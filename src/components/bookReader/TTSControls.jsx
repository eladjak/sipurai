import React from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Square, Minus, Plus, Sparkles } from "lucide-react";
import { useI18n } from "@/components/i18n/i18nProvider";

const ENGINE_STORAGE_KEY = "sipurai_tts_engine";
const AUTO_STORAGE_KEY = "sipurai_tts_auto";
const ENGINE_OPTIONS = [
  { value: "browser", label: "דפדפן (חינם)" },
  { value: "openai",  label: "OpenAI (טבעי)" },
  { value: "gemini",  label: "Gemini (טבעי)" },
];

/**
 * TTSControls - Text-to-Speech play/pause/stop controls with speed + engine selection.
 *
 * Engine selector persists to localStorage. Reload required for change to take effect
 * (parent reads from storage on mount). Shows a small ✨ "natural voice" indicator when
 * a cloud engine is selected.
 */
export default function TTSControls({
  isSpeaking,
  isPaused,
  rate,
  onPlay,
  onPause,
  onResume,
  onStop,
  onRateChange,
  isRTL,
  showEngineSelector = true,
}) {
  const { t } = useI18n();
  const [engine, setEngine] = React.useState(() => {
    if (typeof window === "undefined") return "browser";
    return window.localStorage?.getItem(ENGINE_STORAGE_KEY) || "browser";
  });
  const [autoNarrate, setAutoNarrate] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage?.getItem(AUTO_STORAGE_KEY) === "1";
  });

  const handleEngineChange = (e) => {
    const next = e.target.value;
    setEngine(next);
    try { window.localStorage?.setItem(ENGINE_STORAGE_KEY, next); } catch {}
  };
  const toggleAuto = () => {
    setAutoNarrate((prev) => {
      const next = !prev;
      try { window.localStorage?.setItem(AUTO_STORAGE_KEY, next ? "1" : "0"); } catch {}
      return next;
    });
  };

  const speedLabel = rate === 0.5
    ? t("bookView.tts.slow")
    : rate === 1
      ? t("bookView.tts.normal")
      : t("bookView.tts.fast");

  return (
    <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
      {/* Play / Pause */}
      {!isSpeaking ? (
        <Button
          variant="outline"
          size="sm"
          onClick={onPlay}
          className="gap-1.5"
          aria-label={t("bookView.tts.readAloud")}
        >
          <Play className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-xs">{t("bookView.tts.read")}</span>
        </Button>
      ) : isPaused ? (
        <Button
          variant="outline"
          size="sm"
          onClick={onResume}
          className="gap-1.5"
          aria-label={t("bookView.tts.resume")}
        >
          <Play className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-xs">{t("bookView.tts.resume")}</span>
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={onPause}
          className="gap-1.5"
          aria-label={t("bookView.tts.pause")}
        >
          <Pause className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-xs">{t("bookView.tts.pause")}</span>
        </Button>
      )}

      {/* Stop */}
      {isSpeaking && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onStop}
          aria-label={t("bookView.tts.stop")}
        >
          <Square className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      )}

      {/* Speed control */}
      <div className={`flex items-center gap-1 ${isRTL ? "flex-row-reverse" : ""}`}>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onRateChange(Math.max(0.5, rate - 0.25))}
          disabled={rate <= 0.5}
          aria-label={t("bookView.tts.slower")}
        >
          <Minus className="h-3 w-3" aria-hidden="true" />
        </Button>
        <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[40px] text-center">
          {speedLabel}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onRateChange(Math.min(2, rate + 0.25))}
          disabled={rate >= 2}
          aria-label={t("bookView.tts.faster")}
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
        </Button>
      </div>

      {/* Auto-narrate toggle — Wave-12: when on, page changes auto-play TTS */}
      <button
        type="button"
        onClick={toggleAuto}
        aria-pressed={autoNarrate}
        aria-label={autoNarrate ? "כבה הקראה אוטומטית" : "הפעל הקראה אוטומטית"}
        className={`h-7 px-2 text-xs rounded-full border transition-colors ${
          autoNarrate
            ? "bg-purple-600 border-purple-600 text-white"
            : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400"
        }`}
      >
        {autoNarrate ? "🔊 אוטו" : "🔇 ידני"}
      </button>

      {/* Engine selector — persists, takes effect on next read */}
      {showEngineSelector && (
        <div className={`flex items-center gap-1 ${isRTL ? "flex-row-reverse" : ""}`}>
          <select
            value={engine}
            onChange={handleEngineChange}
            disabled={isSpeaking}
            aria-label="בחר מנוע קריינות"
            className="h-7 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-1"
          >
            {ENGINE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {engine !== "browser" && (
            <Sparkles className="h-3 w-3 text-purple-500" aria-label="קול טבעי" />
          )}
        </div>
      )}
    </div>
  );
}

/** Helper for parent components: reads the engine pref from storage. */
export function getStoredTTSEngine() {
  if (typeof window === "undefined") return "browser";
  return window.localStorage?.getItem(ENGINE_STORAGE_KEY) || "browser";
}
