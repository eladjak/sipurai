import { useState } from "react";
import { ImageOff } from "lucide-react";
import { useI18n } from "@/components/i18n/i18nProvider";

/** Keep the words readable if a stored image temporarily fails to load. */
export default function ReaderIllustration({
  src,
  alt,
  className,
  onAvailability,
}) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  return failed ? (
    <div className="reader-art-pending" role="status">
      <ImageOff aria-hidden="true" />
      <span>{t("bookView.noIllustration")}</span>
      <button
        type="button"
        className="min-h-11 rounded-full border px-4"
        onClick={() => setFailed(false)}
      >
        {t("common.retry")}
      </button>
    </div>
  ) : (
    <img
      src={src}
      alt={alt}
      className={className}
      onLoad={() => onAvailability(false)}
      onError={() => {
        setFailed(true);
        onAvailability(true);
      }}
    />
  );
}
