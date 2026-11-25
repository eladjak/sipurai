import FamilyHome from '@/components/home/FamilyHome';
import InstallPrompt from '@/components/shared/InstallPrompt';

export default function Tonight() {
  return (
    <>
      <FamilyHome createUrl="/new" shelfUrl="/shelf" />
      <InstallPrompt />
    </>
  );
}
