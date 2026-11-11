import book from '../../pages/BookView.jsx?raw';
import controls from './TTSControls.jsx?raw';
import { describe, expect, it } from 'vitest';
import he from '../i18n/locales/he/reader';
import en from '../i18n/locales/en/reader';


describe('reader copy', () => {
  it('uses translated, neutral prompts instead of XP copy', () => {
    expect(book).not.toMatch(/bookView\.(guestBanner|finishedXpEarned|finishedGuestPrompt)/);
    expect(he.reader.guestBanner).not.toMatch(/XP/i);
    expect(en.reader.guestBanner).not.toMatch(/XP/i);
    expect(he.reader.finished).not.toMatch(/XP/i);
    expect(en.reader.finished).not.toMatch(/XP/i);
  });
  it('translates zoom controls and reader text in both languages', () => {
    expect(book).not.toMatch(/aria-label="Zoom (in|out)"|isRTL\s*\?\s*['"]הורדת PDF/);
    expect(controls).not.toMatch(/[\u0590-\u05ff]/);
    for (const locale of [he, en]) {
      for (const key of ['zoomIn', 'zoomOut', 'pdfDownload', 'pdfTitle', 'print', 'musicOn', 'musicOff', 'closeNotice', 'autoOn', 'autoOff', 'auto', 'manual', 'chooseVoice', 'naturalVoice', 'browserVoice', 'openaiVoice', 'geminiVoice']) {
        expect(locale.reader[key], key).toBeTruthy();
      }
    }
  });
});
