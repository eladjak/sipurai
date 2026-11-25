import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Book } from '@/entities/Book';
import { Page } from '@/entities/Page';
import { summarizeBook } from '@/lib/bookProgress';
import { createPageUrl } from '@/utils';
import GenerationWaiting from '@/components/bookReader/GenerationWaiting';
import { Button } from '@/components/ui/button';

// This screen only reads. A missing book is not evidence that creation is safe.
export default function DraftRecovery({ ownerId, attemptId, t, isRTL, onReturnToDraft = undefined }) {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  const section = useRef(null);
  useEffect(() => { section.current?.focus(); }, []);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  useEffect(() => {
    let current = true;
    setResult(null);
    if (!ownerId || !attemptId || !online) return () => { current = false; };
    (async () => {
      try {
        const matches = await Book.filter({ id: attemptId, created_by: ownerId });
        if (!current) return;
        const book = matches.find(item => item.id === attemptId && item.created_by === ownerId);
        if (!book) { setResult({ kind: 'unavailable' }); return; }
        const pages = await Page.filter({ book_id: attemptId }, 'page_number');
        if (current) setResult({ kind: 'checked', counts: summarizeBook(book, pages.filter(page => page.book_id === attemptId)) });
      } catch {
        if (current) setResult({ kind: 'unavailable' });
      }
    })();
    return () => { current = false; };
  }, [ownerId, attemptId, online, revision]);
  const checked = online && result?.kind === 'checked';
  const readable = checked && result.counts.isReadable;
  const message = !online ? t('spxWizard.recovery.offline') : !ownerId ? t('spxWizard.recovery.unavailable') : !result ? t('spxWizard.recovery.checking') :
    readable ? t('spxWizard.firstPages') : checked ? t('spxWizard.recovery.noPages') : t('spxWizard.recovery.unavailable');
  return <section ref={section} tabIndex={-1} aria-label={t('spxWizard.recovery.title')} dir={isRTL ? 'rtl' : 'ltr'} className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-4 py-8">
    <GenerationWaiting t={t} title={t('spxWizard.recovery.title')} message={message} counts={checked ? result.counts : null} active={online && Boolean(ownerId) && !result} />
    {readable && <Button asChild className="min-h-11"><Link to={`${createPageUrl('BookView')}?id=${encodeURIComponent(attemptId)}`}>{t('spxWizard.recovery.open')}</Link></Button>}
    {online && result && <Button className="min-h-11" onClick={() => {
      section.current?.focus();
      setResult(null);
      setRevision(value => value + 1);
    }}>{t('spxWizard.recovery.retry')}</Button>}
    {onReturnToDraft && <Button variant="outline" className="min-h-11" onClick={onReturnToDraft}>{t('spxWizard.recovery.returnToDraft')}</Button>}
    <Button asChild variant="outline" className="min-h-11"><Link to={createPageUrl('Library')}>{t('book.backToLibrary')}</Link></Button>
  </section>;
}
