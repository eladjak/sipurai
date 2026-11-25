import { useId } from "react";
import { Check } from "lucide-react";

export default function IllustratedChoice({ group, value, checked, onSelect, src, label, description = "", className = "min-h-36" }) {
  const descriptionId = useId();
  return (
    <label className={`group relative isolate flex cursor-pointer flex-col justify-end overflow-hidden rounded-2xl bg-slate-900 text-white outline-offset-4 focus-within:outline focus-within:outline-2 focus-within:outline-violet-700 ${className} ${checked ? "ring-2 ring-violet-600 ring-offset-2" : ""}`}>
      <input className="sr-only" name={group} type="radio" value={value} checked={checked} onChange={() => onSelect(value)}
        aria-label={label} aria-describedby={description ? descriptionId : undefined} />
      <img className="absolute inset-0 -z-10 block h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:scale-105 motion-safe:group-focus-within:scale-105"
        src={src} alt="" decoding="async" loading="lazy" />
      <span className="bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent px-3 pb-3 pt-8 text-start">
        <span className="block break-words text-base font-bold leading-tight">{label}</span>
        {description && <span id={descriptionId} className="mt-1 block text-sm leading-snug text-slate-100">{description}</span>}
      </span>
      {checked && <span className="absolute end-2 top-2 grid size-7 place-items-center rounded-full bg-violet-700" aria-hidden="true"><Check size={16} /></span>}
    </label>
  );
}
