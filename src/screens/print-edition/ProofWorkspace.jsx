import { useEffect, useMemo, useRef, useState } from 'react';
import { createDraftEditionManifest } from '@/lib/printEdition/model';
import { createProofClient } from '@/lib/printEdition/proofClient';
import ProofViewer from './ProofViewer';

const fieldLabels = {
  pageLimit: ['עד 80 עמודים', 'up to 80 pages'], coverArt: ['איור כריכה', 'cover illustration'], closingArt: ['איור סיום', 'closing illustration'],
  creator: ['שם היוצר', 'creator name'], blurb: ['תקציר לגב הכריכה', 'back cover blurb'],
  printTitle: ['כותרת', 'title'], title: ['כותרת', 'title'], scenes: ['עמודי סיפור', 'story pages'],
  language: ['ספר בעברית', 'Hebrew book'], printSize: ['מידת דפוס נתמכת', 'supported trim size'],
  unsafeText: ['טקסט ללא תווי כיווניות מוסתרים', 'text without hidden direction controls'], art: ['איור', 'illustration'], spreadArt: ['איור רחב לכפולה', 'spread illustration'],
  text: ['טקסט', 'text'], layout: ['פריסת כפולה', 'spread layout'],
};

function missingLabel(key, rtl) {
  const [, index, item] = /^scene:(\d+):(.+)$/.exec(key) || [];
  const label = fieldLabels[item || key]?.[rtl ? 0 : 1] || (rtl ? 'פרטי המהדורה' : 'edition details');
  return item ? (rtl ? 'סצנה ' : 'Scene ') + (Number(index) + 1) + ' · ' + label : label;
}

export default function ProofWorkspace({ book, pages, edition, unsaved = false, isRTL, onEdit, complete, handoffReady = false, verifyHandoff = null }) {
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
          {isRTL ? 'הורדת קובצי הדפוס של המהדורה השמורה' : 'Download print files for this saved edition'}
        </button>
      )}
      {input.missing?.length > 0 && <p className="mt-2 text-sm" role="status">
        {isRTL ? 'כדי לפתוח את ההגהה, השלימו ' : 'To open the proof, complete '}
        {[...new Set(input.missing.map(key => missingLabel(key, isRTL)))].join(', ')}.
      </p>}
      {ready && result.error === 'proof_limit' && <p className="mt-2 text-sm" role="status">{isRTL ? 'כל עמדות ההגהה תפוסות. אפשר להמשיך לערוך ולנסות שוב בעוד כמה דקות.' : 'The proof workers are busy. You can keep editing and retry in a few minutes.'}</p>}
      {ready && result.error === 'proof_input' && result.detail && <p className="mt-2 text-sm" role="alert">{isRTL ? 'אחד הטקסטים חורג מהשטח הבטוח. קצרו אותו או בחרו מיקום רחב יותר.' : 'Some text exceeds the safe area. Shorten it or choose a wider placement.'} <bdi>{result.detail}</bdi></p>}
      {ready && result.error === 'proof_conflict' && <p role="alert">{isRTL ? 'בינתיים נשמרה מהדורה חדשה. פתחו אותה בלשונית נוספת כדי לשמור גם את השינויים שכתבתם כאן.' : 'A newer edition was saved. Open it in a new tab to keep your current edits.'} <a href={window.location.href} target="_blank" rel="noreferrer" className="underline">{isRTL ? 'פתיחת המהדורה השמורה' : 'Open saved edition'}</a></p>}
      {input.invalid && <p className="mt-2 text-sm" role="status">{isRTL ? 'בדקו את שפת הספר, המידות והטקסט בהגדרות הדפוס.' : 'Check the book language, dimensions and text in the print settings.'}</p>}
      {downloadStatus === 'busy' && <p role="status">{isRTL ? 'מורידים את קובץ הדפוס ובודקים שהוא תואם להגהה…' : 'Downloading and verifying the print file…'}</p>}
      {downloadStatus === 'conflict' && <p role="alert">{isRTL ? 'הספר השתנה מאז פתיחת ההגהה. שמרו את התיקונים ופתחו את המהדורה העדכנית לפני ההורדה.' : 'The book changed. Preserve your edits and open the current edition before downloading.'}</p>}
      {downloadStatus === 'error' && <p role="alert">{isRTL ? 'הקובץ אינו זמין כרגע. אפשר לחדש את ההגהה ולנסות שוב.' : 'The file is unavailable. Refresh the proof and try again.'} <button type="button" className="underline" onClick={again}>{isRTL ? 'חידוש ההגהה' : 'Refresh proof'}</button></p>}
    </div>
  );
}
