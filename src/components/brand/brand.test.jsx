import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { LogoMark } from './LogoMark';
import { Wordmark } from './Wordmark';

describe('moon and book identity', () => {
  it.each(['light', 'dark'])('renders the approved %s symbol as decorative artwork', variant => {
    const { container } = render(<LogoMark variant={variant} />);
    const svg = container.querySelector('svg');
    const approved = readFileSync(`scripts/print_edition/brand/moon-book-${variant}-symbol.svg`, 'utf8');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    for (const path of svg.querySelectorAll('path')) {
      expect(approved).toContain(`d="${path.getAttribute('d')}"`);
      expect(approved).toContain(`"${path.getAttribute('fill')}"`);
    }
  });
  it('keeps the navigation wordmark dark on its light plate even in dark mode', () => {
    render(<Wordmark variant="plate" />);
    expect(screen.getByRole('img').className).toContain('text-[#602046]');
  });
  it('gives the favicon a light backing for dark browser tabs', () => {
    const svg = readFileSync('public/favicon.svg', 'utf8');
    expect(svg).toContain('<rect x="-2" y="-2" width="20" height="20" rx="4" fill="#fff7eb"/>');
    expect(svg).toContain('fill="#602046"');
  });
  it('keeps a single accessible name on the wordmark', () => {
    render(<Wordmark language="he" />);
    expect(screen.getByRole('img', { name: 'סיפוראי' })).toBeTruthy();
  });
  it('references the approved PWA assets and updates the offline cache version', () => {
    const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf8'));
    for (const icon of manifest.icons) expect(readFileSync(`public${icon.src}`).length).toBeGreaterThan(100);
    expect(manifest.icons.map(icon => icon.src)).toContain('/icons/moon-book-512.png');
    expect(manifest.icons.find(icon => icon.purpose === 'maskable')?.src).toBe('/icons/moon-book-maskable-512.png');
    for (const shortcut of manifest.shortcuts) expect(shortcut.icons[0].src).toBe('/favicon.svg');
    const index = readFileSync('index.html', 'utf8');
    expect(index).toContain('/icons/moon-book-apple-180.png');
    for (const [file, size] of [['moon-book-apple-180.png', 180], ['moon-book-192.png', 192], ['moon-book-512.png', 512], ['moon-book-maskable-512.png', 512]]) {
      const png = readFileSync(`public/icons/${file}`);
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([size, size]);
    }
    expect(readFileSync('public/sw.js', 'utf8')).toContain("const CACHE_VERSION = 'sipurai-v4'");
  });
});
