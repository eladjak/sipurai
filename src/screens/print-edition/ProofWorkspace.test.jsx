import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProofWorkspace from './ProofWorkspace';

const fixture = vi.hoisted(() => ({ renderProof: vi.fn() }));
vi.mock('@/components/i18n/i18nProvider', () => ({ useI18n: () => ({ t: key => key }) }));
vi.mock('@/lib/printEdition/model', () => ({ createDraftEditionManifest: () => ({}) }));
vi.mock('@/lib/printEdition/proofClient', () => ({ createProofClient: () => fixture.renderProof }));
vi.mock('./ProofViewer', () => ({ default: () => null }));

describe('proof handoff when an edition changes', () => {
  afterEach(() => vi.useRealTimers());

  it('aborts a stale download and lets the new edition download', async () => {
    vi.useFakeTimers();
    const proofs = [
      { download: vi.fn(), revoke: vi.fn() },
      { download: vi.fn().mockResolvedValue(undefined), revoke: vi.fn() },
    ];
    let finishOld;
    proofs[0].download.mockImplementation(() => new Promise(resolve => { finishOld = resolve; }));
    fixture.renderProof.mockResolvedValueOnce(proofs[0]).mockResolvedValueOnce(proofs[1]);
    const book = { id: 'book' };
    const pages = [];
    const verifyHandoff = vi.fn();
    const view = render(<ProofWorkspace book={book} pages={pages} edition={{ revision: 1 }} complete handoffReady verifyHandoff={verifyHandoff} />);
    await act(() => vi.advanceTimersByTimeAsync(900));
    const button = () => screen.getByRole('button', { name: 'print.proofWorkspace.downloadSaved' });
    fireEvent.click(button());
    const oldSignal = proofs[0].download.mock.calls[0][4];
    expect(button()).toBeDisabled();

    view.rerender(<ProofWorkspace book={book} pages={pages} edition={{ revision: 2 }} complete handoffReady verifyHandoff={verifyHandoff} />);
    expect(oldSignal.aborted).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(900));
    expect(button()).toBeEnabled();
    await act(async () => finishOld());
    expect(button()).toBeEnabled();
    await act(async () => fireEvent.click(button()));
    expect(proofs[1].download).toHaveBeenCalledOnce();
  });
});
