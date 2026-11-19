import { Sparkles } from "lucide-react";
import GenerationProgressCounts from "./GenerationProgressCounts";

export default function GenerationWaiting({ t, message, title = "", counts = null, compact = false, active = true }) {
  return (
    <div
      role="status"
      className={compact
        ? "flex min-w-0 items-center gap-3"
        : "w-full max-w-md rounded-3xl border border-purple-100 bg-white px-5 py-7 text-center text-purple-950 shadow-xl dark:border-purple-800 dark:bg-gray-800 dark:text-purple-100"}
    >
      <div className={compact ? "relative shrink-0" : "relative mx-auto mb-4 w-fit"} aria-hidden="true">
        <img
          src="/images/spx/characters/dragon.webp"
          alt=""
          className={compact ? "h-11 w-11 rounded-full object-cover" : "h-28 w-28 rounded-[2rem] object-cover shadow-md"}
        />
        {active && (
          <Sparkles className={`absolute -end-1 -top-1 rounded-full bg-amber-100 p-1 text-amber-900 motion-safe:animate-pulse ${compact ? "h-5 w-5" : "h-7 w-7"}`} />
        )}
      </div>
      <div className="min-w-0">
        {title && <p className="mb-2 text-xl font-bold">{title}</p>}
        <p className={compact ? "text-sm font-semibold" : "text-base font-medium"}>{message}</p>
        {counts && (
          <div className={compact ? "" : "mt-3 flex justify-center"}>
            <GenerationProgressCounts t={t} {...counts} />
          </div>
        )}
      </div>
    </div>
  );
}
