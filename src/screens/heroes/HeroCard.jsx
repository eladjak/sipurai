import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@/components/i18n/i18nProvider';
export default function HeroCard({ hero }) {
  const { t } = useI18n();
  return <Link to={`/heroes/${encodeURIComponent(hero.id)}`} className="group flex min-h-32 items-center gap-5 rounded-sp-lg border border-sp-line bg-sp-card p-5 shadow-sp-1 transition-transform duration-150 hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sp-violet-600 motion-reduce:transform-none">
    {hero.primary_image_url ? <img src={hero.primary_image_url} alt="" className="h-20 w-20 shrink-0 rounded-sp-md object-cover" /> : <span aria-hidden="true" className="flex h-20 w-20 shrink-0 items-center justify-center rounded-sp-md bg-sp-violet-100 font-display text-3xl text-sp-violet-700">{hero.name?.trim().charAt(0)}</span>}
    <span className="min-w-0"><strong className="block break-words font-display text-sp-xl text-sp-ink-900">{hero.name}</strong>{hero.age != null && <span className="block text-sp-ink-600">{hero.age} {t('heroes.years')}</span>}<span className="mt-2 block text-sp-violet-700 underline">{t('heroes.edit')}</span></span>
  </Link>;
}
