import { useState } from 'react';
import { useI18n } from "@/components/i18n/i18nProvider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Star, Lightbulb, HelpCircle } from 'lucide-react';

export default function FeedbackForm({ onSubmit, onCancel }) {
  const { t } = useI18n();
  const [content, setContent] = useState("");
  const [rating, setRating] = useState(5);
  const [feedbackType, setFeedbackType] = useState("general");
  const [isSuggestion, setIsSuggestion] = useState(false);
  const [privacy, setPrivacy] = useState("public");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleSubmit = async () => {
    if (!content.trim()) return;
    
    setIsSubmitting(true);
    
    const feedbackData = {
      content,
      rating,
      feedback_type: feedbackType,
      is_suggestion: isSuggestion,
      privacy
    };
    
    const success = await onSubmit(feedbackData);
    
    if (!success) {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label htmlFor="content">{t("feedback.form.yourFeedback")}</Label>
          <HoverCard>
            <HoverCardTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 p-0">
                <HelpCircle className="h-4 w-4 text-gray-400" />
              </Button>
            </HoverCardTrigger>
            <HoverCardContent className="w-80">
              <div className="space-y-2">
                <h4 className="font-medium">{t("feedback.form.guidelines.title")}</h4>
                <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1 list-disc pl-4">
                  {(t("feedback.form.guidelines.tips") || []).map((tip, i) => (
                    <li key={i}>{tip}</li>
                  ))}
                </ul>
              </div>
            </HoverCardContent>
          </HoverCard>
        </div>
        <Textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t("feedback.form.placeholder")}
          className="min-h-[120px]"
        />
      </div>
      
      <div className="space-y-2">
        <Label>{t("feedback.form.ratingLabel")}</Label>
        <div className="flex">
          {[1, 2, 3, 4, 5].map((star) => (
            <Button
              key={star}
              type="button"
              variant="ghost"
              className="p-0 w-10 h-10"
              onClick={() => setRating(star)}
            >
              <Star
                className={`h-8 w-8 ${
                  star <= rating ? "text-amber-500 fill-amber-500" : "text-gray-300"
                }`}
              />
            </Button>
          ))}
        </div>
      </div>
      
      <div className="space-y-2">
        <Label>{t("feedback.form.typeLabel")}</Label>
        <Select value={feedbackType} onValueChange={setFeedbackType}>
          <SelectTrigger>
            <SelectValue placeholder={t("feedback.form.typePlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="general">{t("feedback.form.types.general")}</SelectItem>
            <SelectItem value="story">{t("feedback.form.types.story")}</SelectItem>
            <SelectItem value="illustrations">{t("feedback.form.types.illustrations")}</SelectItem>
            <SelectItem value="language">{t("feedback.form.types.language")}</SelectItem>
            <SelectItem value="age_appropriate">{t("feedback.form.types.age_appropriate")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="flex items-start space-x-2">
        <Checkbox 
          id="is-suggestion" 
          checked={isSuggestion}
          onCheckedChange={setIsSuggestion}
        />
        <div className="grid gap-1.5 leading-none">
          <Label
            htmlFor="is-suggestion"
            className="flex items-center gap-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            <Lightbulb className="h-4 w-4 text-amber-500" />
            {t("feedback.form.suggestionLabel")}
          </Label>
          <p className="text-sm text-muted-foreground text-gray-500 dark:text-gray-400">
            {t("feedback.form.suggestionDescription")}
          </p>
        </div>
      </div>
      
      <div className="space-y-2">
        <Label>{t("feedback.form.privacyLabel")}</Label>
        <RadioGroup value={privacy} onValueChange={setPrivacy} className="flex flex-col space-y-2">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="public" id="public" />
            <Label htmlFor="public">{t("feedback.form.privacyOptions.public")}</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="collaborators" id="collaborators" />
            <Label htmlFor="collaborators">{t("feedback.form.privacyOptions.collaborators")}</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="private" id="private" />
            <Label htmlFor="private">{t("feedback.form.privacyOptions.private")}</Label>
          </div>
        </RadioGroup>
      </div>
      
      <div className="flex justify-end gap-3 pt-4">
        <Button variant="outline" onClick={onCancel}>
          {t("feedback.cancel")}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!content.trim() || isSubmitting}
          className="bg-purple-600 hover:bg-purple-700"
        >
          {isSubmitting ? t("feedback.form.submitting") : t("feedback.form.submitButton")}
        </Button>
      </div>
    </div>
  );
}