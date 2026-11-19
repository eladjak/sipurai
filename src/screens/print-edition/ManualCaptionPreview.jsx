import { useRef, useState } from 'react';
import { MoveDiagonal } from 'lucide-react';
import { CAPTION_HEIGHT_MM, CAPTION_WIDTH_MM } from '@/lib/printEdition/captionStyle';
import { actionClass } from './labels';

const clamp = (value, min, max) => Math.min(max, Math.max(min, Math.round(value)));

export function ManualCaptionPreview({ art, wide, leafSide, zone, text, style, widthMm, heightMm, maxWidth,
  trim, labels, onResize, onReset }) {
  const surface = useRef(null);
  const gesture = useRef(null);
  const [dragSize, setDragSize] = useState(null);
  const size = dragSize || { width: widthMm, height: heightMm ?? CAPTION_HEIGHT_MM.initial };
  const top = zone.startsWith('top');
  const right = zone.endsWith('right');
  const left = zone.endsWith('left');
  const leftInset = 14 + (leafSide === 'right' ? 5 : 0);
  const rightBound = trim.widthMm - 14 - (leafSide === 'left' ? 5 : 0);
  const boxX = left ? leftInset : right ? rightBound - size.width : (leftInset + rightBound - size.width) / 2;
  const boxY = top ? 15 : trim.heightMm - 24 - size.height;
  const yPercent = mm => (100 * mm / trim.heightMm) + '%';
  const xPercent = mm => (100 * mm / trim.widthMm) + '%';
  const update = (event, start) => ({
    width: clamp(start.width + (event.clientX - start.x) * start.xFactor, CAPTION_WIDTH_MM.min, maxWidth),
    height: clamp(start.height + (event.clientY - start.y) * start.yFactor, CAPTION_HEIGHT_MM.min, CAPTION_HEIGHT_MM.max),
  });
  const stop = () => {
    gesture.current = null;
    setDragSize(null);
  };
  const backdrop = `${style.backdropColor}${Math.round(style.backdropOpacity * 255).toString(16).padStart(2, '0')}`;

  return (
    <div className="space-y-2">
      <p className="text-sm text-sp-ink-600">{labels.captionResizeHint}</p>
      <div ref={surface} className="relative overflow-hidden rounded-sp-sm bg-sp-violet-50"
        style={{ aspectRatio: `${trim.widthMm} / ${trim.heightMm}` }}>
        {art && <img src={art} alt="" draggable={false} className="pointer-events-none absolute top-0 h-full max-w-none object-cover" style={{
          width: wide ? '200%' : '100%',
          left: wide && leafSide === 'right' ? '-100%' : 0,
        }} />}
        <div data-caption-rectangle="" className="absolute rounded-sm border border-dashed border-[Highlight]"
          style={{ left: xPercent(boxX), top: yPercent(boxY), width: xPercent(size.width), height: yPercent(size.height),
            backgroundColor: backdrop, color: style.textColor }}>
          <div className="flex h-full items-center overflow-hidden px-1">
            <span className="line-clamp-4 w-full break-words text-right text-xs leading-tight" dir="auto">{text}</span>
          </div>
          <span data-caption-handle="" aria-hidden="true"
            className="absolute grid h-11 w-11 place-items-center touch-none select-none text-sp-ink-900"
            style={{
              [right ? 'left' : 'right']: 0, [top ? 'bottom' : 'top']: 0,
              cursor: top === right ? 'nesw-resize' : 'nwse-resize',
              WebkitUserSelect: 'none',
            }}
            onPointerDown={event => {
              if (event.button !== 0 || gesture.current || !surface.current) return;
              const bounds = surface.current.getBoundingClientRect();
              if (!bounds.width || !bounds.height) return;
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              gesture.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, ...size,
                xFactor: (right ? -1 : left ? 1 : 2) * trim.widthMm / bounds.width,
                yFactor: (top ? 1 : -1) * trim.heightMm / bounds.height };
            }}
            onPointerMove={event => {
              const start = gesture.current;
              if (start?.pointer === event.pointerId) setDragSize(update(event, start));
            }}
            onPointerUp={event => {
              const start = gesture.current;
              if (start?.pointer !== event.pointerId) return;
              const next = update(event, start);
              stop();
              if (next.width !== start.width || next.height !== start.height) onResize(next);
            }}
            onPointerCancel={event => { if (event.pointerId === gesture.current?.pointer) stop(); }}
            onLostPointerCapture={event => { if (event.pointerId === gesture.current?.pointer) stop(); }}>
            <span className="grid h-6 w-6 place-items-center rounded-full border border-sp-violet-700 bg-sp-card">
              <MoveDiagonal size={15} />
            </span>
          </span>
        </div>
      </div>
      <label className="block text-sm font-semibold" htmlFor="edition-caption-width">{labels.manualWidth}
        <input id="edition-caption-width" type="range" min={CAPTION_WIDTH_MM.min} max={maxWidth} value={widthMm}
          dir="ltr" className="block h-11 w-full accent-sp-violet-700" aria-valuetext={labels.captionMm(widthMm)}
          onChange={event => onResize({ width: event.target.valueAsNumber, height: size.height })} />
      </label>
      <label className="block text-sm font-semibold" htmlFor="edition-caption-height">{labels.panelHeight}
        <input id="edition-caption-height" type="range" min={CAPTION_HEIGHT_MM.min} max={CAPTION_HEIGHT_MM.max}
          value={heightMm ?? CAPTION_HEIGHT_MM.initial} dir="ltr" className="block h-11 w-full accent-sp-violet-700"
          aria-valuetext={labels.captionMm(heightMm ?? CAPTION_HEIGHT_MM.initial)}
          onChange={event => onResize({ width: widthMm, height: event.target.valueAsNumber })} />
      </label>
      {heightMm != null && <button type="button" className={actionClass} onClick={onReset}>{labels.captionAutoSize}</button>}
    </div>
  );
}
