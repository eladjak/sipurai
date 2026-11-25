import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { isNewShell } from '@/lib/flags';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useI18n } from '@/components/i18n/i18nProvider';

export default function DailyPromptCard({ dailyPrompt, createUrl = isNewShell() ? '/new' : createPageUrl('BookWizard') }) {
  const { t } = useI18n();
  const { user } = useCurrentUser();
  const { title, description, image } = dailyPrompt;

  function saveIdea() {
    if (!user?.id) return;
    try {
      sessionStorage.setItem('sipurai_pending_idea', JSON.stringify({
        title, description, ownerId: user.id, source: 'daily_prompt',
      }));
    } catch {
      /* Navigation is still available when session storage is disabled. */
    }
  }

  return (
    <section className="family-home__idea" aria-labelledby="home-idea-title">
      {image && <img src={image} loading="lazy" alt="" className="family-home__idea-art" />}
      <div className="family-home__idea-copy">
        <p><Sparkles size={15} aria-hidden="true" />{t('tonight.ideaTitle')}</p>
        <h2 id="home-idea-title">{title}</h2>
        <p>{description}</p>
        <Link className="family-home__action" to={createUrl} onClick={saveIdea}>
          {t('home.dailyPrompt.createFromIdea')}
        </Link>
      </div>
    </section>
  );
}
