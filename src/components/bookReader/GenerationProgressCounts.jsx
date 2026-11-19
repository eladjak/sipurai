export default function GenerationProgressCounts({ t, ready, illustrated, total }) {
  if (!Number.isInteger(total) || total < 1) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums">
      <span>{t("spxWizard.writingCount", { ready, total })}</span>
      <span>{t("spxWizard.drawingCount", { ready: illustrated, total })}</span>
    </div>
  );
}
