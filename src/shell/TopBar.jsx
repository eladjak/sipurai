import React from "react";
import { Link } from "react-router-dom";
import { UserRound } from "lucide-react";
import { Wordmark } from "@/components/brand/Wordmark";
import { useI18n } from "@/components/i18n/i18nProvider";

export default function TopBar() {
  const { t, language } = useI18n();
  return (
    <header className="flex items-center justify-between px-5 pb-2 pt-3.5 min-[960px]:hidden">
      <Link
        to="/"
        className="inline-flex min-h-11 items-center rounded-xl focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-sp-violet-500"
      >
        <Wordmark language={language === "english" ? "en" : "he"} size="sm" />
      </Link>
      <Link
        to="/parents"
        aria-label={t("shell.account")}
        className="grid size-11 place-items-center rounded-full text-sp-night-700 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-sp-violet-500"
      >
        <span className="grid size-10 place-items-center rounded-full bg-sp-gold-300">
          <UserRound aria-hidden="true" size={22} />
        </span>
      </Link>
    </header>
  );
}
