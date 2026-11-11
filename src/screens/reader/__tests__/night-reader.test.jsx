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
