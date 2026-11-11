export function EmptyState({
  illustration,
  title,
  description,
  action,
  quietAction,
  headingLevel = 2,
}) {
  /** @type {import('react').ElementType} */
  const Heading = `h${headingLevel}`;
  return (
    <section className="flex flex-col items-center gap-4 p-6 text-center text-sp-ink-900">
      {illustration && <div aria-hidden="true">{illustration}</div>}
      <Heading className="font-sp-display text-sp-xl font-semibold">
        {title}
      </Heading>
      {description && <p className="text-sp-ink-600">{description}</p>}
      {action}
      {quietAction}
    </section>
  );
}
