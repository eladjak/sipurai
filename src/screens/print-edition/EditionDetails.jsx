import { useEffect, useState } from 'react';
import { fitDedication } from '@/lib/printEdition/dedicationLayout';
import { BookHeart, PenLine } from 'lucide-react';
import { TEXT_LIMITS } from '@/lib/printEdition/model';
import { actionClass, textClass } from './labels';

export function EditionDetails({ book, edition, endpaper, change, labels }) {
  const dedication = edition.dedication.trim();
  const dedicationArt = edition.artwork.dedicationArt || book.cover_image;
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    if (!dedication) return;
    let current = true;
    const fitPreview = async () => {
      await document.fonts.ready;
      if (!current) return;
      const context = document.createElement('canvas').getContext('2d');
      if (!context) return;
      context.direction = 'rtl';
      const layout = fitDedication(dedication, (text, points) => {
        context.font = `500 ${points * 96 / 72}px "Sipurai Print"`;
        return context.measureText(text).width * 25.4 / 96;
      });
      setPreview({ input: dedication, layout });
    };
    fitPreview();
    return () => { current = false; };
  }, [dedication]);
  const layout = preview?.input === dedication ? preview.layout : undefined;
  const aboutExample = edition.creator.trim() ? labels.aboutExample(edition.creator.trim()) : '';
  return (
    <>
      <section className="edition-panel space-y-4">
        <h2 className="edition-heading"><PenLine aria-hidden="true" size={22} />{labels.identity}</h2>
        <div>
          <label className="font-semibold" htmlFor="edition-print-title">{labels.printTitle}</label>
          <input id="edition-print-title" dir="auto" className={textClass} maxLength={TEXT_LIMITS.printTitle} value={edition.printTitle} placeholder={book.title} onChange={e => change('printTitle', e.target.value)} />
        </div>
        <div>
          <label className="font-semibold" htmlFor="edition-creator">{labels.creator}</label>
          <p id="edition-creator-hint" className="text-sm text-sp-ink-600">{labels.creatorHint}</p>
          <input id="edition-creator" aria-describedby="edition-creator-hint" autoComplete="off" dir="auto" className={textClass} maxLength={TEXT_LIMITS.creator} value={edition.creator} onChange={e => change('creator', e.target.value)} />
        </div>
        <div>
          <label className="font-semibold" htmlFor="edition-blurb">{labels.blurb}</label>
          <textarea id="edition-blurb" dir="auto" className={textClass} rows={3} maxLength={TEXT_LIMITS.blurb} value={edition.blurb} onChange={e => change('blurb', e.target.value)} />
          {!edition.blurb && book.description && <button type="button" className={actionClass} onClick={() => change('blurb', book.description.slice(0, TEXT_LIMITS.blurb))}>{labels.useDescription}</button>}
        </div>
        <div>
          <label className="font-semibold" htmlFor="edition-author">{labels.about}</label>
          <p id="edition-author-hint" className="text-sm text-sp-ink-600">{labels.aboutPrompt}</p>
          <textarea id="edition-author" aria-describedby="edition-author-hint" dir="auto" className={textClass} rows={2} maxLength={TEXT_LIMITS.aboutAuthor} value={edition.aboutAuthor} onChange={e => change('aboutAuthor', e.target.value)} />
          {!edition.aboutAuthor && aboutExample && <button type="button" className={actionClass} onClick={() => change('aboutAuthor', aboutExample)}>{labels.aboutExampleAction}</button>}
        </div>
        <div>
          <label className="font-semibold" htmlFor="edition-copyright">{labels.copyright}</label>
          <textarea id="edition-copyright" dir="auto" className={textClass} rows={2} maxLength={TEXT_LIMITS.copyright} value={edition.copyright} onChange={e => change('copyright', e.target.value)} />
        </div>
      </section>
      <section className="edition-panel grid gap-5 sm:grid-cols-2">
        <div className="space-y-3">
          <h2 className="edition-heading"><BookHeart aria-hidden="true" size={22} />{labels.dedicationTitle}</h2>
          <div>
            <label className="font-semibold" htmlFor="edition-dedication">{labels.dedication}</label>
            <textarea id="edition-dedication" dir="auto" className={textClass} rows={3} maxLength={TEXT_LIMITS.dedication} value={edition.dedication} onChange={e => change('dedication', e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            {!edition.dedication && <button type="button" className={actionClass} onClick={() => change('dedication', labels.dedicationExample)}>{labels.dedicationExampleAction}</button>}
            {!!edition.dedication && <button type="button" className={actionClass} onClick={() => change('dedication', '')}>{labels.skip}</button>}
          </div>
        </div>
        <figure className="m-0 min-w-0">
          <div className={`edition-dedication ${dedication ? 'has-dedication' : ''}`}>
            {endpaper && <img className="edition-endpaper" src={endpaper} alt="" />}
            {dedication &&
              <><p dir={book.language === 'hebrew' ? 'rtl' : 'auto'} style={layout ? { fontSize: `${layout.size}cqw` } : undefined}>{layout?.text || dedication}</p>{dedicationArt && <img className="edition-dedication-art" src={dedicationArt} alt="" />}</>}
          </div>
          <figcaption className="mt-2 text-center text-xs text-sp-ink-600">{dedication ? labels.dedicationCaption : labels.skipped}</figcaption>
          {layout === null && <p role="alert" className="mt-2 text-sm text-sp-danger">{labels.dedicationOverflow}</p>}
        </figure>
      </section>
    </>
  );
}
