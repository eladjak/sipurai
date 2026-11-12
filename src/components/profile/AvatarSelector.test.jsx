import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const createAvatarFromPhoto = vi.fn();
vi.mock('@/lib/photoToCharacter', async () => {
  const actual = await vi.importActual('@/lib/photoToCharacter');
  return { ...actual, createAvatarFromPhoto: (...a) => createAvatarFromPhoto(...a) };
});
vi.mock('@/integrations/Core', () => ({ GenerateImage: vi.fn(), UploadFile: vi.fn() }));
vi.mock('@/components/i18n/i18nProvider', () => ({
  useI18n: () => ({ t: (k) => k, isRTL: true, language: 'hebrew' }),
}));

import AvatarSelector from './AvatarSelector';

const photo = () => new File([new Uint8Array(1000)], 'kid.jpg', { type: 'image/jpeg' });
const DRAWING = { url: 'https://x/generated/drawing.png' };

beforeEach(() => {
  createAvatarFromPhoto.mockReset();
  createAvatarFromPhoto.mockResolvedValue(DRAWING);
});

describe('AvatarSelector: photo consent is asked just in time', () => {
  it('shows an unticked, labelled checkbox, and the chooser is disabled until it is ticked', () => {
    render(<AvatarSelector open onOpenChange={() => {}} currentAvatar="" onSelectAvatar={() => {}} />);
    const box = screen.getByRole('checkbox');
    expect(box.getAttribute('aria-checked')).toBe('false');
    expect(document.getElementById('avatar-photo-consent')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'avatar.upload.browse' }).disabled).toBe(true);
    expect(screen.getByTestId('photo-file-input').disabled).toBe(true);
    expect(screen.getByTestId('photo-note')).toBeTruthy();
  });

  it('a photo is not processed before the box is ticked (change and drop), and is after', async () => {
    const onSelectAvatar = vi.fn();
    render(<AvatarSelector open onOpenChange={() => {}} currentAvatar="" onSelectAvatar={onSelectAvatar} />);
    const input = screen.getByTestId('photo-file-input');
    fireEvent.change(input, { target: { files: [photo()] } });
    const zone = input.closest('.border-dashed');
    fireEvent.drop(zone, { dataTransfer: { files: [photo()] } });
    expect(createAvatarFromPhoto).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('button', { name: 'avatar.upload.browse' }).disabled).toBe(false);
    fireEvent.change(screen.getByTestId('photo-file-input'), { target: { files: [photo()] } });
    await waitFor(() => expect(createAvatarFromPhoto).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onSelectAvatar).toHaveBeenCalledWith(DRAWING.url));
  });

  it('the tick is not remembered: a fresh dialog starts unticked', () => {
    const first = render(<AvatarSelector open onOpenChange={() => {}} currentAvatar="" onSelectAvatar={() => {}} />);
    fireEvent.click(screen.getByRole('checkbox'));
    first.unmount();
    render(<AvatarSelector open onOpenChange={() => {}} currentAvatar="" onSelectAvatar={() => {}} />);
    expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('false');
  });
});
