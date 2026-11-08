import { ShieldCheck, Printer } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatIls } from './format';

/** Price lines come ONLY from the server quote. Nothing here is computed on the client. */
export function PriceLines({ quote, loading }) {
  if (!quote && loading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="מחשבים את המחיר">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-8 w-2/3" />
      </div>
    );
  }
  if (!quote) return null;
  return (
    <div>
      <ul className="divide-y divide-purple-100 dark:divide-slate-800" data-testid="price-lines">
        {quote.lines.map((l) => (
          <li key={l.key} className="flex items-center justify-between py-2.5 text-base">
            <span className="text-slate-700 dark:text-slate-200">{l.label_he}</span>
            <span className="font-semibold tabular-nums text-slate-900 dark:text-white" dir="ltr">
              {l.amountAgorot === 0 ? 'ללא עלות' : formatIls(l.amountAgorot)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-1 flex items-baseline justify-between border-t-2 border-purple-200 pt-3">
        <span className="text-lg font-extrabold text-slate-900 dark:text-white">סה״כ לתשלום</span>
        <span className="text-2xl font-extrabold tabular-nums text-purple-700 dark:text-purple-300" dir="ltr" data-testid="price-total">
          {formatIls(quote.totalAgorot)}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">המחיר סופי, ללא תוספות</p>
    </div>
  );
}

export function PaymentNotes() {
  return (
    <ul className="space-y-2.5 text-sm text-slate-700 dark:text-slate-200">
      <li className="flex items-start gap-2.5">
        <Printer className="mt-0.5 h-5 w-5 shrink-0 text-purple-600" aria-hidden="true" />
        <span>ההדפסה מתחילה אחרי אישור התשלום.</span>
      </li>
      <li className="flex items-start gap-2.5">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-purple-600" aria-hidden="true" />
        <span>התשלום מתבצע בעמוד תשלום מאובטח, ואחריו תחזרו לכאן.</span>
      </li>
    </ul>
  );
}
