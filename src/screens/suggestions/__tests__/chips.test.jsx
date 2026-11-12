import React from 'react';
import { it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SuggestionChips from '../SuggestionChips';
vi.mock('@/screens/heroes/useHeroes', () => ({useHeroes: () => ({heroes:[],loading:false})}));
vi.mock('@/screens/shelf/useShelf', () => ({useShelf: () => ({books:[],loading:false})}));
const t = key => key;
it('prefills without starting a story and can turn suggestions off', () => { localStorage.clear(); const choose=vi.fn(), start=vi.fn(); render(<SuggestionChips t={t} onChoose={choose} start={start} data={{now:new Date('2026-12-12T17:01:00Z')}}/>); fireEvent.click(screen.getByRole('button',{name:/suggestions.bedtime/})); expect(choose).toHaveBeenCalledOnce(); expect(start).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('switch')); expect(screen.queryByRole('button',{name:/suggestions.bedtime/})).toBeNull(); expect(localStorage.getItem('sipurai_suggestions')).toBe('off'); });

it('keeps the preference off after remount', () => {
 localStorage.setItem('sipurai_suggestions', 'off');
 const view = render(<SuggestionChips t={t} onChoose={vi.fn()} data={{now:new Date('2026-12-12T17:01:00Z')}}/>);
 expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
 expect(screen.queryByRole('button', {name:/suggestions.bedtime/})).toBeNull(); view.unmount();
});

it('consumes a reader idea into the editable topic without starting', async () => {
 const { default: TopicStep } = await import('@/screens/new-story/TopicStep');
 sessionStorage.setItem('sipurai_suggestion', 'A moon story');
 const change = vi.fn(); render(<TopicStep value="" change={change} t={t}/>);
 expect(change).toHaveBeenCalledWith('A moon story');
 expect(sessionStorage.getItem('sipurai_suggestion')).toBeNull();
});

const readerNavigation = vi.hoisted(() => vi.fn());
vi.mock('@/components/i18n/i18nProvider', () => ({useI18n: () => ({t:key => key,language:'english',isRTL:false})}));
vi.mock('react-router-dom', () => ({useParams: () => ({id:'1'}),useNavigate: () => readerNavigation}));
vi.mock('@/hooks/useTTS', () => ({useTTS: () => ({stop:vi.fn()})}));
vi.mock('@/components/bookReader/TTSControls', () => ({getStoredTTSEngine: () => 'fixture'}));
vi.mock('@/screens/reader/useNightReader', () => ({useNightReader: () => ({book:{status:'complete',title:'Moon'},pages:[{text_content:'A page'}],index:0,setIndex:vi.fn(),state:'complete'})}));
it('keeps the last page inside the reader with no suggestion or outgoing link', async () => {
 localStorage.clear(); readerNavigation.mockClear();
 const {default: NightReader} = await import('@/screens/reader/NightReader');
 const {container} = render(<NightReader/>);
 expect(screen.queryByRole('button',{name:/suggestions.sequel/})).toBeNull();
 expect(screen.queryByRole('switch')).toBeNull();
 expect(container.querySelector('a[href]')).toBeNull();
 expect(readerNavigation).not.toHaveBeenCalled();
});
