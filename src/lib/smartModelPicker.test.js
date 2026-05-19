import { describe, it, expect } from 'vitest';
import { pickBestModel, isModelSupported, SUPPORTED_MODEL_IDS } from './smartModelPicker';

describe('smartModelPicker.pickBestModel', () => {
  it('routes Hebrew text to Gemini Pro when accessible', () => {
    const { modelId, reason } = pickBestModel({
      prompt: 'ילד קטן עם כלב חום בגינה',
      userTier: 'creator',
    });
    expect(modelId).toBe(SUPPORTED_MODEL_IDS.GEMINI_PRO);
    expect(reason).toBe('hebrew-text');
  });

  it('routes Hebrew text to Gemini Fast on free tier', () => {
    const { modelId, reason } = pickBestModel({
      prompt: 'ילד קטן עם כלב חום',
      userTier: 'free',
    });
    expect(modelId).toBe(SUPPORTED_MODEL_IDS.GEMINI_FAST);
    expect(reason).toBe('hebrew-text');
  });

  it('routes realistic photo prompts to DALL-E', () => {
    const { modelId, reason } = pickBestModel({
      prompt: 'A photorealistic portrait of a smiling child',
      userTier: 'free',
    });
    expect(modelId).toBe(SUPPORTED_MODEL_IDS.DALLE_3);
    expect(reason).toBe('realistic-style');
  });

  it('routes cartoon prompts to Gemini', () => {
    const { modelId, reason } = pickBestModel({
      prompt: 'A whimsical cartoon illustration for a storybook',
      userTier: 'free',
    });
    expect(modelId).toBe(SUPPORTED_MODEL_IDS.GEMINI_FAST);
    expect(reason).toBe('cartoon-style');
  });

  it('routes sketch/draft to Gemini Fast', () => {
    const { modelId, reason } = pickBestModel({
      prompt: 'Quick rough sketch of a dog',
      userTier: 'creator',
    });
    expect(modelId).toBe(SUPPORTED_MODEL_IDS.GEMINI_FAST);
    expect(reason).toBe('sketch-draft');
  });

  it('honours last manual pick when prompt has no strong signal', () => {
    const { modelId, reason } = pickBestModel({
      prompt: 'something neutral',
      userTier: 'creator',
      lastManualPick: SUPPORTED_MODEL_IDS.DALLE_3,
    });
    expect(modelId).toBe(SUPPORTED_MODEL_IDS.DALLE_3);
    expect(reason).toBe('last-manual-pick');
  });

  it('ignores last manual pick when prompt has Hebrew (signal wins)', () => {
    const { modelId, reason } = pickBestModel({
      prompt: 'טקסט בעברית',
      userTier: 'creator',
      lastManualPick: SUPPORTED_MODEL_IDS.DALLE_3,
    });
    expect(modelId).toBe(SUPPORTED_MODEL_IDS.GEMINI_PRO);
    expect(reason).toBe('hebrew-text');
  });

  it('falls back to Gemini Fast for free tier with no signal', () => {
    const { modelId, reason } = pickBestModel({
      prompt: 'just a generic thing',
      userTier: 'free',
    });
    expect(modelId).toBe(SUPPORTED_MODEL_IDS.GEMINI_FAST);
    expect(reason).toBe('free-tier-default');
  });

  it('never returns an unsupported model id', () => {
    const result = pickBestModel({ prompt: '', userTier: 'free' });
    expect(isModelSupported(result.modelId)).toBe(true);
  });
});
