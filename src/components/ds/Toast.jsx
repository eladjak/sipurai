import { useToast } from '@/components/ui/toast';
export function useDsToast() {
  const { toast, dismiss, dismissAll } = useToast();
  return { dismiss, dismissAll, toast: ({ undo, description, ...props }) => {
    let id;
    id = toast({ ...props, className: 'sp-shell border-sp-line bg-sp-card text-sp-ink-900 shadow-sp-2 [&>button]:min-h-11 [&>button]:min-w-11 [&>button]:opacity-100', description: <>{description}{undo && <button type="button" className="ms-3 min-h-11 min-w-11 rounded-sp-sm text-sp-violet-700 underline hover:text-sp-violet-600 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sp-violet-600" onClick={() => { dismiss(id); undo.onClick(); }}>{undo.label}</button>}</> });
    return id;
  }};
}
