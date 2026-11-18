import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, Download, ImagePlus, Save, Sparkles } from 'lucide-react';
import { Book, savePrintEdition } from '@/entities/Book';
import { Page } from '@/entities/Page';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useI18n } from '@/components/i18n/i18nProvider';
import { isPrintBookId } from '@/lib/printedBookLink';
import { readablePages, summarizeBook } from '@/lib/bookProgress';
import { createEditionManifest, editionDraft, editionHasUnsafeText, matterReview, pageDraft, printReviewComplete, TEXT_LIMITS } from '@/lib/printEdition/model';
import PrintPreferences from '@/screens/print-edition/PrintPreferences';
import { EditionDetails } from '@/screens/print-edition/EditionDetails';
import { EditionArtField } from '@/screens/print-edition/EditionArtField';
import { EditionPageReview } from '@/screens/print-edition/EditionPageReview';
import { actionClass, editionLabels } from '@/screens/print-edition/labels';
import '@/styles/sp-tokens.css';
import '@/styles/sp-fonts.css';
import '@/screens/print-edition/edition.css';

export default function PrintEdition() {
  const [params] = useSearchParams();
  const id = params.get('id');
  const { user, isLoading } = useCurrentUser();
  const { isRTL } = useI18n();
  const labels = editionLabels(isRTL);
  return (
    <main className="sp-shell mx-auto max-w-4xl px-4 py-6 text-sp-ink-900 sm:px-8 sm:py-10" dir={isRTL ? 'rtl' : 'ltr'}>
      {isLoading ? <p role="status">{labels.loading}</p> : !user?.id || !isPrintBookId(id) ? <p role="status">{labels.unavailable}</p> :
        <OwnerEdition key={`${user.id}:${id}`} id={id} ownerId={user.id} labels={labels} isRTL={isRTL} />}
    </main>
  );
}

function OwnerEdition({ id, ownerId, labels, isRTL }) {
  const [loaded, setLoaded] = useState(null);
  const [edition, setEdition] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busyCount, setBusyCount] = useState(0);
  const [closingStatus, setClosingStatus] = useState('');
  const [pattern, setPattern] = useState(null);
  const lock = useRef(false);

  useEffect(() => {
    let current = true;
    const read = async () => {
      let book;
      try {
        book = await Book.get(id);
        if (!current) return;
        if (book?.created_by !== ownerId) throw new Error('owner');
        const rows = await Page.filter({ book_id: id }, 'page_number');
        if (!current) return;
        setLoaded({ book, pages: readablePages(rows), complete: summarizeBook(book, rows).isComplete });
        setEdition(editionDraft(book.printEdition));
      } catch {
        if (current) setError(book?.created_by === ownerId ? 'loadError' : 'unavailable');
      }
    };
    read();
    return () => { current = false; };
  }, [id, ownerId]);

  const endpaperSource = !edition?.artwork.endpaperArt && (edition?.artwork.closingArt || loaded?.book.cover_image);
  useEffect(() => {
    if (!endpaperSource) return;
    let current = true;
    import('@/lib/printEdition/assets').then(({ makeEndpaper }) => makeEndpaper(endpaperSource))
      .then(url => { if (current) setPattern({ source: endpaperSource, url }); })
      .catch(() => { if (current) setPattern(null); });
    return () => { current = false; };
  }, [endpaperSource]);

  if (!loaded || !edition) return error ? <p role="alert">{labels[error]}</p> : <p role="status">{labels.loading}</p>;
  const { book, pages, complete } = loaded;
  const endpaper = edition.artwork.endpaperArt || (pattern?.source === endpaperSource ? pattern.url : null);

  const modify = updater => {
    setEdition(updater);
    setDirty(true);
    setError('');
    setMessage('');
  };
  const update = (field, value) => modify(prev => ({
    ...prev,
    [field]: value,
    ...(Object.hasOwn(TEXT_LIMITS, field) ? { matterApproval: null } : {}),
  }));
  const changePage = (id, patch) => modify(prev => {
    const index = pages.findIndex(item => item.id === id);
    const draft = pageDraft(prev, pages[index], index);
    return { ...prev, pages: { ...prev.pages, [id]: { ...draft, ...patch } } };
  });
  const changeArtwork = (type, src) => modify(prev => ({ ...prev, artwork: { ...prev.artwork, [type]: src } }));
  const onBusy = delta => setBusyCount(count => count + delta);

  const generateClosing = async () => {
    if (busyCount || !complete || !pages.at(-1)) return;
    setClosingStatus('generatingClosingArt');
    onBusy(1);
    try {
      const { makeClosingArt } = await import('@/lib/printEdition/assets');
      changeArtwork('closingArt', await makeClosingArt(book, pages.at(-1), edition.artwork.characterSheet));
      setClosingStatus('');
    } catch {
      setClosingStatus('generateFailed');
    } finally {
      onBusy(-1);
    }
  };
  const save = async (event) => {
    event.preventDefault();
    if (lock.current || !dirty || busyCount) return;
    lock.current = true;
    setError('');
    setMessage('saving');
    try {
      const next = await savePrintEdition(id, ownerId, edition);
      setEdition(next);
      setDirty(false);
      setMessage('saved');
    } catch (err) {
      setMessage('');
      setError(err.message === 'conflict' ? 'conflict' : 'saveFailed');
    } finally {
      lock.current = false;
    }
  };
  const unsafeText = editionHasUnsafeText(edition, book, pages);
  let proofReady = !unsafeText && complete && Boolean(endpaper) && !dirty && Boolean(edition.revision) && Boolean(edition.creator.trim() && edition.blurb.trim()) && printReviewComplete(edition, book, pages);
  if (proofReady) {
    try { createEditionManifest(book, pages, edition, src => { if (!src) throw new Error('Missing artwork'); return src; }); }
    catch { proofReady = false; }
  }
  const download = async () => {
    if (!proofReady || lock.current || busyCount) return;
    lock.current = true;
    setError('');
    setMessage('exporting');
    try {
      const { downloadEditionBundle } = await import('@/lib/printEdition/assets');
      const current = await Book.get(id);
      if (current?.created_by !== ownerId || current.printEdition?.revision !== edition.revision) throw new Error('conflict');
      const rows = await Page.filter({ book_id: id }, 'page_number');
      if (!summarizeBook(current, rows).isComplete) throw new Error('conflict');
      const currentPages = readablePages(rows);
      if (!printReviewComplete(edition, current, currentPages)) {
        setLoaded({ book: current, pages: currentPages, complete: true });
        throw new Error('conflict');
      }
      await downloadEditionBundle(current, currentPages, { ...edition, artwork: { ...edition.artwork, endpaperArt: endpaper } });
      setMessage('exported');
    } catch (err) {
      setMessage('');
      setError(err.message === 'conflict' ? 'conflict' : 'exportFailed');
    } finally {
      lock.current = false;
    }
  };

  const matter = matterReview(edition, book);
  return (
    <>
      <Link className={`${actionClass} mb-4`} to={`/BookView?id=${encodeURIComponent(id)}`}><BookOpen aria-hidden="true" size={17} />{labels.back}</Link>
      <header className="mb-6 grid grid-cols-[1fr_auto] items-center gap-4 rounded-sp-lg bg-sp-night-800 p-5 text-sp-on-night sm:p-7">
        <div className="min-w-0">
          <p dir="auto" className="break-words text-sm text-sp-on-night-muted">{book.title}</p>
          <h1 id="print-edition-title" className="mt-2 font-sp-display text-3xl font-semibold leading-tight">{labels.title}</h1>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-sp-on-night-muted">{labels.intro}</p>
        </div>
        {book.cover_image && <img className="h-20 w-20 rounded-sp-sm object-cover shadow-md sm:h-28 sm:w-28" src={book.cover_image} alt="" />}
      </header>
      <form onSubmit={save} aria-labelledby="print-edition-title">
        <fieldset className="min-w-0 space-y-4" disabled={message === 'saving' || message === 'exporting'}>
          <legend className="sr-only">{labels.title}</legend>
          {!complete && <p className="rounded-sp-md bg-sp-violet-50 p-4 text-sm text-sp-ink-900" role="status">{labels.building}</p>}
          <EditionDetails book={book} endpaper={endpaper} edition={edition} change={update} labels={labels} />
          {matter.needsReview && book.language === 'hebrew' && (
            <section className="edition-panel space-y-3">
              <p>{labels.matterReview}</p>
              <button type="button" className={actionClass} disabled={matter.approved} onClick={() => update('matterApproval', matter.snapshot)}>
                {matter.approved ? labels.reviewed : labels.approveMatter}
              </button>
            </section>
          )}
          <section className="edition-panel"><PrintPreferences value={edition} onChange={value => modify(() => value)} isRTL={isRTL} /></section>
          <EditionPageReview book={book} pages={pages} edition={edition} changePage={changePage} onBusy={onBusy} busy={Boolean(busyCount)} labels={labels} isRTL={isRTL} />
          <section className="edition-panel space-y-3">
            <h2 className="edition-heading"><ImagePlus aria-hidden="true" size={22} />{labels.closing}</h2>
            <p className="text-sm leading-relaxed text-sp-ink-600">{labels.closingHelp} {labels.referenceHelp}</p>
            {complete && (book.cover_image || edition.artwork.characterSheet) &&
              <button type="button" className={actionClass} onClick={generateClosing} disabled={Boolean(busyCount)}>
                <Sparkles aria-hidden="true" size={17} />{labels.generateClosingArt}
              </button>}
            {closingStatus && <p className="text-sm text-sp-ink-600" role={closingStatus === 'generateFailed' ? 'alert' : 'status'}>{labels[closingStatus]}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              {['characterSheet', 'closingArt'].map(kind => <EditionArtField key={kind} label={labels[kind]} labels={labels} src={edition.artwork[kind]} disabled={Boolean(busyCount)} onChange={src => changeArtwork(kind, src)} onBusy={onBusy} />)}
            </div>
            <details className="mt-3">
              <summary className="min-h-11 cursor-pointer py-3 font-semibold">{labels.artwork}</summary>
              <p className="mb-3 text-sm leading-relaxed text-sp-ink-600">{labels.artworkHelp}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {['dedicationArt', 'endpaperArt'].map(kind => <EditionArtField key={kind} label={labels[kind]} labels={labels} src={edition.artwork[kind]} disabled={Boolean(busyCount)} onChange={src => changeArtwork(kind, src)} onBusy={onBusy} />)}
              </div>
            </details>
          </section>
          <section className="edition-panel space-y-3">
            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={!dirty || Boolean(busyCount)} className={`${actionClass} border-sp-violet-700 bg-sp-violet-700 text-white hover:bg-sp-violet-600`}><Save aria-hidden="true" size={17} />{labels.save}</button>
              <button type="button" className={actionClass} onClick={download} disabled={!proofReady || Boolean(busyCount)}><Download aria-hidden="true" size={17} />{labels.export}</button>
            </div>
            <p className="text-sm leading-relaxed text-sp-ink-600">{proofReady ? labels.proofOnly : labels.exportDisabled}</p>
            {unsafeText && <p className="text-sm text-sp-danger" role="alert">{labels.unsafeText}</p>}
            {message && <p className="text-sm font-semibold" role="status">{labels[message]}</p>}
            {error && <p className="text-sm text-sp-danger" role="alert">{labels[error]}</p>}
          </section>
        </fieldset>
      </form>
    </>
  );
}
