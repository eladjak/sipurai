import IllustratedChoice from "@/components/wizard/IllustratedChoice";
import { artStylePreviewSource } from "@/components/wizard/artStylePreview";
import PrintSizeStep from "@/components/wizard/PrintSizeStep";
import PrintPreferences from "@/screens/print-edition/PrintPreferences";

const lengths = ["short", "medium", "long"];
const styles = [
  "disney",
  "watercolor",
  "cartoon",
  "realistic",
  "comic",
  "storybook",
  "anime",
  "impressionist",
  "pixar",
  "minimalist",
  "vintage",
  "fantasy",
  "pop_art",
  "crayon",
  "collage",
  "gouache",
  "chibi",
];
const control =
  "min-h-12 w-full rounded-sp-sm border border-sp-line bg-sp-card px-4 text-sp-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sp-violet-600";
export default function ReadyStep({
  length,
  style,
  setLength,
  setStyle,
  printSize,
  setPrintSize,
  printEdition,
  setPrintEdition,
  t,
  isRTL,
}) {
  const labels = [
    t("newStory.styles0"),
    t("newStory.styles1"),
    t("newStory.styles2"),
    t("newStory.styles3"),
    t("newStory.styles4"),
    t("newStory.styles5"),
    t("newStory.styles6"),
    t("newStory.styles7"),
    t("newStory.styles8"),
    t("newStory.styles9"),
    t("newStory.styles10"),
    t("newStory.styles11"),
    t("newStory.styles12"),
    t("newStory.styles13"),
    t("newStory.styles14"),
    t("newStory.styles15"),
    t("newStory.styles16"),
  ];
  const lengthLabels = [
    t("newStory.lengths0"),
    t("newStory.lengths1"),
    t("newStory.lengths2"),
  ];
  return (
    <section>
      <h2 className="font-sp-display text-sp-2xl font-semibold">
        {t("newStory.ready")}
      </h2>
      <label htmlFor="story-length" className="mt-6 block font-semibold">
        {t("newStory.length")}
      </label>
      <select
        id="story-length"
        className={control}
        value={length}
        onChange={(event) => setLength(event.target.value)}
      >
        {lengths.map((value, index) => (
          <option key={value} value={value}>
            {lengthLabels[index]}
          </option>
        ))}
      </select>
      <fieldset className="mt-6">
        <legend className="pb-3 font-semibold">{t("newStory.style")}</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {styles.map((value, index) => (
            <IllustratedChoice
              key={value}
              group="illustration-style"
              value={value}
              checked={value === style}
              onSelect={setStyle}
              src={artStylePreviewSource(value)}
              label={labels[index]}
            />
          ))}
        </div>
      </fieldset>
      <p className="mt-6 rounded-sp-md bg-sp-violet-50 p-4 text-sp-ink-900">
        {t("newStory.cost")}
      </p>
      <div className="mt-8">
        <PrintSizeStep
          artStyle={style}
          value={printSize}
          onChange={setPrintSize}
          length={length}
          isRTL={isRTL}
        />
      </div>
      <PrintPreferences
        isRTL={isRTL}
        compact
        value={printEdition}
        onChange={setPrintEdition}
      />
    </section>
  );
}
