import DeleteAccountCard from './DeleteAccountCard';
import { ACCOUNT_DELETE_UI, CONTACT_EMAIL } from '@/data/privacyPolicyContent';

const NOTE = {
  he: ['למחיקת החשבון והנתונים (הילדים, הספרים והתמונות) כתבו ל-', '. נמחק ונענה תוך 30 יום.'],
  en: ['To delete your account and data (children, books and images), write to ', '. We will delete and answer within 30 days.'],
};

/**
 * Account deletion by button stays OFF (VITE_ACCOUNT_DELETE_ENABLED) until it is fully tested.
 * While it is off the parent still gets a clear way out: an email address, never a dead end.
 */
export default function AccountDataControls({ language = 'hebrew', isRTL = true, enabled = ACCOUNT_DELETE_UI, onDeleted }) {
  if (enabled) return <DeleteAccountCard language={language} isRTL={isRTL} onDeleted={onDeleted} />;
  const lang = language === 'english' ? 'en' : 'he';
  return (
    <p className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm leading-relaxed text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300" dir={isRTL ? 'rtl' : 'ltr'} data-testid="delete-by-email">
      {NOTE[lang][0]}
      <bdi dir="ltr">{CONTACT_EMAIL}</bdi>
      {NOTE[lang][1]}
    </p>
  );
}
