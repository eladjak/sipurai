import React, { useEffect, useRef } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useI18n } from "@/components/i18n/i18nProvider";
import "@/styles/sp-tokens.css";
import "@/styles/sp-fonts.css";
import SideRail from "./SideRail";
import TabBar from "./TabBar";
import TopBar from "./TopBar";

export default function AppShell({ children }) {
  const { user } = useCurrentUser();
  const { t, isRTL } = useI18n();
  const mainRef = useRef(null);
  useEffect(() => {
    try {
      const dark =
        user?.dark_mode ?? localStorage.getItem("darkMode") === "true";
      localStorage.setItem("darkMode", String(dark));
      document.documentElement.classList.toggle("dark", dark);
    } catch {
      /* Storage may be unavailable. */
    }
  }, [user]);
  const fontSize =
    { small: "text-sm", medium: "", large: "text-lg", "x-large": "text-xl" }[
      user?.font_size
    ] ?? "";
  const density =
    {
      low: "leading-relaxed space-y-3",
      medium: "",
      high: "leading-tight space-y-1",
    }[user?.text_density] ?? "";
  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className={`sp-shell min-h-dvh min-w-0 bg-sp-paper text-sp-ink-900 ${fontSize} ${density}`}
    >
      <a
        href="#main-content"
        onClick={() => mainRef.current?.focus()}
        className="sr-only rounded-xl bg-sp-violet-700 px-4 py-3 text-white focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:outline focus:outline-[3px] focus:outline-offset-2 focus:outline-sp-violet-500"
      >
        {t("shell.skip")}
      </a>
      <div className="mx-auto flex min-h-dvh max-w-[1180px]">
        <SideRail />
        <div className="min-w-0 flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] min-[960px]:pb-0">
          <TopBar />
          <main
            id="main-content"
            ref={mainRef}
            tabIndex={-1}
            className="min-w-0 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-[-3px] focus-visible:outline-sp-violet-500"
          >
            {children}
          </main>
        </div>
      </div>
      <TabBar />
    </div>
  );
}
