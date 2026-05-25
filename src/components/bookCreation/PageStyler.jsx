import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Type, AlignLeft, AlignCenter, AlignRight, AlignJustify } from "lucide-react";
import { useI18n } from "@/components/i18n/i18nProvider";

export default function PageStyler({ textStyles, setTextStyles, bookLanguage, onApplyStyles }) {
  const { t, isRTL } = useI18n();

  const fonts = [
    { value: "Arial", label: "Arial" },
    { value: "Times New Roman", label: "Times New Roman" },
    { value: "Courier New", label: "Courier New" },
    { value: "Georgia", label: "Georgia" },
    { value: "Verdana", label: "Verdana" },
    { value: "Tahoma", label: "Tahoma" },
    // Fonts good for Hebrew
    { value: "David", label: t("book.styler.fontDavid") },
    { value: "Miriam", label: t("book.styler.fontMiriam") },
    { value: "Narkisim", label: t("book.styler.fontNarkisim") },
    { value: "Guttman Yad", label: t("book.styler.fontGuttmanYad") }
  ];

  const handleChange = (field, value) => {
    setTextStyles(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const getExampleText = () => {
    if (bookLanguage === "hebrew") {
      return textStyles.showNikud
        ? "הָיֹה הָיָה סִפּוּר מְיֻחָד לִילָדִים"
        : "היה היה סיפור מיוחד לילדים";
    } else if (bookLanguage === "yiddish") {
      return "אַ מאָל איז געווען אַ באַזונדער מעשׂה פֿאַר קינדער";
    } else {
      return "Once upon a time there was a special story for children";
    }
  };

  const getExampleStyle = () => {
    return {
      fontSize: `${textStyles.fontSize}px`,
      fontFamily: textStyles.fontFamily,
      color: textStyles.color,
      fontWeight: textStyles.fontWeight,
      textAlign: textStyles.alignment,
      lineHeight: textStyles.lineHeight,
      direction: isRTL ? "rtl" : "ltr"
    };
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>
            <Type className="h-5 w-5 mr-2 inline-block text-purple-500" />
            {t("book.styler.title")}
          </CardTitle>
          <CardDescription>
            {t("book.styler.subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="fontSize">{t("book.styler.fontSize")}: {textStyles.fontSize}px</Label>
            </div>
            <Slider
              id="fontSize"
              min={12}
              max={36}
              step={1}
              value={[textStyles.fontSize]}
              onValueChange={(value) => handleChange("fontSize", value[0])}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fontFamily">{t("book.styler.fontFamily")}</Label>
            <Select
              value={textStyles.fontFamily}
              onValueChange={(value) => handleChange("fontFamily", value)}
            >
              <SelectTrigger id="fontFamily">
                <SelectValue placeholder={t("book.styler.selectFont")} />
              </SelectTrigger>
              <SelectContent>
                {fonts.map((font) => (
                  <SelectItem key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                    {font.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fontWeight">{t("book.styler.fontWeight")}</Label>
            <Select
              value={textStyles.fontWeight}
              onValueChange={(value) => handleChange("fontWeight", value)}
            >
              <SelectTrigger id="fontWeight">
                <SelectValue placeholder={t("book.styler.selectWeight")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">{t("book.styler.weightNormal")}</SelectItem>
                <SelectItem value="bold">{t("book.styler.weightBold")}</SelectItem>
                <SelectItem value="lighter">{t("book.styler.weightLight")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="textColor">{t("book.styler.textColor")}</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                id="textColor"
                value={textStyles.color}
                onChange={(e) => handleChange("color", e.target.value)}
                className="w-12 h-10 p-1"
              />
              <Input
                type="text"
                value={textStyles.color}
                onChange={(e) => handleChange("color", e.target.value)}
                className="flex-1"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("book.styler.textAlignment")}</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={textStyles.alignment === "left" ? "default" : "outline"}
                className="flex-1"
                onClick={() => handleChange("alignment", "left")}
              >
                <AlignLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant={textStyles.alignment === "center" ? "default" : "outline"}
                className="flex-1"
                onClick={() => handleChange("alignment", "center")}
              >
                <AlignCenter className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant={textStyles.alignment === "right" ? "default" : "outline"}
                className="flex-1"
                onClick={() => handleChange("alignment", "right")}
              >
                <AlignRight className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant={textStyles.alignment === "justify" ? "default" : "outline"}
                className="flex-1"
                onClick={() => handleChange("alignment", "justify")}
              >
                <AlignJustify className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="lineHeight">{t("book.styler.lineHeight")}: {textStyles.lineHeight}</Label>
            </div>
            <Slider
              id="lineHeight"
              min={1}
              max={2.5}
              step={0.1}
              value={[textStyles.lineHeight]}
              onValueChange={(value) => handleChange("lineHeight", value[0])}
            />
          </div>

          {(bookLanguage === "hebrew" || bookLanguage === "yiddish") && (
            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="showNikud">{t("book.styler.showNikud")}</Label>
              <Switch
                id="showNikud"
                checked={textStyles.showNikud}
                onCheckedChange={(checked) => handleChange("showNikud", checked)}
              />
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={() => onApplyStyles(textStyles)} className="w-full">
            {t("book.styler.applyStyles")}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("book.styler.preview")}</CardTitle>
          <CardDescription>
            {t("book.styler.previewSubtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 min-h-[300px] flex items-center justify-center"
            dir={isRTL ? "rtl" : "ltr"}
          >
            <p style={getExampleStyle()} className="max-w-full">
              {getExampleText()}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
