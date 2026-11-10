import React from 'react';
import { cn } from '@/lib/utils';
import '@/styles/sp-tokens.css';

export const IconButton = React.forwardRef(function IconButton({ label, children, className, type = 'button', ...props }, ref) {
  return <span className="group relative inline-flex"><button {...props} ref={ref} type={type} aria-label={label} className={cn('inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--sp-r-sm)] text-sp-ink-900 hover:bg-sp-violet-50 active:bg-sp-violet-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sp-violet-600 disabled:opacity-50', className)}>{children}</button><span aria-hidden="true" className="pointer-events-none absolute bottom-full start-1/2 z-50 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-[var(--sp-r-sm)] bg-sp-night-900 px-3 py-1 text-sp-cream-100 shadow-[var(--sp-shadow-1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:block">{label}</span></span>;
});
