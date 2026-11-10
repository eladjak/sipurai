import React from 'react';
import { cn } from '@/lib/utils';
import '@/styles/sp-tokens.css';

export const Chip = React.forwardRef(function Chip({ children, className, role = 'checkbox', checked = false, cost, type = 'button', ...props }, ref) {
  return <button {...props} ref={ref} type={type} role={role} aria-checked={checked} className={cn('inline-flex min-h-11 items-center gap-2 rounded-[var(--sp-r-pill)] border px-4 text-sp-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sp-violet-600 active:scale-[0.98] motion-safe:transition-transform motion-safe:duration-150 disabled:opacity-50', checked ? 'border-sp-violet-600 bg-sp-violet-100' : 'border-sp-line bg-sp-card hover:bg-sp-violet-50', className)}>{children}{cost != null && <span className="rounded-[var(--sp-r-pill)] bg-sp-cream-100 px-2 text-sp-ink-900">{cost}</span>}</button>;
});
