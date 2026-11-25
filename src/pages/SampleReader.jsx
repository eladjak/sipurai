import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useI18n } from '@/components/i18n/i18nProvider';
import { Wordmark } from '@/components/brand/Wordmark';
import { isNewShell } from '@/lib/flags';
import books from '@/data/demoBooks';
import './sample-reader.css';

const button = 'inline-flex min-h-12 items-center justify-center rounded-full px-5 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500';
const leadNames = {
  'demo-dragons-garden': { he: 'לילי', en: 'Lily' },
  'demo-space-adventure': { he: 'יעל', en: 'Yael' },
  'demo-brave-fox': { he: 'ערן', en: 'Eran' },
};

// Only the bundled, deliberately public catalogue is read here. No user data.
export default function SampleReader() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const { language, isRTL, t } = useI18n();
  const english = language === 'english' || language === 'en';
  const book = books.find(item => item.id === id);
  const [direction, setDirection] = useState('forward');
  const [brokenImage, setBrokenImage] = useState(false);
  const [enteredName, setEnteredName] = useState(null);
  const nameInput = useRef(null);
  const forwardRef = useRef(null);
  const restoreForwardFocus = useRef(false);
  const bindForward = useCallback((control) => {
    if (!control && forwardRef.current === document.activeElement) {
      restoreForwardFocus.current = true;
    }
    forwardRef.current = control;
  }, []);
  const raw = Number(params.get('page') || 0);
  const page = Number.isInteger(raw) ? Math.max(0, Math.min(book?.pages.length || 0, raw)) : 0;
  const text = book?.pages[page - 1];
  const name = enteredName?.bookId === id ? enteredName.value : '';
  const lead = leadNames[id]?.[english ? 'en' : 'he'];
  const replacement = name.trim();
  const personalize = (phrase) => replacement && lead ? phrase?.replaceAll(lead, () => replacement) : phrase;
  const title = personalize(english ? book?.title.en : book?.title.he);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    setBrokenImage(false);
    if (restoreForwardFocus.current) {
      forwardRef.current?.focus();
      restoreForwardFocus.current = false;
    }
  }, [id, page]);

  function go(next) {
    restoreForwardFocus.current = document.activeElement === forwardRef.current;
    setDirection(next > page ? 'forward' : 'back');
    setParams(next ? { page: String(next) } : {});
  }
  useEffect(() => {
    function key(e) {
      if (e.defaultPrevented || !book || e.altKey || e.ctrlKey || e.metaKey || /INPUT|TEXTAREA|SELECT/.test(e.target?.tagName || '')) return;
      if (e.key === (isRTL ? 'ArrowLeft' : 'ArrowRight') && page < book.pages.length) {
        e.preventDefault();
        go(page + 1);
      } else if (e.key === (isRTL ? 'ArrowRight' : 'ArrowLeft') && page > 0) {
        e.preventDefault();
        go(page - 1);
      }
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [book, page, isRTL]);

  return (
    <main dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-[#f8f1e3] text-[#202b3c]">
      <div className="mx-auto max-w-6xl px-5 pt-5 sm:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link to="/" className="inline-flex min-h-12 items-center"><Wordmark language={english ? 'en' : 'he'} /></Link>
          <Link to="/welcome#showcase" className="min-h-12 content-center underline underline-offset-4">{t('spxLibrary.allSamples')}</Link>
        </header>
        {!book ? (
          <section className="py-20 text-center">
            <FallbackArt />
            <h1 className="text-3xl font-bold">{t('spxLibrary.notFound')}</h1>
            <Link className={`${button} mt-6 bg-[#263c4c] text-white`} to="/welcome#showcase">{t('spxLibrary.explore')}</Link>
          </section>
        ) : (
          <>
            <div className="mt-8 flex flex-wrap items-baseline justify-between gap-2">
              <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
              <p role="status" aria-atomic="true" className="text-sm">{page === 0 ? t('spxLibrary.cover') : t('spxLibrary.pagePosition', { page, total: book.pages.length })}</p>
            </div>
            <article key={`${id}-${page}`} className={`sample-page sample-page--${direction} mt-5 overflow-hidden rounded-3xl bg-white shadow-xl md:grid md:grid-cols-2 ${page === 0 ? 'sample-page--cover' : ''}`}>
              <div className="flex min-h-72 items-center justify-center bg-[#d8e1da]">
                {brokenImage ? <FallbackArt /> : <img src={page ? text.image : book.cover_image} onError={() => setBrokenImage(true)} alt="" className="max-h-[65vh] w-full object-contain" />}
              </div>
              <div className="flex min-h-64 flex-col justify-center p-6 sm:p-10">
                <p className="text-xs font-bold tracking-widest text-[#846445]">{t('spxLibrary.story')}</p>
                {page === 0 ? (
                  <>
                    <h2 className="mt-4 break-words text-3xl font-bold leading-tight">{title}</h2>
                    <p className="mt-5 text-lg leading-relaxed">{t('spxLibrary.coverBody')}</p>
                    {lead && (
                      <div className="mt-5 grid gap-2">
                        <label className="grid gap-2 font-semibold">
                          {t('spxLibrary.sampleName')}
                          <input ref={nameInput} dir="auto" className="min-h-12 min-w-0 rounded-xl border border-[#73818a] bg-[#fffaf0] px-3 focus-visible:outline-2 focus-visible:outline-amber-500"
                            autoComplete="off" maxLength={24} placeholder={t('spxLibrary.sampleNamePlaceholder')} value={name}
                            onChange={(event) => setEnteredName({ bookId: id, value: event.target.value })} />
                        </label>
                        {name && <button type="button" className="min-h-11 justify-self-start px-2 underline underline-offset-4" onClick={() => {
                          setEnteredName(null);
                          nameInput.current?.focus();
                        }}>{t('spxLibrary.sampleNameReset')}</button>}
                      </div>
                    )}
                  </>
                ) : <p className="mt-4 whitespace-pre-line break-words text-lg leading-loose">{personalize(english ? text.textEn : text.text)}</p>}
              </div>
            </article>
            <nav aria-label={t('spxLibrary.pageNav')} className="sample-controls sticky bottom-0 z-10 mt-5 flex flex-wrap items-center justify-between gap-2 py-3">
              <button type="button" onClick={() => go(page - 1)} disabled={page === 0} className={`${button} border border-[#73818a] bg-[#f8f1e3] disabled:opacity-40`}>{t('spxLibrary.previous')}</button>
              {page < book.pages.length ? (
                <button ref={bindForward} type="button" onClick={() => go(page + 1)} className={`${button} bg-[#263c4c] text-white`}>{page === 0 ? t('spxLibrary.open') : t('spxLibrary.next')}</button>
              ) : <Link ref={bindForward} to={isNewShell() ? '/new' : '/BookWizard'} className={`${button} bg-[#263c4c] text-white`}>{t('spxLibrary.create')}</Link>}
            </nav>
          </>
        )}
      </div>
    </main>
  );
}

function FallbackArt() {
  return <img src="/icons/moon-book-192.png" alt="" className="sample-fallback" />;
}
