import { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useTheatre } from './useTheatre';
import TheatrePage from './TheatrePage';
export default function Theatre({ bookId, state, t }) {
 const { pages, loadError, save } = useTheatre(bookId, state);
 const [index, setIndex] = useState(0);
 const current = Math.min(index, Math.max(0, pages.length - 1));
 const button = 'inline-flex min-h-12 items-center gap-2 rounded-sp-sm border border-sp-line px-4 hover:bg-sp-violet-50 active:bg-sp-violet-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sp-violet-700 disabled:opacity-50';
 return <section aria-label={t('newStory.theatreTitle')} className="mt-6"><h2 className="font-sp-display text-sp-2xl font-semibold">{t('newStory.theatreTitle')}</h2>
 {loadError && <p role="alert" className="mt-3 text-sp-danger">{t('newStory.theatreLoadError')}</p>}
 {(state === 'failed' || state === 'disconnected') && pages.length > 0 && <p role="status" className="mt-3">{t('newStory.theatrePartial')}</p>}
 {pages.length ? <><TheatrePage page={pages[current]} t={t} save={save}/><nav aria-label={t('newStory.theatreNavigation')} className="mt-4 flex flex-wrap justify-between gap-3"><button className={button} onClick={() => setIndex(current - 1)} disabled={current === 0}><ArrowRight aria-hidden="true" size={18}/>{t('newStory.theatrePrevious')}</button><button className={button} onClick={() => setIndex(current + 1)} disabled={current >= pages.length - 1}>{t('newStory.theatreNext')}<ArrowLeft aria-hidden="true" size={18}/></button></nav></> : <p className="mt-4 rounded-sp-md bg-sp-violet-50 p-5">{t('newStory.theatreWaiting')}</p>}
 </section>;
}
