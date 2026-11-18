import { useId, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { uploadEditionArt } from '@/lib/printEdition/assets';
import { actionClass, textClass } from './labels';

export function EditionArtField({ label, labels, src, onChange, onBusy, disabled = false, spreadRatio = 0 }) {
  const id = useId();
  const [status, setStatus] = useState('');
  const load = async (event) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setStatus('pending');
    onBusy(1);
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
      {src && <img className="mt-2 max-h-36 w-full rounded-sp-sm object-contain" src={src} alt={label} />}
      <input id={id} disabled={disabled || status === 'pending'} type="file" accept="image/jpeg,image/png" className={`${textClass} min-h-11 min-w-0 file:me-2 file:rounded file:border-none file:bg-sp-violet-50 file:px-2 file:py-1 file:text-sm file:text-sp-violet-700`} onChange={load} />
      {src && <button className={`${actionClass} mt-2`} disabled={disabled || status === 'pending'} type="button" onClick={() => { setStatus(''); onChange(null); }}><X aria-hidden="true" size={16} />{labels.removeArt}</button>}
      {status === 'pending' && <p className="mt-2 text-sm" role="status">{labels.uploadPending}</p>}
      {status === 'failed' && <p className="mt-2 text-sm text-sp-danger" role="alert">{labels.uploadFailed}</p>}
      {status === 'wide' && <p className="mt-2 text-sm text-sp-danger" role="alert">{labels.wideRequired}</p>}
    </div>
  );
}
