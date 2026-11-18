import { useI18n } from "@/components/i18n/i18nProvider";
import { useId } from "react";
import { BookOpen, Layers } from "lucide-react";
import { editionDraft } from "@/lib/printEdition/model";
import useSubscription from "@/hooks/useSubscription";
import {
  configuredPrintEditionPolicy as policy,
  printEditionCapabilities,
} from "@/lib/printEdition/policy";
import { preferenceClass } from "./labels";

export const paperOptions = (t) => [
  [
    "standard",
    t("print.paperChoice.standard"),
    t("print.paperChoice.standardHint"),
  ],
  [
    "chrome-matte-130",
    t("print.paperChoice.matte130"),
    t("print.paperChoice.matte130Hint"),
  ],
  [
    "chrome-matte-170",
    t("print.paperChoice.matte170"),
    t("print.paperChoice.matte170Hint"),
  ],
];

export default function PaperPreferences(props) {
  if (typeof props.allowUpgradedPaper === "boolean")
    return <Controls {...props} />;
  if (policy === "subscriber-preview")
    return <SubscribedPreferences {...props} />;
  return (
    <Controls
      {...props}
      allowUpgradedPaper={printEditionCapabilities(policy).upgradedPaper}
    />
  );
}
function SubscribedPreferences(props) {
  const { plan } = useSubscription();
  return (
    <Controls
      {...props}
      allowUpgradedPaper={printEditionCapabilities(policy, plan).upgradedPaper}
    />
  );
}
function Controls({
  value,
  onChange,
  isRTL,
  compact = false,
  allowUpgradedPaper,
}) {
  const id = useId();
  const { t } = useI18n();
  const edition = value || editionDraft();
  const choices = (
    <div className="grid gap-4 sm:grid-cols-2">
      <fieldset className="min-w-0">
        <legend className="mb-2 flex items-center gap-2 font-semibold">
          <BookOpen size={17} aria-hidden="true" />
          {t("print.paperChoice.cover")}
        </legend>
        <label
          className={`${preferenceClass} flex min-h-11 items-center gap-3`}
        >
          <input
            type="radio"
            name={`${id}-cover`}
            checked={edition.cover !== "hardcover"}
            onChange={() => onChange({ ...edition, cover: "softcover" })}
          />
          {t("print.paperChoice.softcover")}
        </label>
        <p className="mt-2 text-sm text-sp-ink-600">
          {t("print.paperChoice.hardSoon")}
        </p>
        {edition.cover === "hardcover" && (
          <p role="status" className="mt-2 text-sm">
            {t("print.paperChoice.legacyCover")}
          </p>
        )}
      </fieldset>
      <fieldset className="min-w-0">
        <legend className="mb-2 flex items-center gap-2 font-semibold">
          <Layers size={17} aria-hidden="true" />
          {t("print.paperChoice.paper")}
        </legend>
        <div className="grid gap-2">
          {paperOptions(t).map(([option, name, hint]) => (
            <label
              key={option}
              className={`min-h-11 cursor-pointer ${preferenceClass} flex items-start gap-3 focus-within:outline focus-within:outline-2 focus-within:outline-sp-violet-700 ${edition.paper === option ? "border-sp-violet-700 bg-sp-violet-50" : ""}`}
            >
              <input
                className="mt-1.5 shrink-0 accent-sp-violet-700"
                type="radio"
                name={`${id}-paper`}
                checked={edition.paper === option}
                disabled={option !== "standard" && !allowUpgradedPaper}
                onChange={() => onChange({ ...edition, paper: option })}
              />
              <span>
                <span className="block text-sm font-semibold">{name}</span>
                <span className="block text-xs leading-relaxed text-sp-ink-600">
                  {option !== "standard" && !allowUpgradedPaper
                    ? t("print.paperChoice.unavailablePlan")
                    : hint}
                </span>
              </span>
            </label>
          ))}
          {edition.paper === "premium" && (
            <p role="status" className="text-sm">
              {t("print.paperChoice.legacyPaper")}
            </p>
          )}
        </div>
      </fieldset>
      <p className="text-sm text-sp-ink-600 sm:col-span-2">
        {t("print.paperChoice.hint")}
      </p>
    </div>
  );
  if (!compact) return choices;
  return (
    <details
      className="sp-shell mt-6 rounded-sp-md border border-sp-line bg-sp-card px-4 text-sp-ink-900"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <summary className="min-h-11 cursor-pointer py-3 font-semibold">
        {t("print.paperChoice.preferences")}
      </summary>
      <div className="pb-4">{choices}</div>
    </details>
  );
}
