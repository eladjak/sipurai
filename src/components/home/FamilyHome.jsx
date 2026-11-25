import { lazy, Suspense, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowLeft, BookOpen, Feather, Moon, Settings2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n } from '@/components/i18n/i18nProvider';
import demoBooks from '@/data/demoBooks';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { createPageUrl } from '@/utils';
import DailyPromptCard from './DailyPromptCard';
import { homeIdea } from './homeIdeas';
import { useFirstLoginReward } from './useFirstLoginReward';
import { useHomeBooks } from './useHomeBooks';
import './family-home.css';

const OnboardingWizard = lazy(() => import('@/components/onboarding/OnboardingWizard'));

function Cover({ src }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="family-home__cover" aria-hidden="true">
      {src && !failed
        ? <img src={src} alt="" onError={() => setFailed(true)} />
        : <BookOpen size={52} strokeWidth={1.2} />}
    </div>
  );
}

function Preferences({ user, onSaved, t }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="family-home__action family-home__quiet family-home__preferences-trigger">
        <Settings2 size={16} aria-hidden="true" />{t('spxLibrary.preferences')}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/65" />
        <Dialog.Content aria-describedby={undefined} className="family-home-preferences">
          <Dialog.Title className="sr-only">{t('spxLibrary.preferences')}</Dialog.Title>
          <Suspense fallback={<div className="rounded-xl bg-background p-6" role="status">{t('common.loading')}</div>}>
            <OnboardingWizard
              embedded
              ownerId={user.id}
              userName={user.display_name || user.full_name || ''}
              initialAge={user.preferred_age_range || ''}
              initialTopics={Array.isArray(user.favorite_topics) ? user.favorite_topics : []}
              onComplete={updated => { onSaved(updated); close(); }}
              onCancel={close}
            />
          </Suspense>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function progressCopy(book, detail, t) {
  if (book.status === 'partial') {
    if (!detail) return t('tonight.partialUnknown');
    if (!detail.ready) return t('tonight.partialNone');
    const counts = { ready: detail.ready, total: detail.total };
    return detail.missingImage.length ? t('tonight.partialArt', counts) : t('tonight.partialReady', counts);
  }
  if (book.status === 'failed') return t('tonight.failed');
  if (book.status === 'generating') return t('tonight.generating');
  return t('tonight.draft');
}

function openBook(book) {
  const read = ['complete', 'partial', 'generating', 'failed'].includes(book.status);
  return `${createPageUrl(read ? 'BookView' : 'BookCreation')}?id=${encodeURIComponent(book.id)}`;
}

function ProgressBooks({ books, details, t }) {
  return (
    <section className="family-home__progress" aria-labelledby="home-progress-title">
      <h2 id="home-progress-title">{t('tonight.workTitle')}</h2>
      <ul>
        {books.map(book => (
          <li key={book.id}>
            <Link to={openBook(book)}>
              <Cover key={book.cover_image} src={book.cover_image} />
              <span className="min-w-0">
                <strong dir="auto">{book.title || t('tonight.untitled')}</strong>
                <span>{progressCopy(book, details(book), t)}</span>
              </span>
              <ArrowLeft size={20} aria-hidden="true" className="family-home__arrow" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MoreBooks({ books, t }) {
  return (
    <section className="family-home__more" aria-labelledby="home-more-title">
      <h2 id="home-more-title">{t('tonight.moreBooks')}</h2>
      <ul>
        {books.map(book => (
          <li key={book.id}>
            <Link to={openBook(book)}>
              <Cover key={book.cover_image} src={book.cover_image} />
              <span dir="auto">{book.title || t('tonight.untitled')}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SampleShelf({ language, t }) {
  const english = language === 'english' || language === 'en';
  return (
    <section className="family-home__samples" aria-labelledby="home-samples-title">
      <h2 id="home-samples-title">{t('tonight.sampleTitle')}</h2>
      <ul>
        {demoBooks.map(book => (
          <li key={book.id}>
            <Link to={`/samples/${book.id}`}>
              <span className="family-home__sample-book" aria-hidden="true">
                <img src={book.cover_image} alt="" loading="lazy" />
              </span>
              <span>{english ? book.title.en : book.title.he}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FamilyHomeSession({ user, identityReady, createUrl, shelfUrl, awardFirstLogin, showMoreBooks }) {
  const { language, isRTL, t } = useI18n();
  const { featured, moreBooks, inProgress, loading, error, offline, retry, empty, details } = useHomeBooks(identityReady);
  useFirstLoginReward(awardFirstLogin && !loading && !error && !offline ? user?.id : undefined);
  const [savedProfile, setSavedProfile] = useState(null);
  const profile = savedProfile?.updated && savedProfile.base === user ? savedProfile.updated : user;
  const name = (profile?.display_name || profile?.full_name)?.trim();
  const featuredDetail = featured && details(featured);
  const featuredAction = featuredDetail?.page
    ? t('tonight.continue', { page: featuredDetail.page })
    : featured?.status === 'partial' && featuredDetail?.ready === 0 ? t('tonight.recover') : t('tonight.openBook');
  const problem = offline || error;
  const waiting = loading && !problem;
  const title = featured
    ? featured.title || t('tonight.untitled')
    : problem || waiting || empty ? t('tonight.firstTitle') : t('tonight.title');

  return (
    <div className="family-home" dir={isRTL ? 'rtl' : 'ltr'}>
      <section className="family-home__scene" aria-labelledby="home-title">
        <div className="family-home__art" aria-hidden="true">
          {waiting ? <div className="family-home__cover family-home__cover--waiting"><BookOpen size={52} strokeWidth={1.2} /></div>
            : featured && <Cover key={`${featured.id}:${featured.cover_image}`} src={featured.cover_image} />}
        </div>
        <div className="family-home__scene-copy">
          {featured
            ? <p className="family-home__greeting"><Moon size={17} aria-hidden="true" />{featured.status === 'complete' ? t('tonight.latestBook') : t('tonight.familyBook')}</p>
            : name && <p className="family-home__greeting"><Moon size={17} aria-hidden="true" />{t('tonight.greetingName', { name })}</p>}
          <h1 id="home-title" dir={featured ? 'auto' : undefined}>{title}</h1>
          {problem && <p role={offline ? 'status' : 'alert'}>{offline ? t('tonight.offline') : t('tonight.error')}</p>}
          {waiting && <p role="status">{t('tonight.loading')}</p>}
          {featured?.status === 'partial' && <p>{progressCopy(featured, featuredDetail, t)}</p>}
          <div className="family-home__actions">
            {problem && !offline && <button type="button" onClick={retry} className="family-home__action family-home__primary">{t('tonight.retry')}</button>}
            {featured && <Link to={openBook(featured)} className="family-home__action family-home__primary">
              <BookOpen size={19} aria-hidden="true" />{featuredAction}
            </Link>}
            {identityReady && <Link to={createUrl} className={`family-home__action ${featured || error ? 'family-home__quiet' : 'family-home__primary'}`}>
              <Feather size={18} aria-hidden="true" />{empty ? t('tonight.firstAction') : t('tonight.newStory')}
            </Link>}
            {identityReady && !empty && <Link to={shelfUrl} className="family-home__action family-home__quiet">{t('tonight.allBooks')}</Link>}
          </div>
          {identityReady && <Preferences user={profile} onSaved={updated => setSavedProfile({ base: user, updated })} t={t} />}
        </div>
      </section>

      {showMoreBooks && moreBooks.length > 0 && <MoreBooks books={moreBooks} t={t} />}
      {inProgress.length > 0 && <ProgressBooks books={inProgress} details={details} t={t} />}

      <div className="family-home__extras">
        <SampleShelf language={language} t={t} />
        {identityReady && <DailyPromptCard dailyPrompt={homeIdea(profile.favorite_topics, language)} createUrl={createUrl} />}
      </div>

    </div>
  );
}

export default function FamilyHome({ createUrl, shelfUrl, awardFirstLogin = false, showMoreBooks = false }) {
  const { user, isLoading } = useCurrentUser();
  const identityReady = !isLoading && Boolean(user?.id);
  return (
    <FamilyHomeSession
      key={identityReady ? user.id : undefined}
      user={identityReady ? user : null}
      identityReady={identityReady}
      createUrl={createUrl}
      shelfUrl={shelfUrl}
      awardFirstLogin={awardFirstLogin}
      showMoreBooks={showMoreBooks}
    />
  );
}
