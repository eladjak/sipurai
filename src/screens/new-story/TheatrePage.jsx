import { useEffect, useState } from 'react';
import { Pencil, Save, X } from 'lucide-react';
export default function TheatrePage({ page, t, save }) {
  const [editing, setEditing] = useState(false), [text, setText] = useState(page.text_content), [status, setStatus] = useState('');
  useEffect(() => { setEditing(false); setText(page.text_content); setStatus(''); }, [page.id]);
  async function submit(event) {
    event.preventDefault(); setStatus('saving');
    try { await save(page, text); setEditing(false); setStatus('saved'); }
    catch { setStatus('error'); }
  }
  const button = 'inline-flex min-h-12 items-center gap-2 rounded-sp-sm border border-sp-line px-4 hover:bg-sp-violet-50 active:bg-sp-violet-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sp-violet-700 disabled:opacity-50';
  return <article className="mt-5 overflow-hidden rounded-sp-lg border border-sp-line bg-sp-card shadow-sp-1">
    {page.image_url ? <img src={page.image_url} alt="" className="aspect-video w-full object-cover"/> : <div className="bg-sp-violet-50"><img src="/images/empty-library.jpg" alt="" className="aspect-video w-full object-cover"/><p className="px-5 py-3 text-sm text-sp-ink-600">{t('newStory.theatreImagePending')}</p></div>}
    <div className="p-5 sm:p-8"><p className="text-sm text-sp-ink-600">{t('newStory.theatrePage')} {page.page_number}</p>
      {editing ? <form onSubmit={submit} className="mt-4"><label htmlFor="theatre-text" className="block font-semibold">{t('newStory.theatreText')}</label><textarea id="theatre-text" value={text} onChange={e => setText(e.target.value)} className="mt-2 min-h-40 w-full rounded-sp-sm border border-sp-line p-3 text-sp-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sp-violet-700"/><div className="mt-3 flex flex-wrap gap-2"><button className={button} disabled={status === 'saving' || !text.trim()}><Save size={18} aria-hidden="true"/>{t('newStory.theatreSave')}</button><button type="button" className={button} onClick={() => {setEditing(false); setText(page.text_content); setStatus('');}}><X size={18} aria-hidden="true"/>{t('newStory.theatreCancel')}</button></div></form> : <><p className="mt-4 whitespace-pre-wrap rounded-sp-sm bg-sp-violet-50 p-4 text-lg leading-relaxed">{page.text_content}</p><button type="button" className={`${button} mt-4`} onClick={() => {setText(page.text_content); setStatus(''); setEditing(true);}}><Pencil size={18} aria-hidden="true"/>{t('newStory.theatreEdit')}</button></>}
      <p role="status" className="mt-2 text-sp-ink-600">{status === 'saved' ? t('newStory.theatreSaved') : status === 'saving' ? t('newStory.theatreSaving') : status === 'error' ? t('newStory.theatreSaveError') : ''}</p>
    </div>
  </article>;
}
