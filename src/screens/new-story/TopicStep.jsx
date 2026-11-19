import { useEffect } from "react";
import IllustratedChoice from "@/components/wizard/IllustratedChoice";
import SuggestionChips from "@/screens/suggestions/SuggestionChips";
import { useCurrentUser } from "@/hooks/useCurrentUser";
export default function TopicStep({ value, change, t }) {
  const { user } = useCurrentUser();
  useEffect(() => {
    try {
      if (!user?.id) return;
      const raw = sessionStorage.getItem("sipurai_pending_idea");
      if (raw) {
        const idea = JSON.parse(raw);
        if (idea.ownerId !== user.id) return;
        sessionStorage.removeItem("sipurai_pending_idea");
        const text = [idea.title, idea.description]
          .filter((x) => typeof x === "string" && x.trim())
          .join(" — ")
          .slice(0, 500);
        if (text) {
          change(text);
          return;
        }
      }
    } catch {
      /* storage unavailable */
    }
  }, [user?.id]);
  return (
    <section>
      <h2 className="font-sp-display text-sp-2xl font-semibold">
        {t("newStory.topic")}
      </h2>
      <p className="mt-2 text-sp-ink-600">{t("newStory.topicHint")}</p>
      <label className="sr-only" htmlFor="story-topic">
        {t("newStory.topic")}
      </label>
      <textarea
        id="story-topic"
        value={value}
        onChange={(e) => change(e.target.value)}
        placeholder={t("newStory.example")}
        maxLength={500}
        className="mt-6 min-h-32 w-full rounded-sp-md border border-sp-line bg-sp-card p-4 text-sp-ink-900 placeholder:text-sp-ink-600 placeholder:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sp-violet-600"
      />
      <fieldset className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <legend className="sr-only">{t("newStory.topicHint")}</legend>
        {[
          ["animals", t("newStory.ideas0")],
          ["space", t("newStory.ideas1")],
          ["family", t("newStory.ideas2")],
          ["adventure", t("newStory.ideas3")],
          ["nature", t("newStory.ideas4")],
        ].map(([id, idea]) => (
          <IllustratedChoice key={id} group="story-topic-idea" value={idea}
            checked={value === idea} onSelect={change} src={`/images/spx/topics/${id}.webp`} label={idea} />
        ))}
      </fieldset>
      <SuggestionChips t={t} onChoose={change} />
    </section>
  );
}
