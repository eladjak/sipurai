import { useId, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { uploadEditionArt } from '@/lib/printEdition/assets';
import { actionClass } from './labels';

export function EditionArtField({ label, labels, src, fallback = undefined, inputId = undefined, onChange, onBusy, disabled = false, spreadRatio = 0 }) {
  const defaultId = useId();
  const [status, setStatus] = useState('');
  const id = inputId || defaultId;
  const preview = src || fallback;
  const unavailable = disabled || status === 'pending';
  const load = async (event) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file || !onBusy(1)) return;
    setStatus('pending');
    try {
      onChange(await uploadEditionArt(file, spreadRatio));
      setStatus('');
    } catch (error) {
      setStatus(error.message === 'wide' ? 'wide' : 'failed');
    } finally {
      onBusy(-1);
    }
  };
  return (
    <div className="rounded-sp-md border border-sp-line bg-sp-card p-3">
      <label htmlFor={id} className="flex items-center gap-2 text-sm font-semibold"><ImagePlus aria-hidden="true" size={17} />{label}</label>
      {preview && <img className="mt-2 max-h-36 w-full rounded-sp-sm object-contain" src={preview} alt="" />}
      <div className="mt-2 flex flex-wrap gap-2">
        <div className="relative inline-flex rounded-sp-sm focus-within:outline focus-within:outline-2 focus-within:outline-sp-violet-700">
          <input id={id} disabled={unavailable} type="file" accept="image/jpeg,image/png" className="pointer-events-none absolute inset-0 h-full w-full opacity-0" onChange={load} />
          <label htmlFor={id} aria-hidden="true" className={`${actionClass} ${unavailable ? 'opacity-40' : 'cursor-pointer'}`}>{labels.selectArtFile}</label>
        </div>
        {src && <button className={actionClass} disabled={unavailable} type="button" onClick={() => { setStatus(''); onChange(null); }}><X aria-hidden="true" size={16} />{labels.removeArt}</button>}
      </div>
      {status === 'pending' && <p className="mt-2 text-sm" role="status">{labels.uploadPending}</p>}
      {status === 'failed' && <p className="mt-2 text-sm text-sp-danger" role="alert">{labels.uploadFailed}</p>}
      {status === 'wide' && <p className="mt-2 text-sm text-sp-danger" role="alert">{labels.wideRequired}</p>}
    </div>
  );
}
