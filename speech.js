import { getCurrentLanguage, normalizeLanguageCode } from './language-manager.js';

const LANGUAGE_LOCALE_PRIORITY = {
  english: ['en-US', 'en-GB', 'en-AU', 'en-IE'],
  japanese: ['ja-JP', 'ja'],
  chinese: ['zh-CN', 'zh-TW', 'zh-HK'],
};

const DEFAULT_LOCALE = 'en-US';

function normalizeLocaleCode(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeLanguageKey(language) {
  return normalizeLanguageCode(language);
}

export function getSpeechLanguageCode(language = getCurrentLanguage()) {
  const normalizedLanguage = normalizeLanguageKey(language);
  const preferredLocales = LANGUAGE_LOCALE_PRIORITY[normalizedLanguage];
  return preferredLocales?.[0] || DEFAULT_LOCALE;
}

export function selectBestVoice(voices = [], language = getCurrentLanguage()) {
  if (!Array.isArray(voices) || !voices.length) {
    return null;
  }

  const normalizedLanguage = normalizeLanguageKey(language);
  const preferredLocales = LANGUAGE_LOCALE_PRIORITY[normalizedLanguage] || [getSpeechLanguageCode(language)];

  for (const locale of preferredLocales) {
    const normalizedLocale = normalizeLocaleCode(locale);
    const exactMatch = voices.find((voice) => normalizeLocaleCode(voice?.lang) === normalizedLocale);
    if (exactMatch) {
      return exactMatch;
    }
  }

  if (preferredLocales.length) {
    const baseLang = preferredLocales[0].split('-')[0].toLowerCase();
    const prefixMatch = voices.find((voice) => normalizeLocaleCode(voice?.lang).startsWith(baseLang));
    if (prefixMatch) {
      return prefixMatch;
    }
  }

  return voices[0] || null;
}

export function getAvailableVoices() {
  if (typeof window === 'undefined' || !window.speechSynthesis?.getVoices) {
    return [];
  }

  return window.speechSynthesis.getVoices() || [];
}

export function createSpeechUtterance(text, language = getCurrentLanguage(), options = {}) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = getSpeechLanguageCode(language);
  utterance.rate = options.rate ?? 0.8;
  utterance.pitch = options.pitch ?? 1;
  utterance.volume = options.volume ?? 1;
  return utterance;
}

export function speakText(text, options = {}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return false;
  }

  const synth = window.speechSynthesis;
  const language = options.language || getCurrentLanguage();
  const shouldCancelPrevious = options.cancelPrevious !== false;
  const onstart = options.onstart;
  const onend = options.onend;
  const onerror = options.onerror;
  const onpause = options.onpause;
  const onresume = options.onresume;
  const onvoiceschanged = options.onvoiceschanged;

  if (shouldCancelPrevious) {
    synth.cancel();
  }

  const utterance = createSpeechUtterance(text, language, {
    rate: options.rate,
    pitch: options.pitch,
    volume: options.volume,
  });

  let hasStarted = false;
  let voiceAttempted = false;
  let voiceFallbackTimer = null;

  const clearVoiceFallbackTimer = () => {
    if (voiceFallbackTimer) {
      window.clearTimeout(voiceFallbackTimer);
      voiceFallbackTimer = null;
    }
  };

  const applyBestVoice = () => {
    const voices = getAvailableVoices();
    const selectedVoice = selectBestVoice(voices, language);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    return Boolean(selectedVoice);
  };

  const finishWithError = (error) => {
    clearVoiceFallbackTimer();
    if (onerror) {
      onerror(error, utterance);
    }
  };

  utterance.onstart = (event) => {
    hasStarted = true;
    clearVoiceFallbackTimer();
    if (onstart) {
      onstart(event, utterance);
    }
  };

  utterance.onend = (event) => {
    clearVoiceFallbackTimer();
    if (onend) {
      onend(event, utterance);
    }
  };

  utterance.onerror = (event) => {
    finishWithError(event);
  };

  utterance.onpause = (event) => {
    if (onpause) {
      onpause(event, utterance);
    }
  };

  utterance.onresume = (event) => {
    if (onresume) {
      onresume(event, utterance);
    }
  };

  const trySpeak = () => {
    if (voiceAttempted) {
      return;
    }

    voiceAttempted = true;
    const hasVoice = applyBestVoice();
    if (!hasVoice) {
      finishWithError(new Error(`No speech voice is available for ${language}.`));
      return;
    }

    synth.speak(utterance);
  };

  const handleVoicesChanged = () => {
    if (hasStarted) {
      return;
    }
    trySpeak();
    if (onvoiceschanged) {
      onvoiceschanged();
    }
  };

  if (synth.addEventListener) {
    synth.addEventListener('voiceschanged', handleVoicesChanged);
  }

  const voices = getAvailableVoices();
  if (voices.length) {
    trySpeak();
  } else {
    voiceFallbackTimer = window.setTimeout(() => {
      if (hasStarted) {
        return;
      }
      handleVoicesChanged();
    }, 1000);
  }

  return true;
}
