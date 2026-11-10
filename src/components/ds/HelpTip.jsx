import React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { cn } from '@/lib/utils';
import '@/styles/sp-tokens.css';

export function HelpTip({ label, children, side = 'end', dir, className }) {
  const triggerRef = React.useRef(null);
  const [direction, setDirection] = React.useState(dir || 'ltr');
  const physicalSide = side === 'start' ? (direction === 'rtl' ? 'right' : 'left') : (direction === 'rtl' ? 'left' : 'right');
  return <Popover.Root onOpenChange={open => { if (open && !dir && triggerRef.current) setDirection(getComputedStyle(triggerRef.current).direction || 'ltr'); }}><Popover.Trigger ref={triggerRef} aria-label={label} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--sp-r-pill)] text-sp-violet-700 hover:bg-sp-violet-50 active:bg-sp-violet-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sp-violet-600"><span aria-hidden="true" className="inline-flex size-6 items-center justify-center rounded-full border border-sp-violet-700 font-medium">?</span></Popover.Trigger><Popover.Portal><Popover.Content dir={direction} side={physicalSide} sideOffset={8} collisionPadding={12} style={{ maxWidth: "min(18rem, calc(100vw - 24px), var(--radix-popover-content-available-width))", overflowWrap: "anywhere" }} className={cn('sp-shell z-50 rounded-[var(--sp-r-md)] border border-sp-line bg-sp-card p-4 text-sp-ink-900 shadow-[var(--sp-shadow-2)] outline-none', className)}>{children}</Popover.Content></Popover.Portal></Popover.Root>;
}
