import { Link } from "react-router-dom";
import "@/styles/sp-tokens.css";
import "@/styles/sp-fonts.css";

const actionClass = "inline-flex min-h-11 max-w-full items-center justify-center rounded-sp-sm bg-sp-violet-700 px-4 py-2 text-center font-semibold text-white hover:bg-purple-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sp-violet-700 motion-safe:transition-colors";

export default function EmptyState({ title, description = undefined, actionLabel = undefined, actionLink = undefined, onAction = undefined, status = undefined }) {
  return (
    <section className="sp-shell overflow-hidden rounded-sp-lg bg-sp-card text-sp-ink-900 ring-1 ring-sp-line">
      <div className="grid items-stretch sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <img src="/images/empty-library.jpg" alt="" width="1536" height="1024" decoding="async"
          className="block aspect-[16/9] h-full w-full object-cover sm:aspect-[3/2]" />
        <div className="flex min-w-0 flex-col items-start justify-center gap-4 px-5 py-5 sm:px-6 md:px-8 md:py-7">
          <div role={status} className="min-w-0 space-y-2">
            <h2 className="break-words font-sp-display text-2xl font-semibold leading-tight">{title}</h2>
            {description && <p className="max-w-prose leading-relaxed text-sp-ink-600">{description}</p>}
          </div>
          {actionLabel && actionLink && <Link className={actionClass} to={actionLink}>{actionLabel}</Link>}
          {actionLabel && onAction && <button type="button" className={actionClass} onClick={onAction}>{actionLabel}</button>}
        </div>
      </div>
    </section>
  );
}
