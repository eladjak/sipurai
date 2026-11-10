import React from 'react';
import { cn } from '@/lib/utils';
import '@/styles/sp-tokens.css';

const metadata = { tel: ['tel', 'tel'], email: ['email', 'email'], number: ['decimal', 'off'], url: ['url', 'url'], date: ['numeric', 'off'] };
export const Field = React.forwardRef(function Field({ id: givenId, label, hint, error, type = 'text', multiline = false, maxLength, value, defaultValue, onChange, className, 'aria-describedby': describedBy, ...props }, ref) {
  const generatedId = React.useId();
  const id = givenId || generatedId;
  const [length, setLength] = React.useState(null);
  const count = value == null ? (length ?? String(defaultValue ?? '').length) : String(value).length;
  const ids = [describedBy, hint && `${id}-hint`, error && `${id}-error`, multiline && maxLength != null && `${id}-count`].filter(Boolean).join(' ') || undefined;
  const inputMeta = metadata[type];
  const Input = multiline ? 'textarea' : 'input';
  return <div className="flex flex-col gap-2"><label htmlFor={id} className="font-medium text-sp-ink-900">{label}</label>{hint && <div id={`${id}-hint`} className="text-sp-ink-600">{hint}</div>}<Input {...props} ref={ref} id={id} {...(!multiline ? { type } : {})} {...(inputMeta ? { dir: 'ltr', inputMode: inputMeta[0], autoComplete: inputMeta[1] } : {})} value={value} defaultValue={defaultValue} maxLength={maxLength} onChange={event => { setLength(event.target.value.length); onChange?.(event); }} aria-invalid={error ? 'true' : undefined} aria-describedby={ids} className={cn('min-h-11 w-full rounded-[var(--sp-r-sm)] border border-sp-line bg-sp-card px-4 py-2 text-sp-ink-900 placeholder:text-sp-ink-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sp-violet-600', error && 'border-sp-danger', className)} />{multiline && maxLength != null && <div id={`${id}-count`} className="text-sp-ink-600"><span dir="ltr" className="inline-block">{count} / {maxLength}</span></div>}<div id={`${id}-error`} role="alert" className="text-sp-danger">{error || null}</div></div>;
});
