import { LogoMark } from "./LogoMark";
import he from "@/components/i18n/locales/he";
import en from "@/components/i18n/locales/en";
const sizes = { sm: "text-sp-base", md: "text-sp-xl", lg: "text-sp-3xl" };
const marks = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-14 w-14" };
export function Wordmark({ language = "he", size = "md" }) {
  const word = language === "en" ? en.common.brandName : he.common.brandName;
  return (
    <span
      role="img"
      aria-label={word}
      className={`inline-flex items-center gap-2 font-sp-display font-semibold text-sp-ink-900 ${sizes[size] || sizes.md}`}
    >
      <LogoMark className={marks[size] || marks.md} />
      <span aria-hidden="true" dir={language === "en" ? "ltr" : "rtl"}>
        {Array.from(word).map((letter, index) => (
          <span
            key={index}
            className="inline-block motion-safe:animate-[logo-enter_150ms_cubic-bezier(0.22,1,0.36,1)_backwards]"
            style={{ animationDelay: `${index * 7}ms` }}
          >
            {letter}
          </span>
        ))}
      </span>
    </span>
  );
}
