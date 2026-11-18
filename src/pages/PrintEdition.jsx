import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, Download, History, ImagePlus, Redo2, Save, Sparkles, Undo2 } from 'lucide-react';
import { Book, savePrintEdition } from '@/entities/Book';
import { Page } from '@/entities/Page';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import useSubscription from '@/hooks/useSubscription';
import { useI18n } from '@/components/i18n/i18nProvider';
import { isPrintBookId } from '@/lib/printedBookLink';
import { readablePages, summarizeBook } from '@/lib/bookProgress';
import { MAX_PAGES } from '@/lib/printSpec';
import { createEditionManifest, EDIT_INSTRUCTION_LIMIT, editionDraft, editionHasUnsafeText, editionPhysicalPageCount, editionStoryPages, isSafeStoryText, matterReview, pageDraft, printReviewComplete, sameEditionSource, STORY_FONTS, TEXT_LIMITS } from '@/lib/printEdition/model';
import { editEdition, editionSavePayload, moveEdition, openEditionWorkspace, restoreEdition } from '@/lib/printEdition/history';
import { configuredPrintEditionPolicy as policy, printEditionCapabilities } from '@/lib/printEdition/policy';
import PrintPreferences from '@/screens/print-edition/PrintPreferences';
import ProofWorkspace from '@/screens/print-edition/ProofWorkspace';
import { EditionDetails } from '@/screens/print-edition/EditionDetails';
import { EditionArtField } from '@/screens/print-edition/EditionArtField';
import { EditionPageReview } from '@/screens/print-edition/EditionPageReview';
import { actionClass, editionLabels, textClass } from '@/screens/print-edition/labels';
import '@/styles/sp-tokens.css';
import '@/styles/sp-fonts.css';
import '@/screens/print-edition/edition.css';

const fields = {
  printTitle: 'edition-print-title', creator: 'edition-creator', blurb: 'edition-blurb',
  aboutAuthor: 'edition-author', copyright: 'edition-copyright', dedication: 'edition-dedication',
  coverArt: 'edition-cover-art', dedicationArt: 'edition-dedication-art',
  endpaperArt: 'edition-endpaper-art', closingArt: 'edition-closing-art',
  text: 'edition-story-text', art: 'edition-story-art',
  layout: 'edition-scene-layout', zone: 'edition-zone', panel: 'edition-panel-style',
};
const defaultFields = {
  cover: 'printTitle', title: 'printTitle', story: 'text', dedication: 'dedication',
  endpaper: 'endpaperArt', closing: 'closingArt', copyright: 'copyright', aboutAuthor: 'aboutAuthor',
};

export default function PrintEdition() {
  const [params] = useSearchParams();
  const id = params.get('id');
  const { user, isLoading } = useCurrentUser();
  const { isRTL } = useI18n();
  const labels = editionLabels(isRTL);
  const Wizard = policy === 'subscriber-preview' ? SubscribedEdition : OwnerEdition;
  return (
    <main className="sp-shell mx-auto max-w-6xl px-4 py-6 text-sp-ink-900 sm:px-8 sm:py-10" dir={isRTL ? 'rtl' : 'ltr'}>
      {isLoading ? <p role="status">{labels.loading}</p> : !user?.id || !isPrintBookId(id) ? <p role="status">{labels.unavailable}</p> :
        <Wizard key={`${user.id}:${id}`} id={id} ownerId={user.id} labels={labels} isRTL={isRTL} />}
    </main>
  );
}

function SubscribedEdition(props) {
  const { plan } = useSubscription();
  return <OwnerEdition {...props} plan={plan} />;
}

function OwnerEdition({ id, ownerId, labels, isRTL, plan }) {
  const [loaded, setLoaded] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [authorityStale, setAuthorityStale] = useState(false);
  const aiPreference = `sipurai-print-ai:${ownerId}`;
  const [allowAI, setAllowAI] = useState(() => {
    try { return sessionStorage.getItem(aiPreference) === 'allowed'; }
    catch { return false; }
  });
  const [busy, setBusy] = useState(false);
  const [storyIndex, setStoryIndex] = useState(0);
  const [editTarget, setEditTarget] = useState(null);
  const [fromProof, setFromProof] = useState(false);
  const lock = useRef(false);
  const workInProgress = useRef(false);
  const permittedCapabilities = printEditionCapabilities(policy, plan);
  const capabilities = {
    ...permittedCapabilities,
    rewriteSuggestions: permittedCapabilities.rewriteSuggestions && allowAI,
    illustrationGeneration: permittedCapabilities.illustrationGeneration && allowAI,
  };
  const active = workspace?.entries[workspace.cursor];
  const revision = workspace?.revision;
  const edition = useMemo(() => active && { ...active, revision }, [active, revision]);
  const basePages = loaded?.pages;
  const extraPages = edition?.extraPages;
  const pages = useMemo(() => basePages && editionStoryPages({ extraPages }, basePages), [basePages, extraPages]);
  const locked = message === 'saving' || message === 'exporting';

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
        setWorkspace(openEditionWorkspace(book.printEdition));
      } catch {
        if (current) setError(book?.created_by === ownerId ? 'loadError' : 'unavailable');
      }
    };
    read();
    return () => { current = false; };
  }, [id, ownerId]);

  const coverArt = edition?.artwork.coverArt || loaded?.book.cover_image;
  useEffect(() => {
    if (!editTarget || busy || locked) return;
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(editTarget.id) || document.getElementById(editTarget.fallback);
      if (!target) {
        setEditTarget(null);
        return;
      }
      const details = target.closest('details');
      if (details) details.open = true;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'center' });
      setEditTarget(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [editTarget, busy, locked]);

  if (!loaded || !edition) return error ? <p role="alert">{labels[error]}</p> : <p role="status">{labels.loading}</p>;
  const { book, complete } = loaded;
  const { dirty } = workspace;

  const modifyHistory = updater => {
    if (lock.current) return;
    setWorkspace(updater);
    setError('');
    setMessage('');
  };
  const modify = (updater, key) => {
    const now = Date.now();
    modifyHistory(prev => editEdition(prev, updater, { key, now }));
  };
  const update = (field, value, grouped = false) => modify(prev => {
    if (Object.is(prev[field], value)) return prev;
    return {
      ...prev,
      [field]: value,
      ...(Object.hasOwn(TEXT_LIMITS, field) ? { matterApproval: null } : {}),
    };
  }, grouped ? field : undefined);
  const changePage = (id, patch, key) => modify(prev => {
    const index = pages.findIndex(item => item.id === id);
    if (index < 0) return prev;
    const draft = pageDraft(prev, pages[index], index);
    if (Object.entries(patch).every(([field, value]) => Object.is(draft[field], value))) return prev;
    const next = { ...prev, pages: { ...prev.pages, [id]: { ...draft, ...patch } } };
    if (patch.layout) {
      const slots = editionPhysicalPageCount(next, pages);
      if (slots > MAX_PAGES && slots > editionPhysicalPageCount(prev, pages)) return prev;
    }
    return next;
  }, key ? `${id}:${key}` : undefined);
  const canAddPage = complete && capabilities.extraPages && editionPhysicalPageCount(edition, [...pages, { id: null }]) <= MAX_PAGES;
  const appendPrintPage = () => {
    if (!canAddPage || lock.current || workInProgress.current) return;
    const id = `extra-${crypto.randomUUID()}`;
    modify(prev => {
      const added = { ...prev, extraPages: [...prev.extraPages, id] };
      return editionPhysicalPageCount(added, editionStoryPages(added, basePages)) <= MAX_PAGES ? added : prev;
    });
    setStoryIndex(pages.length);
    setEditTarget({ id: fields.text, fallback: fields.text });
  };
  const removePrintPage = (pageId) => {
    modify(prev => {
      if (!prev.extraPages.includes(pageId)) return prev;
      const remaining = editionStoryPages(prev, basePages);
      const index = remaining.findIndex(page => page.id === pageId);
      const previous = remaining[index - 1];
      const story = { ...prev.pages };
      delete story[pageId];
      if (story[previous?.id]?.layout === 'spread') story[previous.id] = { ...story[previous.id], layout: 'single' };
      return { ...prev, pages: story, extraPages: prev.extraPages.filter(id => id !== pageId) };
    });
    setStoryIndex(Math.max(0, storyIndex - 1));
  };
  const changeArtwork = (type, src) => modify(prev => ({ ...prev, artwork: { ...prev.artwork, [type]: src } }));
  const updateAIPreference = allowed => {
    setAllowAI(allowed);
    try { sessionStorage.setItem(aiPreference, allowed ? 'allowed' : 'declined'); }
    catch { /* The preference still applies for the open editor. */ }
  };
  const onBusy = delta => {
    if (delta > 0 && (lock.current || workInProgress.current)) return false;
    workInProgress.current = delta > 0;
    setBusy(workInProgress.current);
    return true;
  };
  const openEditor = ({ kind = '', storyIndex: nextIndex = -1, field = '' } = {}) => {
    if (kind === 'story' && Number.isInteger(nextIndex) && nextIndex >= 0 && nextIndex < pages.length) {
      const previous = pages[nextIndex - 1];
      const sharedArt = field === 'art' && previous && pageDraft(edition, previous, nextIndex - 1).layout === 'spread';
      setStoryIndex(sharedArt ? nextIndex - 1 : nextIndex);
    }
    const input = fields[field] || fields[defaultFields[kind]];
    if (input) {
      setFromProof(true);
      setEditTarget({ id: input, fallback: kind === 'story' ? fields.text : input });
    }
  };

  const save = async (event) => {
    event.preventDefault();
    if (authorityStale || lock.current || workInProgress.current || !dirty) return;
    lock.current = true;
    setError('');
    setMessage('saving');
    try {
      const next = await savePrintEdition(id, ownerId, editionSavePayload(workspace));
      setWorkspace(openEditionWorkspace(next));
      setLoaded(prev => ({ ...prev, book: { ...prev.book, printEdition: next } }));
      setMessage('saved');
    } catch (err) {
      setMessage('');
      if (err.message === 'conflict') setAuthorityStale(true);
      setError(err.message === 'conflict' ? 'conflict' : 'saveFailed');
    } finally {
      lock.current = false;
    }
  };
  const unsafeText = editionHasUnsafeText(edition, book, pages);
  let proofReady = !authorityStale && !unsafeText && complete && !dirty && Boolean(edition.revision) && Boolean(edition.creator.trim() && edition.blurb.trim()) && printReviewComplete(edition, book, pages);
  if (proofReady) {
    try { createEditionManifest(book, pages, edition, src => { if (!src) throw new Error('Missing artwork'); return src; }); }
    catch { proofReady = false; }
  }
  const verifyHandoff = async ({ requireApproval = true } = {}) => {
    if (requireApproval && !proofReady) throw new Error('conflict');
    const current = await Book.get(id);
    const rejectConflict = () => {
      setAuthorityStale(true);
      setError('conflict');
      throw new Error('conflict');
    };
    if (current?.created_by !== ownerId || editionDraft(current.printEdition).revision !== edition.revision) rejectConflict();
    const rows = await Page.filter({ book_id: id }, 'page_number');
    const fresh = readablePages(rows);
    if (!summarizeBook(current, rows).isComplete || !sameEditionSource(book, basePages, current, fresh)) rejectConflict();
    if (requireApproval) {
      try { createEditionManifest(current, editionStoryPages(edition, fresh), edition, src => { if (!src) throw new Error('missing art'); return src; }); }
      catch { rejectConflict(); }
    }
    return { book: current, pages: editionStoryPages(edition, fresh), edition };
  };
  const download = async () => {
    if (!proofReady || lock.current || workInProgress.current) return;
    lock.current = true;
    setError('');
    setMessage('exporting');
    try {
      const { downloadEditionBundle } = await import('@/lib/printEdition/assets');
      const verified = await verifyHandoff();
      await downloadEditionBundle(verified.book, verified.pages, verified.edition, verifyHandoff);
      setMessage('exported');
    } catch (err) {
      setMessage('');
      setError(err.message === 'conflict' ? 'exportConflict' : 'exportFailed');
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
        {coverArt && <img className="h-20 w-20 rounded-sp-sm object-cover shadow-md sm:h-28 sm:w-28" src={coverArt} alt="" />}
      </header>
      {fromProof && <button type="button" className="edition-return" onClick={() => {
        const viewer = document.getElementById('edition-proof');
        viewer?.scrollIntoView({ block: 'center' });
        (viewer?.querySelector('select') || viewer)?.focus({ preventScroll: true });
        setFromProof(false);
      }}><BookOpen size={17} aria-hidden="true" />{labels.returnToProof}</button>}
      <ProofWorkspace book={book} pages={pages} edition={edition} unsaved={dirty || !edition.revision} isRTL={isRTL} onEdit={openEditor} complete={complete} handoffReady={proofReady && !busy && !locked} verifyHandoff={verifyHandoff} />
      <form onSubmit={save} className="mt-4" aria-labelledby="print-edition-title">
        <fieldset className="min-w-0 space-y-4" disabled={locked || busy}>
          <legend className="sr-only">{labels.title}</legend>
          <section className="edition-panel space-y-3">
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={!dirty || authorityStale} className={`${actionClass} border-sp-violet-700 bg-sp-violet-700 text-white hover:bg-sp-violet-600`}><Save aria-hidden="true" size={17} />{labels.save}</button>
              <button type="button" className={actionClass} disabled={workspace.cursor === 0} onClick={() => modifyHistory(prev => moveEdition(prev, -1))}><Undo2 className="rtl:scale-x-[-1]" aria-hidden="true" size={17} />{labels.undo}</button>
              <button type="button" className={actionClass} disabled={workspace.cursor + 1 === workspace.entries.length} onClick={() => modifyHistory(prev => moveEdition(prev, 1))}><Redo2 className="rtl:scale-x-[-1]" aria-hidden="true" size={17} />{labels.redo}</button>
            </div>
            {(!message || message === 'saved' || message === 'saving') && <p className="text-sm text-sp-ink-600" role="status">{message ? labels[message] : dirty ? labels.unsaved : null}</p>}
            {authorityStale && <div className="space-y-2">
              <p className="text-sm text-sp-danger" role="alert">{labels.conflict}</p>
              <Link className={actionClass} to={`/PrintEdition?id=${encodeURIComponent(id)}`} target="_blank" rel="noopener">{labels.openLatest}</Link>
            </div>}
            {!authorityStale && error === 'saveFailed' && <p className="text-sm text-sp-danger" role="alert">{labels.saveFailed}</p>}
            <VersionHistory workspace={workspace} labels={labels} isRTL={isRTL} restore={rev => modifyHistory(prev => restoreEdition(prev, rev))} />
          </section>
          {!complete && <p className="rounded-sp-md bg-sp-violet-50 p-4 text-sm text-sp-ink-900" role="status">{labels.building}</p>}
          <EditionDetails book={book} edition={edition} change={update} changeArtwork={changeArtwork} onBusy={onBusy} busy={busy} labels={labels} />
          {matter.needsReview && book.language === 'hebrew' && (
            <section className="edition-panel space-y-3">
              <p>{labels.matterReview}</p>
              <button type="button" className={actionClass} disabled={matter.approved} onClick={() => update('matterApproval', matter.snapshot)}>
                {matter.approved ? labels.reviewed : labels.approveMatter}
              </button>
            </section>
          )}
          <section className="edition-panel space-y-4">
            <PrintPreferences value={edition} allowUpgradedPaper={capabilities.upgradedPaper} onChange={next => modify(prev => ({ ...prev, cover: next.cover, paper: next.paper }))} isRTL={isRTL} />
            {(permittedCapabilities.rewriteSuggestions || permittedCapabilities.illustrationGeneration) && <div className="rounded-sp-sm border border-sp-line px-3 py-2">
              <label className="flex min-h-11 cursor-pointer items-center gap-3 font-semibold" htmlFor="edition-ai-consent">
                <input id="edition-ai-consent" type="checkbox" checked={allowAI} aria-describedby="edition-ai-disclosure" className="h-5 w-5 shrink-0 accent-sp-violet-700" onChange={e => updateAIPreference(e.target.checked)} />
                {labels.allowAI}
              </label>
              <p id="edition-ai-disclosure" className="pb-2 text-sm leading-relaxed text-sp-ink-600">{labels.aiDisclosure}</p>
            </div>}
            {capabilities.storyFont && <div>
              <label htmlFor="edition-story-font" className="block font-semibold">{labels.storyFont}</label>
              <select id="edition-story-font" className={textClass} value={edition.storyFont} onChange={e => update('storyFont', e.target.value)}>
                {STORY_FONTS.map((font, n) => <option key={font} value={font}>{labels.storyFonts[n]}</option>)}
              </select>
            </div>}
          </section>
          <EditionPageReview book={book} pages={pages} edition={edition} changePage={changePage} onBusy={onBusy} busy={busy} labels={labels} isRTL={isRTL} index={storyIndex} setIndex={setStoryIndex} capabilities={capabilities} basePages={basePages} onAddPage={complete && capabilities.extraPages ? appendPrintPage : null} canAddPage={canAddPage} onRemovePage={removePrintPage} />
          <EditionArtwork book={book} pages={pages} edition={edition} complete={complete} labels={labels} onBusy={onBusy} busy={busy} changeArtwork={changeArtwork} capability={capabilities.illustrationGeneration} />
          <section className="edition-panel space-y-3">
            <button type="button" className={actionClass} onClick={download} disabled={!proofReady}><Download aria-hidden="true" size={17} />{labels.export}</button>
            <p className="text-sm leading-relaxed text-sp-ink-600">{proofReady ? labels.proofOnly : labels.exportDisabled}</p>
            {unsafeText && <p className="text-sm text-sp-danger" role="alert">{labels.unsafeText}</p>}
            {(message === 'exporting' || message === 'exported') && <p className="text-sm font-semibold" role="status">{labels[message]}</p>}
            {(error === 'exportFailed' || (error === 'exportConflict' && !authorityStale)) && <p className="text-sm text-sp-danger" role="alert">{labels[error]}</p>}
          </section>
        </fieldset>
      </form>
    </>
  );
}

function VersionHistory({ workspace, labels, isRTL, restore }) {
  const date = useMemo(() => new Intl.DateTimeFormat(isRTL ? 'he-IL' : 'en', { dateStyle: 'medium', timeStyle: 'short' }), [isRTL]);
  const draft = workspace.entries[workspace.cursor];
  return (
    <details className="rounded-sp-sm border border-sp-line px-3">
      <summary className="min-h-11 cursor-pointer py-3 font-semibold"><span className="inline-flex items-center gap-2"><History aria-hidden="true" size={17} />{labels.versions}</span></summary>
      {!workspace.versions.length ? <p className="pb-3 text-sm text-sp-ink-600">{labels.noVersions}</p> :
        <ul className="mb-3 divide-y divide-sp-line">
          {[...workspace.versions].reverse().map(version => (
            <li key={version.revision} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span><strong>{labels.versionLabel(version.revision)}</strong>{version.savedAt && <> · <time dateTime={version.savedAt}>{date.format(new Date(version.savedAt))}</time></>}</span>
              <button type="button" className={actionClass} disabled={version.draft === draft} onClick={() => restore(version.revision)} aria-label={labels.restoreVersion(version.revision)}>{labels.restore}</button>
            </li>
          ))}
        </ul>}
    </details>
  );
}

function EditionArtwork({ book, pages, edition, complete, labels, onBusy, busy, changeArtwork, capability }) {
  const [instruction, setInstruction] = useState('');
  const [closingStatus, setClosingStatus] = useState('');
  const ending = pages.at(-1);
  const lastDraft = ending && pageDraft(edition, ending, pages.length - 1);
  const source = edition.artwork.characterSheet || book.cover_image || edition.artwork.coverArt;
  const lastArt = lastDraft?.printArt || ending?.image_url;
  const canGenerateClosing = capability && complete && source && isSafeStoryText(lastDraft?.text);
  const generateClosing = async () => {
    if (busy || !canGenerateClosing) return;
    if (!onBusy(1)) return;
    setClosingStatus('generatingClosingArt');
    try {
      const { makeClosingArt } = await import('@/lib/printEdition/assets');
      changeArtwork('closingArt', await makeClosingArt(book, { ...ending, text_content: lastDraft.text }, source, instruction));
      setClosingStatus('');
    } catch {
      setClosingStatus('generateFailed');
    } finally {
      onBusy(-1);
    }
  };
  return (
    <section className="edition-panel space-y-3">
      <h2 className="edition-heading"><ImagePlus aria-hidden="true" size={22} />{labels.closing}</h2>
      <p className="text-sm leading-relaxed text-sp-ink-600">{labels.closingHelp}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <EditionArtField inputId="edition-closing-art" label={labels.closingArt} labels={labels} src={edition.artwork.closingArt} onChange={src => changeArtwork('closingArt', src)} onBusy={onBusy} disabled={busy} />
        <EditionArtField label={labels.characterSheet} labels={labels} src={edition.artwork.characterSheet} onChange={src => changeArtwork('characterSheet', src)} onBusy={onBusy} disabled={busy} />
      </div>
      {complete && lastArt && !edition.artwork.closingArt && <button type="button" className={actionClass} onClick={() => changeArtwork('closingArt', lastArt)}>{labels.useFinalIllustration}</button>}
      {canGenerateClosing && <details className="rounded-sp-sm border border-sp-line px-3">
        <summary className="min-h-11 cursor-pointer py-3 font-semibold">{labels.generateClosingArt}</summary>
        <div className="space-y-2 pb-3">
          <p className="text-sm text-sp-ink-600">{labels.referenceHelp}</p>
          <label htmlFor="edition-closing-instruction" className="block text-sm font-semibold">{labels.imageInstruction}</label>
          <textarea id="edition-closing-instruction" className={textClass} dir="auto" rows={2} maxLength={EDIT_INSTRUCTION_LIMIT} value={instruction} onChange={e => setInstruction(e.target.value)} />
          <button type="button" className={actionClass} onClick={generateClosing}><Sparkles aria-hidden="true" size={17} />{labels.generateClosingArt}</button>
          {closingStatus && <p className="text-sm text-sp-ink-600" role={closingStatus === 'generateFailed' ? 'alert' : 'status'}>{labels[closingStatus]}</p>}
        </div>
      </details>}
      <details className="mt-3">
        <summary className="min-h-11 cursor-pointer py-3 font-semibold">{labels.artwork}</summary>
        <p className="mb-3 text-sm leading-relaxed text-sp-ink-600">{labels.artworkHelp}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {['dedicationArt', 'endpaperArt'].map(kind => <EditionArtField key={kind} inputId={fields[kind]} label={labels[kind]} labels={labels} src={edition.artwork[kind]} onChange={src => changeArtwork(kind, src)} onBusy={onBusy} disabled={busy} />)}
        </div>
      </details>
    </section>
  );
}
