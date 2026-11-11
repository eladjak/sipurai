import React from "react";
import { NavLink } from "react-router-dom";
import { useI18n } from "@/components/i18n/i18nProvider";
import { navItems } from "./navItems";

export default function TabBar() {
  const { t } = useI18n();
  return (
    <nav
      aria-label={t("shell.navigation")}
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-sp-line bg-sp-paper px-2 pt-1 pb-[calc(0.5rem+env(safe-area-inset-bottom))] min-[960px]:hidden"
    >
      {navItems(t).map(({ href, label, icon: Icon }) => (
        <NavLink
          key={href}
          to={href}
          end
          className={({ isActive }) =>
            `flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-[14px] text-xs focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-[-3px] focus-visible:outline-sp-violet-500 ${isActive ? "font-semibold text-sp-violet-700" : "text-sp-ink-600"}`
          }
        >
          <Icon aria-hidden="true" size={24} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
