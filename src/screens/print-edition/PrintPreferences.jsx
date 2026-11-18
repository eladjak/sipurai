import { useId } from 'react';
import { useI18n } from '@/components/i18n/i18nProvider';
import { BookOpen, Layers } from 'lucide-react';
import { editionDraft } from '@/lib/printEdition/model';
import useSubscription from '@/hooks/useSubscription';
import { configuredPrintEditionPolicy as policy, printEditionCapabilities } from '@/lib/printEdition/policy';
import { editionLabels, preferenceClass } from './labels';
import '@/styles/sp-tokens.css';

export const paperOptions = t => [
  ['standard', t('print.paperChoice.standard'), t('print.paperChoice.standardHint')],
  ['chrome-matte-130', t('print.paperChoice.matte130'), t('print.paperChoice.matte130Hint')],
  ['chrome-matte-170', t('print.paperChoice.matte170'), t('print.paperChoice.matte170Hint')],
];

export default function PrintPreferences({ value, onChange, isRTL, compact = false, allowUpgradedPaper = undefined }) {
  const props = { value, onChange, isRTL, compact };
  if (typeof allowUpgradedPaper === 'boolean') return <PreferenceControls {...props} allowUpgradedPaper={allowUpgradedPaper} />;
  if (policy === 'subscriber-preview') return <SubscribedPreferences {...props} />;
  return <PreferenceControls {...props} allowUpgradedPaper={printEditionCapabilities(policy).upgradedPaper} />;
}

function SubscribedPreferences(props) {
  const { plan } = useSubscription();
  return <PreferenceControls {...props} allowUpgradedPaper={printEditionCapabilities(policy, plan).upgradedPaper} />;
}

function PreferenceControls({ value, onChange, isRTL, compact = false, allowUpgradedPaper }) {
  const id = useId();
  const labels = editionLabels(isRTL);
  const { t } = useI18n();
  const edition = value || editionDraft();
  const options = [
    { field: 'cover', icon: BookOpen, items: [['softcover', labels.softcover], ['hardcover', t('print.paperChoice.hardSoon')]] },
    { field: 'paper', icon: Layers, items: paperOptions(t) },
  ];

  const controls = (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {options.map(({ field, icon: Icon, items }) => (
          <fieldset key={field} className="min-w-0">
            <legend className="mb-2 flex items-center gap-2 font-semibold text-sp-ink-900"><Icon aria-hidden="true" size={17} />{labels[field]}</legend>
            <div className="grid gap-2">
              {items.map(([option, name, hint]) => {
                const checked = edition[field] === option;
                const disabled = (field === 'cover' && option === 'hardcover') || (field === 'paper' && option !== 'standard' && !allowUpgradedPaper);
                const detail = field === 'paper' && option !== 'standard' && !allowUpgradedPaper ? t('print.paperChoice.unavailablePlan') : hint;
                return (
                  <label key={option} className={`min-h-11 ${disabled ? '' : 'cursor-pointer'} ${preferenceClass} flex items-start gap-3 focus-within:outline focus-within:outline-2 focus-within:outline-sp-violet-700 ${checked ? 'border-sp-violet-700 bg-sp-violet-50' : ''}`}>
                    <input className="mt-1.5 shrink-0 accent-sp-violet-700" type="radio" name={`${id}-${field}`} value={option} checked={checked} disabled={disabled} onChange={() => onChange({ ...edition, [field]: option })} />
                    <span aria-hidden="true" className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sp-violet-50 text-sp-violet-700"><Icon size={22} /></span>
                    <span><span className="block text-sm font-semibold">{name}</span>{detail && <span className="block text-xs leading-relaxed text-sp-ink-600">{detail}</span>}</span>
                  </label>
                );
              })}
            </div>
            {field === 'cover' && edition.cover === 'hardcover' && <p role="status" className="mt-2 text-sm">{t('print.paperChoice.legacyCover')}</p>}
            {field === 'paper' && edition.paper === 'premium' && <p role="status" className="mt-2 text-sm">{t('print.paperChoice.legacyPaper')}</p>}
          </fieldset>
        ))}
      </div>
      <p className="text-sm leading-relaxed text-sp-ink-600">{labels.choicesHint} {t('print.paperChoice.pricePending')}</p>
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
