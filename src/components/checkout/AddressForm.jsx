import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { IL_CITIES } from './cities';

/** One labelled field: label bound to input, example + error announced next to it. */
function Field({ id, label, optional, hint, error, children }) {
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-sm font-bold text-slate-900 dark:text-white">
        <span>{label}</span>
        {optional && <span className="text-xs font-normal text-slate-500">לא חובה</span>}
      </label>
      {React.cloneElement(children, {
        id,
        'aria-invalid': error ? 'true' : undefined,
        'aria-describedby': [hint ? hintId : null, errId].filter(Boolean).join(' '),
      })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      )}
      <p id={errId} aria-live="polite" className={cn('min-h-0 text-sm font-medium text-rose-700 dark:text-rose-300', error ? 'min-h-5' : '')} data-testid={`${id}-error`}>
        {error || ''}
      </p>
    </div>
  );
}

const inputCls = (error) =>
  cn('h-12 rounded-2xl border-slate-300 bg-white px-4 text-base md:text-base dark:bg-slate-900', error && 'border-rose-400 focus-visible:ring-rose-400');

/**
 * Israeli shipping address form. `errors` come from validateAddress(); they are shown
 * only for fields in `shown` (touched) so an untouched form is not red.
 */
export function AddressForm({ values, onChange, errors, shown, idPrefix = 'addr' }) {
  const err = (k) => (shown[k] ? errors[k] : '');
  const set = (k) => (e) => onChange({ ...values, [k]: e.target.value });
  const digitsOnly = (k) => (e) => onChange({ ...values, [k]: e.target.value.replace(/[^\d]/g, '') });

  return (
    <div className="space-y-3.5">
      <datalist id={`${idPrefix}-cities`}>
        {IL_CITIES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <Field id={`${idPrefix}-fullName`} label="שם מלא של מקבל החבילה" hint="למשל: דנה לוי" error={err('fullName')}>
        <Input value={values.fullName} onChange={set('fullName')} autoComplete="name" placeholder="דנה לוי" className={inputCls(err('fullName'))} />
      </Field>

      <Field id={`${idPrefix}-phone`} label="טלפון נייד" hint="השליח יתקשר לפני שהוא מגיע. למשל: 050-1234567" error={err('phone')}>
        <Input
          value={values.phone}
          onChange={set('phone')}
          type="tel"
          inputMode="tel"
          dir="ltr"
          autoComplete="tel"
          placeholder="050-1234567"
          className={cn(inputCls(err('phone')), 'text-right')}
        />
      </Field>

      <Field id={`${idPrefix}-city`} label="עיר" hint="התחילו להקליד ובחרו מהרשימה. אפשר גם להקליד ישוב שאינו ברשימה." error={err('city')}>
        <Input value={values.city} onChange={set('city')} list={`${idPrefix}-cities`} autoComplete="address-level2" placeholder="חיפה" className={inputCls(err('city'))} />
      </Field>

      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
        <Field id={`${idPrefix}-street`} label="רחוב" hint="למשל: הנרקיסים" error={err('street')}>
          <Input value={values.street} onChange={set('street')} autoComplete="address-line1" placeholder="הנרקיסים" className={inputCls(err('street'))} />
        </Field>
        <Field id={`${idPrefix}-houseNumber`} label="מספר בית" hint="למשל: 12" error={err('houseNumber')}>
          <Input value={values.houseNumber} onChange={set('houseNumber')} inputMode="text" dir="ltr" placeholder="12" className={cn(inputCls(err('houseNumber')), 'text-right')} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field id={`${idPrefix}-apartment`} label="דירה" optional hint="למשל: 4" error={err('apartment')}>
          <Input value={values.apartment} onChange={set('apartment')} dir="ltr" inputMode="text" placeholder="4" className={cn(inputCls(err('apartment')), 'text-right')} />
        </Field>
        <Field id={`${idPrefix}-zip`} label="מיקוד" optional hint="7 ספרות, למשל: 1234567" error={err('zip')}>
          <Input value={values.zip} onChange={digitsOnly('zip')} inputMode="numeric" dir="ltr" maxLength={7} autoComplete="postal-code" placeholder="1234567" className={cn(inputCls(err('zip')), 'text-right')} />
        </Field>
      </div>

      <Field id={`${idPrefix}-notes`} label="הערות לשליח" optional hint="למשל: קומה 2, לצלצל פעמיים" error="">
        <Textarea value={values.notes} onChange={set('notes')} rows={2} maxLength={200} placeholder="קומה 2, לצלצל פעמיים" className="rounded-2xl border-slate-300 bg-white px-4 py-3 text-base dark:bg-slate-900" />
      </Field>
    </div>
  );
}
