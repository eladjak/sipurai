import { Link } from "react-router-dom";
import { Wordmark } from "@/components/brand/Wordmark";
import { useI18n } from "@/components/i18n/i18nProvider";
import "@/styles/sp-tokens.css";
import "@/styles/sp-fonts.css";

export function AuthFrame({ children }) {
  const { isRTL, language, t } = useI18n();
  return (
    <main className="sp-shell flex min-h-screen flex-col items-center justify-center bg-[#f8f1e3] px-4 py-5 text-[#202b3c] sm:py-10" dir={isRTL ? "rtl" : "ltr"}>
      <Link to="/" className="inline-flex min-h-12 items-center rounded-[var(--sp-r-sm)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sp-violet-600">
        <Wordmark language={(language === "english" || language === "en") ? "en" : "he"} />
      </Link>
      <img src="/images/spx/hearth.webp" alt="" aria-hidden="true" className="mt-1 h-16 w-48 rounded-xl object-cover object-left sm:mt-3 sm:h-32 sm:w-64" />
      <p className="mb-3 mt-1 text-center sm:mb-7 sm:mt-3">{t("auth.reassurance")}</p>
      {children}
    </main>
  );
}
