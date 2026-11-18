import { useId, useRef, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Crop, FileDown, Layers, Pencil, RotateCcw } from 'lucide-react';
import { proofEditTarget, proofLeaves } from './proof-viewer-model';
import './proof-viewer.css';

const COPY = {
  he: {
    heading: 'הגהת דפוס', unsaved: 'ההגהה כוללת שינויים שעדיין לא נשמרו.',
    cover: 'הכריכה מבחוץ', opening: 'פתיחת הספר', closing: 'סוף הספר',
    front: 'כריכה קדמית', back: 'כריכה אחורית', spine: 'שדרה', insideFront: 'צד פנימי קדמי', insideBack: 'צד פנימי אחורי',
    title: 'שער', dedication: 'הקדשה', copyright: 'קרדיט וזכויות', endpaper: 'עמוד רקע', story: 'סיפור', lastPage: 'עמוד הסיום',
    page: n => `עמוד ${n}`, pages: (first, second) => `עמודים \u2066${first}–${second}\u2069`,
    edit: name => `עריכה: ${name}`, editHelp: 'אפשר ללחוץ על עמוד או על צד של הכריכה כדי להגיע לעריכה.',
    pick: 'מעבר לכפולה', next: 'הבא', previous: 'הקודם', bleed: 'גלישה לחיתוך', paper: 'הדמיית גוון נייר',
    bleedHelp: 'הקו המקווקו מסמן את גבול החיתוך. השוליים שמעבר לו מיועדים לחיתוך.',
    screen: 'זו הדמיה למסך. צבע, חיתוך ומגע בודקים בעותק מודפס.',
    soft: 'ההגהה הראשית משתמשת בתבנית לכריכה רכה שמודפסת מבחוץ.',
    hard: 'כריכה קשה ממתינה לאישור הספק. ההגהה הראשית בתבנית לכריכה רכה שמודפסת מבחוץ.',
    premium: 'נייר משודרג ממתין לאישור הספק.',
    draftNikud: 'טיוטה: הניקוד ממתין לאישור.',
    blankInside: 'הצד הפנימי של הכריכה ריק בהגהה הראשית.',
    inside: 'הצגת צד פנימי מאויר',
    insideHelp: 'הצד המאויר שייך לקובץ כריכה נפרד וממתין לאישור הספק.',
    trim: 'מידה אחרי חיתוך', bleedMeasure: 'גלישה מכל צד', spineMeasure: 'שדרה', mm: 'מ״מ',
    interiorPdf: 'קובץ תוכן', coverPdf: 'קובץ כריכה', insidePdf: 'קובץ כריכה עם צד פנימי', retry: 'ניסיון נוסף', generate: 'הכנת הגהה',
    pending: 'עוד לא הוכנה הגהה. אפשר להכין אותה כדי לבדוק את הספר לפני הדפוס.',
    incomplete: 'אפשר להכין הגהת דפוס אחרי השלמת הספר והפרטים הדרושים.',
    loading: 'מכינים את קובצי ההגהה…', updating: 'מעדכנים את קובצי ההגהה…', stale: 'מעדכנים את קובצי ההגהה. בינתיים מוצגת הגרסה הקודמת.',
    error: 'לא הצלחנו להכין את ההגהה. אפשר לנסות שוב.',
    imageError: 'אחד מדפי ההגהה לא נטען.',
  },
  en: {
    heading: 'Print proof', unsaved: 'This proof includes unsaved changes.',
    cover: 'Outside cover', opening: 'Opening spread', closing: 'Closing spread',
    front: 'Front cover', back: 'Back cover', spine: 'Spine', insideFront: 'Inside front cover', insideBack: 'Inside back cover',
    title: 'Title page', dedication: 'Dedication', copyright: 'Credits and copyright', endpaper: 'Patterned page', story: 'Story', lastPage: 'Final page',
    page: n => `Page ${n}`, pages: (first, second) => `Pages ${first}–${second}`,
    edit: name => `Edit ${name}`, editHelp: 'Select a page or cover panel to edit it.',
    pick: 'Go to spread', next: 'Next', previous: 'Previous', bleed: 'Show bleed', paper: 'Simulate paper tone',
    bleedHelp: 'Dashed lines mark the trim. The area outside them is cut away.',
    screen: 'Screen preview. Check color, trim, and paper feel on a printed copy.',
    soft: 'The main proof uses a softcover template printed on the outside.',
    hard: 'Hardcover needs printer confirmation. The main proof uses a softcover template printed on the outside.',
    premium: 'Upgraded paper needs printer confirmation.',
    draftNikud: 'Draft: Hebrew vowel marks await approval.',
    blankInside: 'The inside cover is blank in the main proof.',
    inside: 'Show illustrated inside cover',
    insideHelp: 'The illustrated inside cover uses a separate cover PDF and needs printer confirmation.',
    trim: 'Trim size', bleedMeasure: 'Bleed per edge', spineMeasure: 'Spine', mm: 'mm',
    interiorPdf: 'Interior PDF', coverPdf: 'Cover PDF', insidePdf: 'Cover PDF with illustrated inside', retry: 'Try again', generate: 'Prepare proof',
    pending: 'Prepare a proof to review the book before printing.',
    incomplete: 'Complete the book and required details to prepare a print proof.',
    loading: 'Preparing the print proof…', updating: 'Updating the print proof…', stale: 'Updating the print proof. The previous version is on screen.',
    error: 'We couldn’t prepare the print proof. Try again.',
    imageError: 'A proof page couldn’t load.',
  },
};

const leafLabel = (leaf, t) => {
  const label = t[leaf.kind === 'closing' ? 'lastPage' : leaf.kind];
  if (!leaf.number) return label;
  return label ? `${t.page(leaf.number)} · ${label}` : t.page(leaf.number);
};
const spreadLabel = (spread, t) => spread.kind === 'pages'
  ? t.pages(spread.leaves[0].number, spread.leaves[1].number)
  : t[spread.kind];

function ProofLeaf({ leaf, text, showBleed, t, onEdit, onError }) {
  const textId = useId();
  const area = showBleed ? leaf.full : leaf.trim;
  const { media, trim } = leaf;
  const style = {
    flexGrow: area.width,
    aspectRatio: `${area.width} / ${area.height}`,
    '--proof-trim-top': `${(trim.y - area.y) / area.height * 100}%`,
    '--proof-trim-right': `${(area.x + area.width - trim.x - trim.width) / area.width * 100}%`,
    '--proof-trim-bottom': `${(area.y + area.height - trim.y - trim.height) / area.height * 100}%`,
    '--proof-trim-left': `${(trim.x - area.x) / area.width * 100}%`,
  };
  if (!leaf.url) return <div className="proof-leaf proof-leaf-unprinted" style={style} aria-hidden="true" />;
  const label = leafLabel(leaf, t);
  const target = onEdit && proofEditTarget(leaf);
  const image = (
    <img
      className="proof-raster"
      src={leaf.url}
      alt={target ? '' : [label, text].filter(Boolean).join('. ')}
      draggable={false}
      decoding="async"
      onError={onError}
      style={{
        width: `${media.width / area.width * 100}%`,
        height: `${media.height / area.height * 100}%`,
        left: `${-area.x / area.width * 100}%`,
        top: `${-area.y / area.height * 100}%`,
      }}
    />
  );

  if (!target) return <div className="proof-leaf" data-proof-leaf={leaf.kind} style={style}>{image}</div>;
  return (
    <button
      className="proof-leaf proof-leaf-edit"
      data-proof-leaf={leaf.kind}
      style={style}
      type="button"
      aria-label={t.edit(label)}
      aria-describedby={text ? textId : undefined}
      onClick={() => onEdit(target)}
    >
      {image}
      {text && <span className="sr-only" id={textId} dir="auto">{text}</span>}
      <span className="proof-leaf-pencil" aria-hidden="true"><Pencil size={15} /></span>
    </button>
  );
}

function ProofFrame({ spread, coverText, showBleed, paperTone, onEdit, onRetry, t }) {
  const [imageError, setImageError] = useState(false);
  const cover = spread.kind === 'cover';
  return (
    <div className="proof-frame">
      {imageError ? (
        <div className="proof-placeholder">
          <p role="alert">{t.imageError}</p>
          <button type="button" className="proof-control" onClick={() => { setImageError(false); onRetry?.(); }}>
            <RotateCcw aria-hidden="true" size={16} />{t.retry}
          </button>
        </div>
      ) : (
        <div
          className="proof-spread"
          dir={cover ? 'ltr' : 'rtl'}
          data-spread={spread.kind}
          data-bleed={showBleed}
          data-paper={paperTone}
        >
          {spread.leaves.map(leaf => (
            <ProofLeaf
              key={leaf.number || leaf.kind}
              leaf={leaf}
              text={leaf.text || coverText?.[leaf.kind]}
              showBleed={showBleed}
              onEdit={onEdit}
              onError={() => setImageError(true)}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ProofViewer({ proof, status = 'pending', error = null, onRetry, onEdit, onDownload = null, isRTL, cover, paper }) {
  const id = useId();
  const navRef = useRef(null);
  const touch = useRef(null);
  const suppressTouchClickUntil = useRef(0);
  const [{ index, turn }, setPage] = useState({ index: 0, turn: null });
  const [showBleed, setShowBleed] = useState(false);
  const [simulatePaper, setSimulatePaper] = useState(false);
  const [inspectInside, setInspectInside] = useState(false);
  const t = isRTL ? COPY.he : COPY.en;
  const spreads = status === 'ready' || status === 'updating'
    ? proofLeaves(inspectInside ? proof : { ...proof, insideUrl: null })
    : null;
  const last = spreads ? spreads.length - 1 : 0;
  const shown = Math.min(index, last);
  const spread = spreads?.[shown];
  const isEndSpread = spread?.kind === 'opening' || spread?.kind === 'closing';
  const insideAvailable = Boolean(proof?.insideUrl);
  const insideShown = isEndSpread && inspectInside && insideAvailable;
  const show = next => {
    if (next >= 0 && next <= last && next !== shown) {
      setPage({ index: next, turn: next > shown ? 'forward' : 'backward' });
    }
  };
  const move = delta => show(shown + delta);
  const onTouchStart = event => {
    if (event.pointerType !== 'touch') return;
    if (!event.isPrimary) {
      touch.current = null;
      return;
    }
    touch.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    suppressTouchClickUntil.current = 0;
  };
  const onTouchEnd = event => {
    const gesture = touch.current;
    touch.current = null;
    if (!gesture || event.pointerId !== gesture.id) return;
    const horizontal = event.clientX - gesture.x;
    const vertical = event.clientY - gesture.y;
    if (Math.abs(horizontal) < 44 || Math.abs(horizontal) <= Math.abs(vertical) * 1.4) return;
    // Pull the left-hand leaf to the right to turn forward in a Hebrew book.
    suppressTouchClickUntil.current = performance.now() + 450;
    move(horizontal > 0 ? 1 : -1);
  };
  const suppressSwipeClick = event => {
    if (event.detail === 0 || performance.now() >= suppressTouchClickUntil.current) return;
    event.preventDefault();
    event.stopPropagation();
  };
  const state = status === 'ready' && !spread ? 'error' : status;
  const canRetry = onRetry && (state === 'error' || state === 'pending');
  const canEdit = state === 'ready' ? onEdit : undefined;
  const onKeyDown = event => {
    if (!spread || event.target.closest('select') || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (!event.target.closest('.proof-nav, .proof-leaf-edit') || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    // Keep the direction of the printed Hebrew book in both interface languages.
    const delta = event.key === 'ArrowLeft' ? 1 : -1;
    if (shown + delta < 0 || shown + delta > last) return;
    if (event.target.classList.contains('proof-leaf-edit')) navRef.current?.focus();
    move(delta);
  };

  return (
    <section className="proof-viewer" id="edition-proof" tabIndex={-1} dir={isRTL ? 'rtl' : 'ltr'} aria-labelledby={`${id}-heading`} onKeyDown={onKeyDown}>
      <header className="proof-header">
        <h2 id={`${id}-heading`}><BookOpen aria-hidden="true" size={23} />{t.heading}</h2>
        {spread && (
          <>
            <p>{cover === 'hardcover' ? t.hard : t.soft} {paper === 'premium' ? t.premium : ''}</p>
            {proof.unsavedDraft && <p className="proof-draft" role="status">{t.unsaved}</p>}
            {proof.nikudStatus === 'pending' && <p className="proof-draft" role="status">{t.draftNikud}</p>}
            <dl className="proof-measures">
              {[
                [t.trim, `${proof.trimWidthMm} × ${proof.trimHeightMm}`],
                [t.bleedMeasure, proof.bleedMm],
                [t.spineMeasure, proof.spineMm],
              ].map(([label, value]) => (
                <div key={label}><dt>{label}</dt><dd><bdi dir="ltr">{value}</bdi> {t.mm}</dd></div>
              ))}
            </dl>
          </>
        )}
      </header>

      {!spread ? (
        <div className="proof-placeholder">
          <p role={state === 'error' ? 'alert' : 'status'}>{t[state] || (error ? t.error : t.pending)}</p>
          {canRetry && (
            <button type="button" className="proof-control" onClick={onRetry}>
              {state === 'pending' ? <BookOpen aria-hidden="true" size={16} /> : <RotateCcw aria-hidden="true" size={16} />}
              {state === 'pending' ? t.generate : t.retry}
            </button>
          )}
        </div>
      ) : (
        <>
          {state === 'updating' && <p className="proof-update" role="status">{t.stale}</p>}
          <div className="proof-nav" ref={navRef} dir="rtl" role="group" tabIndex={-1} aria-label={t.pick}>
            <button className="proof-control proof-turn" type="button" aria-disabled={shown === 0} aria-controls={`${id}-stage`} onClick={() => move(-1)}>
              <ChevronRight aria-hidden="true" size={17} /><span dir={isRTL ? 'rtl' : 'ltr'}>{t.previous}</span>
            </button>
            <select className="proof-control proof-select" dir={isRTL ? 'rtl' : 'ltr'} value={shown} aria-label={t.pick} aria-controls={`${id}-stage`} onChange={event => show(Number(event.target.value))}>
              {spreads.map((item, index) => <option key={index} value={index}>{spreadLabel(item, t)}</option>)}
            </select>
            <button className="proof-control proof-turn" type="button" aria-disabled={shown === last} aria-controls={`${id}-stage`} onClick={() => move(1)}>
              <span dir={isRTL ? 'rtl' : 'ltr'}>{t.next}</span><ChevronLeft aria-hidden="true" size={17} />
            </button>
          </div>

          <figure className="proof-figure">
            <div
              className="proof-stage"
              id={`${id}-stage`}
              onPointerDown={onTouchStart}
              onPointerUp={onTouchEnd}
              onPointerCancel={() => { touch.current = null; }}
              onClickCapture={suppressSwipeClick}
            >
              <div key={shown} className="proof-page-turn" data-turn={turn}>
                <ProofFrame
                  key={spread.leaves.map(leaf => leaf.url).join('|')}
                  spread={spread}
                  coverText={proof.coverText}
                  showBleed={showBleed}
                  paperTone={simulatePaper ? paper || 'standard' : 'off'}
                  onEdit={canEdit}
                  onRetry={onRetry}
                  t={t}
                />
              </div>
            </div>
            <figcaption className="proof-caption">
              <span className="sr-only" role="status">{spreadLabel(spread, t)}</span>
              {spread.kind === 'cover' && <div className="proof-cover-key" dir="ltr" aria-hidden="true">
                <span dir="auto">{t.front}</span><span dir="auto">{proof.spineMm > 0 ? t.spine : null}</span><span dir="auto">{t.back}</span>
              </div>}
              <div className="proof-caption-copy">
                {isEndSpread && <p>{insideShown ? t.insideHelp : t.blankInside}</p>}
                {canEdit && <p>{t.editHelp}</p>}
              </div>
            </figcaption>
          </figure>

          <div className="proof-tools">
            <div className="proof-toggles">
              {proof.bleedMm > 0 && (
                <button type="button" className="proof-control" aria-pressed={showBleed} aria-controls={`${id}-stage`} onClick={() => setShowBleed(value => !value)}>
                  <Crop aria-hidden="true" size={17} />{t.bleed}
                </button>
              )}
              <button type="button" className="proof-control" aria-pressed={simulatePaper} aria-controls={`${id}-stage`} onClick={() => setSimulatePaper(value => !value)}>
                <Layers aria-hidden="true" size={17} />{t.paper}
              </button>
              {isEndSpread && insideAvailable && (
                <button type="button" className="proof-control" aria-pressed={insideShown} aria-controls={`${id}-stage`} onClick={() => setInspectInside(value => !value)}>
                  <BookOpen aria-hidden="true" size={17} />{t.inside}
                </button>
              )}
            </div>
            {state === 'ready' && proof.pdfs && (
              <div className="proof-downloads">
                {[
                  ['interior', t.interiorPdf],
                  ['cover', t.coverPdf],
                  ...(insideShown ? [['inside', t.insidePdf]] : []),
                ].map(([key, label]) => {
                  const file = proof.pdfs[key];
                  if (!file) return null;
                  const contents = <><FileDown aria-hidden="true" size={16} />{label}</>;
                  if (onDownload) return <button key={key} type="button" className="proof-control" onClick={() => onDownload(key)}>{contents}</button>;
                  return typeof file === 'string'
                    ? <a key={key} className="proof-control" href={file} download={key === 'inside' ? 'cover-with-inside.pdf' : `${key}.pdf`}>{contents}</a>
                    : null;
                })}
              </div>
            )}
          </div>
          <div className="proof-hints">
            {showBleed && <p role="status">{t.bleedHelp}</p>}
            <p>{t.screen}</p>
          </div>
        </>
      )}
    </section>
  );
}

export default ProofViewer;
