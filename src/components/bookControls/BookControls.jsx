import React, { useState } from 'react';
import { Trash2, EyeOff, Loader2, AlertTriangle } from 'lucide-react';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useI18n } from '@/components/i18n/i18nProvider';
import { useToast } from '@/components/ui/use-toast';
import { deleteBook, unshareBook } from '@/lib/ownerApi';

/**
 * Two parent controls for a book they own. Each opens a confirmation that names the book, shows a busy state,
 * and shows an error next to the button with what to do. Success calls onChanged(kind) so the screen can refresh.
 * `onAction` exists so the dialogs can be tested and photographed without a server; the app uses the defaults.
 */
const KINDS = {
  unshare: { Icon: EyeOff, action: unshareBook, tone: 'amber' },
  delete: { Icon: Trash2, action: deleteBook, tone: 'red' },
};

const ERROR_BY_CODE = { open_order: 'bookControls.delOpenOrder', network: 'bookControls.offline' };

function useConfirm({ kind, book, onChanged, onAction, initialOpen = false, initialError = '' }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [open, setOpen] = useState(initialOpen);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const run = onAction || KINDS[kind].action;
  const confirm = async (e) => {
    e?.preventDefault(); // keep the dialog open until the server answers
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await run(book.id);
      setOpen(false);
      setBusy(false);
      // The book is gone, but the server could not remove some drawing files yet: say so plainly.
      const filesLeft = kind === 'delete' && result?.warning === 'files_left';
      toast({ description: t(filesLeft ? 'bookControls.delFilesLeft' : kind === 'delete' ? 'bookControls.delDone' : 'bookControls.stopShareDone') });
      onChanged?.(kind);
    } catch (err) {
      const key = ERROR_BY_CODE[err?.code];
      setError(key ? t(key) : t(kind === 'delete' ? 'bookControls.delFailed' : 'bookControls.stopShareFailed'));
      setBusy(false);
    }
  };
  const onOpenChange = (v) => { if (!busy) { setOpen(v); if (!v) setError(''); } };
  return { open, setOpen, onOpenChange, busy, error, confirm };
}

export function BookControlButton({ kind, book, onChanged, onAction, className = '', initialOpen, initialError, compact = false }) {
  const { t, isRTL } = useI18n();
  const { Icon, tone } = KINDS[kind];
  const s = useConfirm({ kind, book, onChanged, onAction, initialOpen, initialError });
  const title = book?.title || t('bookControls.untitled');
  const isDelete = kind === 'delete';
  const label = t(isDelete ? 'bookControls.del' : 'bookControls.stopShare');
  const palette = tone === 'red'
    ? 'border-red-300 text-red-700 hover:bg-red-50 focus-visible:ring-red-500'
    : 'border-amber-300 text-amber-800 hover:bg-amber-50 focus-visible:ring-amber-500';
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); s.setOpen(true); }}
        className={`inline-flex ${compact ? 'min-h-11 text-sm' : 'min-h-12 text-[15px]'} w-full items-center gap-3 rounded-xl border-2 bg-white px-4 text-start font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98] ${palette} ${className}`}
      >
        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="min-w-0">
          <span className="block">{label}</span>
          {!compact && !isDelete && <span className="block text-sm font-normal text-gray-600">{t('bookControls.stopShareHint')}</span>}
        </span>
      </button>
      <AlertDialog open={s.open} onOpenChange={s.onOpenChange}>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'} className="max-h-[92dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-3xl">
          <AlertDialogHeader className={isRTL ? 'sm:text-right' : ''}>
            <AlertDialogTitle className={`flex items-start gap-2 break-words ${isDelete ? 'text-red-700' : 'text-amber-800'}`}>
              <AlertTriangle className="mt-1 h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="min-w-0">{t(isDelete ? 'bookControls.delTitle' : 'bookControls.stopShareTitle', { title })}</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-start text-[15px] leading-relaxed text-gray-700">
              {t(isDelete ? 'bookControls.delBody' : 'bookControls.stopShareBody')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div role="alert" aria-live="assertive">
            {s.error && (
              <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {s.error}
              </p>
            )}
          </div>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel disabled={s.busy} className="mt-0 h-12 rounded-xl">{t('bookControls.cancel')}</AlertDialogCancel>
            <button
              type="button"
              onClick={s.confirm}
              disabled={s.busy}
              aria-busy={s.busy}
              className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-bold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${isDelete ? 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500' : 'bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500'}`}
            >
              {s.busy
                ? (<><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{t(isDelete ? 'bookControls.delBusy' : 'bookControls.stopShareBusy')}</>)
                : t(isDelete ? 'bookControls.delConfirm' : 'bookControls.stopShareConfirm')}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Both controls for one owned book. "Stop sharing" appears only while the book is shared. */
export default function BookControls({ book, onChanged, className = '', compact = false }) {
  if (!book?.id) return null;
  return (
    <div className={`grid gap-2 ${className}`}>
      {book.is_public && <BookControlButton kind="unshare" book={book} onChanged={onChanged} compact={compact} />}
      <BookControlButton kind="delete" book={book} onChanged={onChanged} compact={compact} />
    </div>
  );
}
