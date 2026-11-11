import React from "react";
import { Link, NavLink } from "react-router-dom";
import { CircleHelp, Plus } from "lucide-react";
import { useI18n } from "@/components/i18n/i18nProvider";
import { Wordmark } from "@/components/brand/Wordmark";
import { navItems } from "./navItems";

const focus =
  "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-sp-violet-500";
export default function SideRail() {
  const { t, language } = useI18n();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1.5 border-e border-sp-line px-4 py-6 min-[960px]:flex">
      <Link to="/" className={`mb-4 rounded-xl px-2 py-1 ${focus}`}>
        <Wordmark language={language === "english" ? "en" : "he"} />
      </Link>
      <Link
        to="/new"
        className={`mb-4 flex min-h-12 items-center justify-center gap-2 rounded-full bg-sp-violet-700 px-4 font-semibold text-white hover:bg-sp-night-700 ${focus}`}
      >
        <Plus aria-hidden="true" size={20} />
        {t("shell.newStory")}
      </Link>
      {navItems(t).map(({ href, label, icon: Icon }) => (
        <NavLink
          key={href}
          to={href}
          end
          className={({ isActive }) =>
            `flex min-h-12 items-center gap-3 rounded-[14px] px-3.5 font-medium hover:bg-sp-violet-50 ${focus} ${isActive ? "bg-sp-violet-100 text-sp-violet-700" : "text-sp-ink-600"}`
          }
        >
          <Icon aria-hidden="true" size={22} />
          {label}
        </NavLink>
      ))}
      <div className="mt-auto border-t border-sp-line pt-2.5">
        <Link
          to="/help"
          className={`flex min-h-12 items-center gap-3 rounded-[14px] px-3.5 text-sp-ink-600 hover:bg-sp-violet-50 ${focus}`}
        >
          <CircleHelp aria-hidden="true" size={22} />
          {t("shell.help")}
        </Link>
      </div>
    </aside>
  );
}
