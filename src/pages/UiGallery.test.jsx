import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import UiGallery from './UiGallery';

const blocks = {
  button: ['default', 'hover', 'focus', 'active', 'disabled', 'loading', 'magic', 'quiet', 'danger', 'on-night'],
  iconbutton: ['default', 'disabled'],
  card: ['paper', 'night', 'interactive'],
  chip: ['default', 'selected', 'cost', 'disabled'],
  field: ['default', 'error', 'textarea', 'disabled'],
  helptip: ['default'], sheet: ['default'], emptystate: ['empty'],
  stepindicator: ['default', 'compact'], notice: ['info', 'success', 'warning', 'danger'],
  toast: ['default'], wordmark: ['sm', 'md', 'lg'], logomark: ['default'],
};

const block = (container, name) => container.querySelector(`[data-ux="${name}"]`);

describe('UI gallery acceptance', () => {
  it('wraps the gallery in the design system shell', () => {
    const { container } = render(<UiGallery />);
    expect(container.querySelector('main.sp-shell')).toBeTruthy();
  });

  it.each(Object.entries(blocks))('marks every %s example for the screenshot harness', (name, states) => {
    const { container } = render(<UiGallery />);
    for (const state of states) expect(block(container, `${name}-${state}`), `${name}-${state}`).toBeTruthy();
  });

  it('shows Hebrew RTL and English LTR together in every block', () => {
    const { container } = render(<UiGallery />);
    for (const [name, states] of Object.entries(blocks)) {
      for (const state of states) {
        const section = block(container, `${name}-${state}`);
        expect(section.querySelector('[lang="he"][dir="rtl"]'), `${name}-${state} Hebrew`).toBeTruthy();
        expect(section.querySelector('[lang="en"][dir="ltr"]'), `${name}-${state} English`).toBeTruthy();
      }
    }
  });

  it('demonstrates forced interaction states and disabled, loading, error, empty, selected and cost states', () => {
    const { container } = render(<UiGallery />);
    for (const state of ['hover', 'focus', 'active']) expect(block(container, `button-${state}`).querySelector('button').className).toMatch(state === 'hover' ? /violet-700/ : state === 'focus' ? /outline/ : /scale/);
    expect(within(block(container, 'button-disabled')).getAllByRole('button')[0].hasAttribute('disabled')).toBe(true);
    expect(block(container, 'button-loading').querySelector('button').disabled).toBe(true);
    expect(within(block(container, 'field-error')).getByText('כדאי להוסיף שם לסיפור.')).toBeTruthy();
    expect(within(block(container, 'emptystate-empty')).getByText('עדיין אין כאן סיפורים')).toBeTruthy();
    expect(block(container, 'chip-selected').querySelector('[aria-checked="true"]')).toBeTruthy();
    expect(within(block(container, 'chip-cost')).getByText('סיפור אחד מהמתנה')).toBeTruthy();
  });

  it('opens the interactive sheet with visible instructions', () => {
    render(<UiGallery />);
    fireEvent.click(screen.getByRole('button', { name: 'פתיחת חלונית' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getAllByText('כאן אפשר לבדוק את פרטי הסיפור.').length).toBeGreaterThan(0);
  });
});
