import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useI18n } from '@/components/i18n/i18nProvider';
import { useHeroes } from './useHeroes';
import HeroCard from './HeroCard';
const action = 'inline-flex min-h-12 items-center justify-center rounded-sp-sm bg-sp-violet-600 px-5 font-semibold text-white hover:bg-sp-violet-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sp-violet-600';
export default function Heroes() {
  const { t } = useI18n(); const { heroes, loading, error, offline, retry } = useHeroes();
  return <main className="mx-auto max-w-6xl px-4 py-8 text-sp-ink-900 md:px-8"><header className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><h1 className="font-display text-sp-3xl font-semibold">{t('heroes.title')}</h1><p className="mt-2 text-sp-ink-600">{t('heroes.intro')}</p></div>{!loading && !error && !offline && heroes.length > 0 && <Link className={action} to="/heroes/new">{t('heroes.new')}</Link>}</header>
    {offline ? <p role="status">{t('heroes.offline')}</p> : loading ? <p role="status">{t('heroes.loading')}</p> : error ? <div role="alert"><p>{t('heroes.error')}</p><button className={`${action} mt-4`} onClick={retry}>{t('heroes.retry')}</button></div> : heroes.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{heroes.map(hero => <HeroCard key={hero.id} hero={hero} />)}</div> : <section className="rounded-sp-lg border border-sp-line bg-sp-card p-8 text-center shadow-sp-1"><Sparkles aria-hidden="true" className="mx-auto mb-4 h-12 w-12 text-sp-violet-600"/><h2 className="font-display text-sp-2xl">{t('heroes.empty')}</h2><p className="mb-6 mt-2 text-sp-ink-600">{t('heroes.emptyHint')}</p><Link className={action} to="/heroes/new">{t('heroes.new')}</Link></section>}
  </main>;
}
