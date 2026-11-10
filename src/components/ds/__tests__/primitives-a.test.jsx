// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Button } from '../Button';
import { IconButton } from '../IconButton';
import { Card } from '../Card';
import { Chip } from '../Chip';
import { Field } from '../Field';
import { HelpTip } from '../HelpTip';

afterEach(cleanup);
describe('design system primitives', () => {
  it('Button preserves its accessible label while loading and supports links', async () => {
    const click = vi.fn();
    const { rerender } = render(<Button onClick={click}>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    button.focus(); expect(document.activeElement).toBe(button); fireEvent.click(button); expect(click).toHaveBeenCalledOnce();
    rerender(<Button loading>Save</Button>); expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('aria-busy', 'true'); expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled(); expect(screen.getByRole('button', { name: 'Save' })).not.toHaveClass('opacity-50');
    rerender(<Button href="/story">Story</Button>); expect(screen.getByRole('link', { name: 'Story' })).toHaveAttribute('href', '/story');
  });
  it('IconButton has an accessible label and responds to keyboard activation', async () => { const click = vi.fn();
    render(<IconButton label="Close" onClick={click}>×</IconButton>);
    const button = screen.getByRole('button', { name: 'Close' }); button.focus(); expect(document.activeElement).toBe(button); fireEvent.click(button); expect(click).toHaveBeenCalledOnce();
  });
  it('Card renders static and interactive variants', async () => { const { rerender } = render(<Card>Static</Card>);
    expect(screen.getByText('Static')).toBeInTheDocument(); rerender(<Card interactive href="/story">Open</Card>);
    const link = screen.getByRole('link', { name: 'Open' }); link.focus(); expect(document.activeElement).toBe(link);
  });
  it('Chip exposes its selection role and state', async () => { const click = vi.fn();
    render(<Chip role="checkbox" checked onClick={click} cost="1 gift">Story</Chip>);
    const chip = screen.getByRole('checkbox', { name: /Story/ }); expect(chip).toHaveAttribute('aria-checked', 'true'); expect(chip).toHaveTextContent('1 gift'); chip.focus(); fireEvent.click(chip); expect(click).toHaveBeenCalledOnce();
  });
  it('Field binds label, hint and announced error and sets LTR input metadata', async () => {
    const { rerender } = render(<Field label="Phone" hint="Include code" error="Required" type="tel" placeholder="050" />);
    const field = screen.getByLabelText('Phone'); expect(field).toHaveAttribute('dir', 'ltr'); expect(field).toHaveAttribute('inputmode', 'tel'); expect(field).toHaveAttribute('autocomplete', 'tel'); expect(field).toHaveAttribute('aria-invalid', 'true'); expect(field.getAttribute('aria-describedby')).toContain(screen.getByText('Required').id); expect(screen.getByText('Required')).toHaveAttribute('role', 'alert');
    for (const type of ['email', 'date']) { rerender(<Field label="Value" type={type} />); expect(screen.getByLabelText('Value')).toHaveAttribute('dir', 'ltr'); }
    rerender(<Field label="Bio" multiline maxLength={20} defaultValue="abc" />); expect(screen.getByLabelText('Bio').tagName).toBe('TEXTAREA'); expect(screen.getByText('3 / 20')).toBeInTheDocument();
  });
  it('HelpTip opens from its keyboard-accessible trigger and closes on Escape', async () => { render(<HelpTip label="הסבר: Gift">Gift details.</HelpTip>);
    const button = screen.getByRole('button', { name: 'הסבר: Gift' }); button.focus(); expect(document.activeElement).toBe(button); fireEvent.click(button); expect(await screen.findByText('Gift details.')).toBeInTheDocument(); fireEvent.keyDown(document, { key: 'Escape' }); expect(screen.queryByText('Gift details.')).not.toBeInTheDocument();
  });
});

describe('primitive state changes', () => {
  it('prevents activation of disabled and loading links', async () => { const onClick = vi.fn();
    const { rerender } = render(<Button href="/next" disabled onClick={onClick}>Next</Button>);
    const link = screen.getByRole('link', { name: 'Next' });
    expect(link).toHaveAttribute('aria-disabled', 'true'); expect(link).not.toHaveAttribute('href'); fireEvent.click(link); expect(onClick).not.toHaveBeenCalled();
    rerender(<Button href="/next" loading onClick={onClick}>Next</Button>); expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute('aria-busy', 'true');
  });
  it('updates textarea count and associates hints and errors', async () => {
    const { rerender } = render(<Field label="Bio" multiline maxLength={20} hint="A short bio" />);
    const input = screen.getByLabelText('Bio'); fireEvent.change(input, { target: { value: 'hello' } }); expect(screen.getByText('5 / 20')).toHaveAttribute('dir', 'ltr');
    rerender(<Field label="Bio" multiline maxLength={20} hint="A short bio" error="Too short" />);
    expect(input).toHaveAccessibleDescription('A short bio Too short 5 / 20'); expect(screen.getByRole('alert')).toHaveTextContent('Too short');
  });
  it('sets safe metadata for directional input types', async () => { const { rerender } = render(<Field label="Value" type="url" />);
    for (const [type, mode, autocomplete] of [['url','url','url'], ['number','decimal','off'], ['date','numeric','off'], ['email','email','email'], ['tel','tel','tel']]) {
      rerender(<Field label="Value" type={type} />); const input = screen.getByLabelText('Value'); expect(input).toHaveAttribute('dir', 'ltr'); expect(input).toHaveAttribute('inputmode', mode); expect(input).toHaveAttribute('autocomplete', autocomplete);
    }
  });
  it('uses parent selection semantics for radio chips', async () => { const { rerender } = render(<Chip role="radio" checked={false}>One</Chip>);
    expect(screen.getByRole('radio')).toHaveAttribute('aria-checked', 'false'); rerender(<Chip role="radio" checked>One</Chip>); expect(screen.getByRole('radio')).toHaveAttribute('aria-checked', 'true');
  });
});
