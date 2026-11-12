// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HelpCentre from '../HelpCentre';
import { answers } from '../helpAnswers';
vi.mock('@/components/i18n/i18nProvider', () => ({ useI18n: () => ({ t: k => k, isRTL: true }) }));
describe('help centre', () => {
 it('has sourced answers and links to privacy, accessibility and contact', () => { expect(answers.length).toBeGreaterThanOrEqual(6); expect(answers.every(a => a.source)).toBe(true); render(<MemoryRouter><HelpCentre printEnabled /></MemoryRouter>); for (const href of ['/privacy','/help/accessibility','/help/contact']) expect(document.querySelector(`a[href="${href}"]`)).toBeTruthy(); cleanup(); });
 it('only includes printing when enabled', () => { render(<MemoryRouter><HelpCentre printEnabled={false}/></MemoryRouter>); expect(screen.queryByText('help.printQuestion')).toBeNull(); cleanup(); render(<MemoryRouter><HelpCentre printEnabled /></MemoryRouter>); expect(screen.getByText('help.printQuestion')).toBeTruthy(); cleanup(); });
});
