import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import UiGallery from './UiGallery';
const galleryBlocks = {
  button: ['default', 'hover', 'focus', 'active', 'disabled', 'loading', 'magic', 'quiet', 'danger', 'on-night'],
  iconbutton: ['default', 'disabled'],
  card: ['paper', 'night', 'interactive'],
  chip: ['default', 'selected', 'cost', 'disabled'],
  field: ['default', 'error', 'textarea', 'disabled'],
  helptip: ['default'],
  sheet: ['default'],
  emptystate: ['empty'],
  stepindicator: ['default', 'compact'],
  notice: ['info', 'success', 'warning', 'danger'],
  toast: ['default'],
  wordmark: ['sm', 'md', 'lg'],
  logomark: ['default']
};
describe('UI gallery', () => {
  it('renders every named component state in both languages', () => {
    const {
      container
    } = render(<UiGallery />);
    for (const [component, states] of Object.entries(galleryBlocks)) {
      for (const state of states) {
        const name = `${component}-${state}`;
        expect(container.querySelector(`[data-ux="${name}"]`), name).toBeTruthy();
      }
    }
    expect(screen.getAllByText('עברית').length).toBeGreaterThan(0);
    expect(screen.getAllByText('English').length).toBeGreaterThan(0);
  });
});
