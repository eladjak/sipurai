import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Sheet } from '../Sheet';
import { EmptyState } from '../EmptyState';
import { StepIndicator } from '../StepIndicator';
import { Notice } from '../Notice';
import { ToastProvider } from '../../ui/toast';
import { useDsToast } from '../Toast';
import { Wordmark } from '../../brand/Wordmark';
import { LogoMark } from '../../brand/LogoMark';

describe('primitives B', () => {
 it('opens a modal sheet, traps focus, closes on Escape and returns focus', async () => {
  render(<Sheet trigger={<button>Open</button>} title="Title"><button>First</button><button>Last</button></Sheet>);
  const trigger = screen.getByText('Open'); trigger.focus(); fireEvent.click(trigger);
  const dialog = await screen.findByRole('dialog'); expect(dialog.contains(document.activeElement)).toBe(true);
  document.body.focus(); fireEvent.focusIn(document.body); expect(dialog.contains(document.activeElement)).toBe(true);
  fireEvent.keyDown(document, {key:'Escape'}); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(document.activeElement).toBe(trigger);
 });
 it('renders an empty state with one primary action and optional support', () => {
  render(<EmptyState title="Nothing yet" description="Start here" action={<button>Create</button>} />);
  expect(screen.getByText('Nothing yet')).toBeTruthy(); expect(screen.getByText('Start here')).toBeTruthy(); expect(screen.getAllByRole('button')).toHaveLength(1);
 });
 it('marks the current step', () => { render(<StepIndicator steps={['One','Two']} current={1} />); expect(screen.getByText('Two').closest('li').getAttribute('aria-current')).toBe('step'); });
 it.each([['info','status'],['success','status'],['warning','alert'],['danger','alert']])('announces %s as %s', (tone,role) => { render(<Notice tone={tone} title="Message" action="Try again" />); expect(screen.getByRole(role).textContent).toContain('Try again'); });
 it('calls undo from the toast', () => { const undo=vi.fn(); function Test(){const {toast}=useDsToast();return <button onClick={()=>toast({title:'Deleted', undo:{label:'Undo', onClick:undo}})}>Delete</button>}; render(<ToastProvider><Test /></ToastProvider>); fireEvent.click(screen.getByText('Delete')); fireEvent.click(screen.getByText('Undo')); expect(undo).toHaveBeenCalledOnce(); });
 it.each([['he','סיפוראי'],['yi','סיפוראי'],['en','Sipurai']])('selects wordmark for %s', (language,text) => { render(<Wordmark language={language} />); expect(screen.getByLabelText(text)).toBeTruthy(); });
 it('shows a decorative book logo', () => { const {container}=render(<LogoMark />); expect(container.querySelector('svg').getAttribute('aria-hidden')).toBe('true'); });
});
