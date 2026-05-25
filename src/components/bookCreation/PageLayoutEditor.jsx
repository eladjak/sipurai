import { Settings } from "lucide-react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const LAYOUTS = [
  { value: "text_top", key: "book.textTop", topHalf: true, bottomHalf: false, direction: "col" },
  { value: "text_bottom", key: "book.textBottom", topHalf: false, bottomHalf: true, direction: "col" },
  { value: "text_left", key: "book.textLeft", leftHalf: true, rightHalf: false, direction: "row" },
  { value: "text_right", key: "book.textRight", leftHalf: false, rightHalf: true, direction: "row" }
];

/**
 * Accordion-based layout selector for book pages.
 * Shows visual previews of each layout option.
 */
export default function PageLayoutEditor({ currentPageLayout, onLayoutChange, isRTL, t }) {
  return (
    <Accordion
      type="single"
      collapsible
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
    >
      <AccordionItem value="layout">
        <AccordionTrigger className="px-4">
          <div className={`flex items-center ${isRTL ? "flex-row-reverse" : ""}`}>
            <Settings className={`h-5 w-5 text-purple-500 ${isRTL ? "ml-2" : "mr-2"}`} />
            <span>{t("book.pageLayout")}</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <RadioGroup
            className="grid grid-cols-2 gap-3"
            value={currentPageLayout}
            onValueChange={onLayoutChange}
            dir={isRTL ? "rtl" : "ltr"}
          >
            {LAYOUTS.map((layout) => (
              <div
                key={layout.value}
                className={`flex items-center gap-2 border border-gray-200 dark:border-gray-700 rounded-lg p-3 cursor-pointer hover:border-purple-300 transition-colors ${
                  currentPageLayout === layout.value ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20" : ""
                }`}
              >
                <RadioGroupItem value={layout.value} id={layout.value} />
                <Label htmlFor={layout.value} className="flex flex-col items-center cursor-pointer flex-1">
                  <LayoutThumbnail layout={layout} />
                  <span className="text-xs mt-1.5 font-medium">{t(layout.key)}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function LayoutThumbnail({ layout }) {
  if (layout.direction === "col") {
    return (
      <div className="w-20 h-12 bg-gray-100 dark:bg-gray-700 rounded flex flex-col overflow-hidden">
        <div className={`h-1/2 ${layout.topHalf ? "bg-purple-300 dark:bg-purple-700" : ""}`} />
        <div className={`h-1/2 ${layout.bottomHalf ? "bg-purple-300 dark:bg-purple-700" : ""}`} />
      </div>
    );
  }

  return (
    <div className="w-20 h-12 bg-gray-100 dark:bg-gray-700 rounded flex flex-row overflow-hidden">
      <div className={`w-1/2 ${layout.leftHalf ? "bg-purple-300 dark:bg-purple-700" : ""}`} />
      <div className={`w-1/2 ${layout.rightHalf ? "bg-purple-300 dark:bg-purple-700" : ""}`} />
    </div>
  );
}
