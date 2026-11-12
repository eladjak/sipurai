import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useHeroes } from '@/screens/heroes/useHeroes';
import { useShelf } from '@/screens/shelf/useShelf';
import { suggestions } from '@/lib/suggestions/rules';

function Ideas({ t, onChoose, data, night }) {
  const heroData = useHeroes();
  const shelfData = useShelf();
  const { heroes } = heroData;
  const { books } = shelfData;
  if (heroData.loading || shelfData.loading || heroData.error || shelfData.error) return null;
  const items = suggestions({ heroes, books, ...data, t });
  if (!items.length) return null;
  return <><p className="mt-2 text-sm">{t('suggestions.hint')}</p><div className="mt-3 flex flex-wrap gap-2">{items.map(item => <button type="button" key={item.id} onClick={() => onChoose(item.action)} className={`min-h-11 rounded-sp-md border px-4 py-2 text-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[.99] motion-reduce:transform-none ${night ? 'border-sp-on-night-muted text-sp-on-night hover:bg-sp-night-700' : 'border-sp-line bg-sp-card text-sp-ink-900 hover:bg-sp-violet-50'}`}><span className="block font-semibold">{item.text}</span><span className="block text-sm">{item.costLabel}</span></button>)}</div></>;
}
export default function SuggestionChips({ t, onChoose, data, night = false }) {
  const [enabled, setEnabled] = useState(() => { try { return localStorage.getItem('sipurai_suggestions') !== 'off'; } catch { return true; } });
  const toggle = () => { const next = !enabled; setEnabled(next); try { localStorage.setItem('sipurai_suggestions', next ? 'on' : 'off'); } catch { /* available for this visit */ } };
  return <section className="mt-6" aria-label={t('suggestions.label')}><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-sp-display text-sp-xl font-semibold"><Sparkles size={20} aria-hidden="true"/>{t('suggestions.title')}</h2><button type="button" role="switch" aria-checked={enabled} onClick={toggle} className="min-h-11 rounded-sp-pill border border-current px-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[.99] motion-reduce:transform-none">{t('suggestions.label')} {enabled ? '✓' : '○'}</button></div>{enabled && <Ideas t={t} onChoose={onChoose} data={data} night={night}/>}</section>;
}
