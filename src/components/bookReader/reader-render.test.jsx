import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nContext, LANGUAGES } from '../i18n/i18nProvider';
import TTSControls from './TTSControls';

afterEach(() => { cleanup(); localStorage.clear(); });

function renderControls(language) {
  const translations = LANGUAGES[language].translations;
  const t = (key) => key.split('.').reduce((value, part) => value?.[part], translations);
  render(
    <I18nContext.Provider value={{ t }}>
      <TTSControls isRTL={language === 'hebrew'} rate={1} notice="Notice" />
    </I18nContext.Provider>,
  );
}

describe.each([
  ['hebrew', 'בחירת קול להקראה', 'הפעלת הקראה אוטומטית', 'כיבוי הקראה אוטומטית', 'סגירת הודעה'],
  ['english', 'Choose narration voice', 'Turn automatic narration on', 'Turn automatic narration off', 'Close notice'],
])('reader controls in %s', (language, voice, on, off, close) => {
  it('renders translated controls and updates the auto narration label', () => {
    renderControls(language);
    expect(screen.getByRole('combobox', { name: voice })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: on }));
    expect(screen.getByRole('button', { name: off }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: close }));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
