import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/components/i18n/i18nProvider";
import { X } from "lucide-react";
export function useDsToast() {
  const { toast, dismiss, dismissAll } = useToast();
  const { t } = useI18n();
  return {
    dismiss,
    dismissAll,
    toast: ({ undo, description, ...props }) => {
      let id;
      id = toast({
        ...props,
        className:
          "sp-shell border-sp-line bg-sp-card text-sp-ink-900 shadow-sp-2 [&>button]:hidden",
        description: (
          <>
            {description}
            <button
              type="button"
              aria-label={t("common.close")}
              className="absolute end-2 top-2 flex min-h-11 min-w-11 items-center justify-center rounded-sp-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-sp-violet-600"
              onClick={() => dismiss(id)}
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
            {undo && (
              <button
                type="button"
                className="ms-3 min-h-11 min-w-11 rounded-sp-sm text-sp-violet-700 underline hover:text-sp-violet-600 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sp-violet-600"
                onClick={() => {
                  dismiss(id);
                  undo.onClick();
                }}
              >
                {undo.label}
              </button>
            )}
          </>
        ),
      });
      return id;
    },
  };
}
