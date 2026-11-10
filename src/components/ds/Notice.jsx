import { Info, CircleCheck, TriangleAlert, CircleAlert } from "lucide-react";
const styles = {
  info: [Info, "bg-sp-violet-50 text-sp-ink-900"],
  success: [CircleCheck, "bg-sp-success-50 text-sp-success"],
  warning: [TriangleAlert, "bg-sp-cream-100 text-sp-ink-900"],
  danger: [CircleAlert, "bg-sp-danger-50 text-sp-danger"],
};
export function Notice({ tone = "info", title, action }) {
  const [Icon, style] = styles[tone] || styles.info;
  return (
    <div
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={`flex gap-3 rounded-sp-md p-4 ${style}`}
    >
      <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1">{action}</p>
      </div>
    </div>
  );
}
