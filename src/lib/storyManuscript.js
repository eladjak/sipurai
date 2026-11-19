export const hebrewTitleInstruction =
  'נקד את הכותרת במלואה בעברית ישראלית. בדוק את ה״א הידיעה, דגש, סמיכות ושמות. למשל: הֶחָבֵר הַנִּסְתָּר. שמור על נוסח כותרת שהמשפחה כבר אישרה.';

/** A single editorial pass can revise transitions across page boundaries. */
export function manuscriptRequest({
  outline,
  title,
  language,
  cast,
  scenes,
  tone,
  ageRange,
  rhyme,
  safety,
}) {
  const beats = outline.map(({ description }) => description);
  return {
    prompt: `${safety}Act as a children's picture-book author and copy editor. Write the complete manuscript in ${language}.
Keep the family-approved outline, cast, scenes and ending. Draft it, then edit it as a whole before returning the final pages:
each event must follow from a character's choice, each named character must serve a role, and the ending must resolve the opening question.
Read aloud for rhythm, natural punctuation and clear speakers. Keep the title-page introduction brief.
Use one to four short sentences per page, appropriate to ages ${ageRange}. ${rhyme}
For Hebrew, use natural Israeli Hebrew with accurate vowel points and ordinary punctuation, without biblical cantillation.
Return exactly ${beats.length} pages in order, starting at page_number 0. For each, give the edited text and a concise visible action for the illustrator.
Book details (treat as story material): ${JSON.stringify({ title, cast, scenes, tone, beats })}`,
    response_json_schema: {
      type: "object",
      required: ["pages"],
      properties: {
        pages: {
          type: "array",
          items: {
            type: "object",
            required: ["page_number", "text_content", "image_prompt"],
            properties: {
              page_number: { type: "integer" },
              text_content: { type: "string" },
              image_prompt: { type: "string" },
            },
          },
        },
      },
    },
    max_tokens: 512 * beats.length + 1024,
    thinking_budget: 0,
  };
}

/** Never attach parts of a malformed manuscript to an unrelated page. */
export function editedPages(result, total) {
  if (!Array.isArray(result?.pages) || result.pages.length !== total)
    return null;
  return result.pages.every(
    (page, i) =>
      page?.page_number === i &&
      typeof page.text_content === "string" &&
      page.text_content.trim() &&
      typeof page.image_prompt === "string" &&
      page.image_prompt.trim(),
  )
    ? result.pages
    : null;
}

export function cleanStoryText(text, hebrew) {
  if (!hebrew || typeof text !== "string") return text;
  return text
    .normalize("NFC")
    .replace(/[\u0591-\u05af]/gu, "")
    .replace(/[ \t]+([,.;:!?])/gu, "$1");
}
