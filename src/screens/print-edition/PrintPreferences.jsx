import { useId } from 'react';
import { BookOpen, Layers } from 'lucide-react';
import { editionDraft } from '@/lib/printEdition/model';
import { editionLabels, preferenceClass } from './labels';
import '@/styles/sp-tokens.css';

export default function PrintPreferences({ value, onChange, isRTL, compact = false }) {
  const id = useId();
  const labels = editionLabels(isRTL);
  const edition = value || editionDraft();
  const options = [
    { field: 'cover', icon: BookOpen, items: [['softcover', labels.softcover], ['hardcover', labels.hardcover, labels.hardcoverHint]] },
    { field: 'paper', icon: Layers, items: [['standard', labels.standardPaper], ['premium', labels.premiumPaper, labels.pending]] },
  ];

  const controls = (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {options.map(({ field, icon: Icon, items }) => (
          <fieldset key={field} className="min-w-0">
            <legend className="mb-2 flex items-center gap-2 font-semibold text-sp-ink-900"><Icon aria-hidden="true" size={17} />{labels[field]}</legend>
            <div className="grid gap-2">
              {items.map(([option, name, hint]) => (
                <label key={option} className={`min-h-11 cursor-pointer ${preferenceClass} flex items-start gap-3 focus-within:outline focus-within:outline-2 focus-within:outline-sp-violet-700 ${edition[field] === option ? 'border-sp-violet-700 bg-sp-violet-50' : ''}`}>
                  <input className="mt-1.5 shrink-0 accent-sp-violet-700" type="radio" name={`${id}-${field}`} value={option} checked={edition[field] === option} onChange={() => onChange({ ...edition, [field]: option })} />
                  <span><span className="block text-sm font-semibold">{name}</span>{hint && <span className="block text-xs leading-relaxed text-sp-ink-600">{hint}</span>}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <p className="text-sm leading-relaxed text-sp-ink-600">{labels.choicesHint}</p>
    </div>
  );
  if (!compact) return controls;
  return (
    <details className="sp-shell mt-6 rounded-sp-md border border-sp-line bg-sp-card px-4 text-sp-ink-900" dir={isRTL ? 'rtl' : 'ltr'}>
      <summary className="min-h-11 cursor-pointer py-3 font-semibold">{labels.beforeCreate}</summary>
      <div className="space-y-4 pb-4">
        <p className="text-sm text-sp-ink-600">{labels.beforeCreateHint}</p>
        {controls}
      </div>
    </details>
  );
}
