export function StepIndicator({ steps, current, compact = false, label }) {
  return (
    <nav aria-label={label}>
      <ol className="flex gap-2">
        {steps.map((step, index) => (
          <li
            key={index}
            aria-current={index === current ? "step" : undefined}
            className="min-w-0 flex-1 text-start"
          >
            <span
              aria-hidden="true"
              className={`block h-1 rounded-full ${index === current ? "h-2 bg-sp-violet-700" : index < current ? "bg-sp-violet-100" : "bg-sp-line"}`}
            />
            <span
              className={`mt-2 block ${index === current ? "font-semibold text-sp-ink-900" : "text-sp-ink-600"} ${compact ? "text-sp-xs" : "text-sp-sm"}`}
            >
              {step}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
