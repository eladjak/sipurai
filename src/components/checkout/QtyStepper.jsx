import { Minus, Plus } from 'lucide-react';
import { useI18n } from '@/components/i18n/i18nProvider';

/** Copies selector: 48px buttons, limits explained in words (not just greyed out). */
export function QtyStepper({ value, onChange, min = 1, max = 20 }) {
  const { t } = useI18n();
  const atMin = value <= min;
  const atMax = value >= max;
  const btn =
    'grid h-12 w-12 place-items-center rounded-2xl border border-purple-200 bg-white text-purple-800 transition-[transform,opacity] duration-150 hover:bg-purple-50 active:scale-95 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:bg-slate-900 dark:text-purple-200';
  return (
    <div>
      <div className="flex items-center justify-center gap-5" role="group" aria-label={t('print.quantity.label')}>
        <button type="button" className={btn} onClick={() => onChange(Math.max(min, value - 1))} disabled={atMin} aria-label={t('print.quantity.remove')}>
          <Minus className="h-5 w-5" aria-hidden="true" />
        </button>
        <output className="min-w-14 text-center text-4xl font-extrabold tabular-nums text-slate-900 dark:text-white" aria-live="polite" data-testid="qty-value">
          {value}
        </output>
        <button type="button" className={btn} onClick={() => onChange(Math.min(max, value + 1))} disabled={atMax} aria-label={t('print.quantity.add')}>
          <Plus className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-300" data-testid="qty-hint">
        {atMax
          ? t('print.quantity.maximum', { max })
          : atMin
            ? t('print.quantity.one')
            : t('print.quantity.many', { value, max })}
      </p>
    </div>
  );
}
