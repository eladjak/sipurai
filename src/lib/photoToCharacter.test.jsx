import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Spies on EVERY way a file can reach storage. The photo must reach none of them.
const UploadFile = vi.fn(async () => ({ file_url: 'https://x/storage/v1/object/public/sipurai-images/uploads/ORIGINAL.png' }));
const GenerateImage = vi.fn();
const uploadFileToSupabase = vi.fn();
vi.mock('@/integrations/Core', () => ({ GenerateImage: (...a) => GenerateImage(...a), UploadFile: (...a) => UploadFile(...a) }));
vi.mock('@/lib/supabaseClient', () => ({ uploadFileToSupabase: (...a) => uploadFileToSupabase(...a), supabase: {} }));
vi.mock('@/components/i18n/i18nProvider', () => ({
  useI18n: () => ({ t: (k) => k, isRTL: true, language: 'hebrew' }),
}));

import { createAvatarFromPhoto, photoNote, PhotoError, buildPhotoPrompt } from './photoToCharacter';
import AvatarSelector from '@/components/profile/AvatarSelector';

const photo = (over = {}) => new File([new Uint8Array(1000)], 'kid.jpg', { type: 'image/jpeg', ...over });
const DRAWING = { url: 'https://x/storage/v1/object/public/sipurai-images/generated/drawing.png', base64: 'RFJBV0lORw==' };

beforeEach(() => {
  UploadFile.mockClear();
  GenerateImage.mockReset();
  uploadFileToSupabase.mockClear();
  // jsdom has no image decoding: stand in for the browser
  globalThis.createImageBitmap = vi.fn(async () => ({ width: 1000, height: 800, close() {} }));
  HTMLCanvasElement.prototype.getContext = () => ({ drawImage() {} });
  HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,UEhPVE8=';
});

describe('photo to character: the original photo is never stored', () => {
  it('sends the photo only as the reference of the drawing request and returns the DRAWING', async () => {
    GenerateImage.mockResolvedValue(DRAWING);
    const out = await createAvatarFromPhoto(photo());
    expect(out.url).toBe(DRAWING.url);
    expect(GenerateImage).toHaveBeenCalledTimes(1);
    expect(GenerateImage.mock.calls[0][0].referenceImageBase64).toBe('UEhPVE8=');
    expect(GenerateImage.mock.calls[0][0].prompt).toContain('reference photo');
    expect(UploadFile).not.toHaveBeenCalled();
    expect(uploadFileToSupabase).not.toHaveBeenCalled();
  });

  it('when the drawing fails nothing was stored, so there is no orphan to clean up', async () => {
    GenerateImage.mockRejectedValue(new Error('provider 500'));
    await expect(createAvatarFromPhoto(photo())).rejects.toThrow('provider 500');
    expect(UploadFile).not.toHaveBeenCalled();
    expect(uploadFileToSupabase).not.toHaveBeenCalled();
  });

  it('refuses a wrong type or a huge file before anything leaves the browser', async () => {
    await expect(createAvatarFromPhoto(photo({ type: 'image/gif' }))).rejects.toMatchObject({ code: 'format' });
    await expect(createAvatarFromPhoto(new File([new Uint8Array(11 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' }))).rejects.toBeInstanceOf(PhotoError);
    expect(GenerateImage).not.toHaveBeenCalled();
    expect(globalThis.createImageBitmap).not.toHaveBeenCalled();
  });

  it('the prompt asks for a drawing without text and without the photo background', () => {
    const p = buildPhotoPrompt('cartoon');
    expect(p).toMatch(/illustration/);
    expect(p).toMatch(/no text/);
  });

  it('the note shown to parents says what is true and names the providers', () => {
    for (const text of [photoNote.he, photoNote.en]) {
      expect(text).toMatch(/Google/);
      expect(text).toMatch(/OpenAI/);
    }
    expect(photoNote.he).toContain('לא נשמרת');
    expect(photoNote.en).toContain('not kept');
  });
});

describe('AvatarSelector upload tab (real component)', () => {
  it('a chosen photo becomes a drawing; the photo never goes through UploadFile; only the drawing is selected', async () => {
    GenerateImage.mockResolvedValue(DRAWING);
    const onSelectAvatar = vi.fn();
    const { container } = render(<AvatarSelector open onOpenChange={() => {}} currentAvatar="" onSelectAvatar={onSelectAvatar} />);
    expect((await screen.findAllByTestId('photo-note')).length).toBeGreaterThan(0);
    const input = document.querySelector('input[type="file"]');
    expect(input).toBeTruthy();
    fireEvent.click(document.getElementById('avatar-photo-consent')); // the separate photo approval
    fireEvent.change(input, { target: { files: [photo()] } });
    await waitFor(() => expect(onSelectAvatar).toHaveBeenCalledWith(DRAWING.url));
    expect(UploadFile).not.toHaveBeenCalled();
    expect(uploadFileToSupabase).not.toHaveBeenCalled();
    expect(container).toBeTruthy();
  });
});
