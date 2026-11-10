import { useState } from 'react';
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { deleteMyAccount } from '@/lib/privacyConsent';

const COPY = {
  he: {
    title: 'מחיקת החשבון והנתונים',
    desc: 'מוחק לצמיתות את החשבון שלכם ואת כל מה שבו: הילדים והדמויות, הספרים והאיורים, התמונות שהעליתם וההגדרות. אי אפשר לשחזר.',
    open: 'מחיקת החשבון והנתונים',
    dialogTitle: 'למחוק את החשבון לצמיתות?',
    dialogLead: 'זה לא ניתן לביטול. הנה מה שיימחק:',
    items: ['החשבון שלכם והתחברות', 'הילדים, הדמויות והרעיונות לסיפורים', 'כל הספרים, הדפים והאיורים', 'התמונות והקבצים שהעליתם', 'ההגדרות וההישגים'],
    keep: 'הזמנת ספר מודפס שכבר נשלח: הרשומה הכספית נשמרת לפי החוק, וכתובת המשלוח נמחקת.',
    word: 'מחק',
    typeLabel: 'כדי לאשר, כתבו את המילה "מחק"',
    typeExample: 'מחק',
    cancel: 'ביטול',
    confirm: 'מחיקה לצמיתות',
    deleting: 'מוחקים…',
    failed: 'המחיקה לא הושלמה. לא קרה שום נזק, אפשר ללחוץ שוב.',
    byCode: {
      paid_subscription: 'יש לכם מנוי בתשלום פעיל. מחיקת החשבון לא מבטלת חיוב, ולכן צריך קודם לבטל את המנוי. אחרי הביטול אפשר למחוק.',
      open_order: 'יש הזמנת ספר מודפס שעדיין בדרך. אפשר למחוק את החשבון אחרי שההזמנה תגיע, או בפנייה אלינו ב-support@sipurai.ai.',
      not_configured: 'מחיקת חשבון עדיין לא הופעלה בשרת. פנו אלינו ב-support@sipurai.ai ונמחק בשבילכם. לא נמחק כלום.',
    },
  },
  en: {
    title: 'Delete account and data',
    desc: 'Permanently deletes your account and everything in it: children and characters, books and illustrations, uploaded photos and settings. This cannot be undone.',
    open: 'Delete account and data',
    dialogTitle: 'Delete your account for good?',
    dialogLead: 'This cannot be undone. Here is what will be deleted:',
    items: ['Your account and sign-in', 'Children, characters and story ideas', 'All books, pages and illustrations', 'Photos and files you uploaded', 'Settings and achievements'],
    keep: 'A printed-book order that already shipped: the financial record is kept as the law requires, and the delivery address is removed.',
    word: 'delete',
    typeLabel: 'To confirm, type the word "delete"',
    typeExample: 'delete',
    cancel: 'Cancel',
    confirm: 'Delete forever',
    deleting: 'Deleting…',
    failed: 'Deletion did not finish. Nothing is broken, you can press it again.',
    byCode: {
      paid_subscription: 'You have an active paid subscription. Deleting the account does not stop billing, so please cancel the subscription first. Then you can delete.',
      open_order: 'A printed-book order is still on its way. You can delete the account after it arrives, or by writing to support@sipurai.ai.',
      not_configured: 'Account deletion is not switched on yet. Write to support@sipurai.ai and we will delete it for you. Nothing was deleted.',
    },
  },
};

/**
 * Danger zone in Settings > Account. `onDelete` and `initialOpen` exist so the screen can be tested
 * and photographed without a real account; the app uses the defaults.
 */
export default function DeleteAccountCard({ language = 'hebrew', isRTL = true, onDeleted, onDelete = deleteMyAccount, initialOpen = false, initialError = '' }) {
  const c = COPY[language === 'english' ? 'en' : 'he'];
  const [open, setOpen] = useState(initialOpen);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const matches = typed.trim().toLowerCase() === c.word;

  const run = async (e) => {
    e.preventDefault(); // keep the dialog open until the server answers
    if (!matches || busy) return;
    setBusy(true);
    setError('');
    try {
      await onDelete();
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch { /* storage blocked: nothing to clear */ }
      setOpen(false);
      onDeleted?.();
    } catch (err) {
      setError(c.byCode[err?.code] || c.failed);
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby="delete-account-title"
      className="mt-4 overflow-hidden rounded-2xl border border-red-100 bg-red-50/40 p-5 dark:border-red-900/40 dark:bg-red-900/10"
    >
      <h3 id="delete-account-title" className="flex items-center gap-2 text-base font-bold text-red-700 dark:text-red-300">
        <Trash2 className="h-5 w-5" aria-hidden="true" />
        {c.title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">{c.desc}</p>

      <AlertDialog open={open} onOpenChange={(v) => { if (!busy) { setOpen(v); if (!v) { setTyped(''); setError(''); } } }}>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            className="mt-4 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-red-300 bg-white px-5 text-[15px] font-bold text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 active:scale-[0.98] dark:bg-transparent dark:text-red-300"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {c.open}
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'} className="max-h-[92dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-3xl">
          <AlertDialogHeader className={isRTL ? 'sm:text-right' : ''}>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
              {c.dialogTitle}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-start text-[15px] text-gray-700 dark:text-gray-300">
                <p>{c.dialogLead}</p>
                <ul className="list-disc space-y-1 ps-5">
                  {c.items.map((i) => <li key={i}>{i}</li>)}
                </ul>
                <p className="rounded-xl bg-gray-50 p-3 text-sm dark:bg-gray-800">{c.keep}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div>
            <Label htmlFor="delete-confirm-word" className="text-sm font-semibold">{c.typeLabel}</Label>
            <Input
              id="delete-confirm-word"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={c.typeExample}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              disabled={busy}
              aria-invalid={!!error || undefined}
              aria-describedby={error ? 'delete-error' : undefined}
              className="mt-1.5 h-12 rounded-xl text-base"
            />
            <div id="delete-error" role="alert" aria-live="assertive">
              {error && (
                <p className="mt-2 flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 dark:bg-red-900/20 dark:text-red-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {error}
                </p>
              )}
            </div>
          </div>

          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel disabled={busy} className="mt-0 h-12 rounded-xl">{c.cancel}</AlertDialogCancel>
            <button
              type="button"
              onClick={run}
              disabled={!matches || busy}
              aria-busy={busy}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-[15px] font-bold text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? (<><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{c.deleting}</>) : c.confirm}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
