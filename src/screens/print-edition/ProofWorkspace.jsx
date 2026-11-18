import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/components/i18n/i18nProvider';
import { createDraftEditionManifest } from '@/lib/printEdition/model';
import { createProofClient } from '@/lib/printEdition/proofClient';
import ProofViewer from './ProofViewer';

function missingLabels(fields, t) {
  const labels = {
    pageLimit: t('print.proofWorkspace.fields.pageLimit'),
    coverArt: t('print.proofWorkspace.fields.coverArt'),
    closingArt: t('print.proofWorkspace.fields.closingArt'),
    creator: t('print.proofWorkspace.fields.creator'),
    blurb: t('print.proofWorkspace.fields.blurb'),
    title: t('print.proofWorkspace.fields.title'),
    scenes: t('print.proofWorkspace.fields.scenes'),
    language: t('print.proofWorkspace.fields.language'),
    printSize: t('print.proofWorkspace.fields.printSize'),
    unsafeText: t('print.proofWorkspace.fields.unsafeText'),
    art: t('print.proofWorkspace.fields.art'),
    spreadArt: t('print.proofWorkspace.fields.spreadArt'),
    text: t('print.proofWorkspace.fields.text'),
    layout: t('print.proofWorkspace.fields.layout'),
  };
  return [...new Set(fields.map(key => {
    const [, index, item] = /^scene:(\d+):(.+)$/.exec(key) || [];
    const field = key === 'printTitle' ? 'title' : item || key;
    const label = labels[field] || t('print.proofWorkspace.editionDetails');
    return item ? t('print.proofWorkspace.sceneField', { number: Number(index) + 1, label }) : label;
  }))].join(', ');
}

export default function ProofWorkspace({ book, pages, edition, unsaved = false, isRTL, onEdit, complete, handoffReady = false, verifyHandoff = null }) {
  const { t } = useI18n();
  const client = useMemo(() => createProofClient(), [book.id]);
  const [attempt, retry] = useState(0);
  const [result, setResult] = useState(null);
  const [downloadStatus, setDownloadStatus] = useState('');
  const downloadRequest = useRef(null);
  const lastProof = useRef(null);
  useEffect(() => () => lastProof.current?.revoke(), []);
  const input = useMemo(() => {
    try {
      const assets = new Map();
      const path = source => {
        if (!source) return null;
        if (!assets.has(source)) assets.set(source, 'art/image-' + (assets.size + 1));
        return assets.get(source);
      };
      const { missingInputs, ...manifest } = createDraftEditionManifest(book, pages, edition, path);
      return { revision: edition.revision, manifest: unsaved ? { ...manifest, unsavedDraft: true } : manifest, sources: [...assets.keys()], missing: missingInputs || [] };
    } catch {
      return { invalid: true };
    }
  }, [book, pages, edition, unsaved]);
  useEffect(() => {
    setDownloadStatus('');
    if (!complete || input.invalid || input.missing.length) return;
    const controller = new AbortController();
    let current;
    // Edits invalidate the old proof immediately. Compose after the parent pauses typing.
    const timer = setTimeout(async () => {
      try {
        current = await client(book.id, input.manifest, input.sources, controller.signal, input.revision);
        if (controller.signal.aborted) current.revoke();
        else {
          lastProof.current?.revoke();
          lastProof.current = current;
          setResult({ input, attempt, proof: current });
        }
      } catch (error) {
        if (!controller.signal.aborted) setResult({ input, attempt, error: error.code || error.status || 500, detail: error.detail });
      }
    }, 900);
    return () => {
      clearTimeout(timer);
      controller.abort();
      downloadRequest.current?.abort();
    };
  }, [book.id, complete, input, client, attempt]);
  const ready = result?.input === input && result?.attempt === attempt;
  const proof = (ready ? result.proof : lastProof.current) || null;
  const incomplete = !complete || input.invalid || input.missing?.length > 0;
  const status = incomplete ? 'incomplete' : ready ? (proof ? 'ready' : 'error') : (result ? 'updating' : 'loading');
  const again = () => retry(n => n + 1);
  async function download(key) {
    if (status !== 'ready' || !proof || downloadStatus === 'busy') return;
    const controller = new AbortController();
    downloadRequest.current = controller;
    setDownloadStatus('busy');
    try {
      if (!verifyHandoff || (key === 'handoff' && !handoffReady)) throw new Error('Review required');
      await proof.download(key, edition.revision, handoffReady, verifyHandoff, controller.signal);
      setDownloadStatus('');
    }
    catch (error) {
      if (!controller.signal.aborted) setDownloadStatus(error.name === 'AbortError' ? '' : error.message === 'conflict' ? 'conflict' : 'error');
    }
  }
  return (
    <div>
      <ProofViewer proof={proof} status={status} error={ready ? result.error : null} onRetry={again} onEdit={onEdit}
        onDownload={download} isRTL={isRTL} cover={edition.cover} paper={edition.paper} />
      {status === 'ready' && handoffReady && verifyHandoff && (
        <button className="proof-control mt-2" type="button" disabled={downloadStatus === 'busy'} onClick={() => download('handoff')}>
          {t('print.proofWorkspace.downloadSaved')}
        </button>
      )}
      {input.missing?.length > 0 && <p className="mt-2 text-sm" role="status">
        {t('print.proofWorkspace.missingSummary', { fields: missingLabels(input.missing, t) })}
      </p>}
      {ready && result.error === 'proof_limit' && <p className="mt-2 text-sm" role="status">{t('print.proofWorkspace.workersBusy')}</p>}
      {ready && result.error === 'proof_input' && result.detail && <p className="mt-2 text-sm" role="alert">{t('print.proofWorkspace.textOverflow')} <bdi>{result.detail}</bdi></p>}
      {ready && result.error === 'proof_conflict' && <p role="alert">{t('print.proofWorkspace.savedConflict')} <a href={window.location.href} target="_blank" rel="noreferrer" className="underline">{t('print.proofWorkspace.openSaved')}</a></p>}
      {input.invalid && <p className="mt-2 text-sm" role="status">{t('print.proofWorkspace.invalidInput')}</p>}
      {downloadStatus === 'busy' && <p role="status">{t('print.proofWorkspace.downloading')}</p>}
      {downloadStatus === 'conflict' && <p role="alert">{t('print.proofWorkspace.downloadConflict')}</p>}
      {downloadStatus === 'error' && <p role="alert">{t('print.proofWorkspace.downloadError')} <button type="button" className="underline" onClick={again}>{t('print.proofWorkspace.refreshProof')}</button></p>}
    </div>
  );
}
