import * as Dialog from '@radix-ui/react-dialog';

export function Sheet({ trigger, title, description, children, open, onOpenChange }) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="sp-shell fixed inset-0 z-50 bg-sp-night-900 opacity-60" />
      <Dialog.Content className="sp-shell fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-sp-lg bg-sp-paper p-6 text-sp-ink-900 shadow-sp-2 focus:outline-none motion-safe:duration-200 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:slide-in-from-bottom-full sm:inset-y-0 sm:start-auto sm:end-0 sm:h-full sm:max-h-none sm:w-[28rem] sm:rounded-none sm:motion-safe:data-[state=open]:slide-in-from-right-full rtl:sm:motion-safe:data-[state=open]:slide-in-from-left-full">
        <div aria-hidden="true" className="mx-auto mb-4 h-1 w-12 rounded-full bg-sp-line sm:hidden" />
        <Dialog.Title className="font-sp-display text-sp-xl font-semibold">{title}</Dialog.Title>
        {description && <Dialog.Description className="mt-2 text-sp-ink-600">{description}</Dialog.Description>}
        {!description && <Dialog.Description className="sr-only">{title}</Dialog.Description>}
        <div className="mt-4">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
