import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DailyPromptCard from './DailyPromptCard';
import TopicStep from '@/screens/new-story/TopicStep';
const state = vi.hoisted(() => ({ shell: false }));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ user: { id: 'owner-a' } }) }));
vi.mock('@/lib/flags', () => ({ isNewShell: () => state.shell }));
vi.mock('@/components/i18n/i18nProvider', () => ({ useI18n: () => ({ isRTL: true, t: key => key }) }));
vi.mock('@/screens/suggestions/SuggestionChips', () => ({ default: () => null }));
afterEach(() => { cleanup(); sessionStorage.clear(); });
describe('daily idea handoff', () => {
  it.each([false, true])('saves the displayed idea once for shell %s', shell => {
    state.shell = shell;
    render(<MemoryRouter><DailyPromptCard dailyPrompt={{title:'כוכב',description:'ילד מוצא כוכב'}} isPromptLoading={false} /></MemoryRouter>);
    const link = screen.getByRole('link', {name:'home.dailyPrompt.createFromIdea'});
    expect(link.getAttribute('href')).toBe(shell ? '/new' : '/BookWizard');
    fireEvent.click(link);
    expect(JSON.parse(sessionStorage.getItem('sipurai_pending_idea'))).toMatchObject({ownerId:'owner-a',title:'כוכב',description:'ילד מוצא כוכב'});
  });
  it('never loads another account’s pending idea', () => {
    sessionStorage.setItem('sipurai_pending_idea', JSON.stringify({ ownerId:'owner-b', title:'private idea' }));
    const change = vi.fn();
    render(<TopicStep value="" change={change} t={key=>key} />);
    expect(change).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('sipurai_pending_idea')).not.toBeNull();
  });
  it('prefills new-shell topic and consumes the handoff', () => {
    sessionStorage.setItem('sipurai_pending_idea', JSON.stringify({ownerId:'owner-a',title:'כוכב', description:'ילד מוצא כוכב'}));
    const change = vi.fn();
    render(<TopicStep value="" change={change} t={key=>key} />);
    expect(change).toHaveBeenCalledWith('כוכב — ילד מוצא כוכב');
    expect(sessionStorage.getItem('sipurai_pending_idea')).toBeNull();
  });
});
