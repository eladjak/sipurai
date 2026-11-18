import { EDIT_INSTRUCTION_LIMIT, isSafeStoryText } from './model.js';

export async function suggestEditionRewrite({ text, instruction, language }) {
  if (!isSafeStoryText(text) || !instruction.trim() || instruction.length > EDIT_INSTRUCTION_LIMIT) {
    throw new Error('Invalid rewrite request');
  }
  const { InvokeLLM } = await import('@/integrations/Core');
  const result = await InvokeLLM({
    prompt: [
      'Edit this one page of an illustrated children’s book. Apply the parent’s instruction to the page text.',
      `Use the original language (${language}). Preserve character names, the events and facts of this scene, and the connection to the surrounding story.`,
      'Keep the length close to the original so the result can fit on the same printed page. Return only the replacement page text in JSON.',
      JSON.stringify({ text, instruction: instruction.trim() }),
    ].join('\n'),
    response_json_schema: { type: 'OBJECT', properties: { text: { type: 'STRING' } }, required: ['text'] },
    max_tokens: 2048,
  });
  if (!isSafeStoryText(result?.text)) throw new Error('Invalid rewrite response');
  return result.text.trim();
}
