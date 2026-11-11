import { useI18n } from '@/components/i18n/i18nProvider';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export const CHECKOUT_STEPS = [
  { n: 1, label: 0 },
  { n: 2, label: 1 },
  { n: 3, label: 2 },
];

/** "Where am I and what is left" indicator. */
export function Stepper({ current }) {
  const { t } = useI18n();
  const labels = [t('print.checkoutCopy.stepCopies'), t('print.checkoutCopy.stepAddress'), t('print.checkoutCopy.stepPayment')];
  return (
    <nav aria-label={t('print.checkoutCopy.stepsLabel')}>
      <p className="mb-2 text-sm font-semibold text-purple-700 dark:text-purple-300">
        {t('print.checkoutCopy.stepProgress', { current, total: CHECKOUT_STEPS.length })}
      </p>
      <ol className="flex items-start">
        {CHECKOUT_STEPS.map((s, i) => {
          const done = s.n < current;
          const active = s.n === current;
          return (
            <li key={s.n} className="flex flex-1 items-start" aria-current={active ? 'step' : undefined}>
              <div className="flex w-full flex-col items-center">
                <div className="flex w-full items-center">
                  <span
                    className={cn(
                      'h-1 flex-1 rounded-full transition-colors duration-200',
                      i === 0 ? 'opacity-0' : done || active ? 'bg-purple-500' : 'bg-slate-200 dark:bg-slate-700'
                    )}
                  />
                  <span
                    className={cn(
                      'mx-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ring-4 transition-[background-color,color,box-shadow] duration-200',
                      done && 'bg-purple-600 text-white ring-purple-100',
                      active && 'bg-purple-600 text-white ring-purple-200',
                      !done && !active && 'bg-white text-slate-500 ring-slate-100 dark:bg-slate-800'
                    )}
                  >
                    {done ? <Check className="h-4 w-4" aria-hidden="true" /> : s.n}
                    <span className="sr-only">{done ? ` ${t('print.checkoutCopy.completed')}` : active ? ` ${t('print.checkoutCopy.current')}` : ''}</span>
                  </span>
                  <span
                    className={cn(
                      'h-1 flex-1 rounded-full transition-colors duration-200',
                      i === CHECKOUT_STEPS.length - 1 ? 'opacity-0' : done ? 'bg-purple-500' : 'bg-slate-200 dark:bg-slate-700'
                    )}
                  />
                </div>
                <span className={cn('mt-1.5 text-center text-xs leading-tight', active ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400')}>
                  {labels[s.label]}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
