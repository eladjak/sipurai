import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PrintSizeStep from './PrintSizeStep';
vi.mock('@/components/i18n/i18nProvider', () => ({ useI18n: () => ({ t: key => key }) }));

describe('book size selection', () => {
  it('shows four accessible choices, page count, pricing and help', () => {
    const change = vi.fn();
    render(<PrintSizeStep value="square-220" onChange={change} length="medium" isRTL />);
    const choices = screen.getAllByRole('radio');
    expect(choices).toHaveLength(4);
    expect(choices[0].checked).toBe(true);
    expect(screen.getByText(/10 עמודים/)).toBeTruthy();
    expect(screen.getByText(/מחיר ללקוח עדיין לא זמין/)).toBeTruthy();
    fireEvent.click(choices[2]);
    expect(change).toHaveBeenCalledWith('portrait-165x235');
    fireEvent.click(choices[3]);
    expect(change).toHaveBeenCalledWith('landscape-210x170');
    expect(screen.getByText('איך בוחרים גודל?')).toBeTruthy();
  });
});
