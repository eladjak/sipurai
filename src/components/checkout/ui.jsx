import React from 'react';
import { useI18n } from '@/components/i18n/i18nProvider';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2, AlertTriangle, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/** Page frame shared by the checkout, my-orders and admin screens (Hebrew, RTL, mobile first). */
export function PageShell({ title, subtitle, backTo, backLabel = 'חזרה', children, wide = false, headingRef }) {
  const { language, direction } = useI18n();
  const lang = { hebrew: 'he', english: 'en', yiddish: 'yi' }[language] || 'he';
  return (
    <div dir={direction} lang={lang} className="min-h-dvh bg-gradient-to-b from-purple-50 via-white to-amber-50/60 pb-48 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className={cn('mx-auto w-full px-4 pt-5 sm:px-6', wide ? 'max-w-5xl' : 'max-w-xl')}>
        {backTo && (
          <Link
            to={backTo}
            className="mb-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl pe-3 text-sm font-medium text-purple-700 hover:text-purple-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:text-purple-300"
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
            {backLabel}
          </Link>
        )}
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-extrabold tracking-tight text-slate-900 focus:outline-none sm:text-3xl dark:text-white">
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 text-base leading-relaxed text-slate-600 dark:text-slate-300">{subtitle}</p>}
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

export function Card({ className, children, ...props }) {
  return (
    <section
      className={cn(
        'rounded-3xl border border-purple-100/80 bg-white p-4 shadow-[0_8px_30px_rgba(124,58,237,0.08)] sm:p-5 dark:border-slate-800 dark:bg-slate-900',
        className
      )}
      {...props}
    >
      {children}
    </section>
  );
}

/** Large, thumb-friendly primary action (48px high). */
export const PrimaryButton = React.forwardRef(function PrimaryButton({ className, loading, children, ...props }, ref) {
  return (
    <Button
      ref={ref}
      className={cn(
        'h-12 min-w-11 rounded-2xl bg-purple-600 px-6 text-base font-bold text-white shadow-[0_6px_18px_rgba(124,58,237,0.35)] transition-[transform,opacity,background-color] duration-150 hover:bg-purple-700 active:scale-[0.98] disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none dark:disabled:bg-slate-700',
        loading && 'disabled:bg-purple-500 disabled:text-white disabled:opacity-90 disabled:shadow-[0_6px_18px_rgba(124,58,237,0.25)]',
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
      {children}
    </Button>
  );
});

export function SecondaryButton({ className, children, ...props }) {
  return (
    <Button
      variant="outline"
      className={cn('h-12 min-w-11 rounded-2xl border-purple-200 px-5 text-base font-semibold text-purple-800 hover:bg-purple-50 dark:text-purple-200', className)}
      {...props}
    >
      {children}
    </Button>
  );
}

/** Error / notice block. Announced to screen readers, always says what to do next. */
export function InlineAlert({ tone = 'error', title, children, onRetry, retryLabel = 'נסו שוב', className }) {
  const palette =
    tone === 'error'
      ? 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
        : 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100';
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-2xl border p-3.5 text-sm leading-relaxed', palette, className)}>
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-bold">{title}</p>}
        <div>{children}</div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-white/70 px-3 font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:bg-white/10"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {retryLabel}
          </button>
        )}
      </div>
    </div>
  );
}

/** Fixed bottom action bar: stays under the thumb on phones. */
export function ActionBar({ reason, children }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-purple-100 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      <div className="mx-auto w-full max-w-xl">
        <p className="min-h-5 pb-2 text-center text-sm text-slate-600 dark:text-slate-300" role="status" aria-live="polite" data-testid="disabled-reason">
          {reason || ''}
        </p>
        <div className="flex items-center gap-3">{children}</div>
      </div>
    </div>
  );
}
