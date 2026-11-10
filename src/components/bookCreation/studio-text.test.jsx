import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { I18nContext, LANGUAGES } from '@/components/i18n/i18nProvider';
import { getBookTranslation } from '@/utils/book-translations';
import ScenePlanStep from './ScenePlanStep';
import BookEditorTab from './BookEditorTab';

const lookup = (language) => (key) => key.split('.').reduce((value, part) => value?.[part], LANGUAGES[language].translations) || key;

afterEach(cleanup);
describe.each(['hebrew', 'english'])('studio text in %s', (language) => {
  const isRTL = language === 'hebrew';
  const t = getBookTranslation(language);
  const wrapper = (children) => (
    <MemoryRouter><I18nContext.Provider value={{ t: lookup(language), isRTL, language }}>{children}</I18nContext.Provider></MemoryRouter>
  );

  it('renders the empty scene plan', () => {
    const { container } = render(wrapper(<ScenePlanStep book={{ language }} isRTL={isRTL} t={t} onBack={() => {}} onConfirm={() => {}} />));
    expect(container.textContent).toMatchSnapshot();
  });

  it('renders the page editor', () => {
    const { container } = render(wrapper(<BookEditorTab book={{ language }} bookId="test" pages={[{ text: '', image_url: '' }]} currentPageIndex={0} currentPageText="" currentPageImagePrompt="" currentPageLayout="standard" textStyles={{}} interactiveElements={[]} isRTL={isRTL} t={t} onPageIndexChange={() => {}} onTextChange={() => {}} onSaveText={() => {}} onImagePromptChange={() => {}} onRegenerateImage={() => {}} onLayoutChange={() => {}} />));
    expect(container.textContent).toMatchSnapshot();
  });
});

describe('scene plan language selection', () => {
  it('keeps the Yiddish book fallback when the interface is left-to-right', () => {
    const { getByText } = render(<ScenePlanStep book={{ language: 'yiddish' }} isRTL={false} t={(key) => key} />);
    expect(getByText('פלאַנירן די סצענעס')).toBeInTheDocument();
  });

  it('still honours an existing per-book translation', () => {
    const t = (key) => key === 'book.scenePlan.title' ? 'Custom title' : key;
    const { getByText } = render(<ScenePlanStep book={{ language: 'english' }} isRTL={false} t={t} />);
    expect(getByText('Custom title')).toBeInTheDocument();
  });
});
