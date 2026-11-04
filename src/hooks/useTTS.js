import { useState, useEffect, useCallback, useRef } from 'react';
import { synthesize, getDefaultVoice } from '../lib/ttsProvider';
import { getNarrationPreset } from '../lib/storyBible';

/**
 * Hook for Text-to-Speech narration with language-aware voice selection.
 *
 * Two engines:
 *   - 'browser' (default): Web Speech API (speechSynthesis) — free, robotic, often poor Hebrew
 *   - 'openai' / 'gemini': cloud TTS via /api/ai/tts — natural voices, slight latency, costs $
 *
 * @param {Object} options
 * @param {'english'|'hebrew'|'yiddish'} options.language
 * @param {'browser'|'openai'|'gemini'} [options.engine='browser']
 * @param {string} [options.voice] - voice name for cloud engines (default per-engine)
 * @returns {{ speak, stop, pause, resume, isSpeaking, isPaused, currentWordIndex, rate, setRate, engine }}
 */
export function useTTS({ language = 'english', engine = 'browser', voice } = {}) {
  const cloudAudioRef = useRef(null);
  const cloudUrlRef = useRef(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [rate, setRate] = useState(1);
  const utteranceRef = useRef(null);
  const wordsRef = useRef([]);
  const [notice, setNotice] = useState('');
  const browserFallbackRef = useRef(false);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  // Get the best available voice for the language
  const getVoice = useCallback(() => {
    const voices = window.speechSynthesis?.getVoices() || [];

    const langMap = {
      hebrew: ['he', 'he-IL', 'iw'],
      yiddish: ['yi', 'he', 'he-IL'],
      english: ['en', 'en-US', 'en-GB']
    };

    const langCodes = langMap[language] || langMap.english;

    for (const code of langCodes) {
      const voice = voices.find(v => v.lang.startsWith(code));
      if (voice) return voice;
    }

    return voices[0] || null;
  }, [language]);

  const speakBrowser = useCallback((text) => {
    if (!window.speechSynthesis || !text) return false;

    window.speechSynthesis.cancel();
    setCurrentWordIndex(-1);

    const words = text.split(/\s+/).filter(Boolean);
    wordsRef.current = words;

    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;

    const voice = getVoice();
    if (voice) utterance.voice = voice;

    utterance.rate = rate;
    utterance.pitch = 1;

    // Word boundary events for highlight-as-you-read
    let charIndex = 0;
    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        // Map character index to word index
        const textBefore = text.substring(0, event.charIndex);
        const wordIndex = textBefore.split(/\s+/).filter(Boolean).length;
        setCurrentWordIndex(wordIndex);
      }
    };

    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
      setCurrentWordIndex(-1);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setIsPaused(false);
      setCurrentWordIndex(-1);
    };

    window.speechSynthesis.speak(utterance);
    return true;
  }, [getVoice, rate]);

  // ── Cloud engines (OpenAI / Gemini) — fetch audio bytes, play via <audio> ──
  const speakCloud = useCallback(async (text) => {
    if (!text) return;
    browserFallbackRef.current = false;
    try {
      stopCloud();
      const v = voice ?? getDefaultVoice(engine, language);
      // Hebrew narration steering (Sprint-24 presets, wired 2026-07-05):
      // OpenAI voices are EN-tuned; the preset instructions direct warm,
      // slower Israeli-Hebrew storytelling. OpenAI-only (the Gemini proxy
      // path has no instructions param).
      const instructions =
        engine === 'openai' && (language === 'hebrew' || language === 'yiddish')
          ? getNarrationPreset('playful').instructions
          : undefined;
      const { url } = await synthesize({ text, provider: engine, voice: v, instructions });
      cloudUrlRef.current = url;
      const audio = new Audio(url);
      audio.playbackRate = rate;
      cloudAudioRef.current = audio;
      audio.onplay = () => { setIsSpeaking(true); setIsPaused(false); };
      audio.onpause = () => setIsPaused(true);
      audio.onended = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        setCurrentWordIndex(-1);
        if (cloudUrlRef.current) { URL.revokeObjectURL(cloudUrlRef.current); cloudUrlRef.current = null; }
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        setIsPaused(false);
      };
      await audio.play();
    } catch (err) {
      console.error('[useTTS] cloud TTS failed, falling back to browser speech:', err);
      stopCloud();
      // Never silence: if the natural voice is unavailable (retired model, network, quota),
      // read with the browser voice and tell the user why it sounds different.
      const started = speakBrowser(text);
      if (started) {
        browserFallbackRef.current = true;
        setNotice('הקול הטבעי לא זמין כרגע, מקריאים בקול של הדפדפן');
      } else {
        setIsSpeaking(false);
        setNotice('ההקראה לא זמינה כרגע בדפדפן הזה');
      }
    }
  }, [engine, voice, language, rate, speakBrowser]);

  function stopCloud() {
    if (cloudAudioRef.current) {
      cloudAudioRef.current.pause();
      cloudAudioRef.current.currentTime = 0;
      cloudAudioRef.current = null;
    }
    if (cloudUrlRef.current) { URL.revokeObjectURL(cloudUrlRef.current); cloudUrlRef.current = null; }
  }

  const speak = useCallback((text) => {
    if (engine !== 'browser') { setNotice(''); speakCloud(text); return; }
    speakBrowser(text);
  }, [engine, speakCloud, speakBrowser]);

  const stop = useCallback(() => {
    if (engine !== 'browser') stopCloud();
    if (engine === 'browser' || browserFallbackRef.current) window.speechSynthesis?.cancel();
    browserFallbackRef.current = false;
    setIsSpeaking(false);
    setIsPaused(false);
    setCurrentWordIndex(-1);
  }, [engine]);

  const pause = useCallback(() => {
    if (engine !== 'browser' && !browserFallbackRef.current) {
      cloudAudioRef.current?.pause();
      setIsPaused(true);
      return;
    }
    window.speechSynthesis?.pause();
    setIsPaused(true);
  }, [engine]);

  const resume = useCallback(() => {
    if (engine !== 'browser' && !browserFallbackRef.current) {
      cloudAudioRef.current?.play();
      setIsPaused(false);
      return;
    }
    window.speechSynthesis?.resume();
    setIsPaused(false);
  }, [engine]);

  return {
    speak,
    stop,
    pause,
    resume,
    isSpeaking,
    isPaused,
    currentWordIndex,
    rate,
    setRate,
    engine,
    notice,
  };
}
