import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Shield, Save, Lock, KeyRound, Check, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  getParentalControls,
  saveParentalControls,
  isPinSet,
  setParentalPin,
  verifyParentalPin,
  removeParentalPin,
} from "@/utils/content-moderation";
import { useI18n } from "@/components/i18n/i18nProvider";

/**
 * ParentalControls - Parental controls settings panel with PIN protection.
 * PIN code required to view/modify settings when set.
 */
export default function ParentalControls() {
  const { t, isRTL } = useI18n();
  const { toast } = useToast();
  const [controls, setControls] = useState(getParentalControls());
  const [isSaving, setIsSaving] = useState(false);

  // PIN state
  const [hasPinSet, setHasPinSet] = useState(isPinSet());
  const [isUnlocked, setIsUnlocked] = useState(!isPinSet());
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);

  // PIN setup state
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinSetupError, setPinSetupError] = useState("");

  // PIN removal state
  const [isRemovingPin, setIsRemovingPin] = useState(false);
  const [removeConfirmPin, setRemoveConfirmPin] = useState("");

  const updateControl = (key, value) => {
    setControls((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    setIsSaving(true);
    saveParentalControls(controls);
    setTimeout(() => {
      setIsSaving(false);
      toast({
        title: t("parentalControls.savedTitle"),
        description: t("parentalControls.savedDesc"),
        className: "bg-green-100 text-green-900 dark:bg-green-900/50 dark:text-green-100"
      });
    }, 300);
  };

  const handlePinUnlock = async () => {
    if (await verifyParentalPin(pinInput)) {
      setIsUnlocked(true);
      setPinError(false);
      setPinInput("");
    } else {
      setPinError(true);
      setPinInput("");
    }
  };

  const handleSetPin = async () => {
    setPinSetupError("");
    if (!/^\d{4,6}$/.test(newPin)) {
      setPinSetupError(t("parentalControls.pinMustBeDigits"));
      return;
    }
    if (newPin !== confirmPin) {
      setPinSetupError(t("parentalControls.pinNoMatch"));
      return;
    }
    const success = await setParentalPin(newPin);
    if (success) {
      setHasPinSet(true);
      setIsSettingPin(false);
      setNewPin("");
      setConfirmPin("");
      toast({
        title: t("parentalControls.pinSet"),
        description: t("parentalControls.pinSetDesc"),
        className: "bg-green-100 text-green-900 dark:bg-green-900/50 dark:text-green-100"
      });
    }
  };

  const handleRemovePin = async () => {
    const success = await removeParentalPin(removeConfirmPin);
    if (success) {
      setHasPinSet(false);
      setIsRemovingPin(false);
      setRemoveConfirmPin("");
      toast({
        title: t("parentalControls.pinRemoved"),
        description: t("parentalControls.pinRemovedDesc"),
      });
    } else {
      toast({
        variant: "destructive",
        title: t("parentalControls.wrongPin"),
        description: t("parentalControls.wrongPinDesc"),
      });
      setRemoveConfirmPin("");
    }
  };

  // --- PIN unlock screen ---
  if (!isUnlocked) {
    return (
      <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
        <Card className="border-amber-200 dark:border-amber-800">
          <CardContent className="p-8">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Lock className="h-8 w-8 text-amber-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {t("parentalControls.protected")}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t("parentalControls.enterPin")}
              </p>

              <div className="w-full max-w-[200px] space-y-3">
                <Input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder={t("parentalControls.pinPlaceholder")}
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value.replace(/\D/g, ''));
                    setPinError(false);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handlePinUnlock()}
                  className={`text-center text-2xl tracking-[0.5em] ${pinError ? 'border-red-500' : ''}`}
                  aria-label={t("parentalControls.enterPin")}
                />
                {pinError && (
                  <p className="text-sm text-red-500" role="alert">
                    {t("parentalControls.incorrectPin")}
                  </p>
                )}
                <Button
                  onClick={handlePinUnlock}
                  disabled={pinInput.length < 4}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  <KeyRound className="h-4 w-4 ml-2" aria-hidden="true" />
                  {t("parentalControls.unlock")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Main controls (unlocked) ---
  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header info */}
      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="p-4">
          <div className={`flex items-start gap-3 ${isRTL ? "flex-row-reverse text-right" : ""}`}>
            <Lock className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                {t("parentalControls.header")}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                {t("parentalControls.headerDesc")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PIN Management */}
      <Card>
        <CardHeader>
          <CardTitle className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse text-right" : ""}`}>
            <KeyRound className="h-5 w-5 text-indigo-600" />
            {t("parentalControls.pinProtection")}
          </CardTitle>
          <CardDescription className={isRTL ? "text-right" : ""}>
            {hasPinSet
              ? t("parentalControls.pinProtectedDesc")
              : t("parentalControls.pinUnprotectedDesc")
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasPinSet && !isSettingPin && (
            <Button
              onClick={() => setIsSettingPin(true)}
              variant="outline"
              className="gap-2"
            >
              <Lock className="h-4 w-4" aria-hidden="true" />
              {t("parentalControls.setPin")}
            </Button>
          )}

          {isSettingPin && (
            <div className="space-y-3 max-w-xs">
              <div>
                <Label>{t("parentalControls.newPin")}</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="****"
                  className="text-center tracking-widest"
                  aria-label={t("parentalControls.newPin")}
                />
              </div>
              <div>
                <Label>{t("parentalControls.confirmPin")}</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="****"
                  className="text-center tracking-widest"
                  aria-label={t("parentalControls.confirmPin")}
                />
              </div>
              {pinSetupError && (
                <p className="text-sm text-red-500" role="alert">{pinSetupError}</p>
              )}
              <div className="flex gap-2">
                <Button onClick={handleSetPin} className="bg-purple-600 hover:bg-purple-700 gap-1">
                  <Check className="h-4 w-4" aria-hidden="true" />
                  {t("parentalControls.save")}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsSettingPin(false);
                    setNewPin("");
                    setConfirmPin("");
                    setPinSetupError("");
                  }}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  {t("parentalControls.cancel")}
                </Button>
              </div>
            </div>
          )}

          {hasPinSet && !isRemovingPin && (
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="border-green-300 text-green-700 dark:text-green-300 gap-1">
                <Check className="h-3 w-3" />
                {t("parentalControls.pinActive")}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsRemovingPin(true)}
                className="text-red-500 hover:text-red-700"
              >
                {t("parentalControls.removePin")}
              </Button>
            </div>
          )}

          {isRemovingPin && (
            <div className="space-y-3 max-w-xs">
              <Label>{t("parentalControls.enterCurrentPin")}</Label>
              <Input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={removeConfirmPin}
                onChange={(e) => setRemoveConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="****"
                className="text-center tracking-widest"
                aria-label={t("parentalControls.enterCurrentPin")}
              />
              <div className="flex gap-2">
                <Button onClick={handleRemovePin} variant="destructive" size="sm" className="gap-1">
                  {t("parentalControls.remove")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsRemovingPin(false);
                    setRemoveConfirmPin("");
                  }}
                >
                  {t("parentalControls.cancel")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Content Filter Level */}
      <Card>
        <CardHeader>
          <CardTitle className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse text-right" : ""}`}>
            <Shield className="h-5 w-5 text-purple-600" />
            {t("parentalControls.contentFilter")}
          </CardTitle>
          <CardDescription className={isRTL ? "text-right" : ""}>
            {t("parentalControls.contentFilterDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            value={controls.contentFilterLevel}
            onValueChange={(value) => updateControl("contentFilterLevel", value)}
          >
            <SelectTrigger aria-label={t("parentalControls.selectFilter")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="strict">
                {t("parentalControls.filterStrict")}
              </SelectItem>
              <SelectItem value="moderate">
                {t("parentalControls.filterModerate")}
              </SelectItem>
              <SelectItem value="relaxed">
                {t("parentalControls.filterRelaxed")}
              </SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Age Range */}
      <Card>
        <CardHeader>
          <CardTitle className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse text-right" : ""}`}>
            {t("parentalControls.ageRange")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={controls.ageRange}
            onValueChange={(value) => updateControl("ageRange", value)}
          >
            <SelectTrigger aria-label={t("parentalControls.selectAge")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3-5">{t("parentalControls.ages35")}</SelectItem>
              <SelectItem value="5-7">{t("parentalControls.ages57")}</SelectItem>
              <SelectItem value="7-10">{t("parentalControls.ages710")}</SelectItem>
              <SelectItem value="10-12">{t("parentalControls.ages1012")}</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Toggles */}
      <Card>
        <CardHeader>
          <CardTitle className={isRTL ? "text-right" : ""}>
            {t("parentalControls.permissions")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className={`flex items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
            <Label className={isRTL ? "text-right" : ""}>
              {t("parentalControls.allowAI")}
            </Label>
            <Switch
              checked={controls.allowAIGeneration}
              onCheckedChange={(checked) => updateControl("allowAIGeneration", checked)}
              aria-label={t("parentalControls.allowAI")}
            />
          </div>
          <div className={`flex items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
            <Label className={isRTL ? "text-right" : ""}>
              {t("parentalControls.allowCommunity")}
            </Label>
            <Switch
              checked={controls.allowCommunitySharing}
              onCheckedChange={(checked) => updateControl("allowCommunitySharing", checked)}
              aria-label={t("parentalControls.allowCommunity")}
            />
          </div>
          <div className={`flex items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
            <Label className={isRTL ? "text-right" : ""}>
              {t("parentalControls.requireApproval")}
            </Label>
            <Switch
              checked={controls.requireApprovalBeforePublish}
              onCheckedChange={(checked) => updateControl("requireApprovalBeforePublish", checked)}
              aria-label={t("parentalControls.requireApproval")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Daily book limit */}
      <Card>
        <CardHeader>
          <CardTitle className={isRTL ? "text-right" : ""}>
            {t("parentalControls.dailyLimit")}
          </CardTitle>
          <CardDescription className={isRTL ? "text-right" : ""}>
            {t("parentalControls.dailyLimitDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className={`flex items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
            <Input
              type="number"
              min={1}
              max={20}
              value={controls.maxDailyBooks}
              onChange={(e) => updateControl("maxDailyBooks", parseInt(e.target.value) || 1)}
              className="w-24"
              aria-label={t("parentalControls.booksPerDayLabel")}
            />
            <span className="text-sm text-gray-500">
              {t("parentalControls.booksPerDay")}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <Button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full bg-purple-600 hover:bg-purple-700 gap-2"
        aria-label={t("parentalControls.saveButton")}
      >
        <Save className="h-4 w-4" aria-hidden="true" />
        {isSaving ? t("parentalControls.saving") : t("parentalControls.saveButton")}
      </Button>
    </div>
  );
}

// Badge component used above (inline since we only need it here)
function Badge({ children, variant = "default", className = "" }) {
  const baseClass = variant === "outline"
    ? "border rounded-full px-2 py-0.5 text-xs inline-flex items-center"
    : "rounded-full px-2 py-0.5 text-xs inline-flex items-center";
  return <span className={`${baseClass} ${className}`}>{children}</span>;
}
