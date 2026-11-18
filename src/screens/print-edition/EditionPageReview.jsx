import { useEffect, useState } from 'react';
import { AlignCenter, Check, ChevronLeft, ChevronRight, Sparkles, SpellCheck2 } from 'lucide-react';
import { createNikudClient } from '@/lib/printEdition/localNikudClient';
import { BLEED_MM, PRINT_PRESETS } from '@/lib/printSpec';
import { canApproveNikud, hasHebrew, isReviewCurrent, pageDraft, TEXT_ZONES } from '@/lib/printEdition/model';
import { EditionArtField } from './EditionArtField';
import { actionClass, textClass } from './labels';

const markKeys = ['ְ', 'ֱ', 'ֲ', 'ֳ', 'ִ', 'ֵ', 'ֶ', 'ַ', 'ָ', 'ֹ', 'ֻ', 'ּ', 'ׁ', 'ׂ'];
const markNames = ['שווא', 'חטף סגול', 'חטף פתח', 'חטף קמץ', 'חיריק', 'צירה', 'סגול', 'פתח', 'קמץ', 'חולם', 'קובוץ', 'דגש', 'שין ימנית', 'שין שמאלית'];

export function EditionPageReview({ book, pages, edition, changePage, onBusy, busy, labels, isRTL }) {
  const [index, setIndex] = useState(0);
  const [nikud] = useState(createNikudClient);
  useEffect(() => () => nikud.close(), [nikud]);
  const currentIndex = Math.min(index, pages.length - 1);
  const page = pages[currentIndex];
  const reviewed = pages.filter((item, n) => {
    const draft = pageDraft(edition, item, n);
    return book.language !== 'hebrew' || !hasHebrew(draft.source) || isReviewCurrent(draft);
  }).length;
  const Next = isRTL ? ChevronLeft : ChevronRight;
  const Prev = isRTL ? ChevronRight : ChevronLeft;
  if (!page) return null;
  const draft = pageDraft(edition, page, currentIndex);
  const preset = PRINT_PRESETS.find(item => item.id === book.print_size) || PRINT_PRESETS[0];
  const spreadRatio = (2 * preset.widthMm + 2 * BLEED_MM) / (preset.heightMm + 2 * BLEED_MM);
  const previous = edition.pages[pages[currentIndex - 1]?.id];
  const previousLayout = previous?.layout;
  const nextLayout = edition.pages[pages[currentIndex + 1]?.id]?.layout;
  const wideSrc = previousLayout === 'spread' ? previous.spread : draft.layout === 'spread' ? draft.spread : null;
  const framing = previousLayout === 'spread' ? previous.printSettings : draft.printSettings;
  const previewArt = wideSrc || draft.printArt || page.image_url;
  const nextPage = pages[currentIndex + 1];
  const canGenerate = Boolean(nextPage && (edition.artwork.characterSheet || book.cover_image));
  const generateSpread = canGenerate ? async () => {
    const { makeSpreadArt } = await import('@/lib/printEdition/assets');
    return makeSpreadArt(book, page, nextPage, edition.artwork.characterSheet, spreadRatio);
  } : null;
  return (
    <section className="edition-panel space-y-4">
      <h2 className="edition-heading"><SpellCheck2 aria-hidden="true" size={22} />{labels.story}</h2>
      {book.language === 'hebrew' && <p className="text-sm leading-relaxed text-sp-ink-600">{labels.storyHelp}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <button className={actionClass} type="button" aria-label={labels.previous} disabled={busy || currentIndex === 0} onClick={() => setIndex(currentIndex - 1)}><Prev aria-hidden="true" size={20} /></button>
          <button className={actionClass} type="button" aria-label={labels.next} disabled={busy || currentIndex + 1 >= pages.length} onClick={() => setIndex(currentIndex + 1)}><Next aria-hidden="true" size={20} /></button>
        </div>
        <div className="text-sm leading-tight text-sp-ink-600" aria-live="polite">{labels.page} <bdi>{currentIndex + 1}/{pages.length}</bdi> · {labels.reviewed} <bdi>{reviewed}/{pages.length}</bdi></div>
      </div>
      <PageDraft key={page.id} nikud={nikud} generateSpread={generateSpread} busy={busy} spreadRatio={spreadRatio} aspectRatio={preset.widthMm / preset.heightMm} wideSrc={wideSrc} previewArt={previewArt} framing={framing} isSecond={previousLayout === 'spread'} canPair={currentIndex + 1 < pages.length && previousLayout !== 'spread' && nextLayout !== 'spread'} page={page} draft={draft} isHebrew={book.language === 'hebrew'} onChange={patch => changePage(page.id, patch)} onBusy={onBusy} labels={labels} />
    </section>
  );
}

function PageDraft({ nikud, generateSpread, busy, spreadRatio, aspectRatio, wideSrc, previewArt, framing, isSecond, canPair, page, draft, isHebrew, onChange, onBusy, labels }) {
  const [work, setWork] = useState('');
  const [spreadWork, setSpreadWork] = useState('');
  const wantSpread = draft.layout === 'spread';
  const [editor, setEditor] = useState(null);
  const textInHebrew = isHebrew && hasHebrew(draft.source);
  const approved = isReviewCurrent(draft);
  const showText = draft.text || draft.source;
  const anchor = framing?.anchor;
  const previewAnchor = anchor ? { objectPosition: `${anchor[0] * 100}% ${anchor[1] * 100}%` } : undefined;
  const edit = (text) => onChange({ text, approval: null });
  const suggest = async () => {
    setWork('working');
    onBusy(1);
    try {
      const candidate = await nikud.suggest(draft.source);
      if (!canApproveNikud({ ...draft, text: candidate })) throw new Error('Invalid nikud response');
      edit(candidate);
      setWork('');
    } catch {
      setWork('failed');
    } finally {
      onBusy(-1);
    }
  };
  const createSpread = async () => {
    if (busy || !generateSpread) return;
    setSpreadWork('generatingSpread');
    onBusy(1);
    try {
      onChange({ spread: await generateSpread() });
      setSpreadWork('');
    } catch {
      setSpreadWork('spreadFailed');
    } finally {
      onBusy(-1);
    }
  };
  const insertMark = mark => {
    if (!editor) return;
    const caret = editor.selectionStart;
    edit(draft.text.slice(0, caret) + mark + draft.text.slice(editor.selectionEnd));
    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(caret + mark.length, caret + mark.length);
    });
  };
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="space-y-3">
        <div className="edition-scene" style={{ aspectRatio }}>
          {previewArt && <img src={previewArt} style={previewAnchor} className={wideSrc ? (isSecond ? 'edition-left-art' : 'edition-right-art') : ''} alt="" />}
          <div className={`edition-text-zone zone-${draft.zone}${framing?.panel === 'dark' ? ' panel-dark' : ''}`} dir={isHebrew ? 'rtl' : 'auto'}>{showText}</div>
        </div>
        <label className="block font-semibold" htmlFor="edition-zone">{labels.zone}</label>
        <select id="edition-zone" className={textClass} value={draft.zone} onChange={e => onChange({ zone: e.target.value })}>
          {TEXT_ZONES.map((zone, n) => <option key={zone} value={zone}>{labels.zones[n]}</option>)}
        </select>
        {isSecond ? <p className="text-sm text-sp-ink-600">{labels.spreadSecond}</p> : canPair &&
          <div>
            <label className="block font-semibold" htmlFor="edition-scene-layout">{labels.layout}</label>
            <select id="edition-scene-layout" className={textClass} disabled={busy} value={wantSpread ? 'spread' : 'single'} onChange={e => {
              const layout = e.target.value;
              onChange({ layout });
            }}>
              <option value="single">{labels.single}</option>
              <option value="spread">{labels.spread}</option>
            </select>
            {wantSpread && <div className="mt-2 space-y-2"><p className="text-sm text-sp-ink-600">{labels.spreadHint}</p>
              {generateSpread && <button className={actionClass} type="button" disabled={busy} onClick={createSpread}><Sparkles aria-hidden="true" size={17} />{labels.generateSpread}</button>}
              {spreadWork && <p className="text-sm text-sp-ink-600" role={spreadWork === 'spreadFailed' ? 'alert' : 'status'}>{labels[spreadWork]}</p>}
              <EditionArtField label={labels.imageInput} labels={labels} src={draft.spread} disabled={busy} spreadRatio={spreadRatio} onChange={spread => onChange({ spread })} onBusy={onBusy} /></div>}
          </div>}
      </div>
      <div className="min-w-0 space-y-3">
        {textInHebrew && <>
          <div role="status" className={`flex min-h-7 items-center gap-1.5 text-sm font-semibold ${approved ? 'text-green-800' : 'text-sp-ink-600'}`}>{approved && <Check aria-hidden="true" size={17} />}{approved ? labels.reviewed : labels.needsReview}</div>
          <label className="block font-semibold" htmlFor="edition-story-text">{labels.text}</label>
          <textarea ref={setEditor} id="edition-story-text" dir="rtl" aria-describedby="edition-story-text-hint" rows={5} value={draft.text} onChange={e => edit(e.target.value)} className={`edition-print-font ${textClass} leading-relaxed`} disabled={work === 'working'} />
          <div className="flex flex-wrap gap-1" dir="rtl">
            {markKeys.map((mark, n) => <button key={mark} type="button" className={`${actionClass} edition-print-font min-w-11 text-xl`} aria-label={markNames[n]} disabled={work === 'working'} onClick={() => insertMark(mark)}>{`◌${mark}`}</button>)}
          </div>
          <p id="edition-story-text-hint" className="text-sm leading-relaxed text-sp-ink-600">{labels.nikudChanged}</p>
          <button type="button" className={actionClass} onClick={suggest} disabled={work === 'working'}><AlignCenter aria-hidden="true" size={17} />{labels.nikud}</button>
          {work === 'working' && <p role="status" className="text-sm text-sp-ink-600">{labels.nikudWorking}</p>}
          {work === 'failed' && <p role="alert" className="text-sm text-sp-danger">{labels.nikudFailed}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={actionClass} disabled={work === 'working' || !canApproveNikud(draft)} onClick={() => onChange({ approval: { mode: 'approved', text: draft.text } })}>{labels.approve}</button>
            <button type="button" className={actionClass} disabled={work === 'working'} onClick={() => onChange({ text: draft.source, approval: { mode: 'unpointed', text: draft.source } })}>{labels.unpointed}</button>
          </div>
        </>}
      </div>
    </div>
  );
}
