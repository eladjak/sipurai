import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it } from 'vitest';
import { Framing } from './EditionPageReview';
import { editionLabels } from './labels';

const labels = editionLabels(false);
afterEach(cleanup);

function Editor() {
  const [settings, setSettings] = useState({});
  return <Framing pageId="example" trim={{ widthMm: 165, heightMm: 235 }} leafSide="right" scene={{ printSettings: settings }} isWide={false} isSecond={false} maxWidth={176}
    draft={{ zone: 'bottom', text: 'שלום' }} defaultPanel="floating" aspectRatio="1"
    artwork={null} labels={labels} onChange={patch => setSettings(previous => ({ ...previous, ...patch }))} />;
}

it('keeps manual colors and opacity scoped to the explicit mode without changing width', () => {
  render(<Editor />);
  fireEvent.click(screen.getByText(labels.advancedLayout));
  const panel = screen.getByLabelText(labels.panelStyle);
  const width = screen.getByLabelText(labels.panelWidth);
  expect(panel).toHaveValue('floating');
  expect(screen.queryByLabelText(labels.captionColor)).toBeNull();

  fireEvent.change(width, { target: { value: '120' } });
  fireEvent.change(panel, { target: { value: 'manual' } });
  const color = screen.getByLabelText(labels.captionColor);
  const backdrop = screen.getByLabelText(labels.captionBackdrop);
  const opacity = screen.getByLabelText(new RegExp(labels.captionOpacity));
  fireEvent.change(color, { target: { value: '#112233' } });
  fireEvent.change(backdrop, { target: { value: '#eeddcc' } });
  fireEvent.change(opacity, { target: { value: '0' } });
  expect(opacity).toHaveAttribute('aria-valuetext', '0%');
  expect(screen.getByLabelText(labels.manualWidth)).toHaveValue('120');
  const height = screen.getByLabelText(labels.panelHeight);
  fireEvent.change(height, { target: { value: '56' } });
  expect(height).toHaveAttribute('aria-valuetext', '56 mm');

  fireEvent.change(panel, { target: { value: 'dark' } });
  expect(screen.queryByLabelText(labels.captionColor)).toBeNull();
  fireEvent.change(panel, { target: { value: 'manual' } });
  expect(screen.getByLabelText(labels.captionColor)).toHaveValue('#112233');
  expect(screen.getByLabelText(labels.captionBackdrop)).toHaveValue('#eeddcc');
  expect(screen.getByLabelText(new RegExp(labels.captionOpacity))).toHaveValue('0');
  expect(screen.getByLabelText(labels.panelHeight)).toHaveValue('56');
  fireEvent.click(screen.getByRole('button', { name: labels.captionAutoSize }));
  expect(screen.getByLabelText(labels.panelHeight)).toHaveValue('46');
  expect(screen.getByLabelText(labels.manualWidth)).toHaveValue('120');
});
