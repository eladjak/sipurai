
/** Small friendly illustrations. Pure inline SVG, decorative (aria-hidden), no text inside. */
export function EmptyOrdersArt({ className = 'h-32 w-32' }) {
  return (
    <svg viewBox="0 0 160 160" className={className} aria-hidden="true" focusable="false">
      <ellipse cx="80" cy="140" rx="46" ry="8" fill="#ede9fe" />
      <path d="M32 70 80 48l48 22v52L80 144 32 122z" fill="#c4b5fd" />
      <path d="M32 70 80 92l48-22" fill="none" stroke="#7c3aed" strokeWidth="3" strokeLinejoin="round" />
      <path d="M80 92v52" stroke="#7c3aed" strokeWidth="3" />
      <path d="M32 70 56 58l48 22-24 12z" fill="#ddd6fe" />
      <rect x="62" y="22" width="36" height="46" rx="4" fill="#fff" stroke="#7c3aed" strokeWidth="3" transform="rotate(-8 80 45)" />
      <path d="M70 36h20M70 45h20M70 54h12" stroke="#a78bfa" strokeWidth="3" strokeLinecap="round" transform="rotate(-8 80 45)" />
      <circle cx="132" cy="38" r="5" fill="#fbbf24" />
      <circle cx="26" cy="46" r="3.5" fill="#f472b6" />
    </svg>
  );
}

export function SuccessBookArt({ className = 'h-28 w-28' }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true" focusable="false">
      <circle cx="60" cy="60" r="52" fill="#ecfdf5" />
      <circle cx="60" cy="60" r="40" fill="#10b981" />
      <path d="m40 61 14 14 27-30" fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="18" cy="30" r="4" fill="#fbbf24" />
      <circle cx="104" cy="24" r="3.5" fill="#f472b6" />
      <circle cx="100" cy="96" r="4.5" fill="#a78bfa" />
      <circle cx="16" cy="88" r="3" fill="#38bdf8" />
    </svg>
  );
}

export function WaitingPrinterArt({ className = 'h-24 w-24' }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true" focusable="false">
      <circle cx="60" cy="60" r="52" fill="#f5f3ff" />
      <rect x="34" y="40" width="52" height="32" rx="8" fill="#a78bfa" />
      <rect x="44" y="26" width="32" height="20" rx="3" fill="#fff" stroke="#7c3aed" strokeWidth="3" />
      <rect x="44" y="64" width="32" height="26" rx="3" fill="#fff" stroke="#7c3aed" strokeWidth="3" />
      <path d="M50 74h20M50 81h14" stroke="#c4b5fd" strokeWidth="3" strokeLinecap="round" />
      <circle cx="78" cy="50" r="3" fill="#fde68a" />
    </svg>
  );
}
