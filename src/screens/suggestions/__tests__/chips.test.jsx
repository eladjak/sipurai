import React from 'react';
import { it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SuggestionChips from '../SuggestionChips';
vi.mock('@/screens/heroes/useHeroes', () => ({useHeroes: () => ({heroes:[],loading:false})}));
vi.mock('@/screens/shelf/useShelf', () => ({useShelf: () => ({books:[],loading:false})}));
const t = key => key;
it('prefills without starting a story and can turn suggestions off', () => { localStorage.clear(); const choose=vi.fn(), start=vi.fn(); render(<SuggestionChips t={t} onChoose={choose} start={start} data={{now:new Date('2026-12-12T17:01:00Z')}}/>); fireEvent.click(screen.getByRole('button',{name:/suggestions.bedtime/})); expect(choose).toHaveBeenCalledOnce(); expect(start).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('switch')); expect(screen.queryByRole('button',{name:/suggestions.bedtime/})).toBeNull(); expect(localStorage.getItem('sipurai_suggestions')).toBe('off'); });
