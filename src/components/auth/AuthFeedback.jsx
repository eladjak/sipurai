import { useEffect, useState } from "react";
import { ClerkFailed, ClerkLoaded, ClerkLoading } from "@clerk/clerk-react";
import { useI18n } from "@/components/i18n/i18nProvider";

function Message({ kind }) {
  const { t } = useI18n();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (kind !== "loading") return undefined;
    const timer = window.setTimeout(() => setSlow(true), 10000);
    return () => window.clearTimeout(timer);
  }, [kind]);
  const retry = kind === "failed" || (kind === "loading" && slow);
  const copy = {
    loading: { title: t("auth.loadingTitle"), message: slow ? t("auth.slowMessage") : t("auth.loadingMessage") },
    failed: { title: t("auth.failedTitle"), message: t("auth.failedMessage") },
    unavailable: { title: t("auth.unavailableTitle"), message: t("auth.unavailableMessage") },
  }[kind];
  return (
    <section className="flex min-h-[320px] w-full max-w-[400px] flex-col items-center justify-center rounded-2xl bg-white/90 px-7 py-10 text-center shadow-xl" aria-labelledby="auth-feedback-title">
      <div aria-hidden="true" className="mb-5 text-4xl">{kind === "loading" ? "✦" : "☁"}</div>
      <div role={kind === "loading" ? "status" : "alert"} aria-atomic="true">
        <h1 id="auth-feedback-title" className="text-xl font-bold">{copy.title}</h1>
        <p className="mt-3 leading-7">{copy.message}</p>
      </div>
      {retry && <button type="button" onClick={() => window.location.reload()} className="mt-6 min-h-11 rounded-xl bg-[#563a91] px-6 font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#563a91]">{t("auth.retry")}</button>}
    </section>
  );
}

export function AuthFeedback({ children }) {
  // The local fallback deliberately has no ClerkProvider; control components require one.
  if (!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY) return <Message kind="unavailable" />;
  return <><ClerkLoading><Message kind="loading" /></ClerkLoading><ClerkFailed><Message kind="failed" /></ClerkFailed><ClerkLoaded>{children}</ClerkLoaded></>;
}
