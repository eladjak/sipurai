export function StepIndicator({ steps, current, compact = false, label }) {
  return <nav aria-label={label}><ol className="flex gap-2">{steps.map((step, index) => <li key={index} aria-current={index === current ? 'step' : undefined} className="min-w-0 flex-1 text-start">
    <span aria-hidden="true" className={`block h-1 rounded-full ${index <= current ? 'bg-sp-violet-600' : 'bg-sp-line'}`} />
    <span className={`mt-2 block text-sp-ink-600 ${compact ? 'text-sp-xs' : 'text-sp-sm'}`}>{step}</span>
  </li>)}</ol></nav>;
}
