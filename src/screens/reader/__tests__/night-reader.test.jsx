import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ReaderControls from '../ReaderControls';
import AdultExit from '../AdultExit';
import ReaderPage from '../ReaderPage';

const t = (key) => key;
describe('night reader', () => {
  it('bounds previous and next and marks the current dot', () => {
    const go = vi.fn(); render(<ReaderControls index={0} count={2} go={go} t={t} tts={{}} text="hello" />);
    expect(screen.getByRole('button', {name:'nightReader.previous'}).disabled).toBe(true);
    expect(screen.getByLabelText('nightReader.position 1 / 2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name:'nightReader.next'})); expect(go).toHaveBeenCalledWith(1);
  });
  it('plays and pauses through narration', () => {
    const speak = vi.fn(), pause = vi.fn(); const {rerender} = render(<ReaderControls index={0} count={1} go={() => {}} t={t} tts={{speak}} text="hello" />);
    fireEvent.click(screen.getByRole('button', {name:'nightReader.play'})); expect(speak).toHaveBeenCalledWith('hello');
    rerender(<ReaderControls index={0} count={1} go={() => {}} t={t} tts={{isSpeaking:true,pause}} text="hello" />);
    fireEvent.click(screen.getByRole('button', {name:'nightReader.pause'})); expect(pause).toHaveBeenCalled();
  });
  it('requires a two second adult hold', () => {
    vi.useFakeTimers(); const exit = vi.fn(); render(<AdultExit t={t} onExit={exit}/>); const button=screen.getByRole('button',{name:'nightReader.exit'});
    fireEvent.pointerDown(button); act(()=>vi.advanceTimersByTime(500)); fireEvent.pointerUp(button); expect(exit).not.toHaveBeenCalled();
    fireEvent.pointerDown(button); act(()=>vi.advanceTimersByTime(2000)); expect(exit).toHaveBeenCalledOnce(); vi.useRealTimers();
  });
  it('shows a calm fallback for missing art', () => { render(<ReaderPage page={{text_content:'hello'}} t={t}/>); expect(screen.getByText('nightReader.missingArt')).toBeTruthy(); });
});

import { MemoryRouter, Route, Routes } from 'react-router-dom';
import NightReader from '../NightReader';
import { useNightReader } from '../useNightReader';
vi.mock('../useNightReader', () => ({ useNightReader: vi.fn() }));
vi.mock('@/components/i18n/i18nProvider', () => ({ useI18n: () => ({t, language:'hebrew', isRTL:true}) }));
vi.mock('@/hooks/useTTS', () => ({ useTTS: () => ({speak:vi.fn(),stop:vi.fn(), currentWordIndex:-1}) }));
vi.mock('@/components/bookReader/TTSControls', () => ({ getStoredTTSEngine: () => 'browser' }));
const renderReader = (state, pages=[]) => {
  useNightReader.mockReturnValue({state, pages, index:0, setIndex:vi.fn(), book:{title:'Story'}});
  return render(<MemoryRouter initialEntries={['/book/1/read']}><Routes><Route path="/book/:id/read" element={<NightReader/>}/></Routes></MemoryRouter>);
};
describe('reader states', () => {
  it.each(['loading','building','paused','failed'])( 'shows %s state', (status) => {
    const internal = {loading:'loading', building:'starting', paused:'interrupted', failed:'failed'}[status];
    renderReader(internal); expect(screen.getByText(`nightReader.${status}`)).toBeTruthy();
  });
  it('keeps a ready page visible while more are building', () => {
    renderReader('building',[{text_content:'A ready page'}]);
    expect(screen.getByText('nightReader.building')).toBeTruthy(); expect(document.querySelector('.reader-text').textContent).toBe('A ready page');
  });
  it('disables next at the last page', () => {
    render(<ReaderControls index={1} count={2} go={vi.fn()} t={t} tts={{}} text="hello"/>);
    expect(screen.getByRole('button',{name:'nightReader.next'}).disabled).toBe(true);
  });
});
