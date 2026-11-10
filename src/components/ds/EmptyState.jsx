export function EmptyState({ illustration, title, description, action, quietAction }) {
  return <section className="flex flex-col items-center gap-4 p-6 text-center text-sp-ink-900">
    {illustration && <div aria-hidden="true">{illustration}</div>}
    <h2 className="font-sp-display text-sp-xl font-semibold">{title}</h2>
    {description && <p className="text-sp-ink-600">{description}</p>}
    {action}{quietAction}
  </section>;
}
