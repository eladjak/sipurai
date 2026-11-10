import React from 'react';
import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import '@/styles/sp-tokens.css';

const variants = {
  primary: 'bg-sp-violet-600 text-sp-card hover:bg-sp-violet-700',
  magic: 'bg-sp-gold-400 text-sp-night-900 hover:bg-sp-gold-300',
  quiet: 'bg-transparent text-sp-violet-700 hover:bg-sp-violet-50',
  danger: 'bg-sp-danger text-sp-card hover:opacity-90',
  onNight: 'bg-sp-night-700 text-sp-on-night hover:bg-sp-night-800',
};
export const Button = React.forwardRef(function Button({ children, className, variant = 'primary', size = 'md', loading = false, disabled = false, href, icon, iconPosition = 'start', onClick, ...props }, ref) {
  const unavailable = disabled || loading;
  const content = <><span aria-hidden="true" className="inline-flex w-5 shrink-0 items-center justify-center">{loading && <LoaderCircle className="size-5 motion-safe:animate-spin" />}</span><span className="inline-flex items-center gap-2">{icon && iconPosition === 'start' && <span aria-hidden="true">{icon}</span>}{children}{icon && iconPosition === 'end' && <span aria-hidden="true">{icon}</span>}</span><span aria-hidden="true" className="w-5 shrink-0" /></>;
  const common = { ...props, ref, 'aria-busy': loading || undefined, className: cn('relative inline-flex items-center justify-center gap-2 rounded-[var(--sp-r-sm)] px-6 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sp-violet-600 motion-safe:transition-transform motion-safe:duration-150 active:scale-[0.98] disabled:cursor-not-allowed', size === 'lg' ? 'min-h-14' : 'min-h-12', variants[variant], unavailable && 'cursor-not-allowed', disabled && 'opacity-50', className) };
  if (href && !unavailable) return <a {...common} href={href} onClick={onClick}>{content}</a>;
  if (href) return <a {...common} role="link" aria-disabled="true" tabIndex={-1} onClick={e => e.preventDefault()}>{content}</a>;
  return <button {...common} type={props.type || 'button'} disabled={unavailable} onClick={onClick}>{content}</button>;
});
