import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export const CHECKOUT_STEPS = [
  { n: 1, label: 'עותקים ומשלוח' },
  { n: 2, label: 'כתובת' },
  { n: 3, label: 'סיכום ותשלום' },
];

/** "Where am I and what is left" indicator. */
export function Stepper({ current }) {
  return (
    <nav aria-label="שלבי ההזמנה">
      <p className="mb-2 text-sm font-semibold text-purple-700 dark:text-purple-300">
        שלב {current} מתוך {CHECKOUT_STEPS.length}
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
                    <span className="sr-only">{done ? ' הושלם' : active ? ' השלב הנוכחי' : ''}</span>
                  </span>
                  <span
                    className={cn(
                      'h-1 flex-1 rounded-full transition-colors duration-200',
                      i === CHECKOUT_STEPS.length - 1 ? 'opacity-0' : done ? 'bg-purple-500' : 'bg-slate-200 dark:bg-slate-700'
                    )}
                  />
                </div>
                <span className={cn('mt-1.5 text-center text-xs leading-tight', active ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400')}>
                  {s.label}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
