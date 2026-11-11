import { useI18n } from '@/components/i18n/i18nProvider';
import { useHeroes } from '@/screens/heroes/useHeroes';
import { StepIndicator } from '@/components/ds/StepIndicator';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import HeroStep from './HeroStep';
import TopicStep from './TopicStep';
import ReadyStep from './ReadyStep';
import StartStates from './StartStates';
import { useNewStory } from './useNewStory';
export default function NewStory() {
 const { t, language } = useI18n(); const heroes = useHeroes(); const flow = useNewStory(language, t('newStory.leave'));
 const NextIcon = language === 'hebrew' ? ArrowLeft : ArrowRight; const BackIcon = language === 'hebrew' ? ArrowRight : ArrowLeft;
 const button = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-sp-sm px-6 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sp-violet-600 active:scale-[.99] motion-reduce:transform-none';
 return <main className="mx-auto max-w-3xl px-4 py-8 text-sp-ink-900 sm:px-8 sm:py-12"><h1 className="font-sp-display text-sp-3xl font-semibold">{t('newStory.title')}</h1>{flow.state ? <div className="mt-8"><StartStates state={flow.state} t={t} retry={flow.start} bookId={flow.bookId}/></div> : <><div className="my-8"><StepIndicator steps={[t('newStory.steps0'),t('newStory.steps1'),t('newStory.steps2')]} current={flow.step} label={t('newStory.title')}/></div><div className="rounded-sp-lg border border-sp-line bg-sp-card p-5 shadow-sp-1 sm:p-8">{flow.step === 0 && <HeroStep data={heroes} selected={flow.hero} select={flow.setHero} t={t}/>} {flow.step === 1 && <TopicStep value={flow.topic} change={flow.setTopic} t={t}/>} {flow.step === 2 && <ReadyStep {...flow} t={t}/>} {flow.invalid && <p role="alert" className="mt-4 text-sp-danger">{t('newStory.invalid')}</p>}<div className="mt-8 flex flex-wrap justify-between gap-3">{flow.step > 0 && <button type="button" className={`${button} border border-sp-line hover:bg-sp-violet-50`} onClick={() => flow.setStep(flow.step - 1)}><BackIcon size={18} aria-hidden="true"/>{t('newStory.back')}</button>}<button type="button" disabled={flow.step === 0 ? !flow.hero : flow.step === 1 ? !flow.topic.trim() : false} className={`${button} ms-auto bg-sp-violet-700 text-white hover:bg-sp-violet-600 disabled:opacity-50`} onClick={() => flow.step < 2 ? flow.setStep(flow.step + 1) : flow.start()}>{flow.step === 2 ? <Sparkles size={18} aria-hidden="true"/> : null}{flow.step === 2 ? t('newStory.start') : t('newStory.next')}{flow.step < 2 && <NextIcon size={18} aria-hidden="true"/>}</button></div></div></>}</main>;
}
