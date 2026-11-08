import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PrintSizeStep from './PrintSizeStep';

describe('book size selection', () => {
  it('shows three accessible choices, page count, pricing and help', () => {
    const change = vi.fn();
    render(<PrintSizeStep value="square-220" onChange={change} length="medium" isRTL />);
    const choices = screen.getAllByRole('radio');
    expect(choices).toHaveLength(3);
    expect(choices[0].checked).toBe(true);
    expect(screen.getByText(/10 עמודים/)).toBeTruthy();
    expect(screen.getByText(/מחיר ללקוח עדיין לא זמין/)).toBeTruthy();
    fireEvent.click(choices[2]);
    expect(change).toHaveBeenCalledWith('portrait-165x235');
    expect(screen.getByText('איך בוחרים גודל?')).toBeTruthy();
  });
});
