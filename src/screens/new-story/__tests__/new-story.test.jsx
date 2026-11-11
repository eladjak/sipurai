import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NewStory from '../NewStory';
import StartStates from '../StartStates';
import translations from '@/components/i18n/locales/en/newStory';
const t = key => key.split('.').reduce((x, k) => x?.[k], translations) || key;
vi.mock('@/components/i18n/i18nProvider', () => ({ useI18n: () => ({ t, language: 'english' }) }));
vi.mock('@/screens/heroes/useHeroes', () => ({ useHeroes: () => ({ heroes: [{id: '1', name: 'Maya'}], loading: false }) }));
vi.mock('react-router-dom', async () => ({ ...(await vi.importActual('react-router-dom')), useNavigate: () => vi.fn(), Link: ({children, ...props}) => <a {...props}>{children}</a> }));
vi.mock('@/lib/bookQuota', () => ({ newBookKey: () => 'key', reserveBookSlot: vi.fn(() => new Promise(() => {})), clearActiveBookKey: vi.fn() }));
vi.mock('@/lib/bookGeneration', () => ({ generateBookIncremental: vi.fn() }));
import { reserveBookSlot } from '@/lib/bookQuota';
describe('new story', () => {
 it('keeps topic and selection when going back through three steps', () => { render(<NewStory />); fireEvent.click(screen.getByText('Maya')); fireEvent.click(screen.getByText('Continue')); fireEvent.change(screen.getByLabelText('What is the story about?'), {target:{value:'A moon journey'}}); fireEvent.click(screen.getByText('Continue')); fireEvent.click(screen.getByText('Back')); expect(screen.getByDisplayValue('A moon journey')).toBeTruthy(); });
 it('shows no invented quota and guards a double start', () => { render(<NewStory />); fireEvent.click(screen.getByText('Maya')); fireEvent.click(screen.getByText('Continue')); fireEvent.change(screen.getByLabelText('What is the story about?'), {target:{value:'Moon'}}); fireEvent.click(screen.getByText('Continue')); expect(screen.getByText('Your plan or gift allowance applies.')).toBeTruthy(); const button=screen.getByText('Start the story'); fireEvent.click(button); fireEvent.click(button); expect(reserveBookSlot).toHaveBeenCalledTimes(1); });
 it.each(['queued','slow','disconnected','failed','success'])('shows the %s state', state => { render(<StartStates state={state} t={t} />); expect(screen.getByRole('status')).toBeTruthy(); });
});
