import React from 'react';
import { cn } from '@/lib/utils';
import '@/styles/sp-tokens.css';

export const Card = React.forwardRef(function Card({ children, className, surface = 'paper', interactive = false, href, ...props }, ref) {
  const Component = interactive ? (href ? 'a' : 'button') : 'div';
  return <Component {...props} ref={ref} {...(interactive && href ? { href } : {})} {...(interactive && !href ? { type: props.type || 'button' } : {})} className={cn('rounded-[var(--sp-r-lg)] p-6 text-start shadow-[var(--sp-shadow-1)]', surface === 'night' ? 'bg-sp-night-800 text-sp-on-night' : 'bg-sp-card text-sp-ink-900', interactive && 'block min-h-11 w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sp-violet-600 motion-safe:transition-transform motion-safe:duration-200 motion-safe:hover:-translate-y-[3px] active:translate-y-0', className)}>{children}</Component>;
});
