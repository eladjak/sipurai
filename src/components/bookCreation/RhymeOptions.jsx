import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useI18n } from "@/components/i18n/i18nProvider";

export default function RhymeOptions({ rhymeSettings, setRhymeSettings }) {
  const { t, isRTL } = useI18n();

  const handleChange = (field, value) => {
    setRhymeSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="space-y-4" dir={isRTL ? "rtl" : "ltr"}>
      <div className="space-y-2">
        <Label htmlFor="rhymePattern">{t("rhyme.pattern.label")}</Label>
        <Select
          id="rhymePattern"
          value={rhymeSettings.pattern}
          onValueChange={(value) => handleChange("pattern", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("rhyme.pattern.label")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="aabb">{t("rhyme.pattern.aabb")}</SelectItem>
            <SelectItem value="abab">{t("rhyme.pattern.abab")}</SelectItem>
            <SelectItem value="abcb">{t("rhyme.pattern.abcb")}</SelectItem>
            <SelectItem value="abba">{t("rhyme.pattern.abba")}</SelectItem>
            <SelectItem value="monorhyme">{t("rhyme.pattern.monorhyme")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="rhymeMeter">{t("rhyme.meter.label")}</Label>
        <Select
          id="rhymeMeter"
          value={rhymeSettings.meter}
          onValueChange={(value) => handleChange("meter", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("rhyme.meter.label")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="iambic">{t("rhyme.meter.iambic")}</SelectItem>
            <SelectItem value="trochaic">{t("rhyme.meter.trochaic")}</SelectItem>
            <SelectItem value="anapestic">{t("rhyme.meter.anapestic")}</SelectItem>
            <SelectItem value="dactylic">{t("rhyme.meter.dactylic")}</SelectItem>
            <SelectItem value="free">{t("rhyme.meter.free")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between">
          <Label htmlFor="complexity">{t("rhyme.complexity.label")}</Label>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {rhymeSettings.complexity === "simple" ? t("rhyme.complexity.simple") :
             rhymeSettings.complexity === "moderate" ? t("rhyme.complexity.moderate") :
             t("rhyme.complexity.complex")}
          </span>
        </div>
        <Select
          id="complexity"
          value={rhymeSettings.complexity}
          onValueChange={(value) => handleChange("complexity", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("rhyme.complexity.label")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="simple">{t("rhyme.complexity.simple")}</SelectItem>
            <SelectItem value="moderate">{t("rhyme.complexity.moderate")}</SelectItem>
            <SelectItem value="complex">{t("rhyme.complexity.complex")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
