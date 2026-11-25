import FamilyHome from '@/components/home/FamilyHome';
import { createPageUrl } from '@/utils';

export default function Home() {
  return <FamilyHome awardFirstLogin createUrl={createPageUrl('BookWizard')} shelfUrl={createPageUrl('Library')} />;
}
