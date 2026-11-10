import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Database, Sparkles, Users, Trash2, Heart, Camera, HelpCircle, Loader2, Check, ExternalLink, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { gateCopy, POLICY_VERSION } from '@/data/privacyPolicyContent';

const ICONS = { camera: Camera, database: Database, sparkles: Sparkles, users: Users, trash: Trash2, heart: Heart };

/** Small friendly picture: a shield holding an open book. No text inside the image. */
export function ShieldBookArt({ label, className = '' }) {
  return (
    <svg viewBox="0 0 120 120" role="img" aria-label={label} className={className}>
      <defs>
        <linearGradient id="pg-shield" x1="24" y1="14" x2="96" y2="106" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#a855f7" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="56" fill="#f3e8ff" />
      <path d="M60 14 96 28v30c0 24-16 40-36 48C40 98 24 82 24 58V28z" fill="url(#pg-shield)" />
      <path d="M60 51c-7-4-15-5-24-3v28c9-2 17-1 24 3z" fill="#fff" />
      <path d="M60 51c7-4 15-5 24-3v28c-9-2-17-1-24 3z" fill="#ede9fe" />
      <path d="M60 51v28" stroke="#c4b5fd" strokeWidth="2" strokeLinecap="round" />
      <path d="M92 18l2.6 6.4L101 27l-6.4 2.6L92 36l-2.6-6.4L83 27l6.4-2.6z" fill="#fbbf24" />
      <circle cx="26" cy="92" r="3" fill="#c4b5fd" />
    </svg>
  );
}

/** One row of the plain summary. The optional "?" opens on tap (phones have no hover). */
function SummaryRow({ row, helpLabel, isRTL }) {
  const Icon = ICONS[row.icon] || Database;
  return (
    <li className="flex gap-3 sm:gap-4">
      <span aria-hidden="true" className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <h3 className="font-heading text-base font-semibold text-gray-900 dark:text-white">{row.title}</h3>
          {row.help && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={`${helpLabel}: ${row.title}`}
                  className="-my-2 flex h-11 w-11 items-center justify-center rounded-full text-purple-600 transition-colors hover:bg-purple-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:text-purple-300 dark:hover:bg-purple-900/30"
                >
                  <HelpCircle className="h-5 w-5" aria-hidden="true" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="center" collisionPadding={16} dir={isRTL ? 'rtl' : 'ltr'} className="w-72 text-sm leading-relaxed">
                {row.help}
              </PopoverContent>
            </Popover>
          )}
        </div>
        <p className="mt-0.5 text-[15px] leading-relaxed text-gray-600 dark:text-gray-300">{row.text}</p>
      </div>
    </li>
  );
}

function ConsentCheck({ id, checked, onChange, invalid, describedBy, children }) {
  return (
    <label
      htmlFor={id}
      className={`flex min-h-[56px] cursor-pointer items-start gap-3 rounded-2xl border-2 p-3.5 transition-colors duration-150 hover:bg-purple-50/60 dark:hover:bg-purple-900/20 ${
        invalid ? 'border-red-300 bg-red-50/60 dark:border-red-500/60 dark:bg-red-900/10' : checked ? 'border-purple-300 bg-purple-50/50 dark:border-purple-500/60 dark:bg-purple-900/10' : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? describedBy : undefined}
        className="mt-0.5 h-6 w-6 shrink-0 rounded-md border-2 border-purple-300 data-[state=checked]:border-purple-600 data-[state=checked]:bg-purple-600"
      />
      <span className="text-[15px] leading-relaxed text-gray-800 dark:text-gray-100">{children}</span>
    </label>
  );
}

/**
 * The privacy gate screen. Presentational: the parent component owns saving and sign-out.
 * status: 'idle' | 'saving' | 'error'. Harness props (initialChecks, initialShowMissing) exist only
 * so every state can be photographed without clicking.
 */
export default function ConsentScreen({
  lang = 'he', isRTL = true, status = 'idle', errorText = '', onAccept, onDecline,
  initialChecks = { guardian: false, agree: false }, initialShowMissing = false,
}) {
  const c = gateCopy[lang] || gateCopy.he;
  const [guardian, setGuardian] = useState(initialChecks.guardian);
  const [agree, setAgree] = useState(initialChecks.agree);
  const [showMissing, setShowMissing] = useState(initialShowMissing);
  const headingRef = useRef(null);
  const saving = status === 'saving';

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  const submit = () => {
    if (saving) return;
    if (!guardian || !agree) {
      setShowMissing(true);
      requestAnimationFrame(() => document.getElementById(!guardian ? 'gate-guardian' : 'gate-agree')?.focus());
      return;
    }
    onAccept?.();
  };

  const missingGuardian = showMissing && !guardian;
  const missingAgree = showMissing && !agree;

  return (
    <main
      dir={isRTL ? 'rtl' : 'ltr'}
      lang={lang}
      className="flex min-h-dvh items-start justify-center bg-gradient-to-b from-purple-50 via-white to-indigo-50 px-4 py-6 sm:items-center sm:py-12 dark:from-gray-950 dark:via-gray-950 dark:to-purple-950/40"
    >
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        aria-labelledby="gate-title"
        className="w-full max-w-xl overflow-hidden rounded-3xl border border-purple-100 bg-white shadow-xl shadow-purple-200/40 dark:border-purple-900/50 dark:bg-gray-900 dark:shadow-none"
      >
        <header className="px-5 pb-2 pt-7 text-center sm:px-8 sm:pt-9">
          <ShieldBookArt label={c.illustration} className="mx-auto h-24 w-24 sm:h-28 sm:w-28" />
          <h1
            id="gate-title"
            ref={headingRef}
            tabIndex={-1}
            className="mt-4 font-heading text-2xl font-bold leading-snug text-gray-900 outline-none sm:text-3xl dark:text-white"
          >
            {c.title}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-gray-600 dark:text-gray-300">{c.lead}</p>
        </header>

        <ul className="space-y-5 px-5 py-6 sm:px-8">
          {c.rows.map((row) => (
            <SummaryRow key={row.icon} row={row} helpLabel={lang === 'he' ? 'הסבר' : 'Explanation'} isRTL={isRTL} />
          ))}
        </ul>

        <div className="space-y-3 border-t border-purple-50 px-5 pb-2 pt-5 sm:px-8 dark:border-purple-900/30">
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-1.5 font-semibold text-purple-700 underline underline-offset-4 hover:text-purple-900 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:text-purple-300">
              {c.fullPolicy}
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-1.5 font-semibold text-purple-700 underline underline-offset-4 hover:text-purple-900 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:text-purple-300">
              {c.terms}
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          </p>

          <ConsentCheck id="gate-guardian" checked={guardian} onChange={setGuardian} invalid={missingGuardian} describedBy="gate-missing">
            {c.guardian}
          </ConsentCheck>
          <ConsentCheck id="gate-agree" checked={agree} onChange={setAgree} invalid={missingAgree} describedBy="gate-missing">
            {c.agree}
          </ConsentCheck>

          <div id="gate-missing" role="alert" aria-live="assertive" className="min-h-0">
            {(missingGuardian || missingAgree) && (
              <p className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 dark:bg-red-900/20 dark:text-red-300">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                {c.missing}
              </p>
            )}
            {status === 'error' && (
              <p className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 dark:bg-red-900/20 dark:text-red-300">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                {errorText || c.saveError}
              </p>
            )}
          </div>
        </div>

        <footer className="px-5 pb-7 pt-3 sm:px-8">
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            aria-busy={saving}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 text-base font-bold text-white shadow-lg shadow-purple-300/50 transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-wait disabled:opacity-80 disabled:hover:translate-y-0 dark:shadow-none"
          >
            {saving ? (<><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />{c.saving}</>) : status === 'error' ? (<><RefreshCw className="h-5 w-5" aria-hidden="true" />{c.retry}</>) : c.accept}
          </button>
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={onDecline}
              disabled={saving}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 text-[15px] font-semibold text-gray-600 underline underline-offset-4 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:opacity-50 dark:text-gray-300 dark:hover:text-white"
            >
              {c.notNow}
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400">{c.notNowHint}</p>
          </div>
          <p className="mt-4 text-center text-xs text-gray-400">
            {c.version} <span dir="ltr">{POLICY_VERSION}</span>
          </p>
        </footer>
      </motion.section>
    </main>
  );
}

/** Same page shell for the quiet states: checking, could not check, success. */
export function GateShell({ lang = 'he', isRTL = true, children }) {
  return (
    <main
      dir={isRTL ? 'rtl' : 'ltr'}
      lang={lang}
      className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-purple-50 via-white to-indigo-50 px-4 py-8 dark:from-gray-950 dark:via-gray-950 dark:to-purple-950/40"
    >
      <div className="w-full max-w-sm rounded-3xl border border-purple-100 bg-white p-7 text-center shadow-xl shadow-purple-200/40 dark:border-purple-900/50 dark:bg-gray-900 dark:shadow-none">
        {children}
      </div>
    </main>
  );
}

export function GateLoading({ lang = 'he', isRTL = true }) {
  const c = gateCopy[lang] || gateCopy.he;
  return (
    <GateShell lang={lang} isRTL={isRTL}>
      <div role="status" aria-live="polite">
        <ShieldBookArt label={c.illustration} className="mx-auto h-20 w-20" />
        <Loader2 className="mx-auto mt-4 h-6 w-6 animate-spin text-purple-600" aria-hidden="true" />
        <p className="mt-3 text-[15px] text-gray-600 dark:text-gray-300">{c.loading}</p>
      </div>
    </GateShell>
  );
}

export function GateLoadError({ lang = 'he', isRTL = true, onRetry, onSignOut }) {
  const c = gateCopy[lang] || gateCopy.he;
  return (
    <GateShell lang={lang} isRTL={isRTL}>
      <div role="alert">
        <span aria-hidden="true" className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-900/20">
          <AlertTriangle className="h-7 w-7" />
        </span>
        <h1 className="mt-4 font-heading text-xl font-bold text-gray-900 dark:text-white">{c.loadError}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-gray-600 dark:text-gray-300">{c.loadErrorHelp}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 active:scale-[0.98]"
      >
        <RefreshCw className="h-5 w-5" aria-hidden="true" />
        {c.retry}
      </button>
      <button
        type="button"
        onClick={onSignOut}
        className="mt-2 inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 text-[15px] font-semibold text-gray-600 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:text-gray-300"
      >
        {c.signOut}
      </button>
    </GateShell>
  );
}

export function GateSuccess({ lang = 'he', isRTL = true }) {
  const c = gateCopy[lang] || gateCopy.he;
  return (
    <GateShell lang={lang} isRTL={isRTL}>
      <div role="status" aria-live="polite">
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          aria-hidden="true"
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-200"
        >
          <Check className="h-8 w-8" strokeWidth={3} />
        </motion.span>
        <p className="mt-4 font-heading text-xl font-bold text-gray-900 dark:text-white">{c.success}</p>
      </div>
    </GateShell>
  );
}
