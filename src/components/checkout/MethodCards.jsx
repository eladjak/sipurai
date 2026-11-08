import { Truck, Store, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Ship / pickup choice. Native radios underneath, so keyboard and screen readers just work. */
export function MethodCards({ value, onChange, pickup }) {
  const options = [
    { id: 'ship', title: 'משלוח סיפוראי', text: 'הספר מגיע עד הבית, לכתובת שתמלאו בשלב הבא.', Icon: Truck },
  ];
  if (pickup?.enabled) {
    options.push({ id: 'pickup', title: pickup.label_he || 'איסוף עצמי', text: 'בלי עלות משלוח. תראו כאן כשהספר מוכן לאיסוף.', Icon: Store });
  }
  return (
    <fieldset>
      <legend className="mb-2 text-base font-bold text-slate-900 dark:text-white">איך תרצו לקבל את הספר?</legend>
      <div className="grid gap-3">
        {options.map(({ id, title, text, Icon }) => (
          <label key={id} className="block cursor-pointer">
            <input type="radio" name="delivery-method" value={id} checked={value === id} onChange={() => onChange(id)} className="peer sr-only" />
            <span
              className={cn(
                'flex min-h-20 items-center gap-3 rounded-3xl border-2 bg-white p-4 transition-[border-color,box-shadow,transform] duration-150 dark:bg-slate-900',
                'peer-focus-visible:ring-2 peer-focus-visible:ring-purple-500 peer-focus-visible:ring-offset-2',
                value === id ? 'border-purple-500 shadow-[0_6px_20px_rgba(124,58,237,0.15)]' : 'border-slate-200 hover:border-purple-300 dark:border-slate-700'
              )}
            >
              <span className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-2xl', value === id ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700')}>
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold text-slate-900 dark:text-white">{title}</span>
                <span className="block text-sm leading-snug text-slate-600 dark:text-slate-300">{text}</span>
              </span>
              <span
                className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-colors duration-150', value === id ? 'border-purple-600 bg-purple-600 text-white' : 'border-slate-300')}
                aria-hidden="true"
              >
                {value === id && <Check className="h-4 w-4" />}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
