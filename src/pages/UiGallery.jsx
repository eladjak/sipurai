import React from 'react';
import { BookOpen, Star } from 'lucide-react';
import { Button } from '@/components/ds/Button';
import { IconButton } from '@/components/ds/IconButton';
import { Card } from '@/components/ds/Card';
import { Chip } from '@/components/ds/Chip';
import { Field } from '@/components/ds/Field';
import { HelpTip } from '@/components/ds/HelpTip';
import { Sheet } from '@/components/ds/Sheet';
import { EmptyState } from '@/components/ds/EmptyState';
import { StepIndicator } from '@/components/ds/StepIndicator';
import { Notice } from '@/components/ds/Notice';
import { useDsToast } from '@/components/ds/Toast';
import { ToastProvider } from '@/components/ui/toast';
import { I18nProvider } from '@/components/i18n/i18nProvider';
import { Wordmark } from '@/components/brand/Wordmark';
import { LogoMark } from '@/components/brand/LogoMark';
import '@/styles/sp-fonts.css';
const states = {
  button: ['default', 'hover', 'focus', 'active', 'disabled', 'loading', 'magic', 'quiet', 'danger', 'on-night'],
  iconbutton: ['default', 'disabled'],
  card: ['paper', 'night', 'interactive'],
  chip: ['default', 'selected', 'cost', 'disabled'],
  field: ['default', 'error', 'textarea', 'disabled'],
  helptip: ['default'],
  sheet: ['default'],
  emptystate: ['empty'],
  stepindicator: ['default', 'compact'],
  notice: ['info', 'success', 'warning', 'danger'],
  toast: ['default'],
  wordmark: ['sm', 'md', 'lg'],
  logomark: ['default']
};
export const galleryBlocks = Object.entries(states).flatMap(([name, variants]) => variants.map(state => `${name}-${state}`));
const copy = {
  he: {
    title: 'גלריית רכיבים',
    intro: 'דוגמאות לרכיבי הממשק ולמצבים שלהם, בעברית ובאנגלית.',
    language: 'עברית',
    button: 'ממשיכים לסיפור',
    favorite: 'הוספה למועדפים',
    card: 'סיפור לפני השינה',
    chip: 'הרפתקה ביער',
    cost: 'סיפור אחד מהמתנה',
    label: 'שם הסיפור',
    hint: 'אפשר לבחור שם זמני ולשנות אותו אחר כך.',
    placeholder: 'למשל: המסע של נועה',
    error: 'כדאי להוסיף שם לסיפור.',
    help: 'הסבר: שם הסיפור',
    helpBody: 'השם יופיע על כריכת הספר. אפשר לשנות אותו בהמשך.',
    open: 'פתיחת חלונית',
    sheet: 'פרטי הסיפור',
    description: 'כאן אפשר לבדוק את פרטי הסיפור.',
    close: 'סגירה',
    empty: 'עדיין אין כאן סיפורים',
    emptyDetail: 'הסיפור הראשון שלכם מחכה להתחיל.',
    create: 'יצירת סיפור',
    steps: ['דמויות', 'סיפור', 'סיום'],
    progress: 'התקדמות ביצירה',
    notices: {
      info: ['מכינים את הסיפור', 'אפשר להמשיך בעוד רגע.'],
      success: ['הסיפור נשמר', 'אפשר לחזור אליו מהספרייה.'],
      warning: ['החיבור איטי', 'כדאי להמתין רגע.'],
      danger: ['לא הצלחנו לשמור', 'כדאי לנסות שוב.']
    },
    toast: 'הצגת הודעה',
    saved: 'הסיפור נשמר',
    undo: 'ביטול'
  },
  en: {
    language: 'English',
    button: 'Continue to story',
    favorite: 'Add to favorites',
    card: 'A bedtime story',
    chip: 'Forest adventure',
    cost: 'One gift story',
    label: 'Story title',
    hint: 'Choose a temporary title and change it later.',
    placeholder: 'For example: Noa’s journey',
    error: 'Please add a story title.',
    help: 'Help: story title',
    helpBody: 'The title appears on the book cover. You can change it later.',
    open: 'Open panel',
    sheet: 'Story details',
    description: 'Review the story details here.',
    close: 'Close',
    empty: 'No stories here yet',
    emptyDetail: 'Your first story is waiting to begin.',
    create: 'Create a story',
    steps: ['Characters', 'Story', 'Finish'],
    progress: 'Creation progress',
    notices: {
      info: ['Preparing the story', 'Please wait a moment.'],
      success: ['Story saved', 'Find it in your library.'],
      warning: ['Connection is slow', 'Please wait a moment.'],
      danger: ['Could not save', 'Please try again.']
    },
    toast: 'Show notification',
    saved: 'Story saved',
    undo: 'Undo'
  }
};
function Example({
  name,
  state,
  text,
  language
}) {
  const [checked, setChecked] = React.useState(state === 'selected');
  const {
    toast
  } = useDsToast();
  if (name === 'button') {
    const variant = {
      magic: 'magic',
      quiet: 'quiet',
      danger: 'danger',
      'on-night': 'onNight'
    }[state] || 'primary';
    const forced = {
      hover: 'bg-sp-violet-700',
      focus: 'outline outline-2 outline-offset-2 outline-sp-violet-600',
      active: 'scale-[0.98]'
    }[state];
    return <Button variant={variant} className={forced} disabled={state === 'disabled'} loading={state === 'loading'}>{text.button}</Button>;
  }
  if (name === 'iconbutton') return <IconButton label={text.favorite} disabled={state === 'disabled'}><Star aria-hidden="true" /></IconButton>;
  if (name === 'card') return <Card surface={state === 'night' ? 'night' : 'paper'} interactive={state === 'interactive'}>{text.card}</Card>;
  if (name === 'chip') return <Chip checked={checked} onClick={() => setChecked(!checked)} disabled={state === 'disabled'} cost={state === 'cost' ? text.cost : undefined}>{text.chip}</Chip>;
  if (name === 'field') return <Field label={text.label} hint={text.hint} placeholder={text.placeholder} error={state === 'error' ? text.error : undefined} multiline={state === 'textarea'} maxLength={state === 'textarea' ? 100 : undefined} disabled={state === 'disabled'} />;
  if (name === 'helptip') return <HelpTip className="" label={text.help} dir={language === 'he' ? 'rtl' : 'ltr'}>{text.helpBody}</HelpTip>;
  if (name === 'sheet') return <Sheet open={undefined} onOpenChange={undefined} trigger={<Button>{text.open}</Button>} title={text.sheet} description={text.description} closeLabel={text.close}><p>{text.description}</p></Sheet>;
  if (name === 'emptystate') return <EmptyState quietAction={undefined} illustration={<BookOpen aria-hidden="true" size={48} />} title={text.empty} description={text.emptyDetail} action={<Button>{text.create}</Button>} />;
  if (name === 'stepindicator') return <StepIndicator steps={text.steps} current={1} compact={state === 'compact'} label={text.progress} />;
  if (name === 'notice') return <Notice tone={state} title={text.notices[state][0]} action={text.notices[state][1]} />;
  if (name === 'toast') return <Button onClick={() => toast({
    description: text.saved,
    title: text.saved,
    undo: {
      label: text.undo,
      onClick: () => {}
    }
  })}>{text.toast}</Button>;
  if (name === 'wordmark') return <Wordmark language={language} size={state} />;
  return <LogoMark className="h-14 w-14" />;
}
export default function UiGallery() {
  return <I18nProvider><ToastProvider><main dir="rtl" lang="he" className="sp-shell min-h-screen bg-sp-paper p-4 font-sp-body text-sp-ink-900 sm:p-8">
    <header className="mx-auto mb-8 max-w-6xl"><h1 className="font-sp-display text-sp-3xl font-semibold">{copy.he.title}</h1><p>{copy.he.intro}</p></header>
    <div className="mx-auto grid max-w-6xl gap-5">{Object.entries(states).flatMap(([name, variants]) => variants.map(state => <section data-ux={`${name}-${state}`} key={`${name}-${state}`} className="rounded-sp-lg border border-sp-line bg-sp-card p-4 sm:p-6">
      <h2 dir="ltr" className="mb-4 text-start font-sp-display text-sp-xl font-semibold">{name} / {state}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{Object.entries(copy).map(([language, text]) => <div key={language} lang={language} dir={language === 'he' ? 'rtl' : 'ltr'} className={`min-w-0 rounded-sp-md p-4 ${state === 'on-night' ? 'bg-sp-night-800 text-sp-on-night' : 'bg-sp-paper text-sp-ink-900'}`}><h3 className="mb-3 font-semibold">{text.language}</h3><Example name={name} state={state} text={text} language={language} /></div>)}</div>
    </section>))}</div>
  </main></ToastProvider></I18nProvider>;
}
