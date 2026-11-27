import { Sparkles } from "lucide-react";
import GenerationProgressCounts from "./GenerationProgressCounts";

export default function GenerationWaiting({ t, message, title = "", counts = null, compact = false, active = true }) {
  return (
    <div
      role="status"
      className={compact
        ? "flex min-w-0 items-center gap-3"
        : "w-full max-w-md overflow-hidden rounded-[2rem] border border-[#dac29f] bg-[#fff7e9] p-2.5 text-center text-[#26394b] shadow-xl shadow-[#25384a]/10 dark:border-[#665847] dark:bg-[#242d3c] dark:text-[#fff1d8]"}
    >
      <div
        aria-hidden="true"
        className={compact
          ? "relative shrink-0"
          : "relative isolate grid aspect-[2/1] min-h-36 place-items-center overflow-hidden rounded-[1.5rem] bg-[#242f47] bg-[radial-gradient(ellipse_at_50%_32%,#576a84,transparent_65%)]"}
      >
        <img
          src="/images/spx/characters/dragon.webp"
          alt=""
          className={compact
            ? "size-11 rounded-full object-cover ring-1 ring-[#a77d4b]/40"
            : "size-[min(43vw,9rem)] rounded-[46%] object-cover shadow-lg ring-[5px] ring-[#e8c38b]/30"}
        />
        {active && (
          <Sparkles className={compact
            ? "absolute -end-1 -top-1 size-5 rounded-full bg-[#f8dda8] p-1 text-[#593c28]"
            : "absolute end-[13%] top-[18%] size-7 text-[#ffdb99] motion-safe:animate-[pulse_1.6s_ease-in-out_2]"} />
        )}
      </div>
      <div className={compact ? "min-w-0" : "min-w-0 px-3 py-5 sm:px-5"}>
        {title && <p className="mb-2 font-heading text-xl font-bold">{title}</p>}
        {active && <p className="mb-1 text-xs font-bold text-[#805326] dark:text-[#edc38d]">{t("spxWizard.waiting.narrator")}</p>}
        <p className={compact ? "text-sm font-semibold" : "font-heading text-lg font-semibold leading-snug"}>{message}</p>
        {counts && (
          <div className={compact ? "" : "mt-3 flex justify-center"}>
            <GenerationProgressCounts t={t} {...counts} />
          </div>
        )}
      </div>
    </div>
  );
}
