import { normalizeLanguageCode } from './language-manager.js';

const DEFAULT_MEANING_LANGUAGE = 'vietnamese';
const MEANING_LANGUAGE_STORAGE_KEY = 'vocabularyTrainer.meaningLanguage';

const DISPLAY_LANGUAGE_DEFINITIONS = {
  english: {
    termLabel: 'Word',
    pronunciationLabel: 'IPA',
    pronunciationPlaceholder: '/wɜːrk/',
    meaningLabel: 'Meaning',
    exampleLabel: 'Example',
    termHint: 'English term',
    exampleHint: 'English example',
  },
  japanese: {
    termLabel: 'Từ tiếng Nhật',
    pronunciationLabel: 'Kana',
    pronunciationPlaceholder: 'たべる',
    meaningLabel: 'Nghĩa',
    exampleLabel: 'Ví dụ tiếng Nhật',
    termHint: 'Từ tiếng Nhật',
    exampleHint: 'Ví dụ tiếng Nhật',
  },
  chinese: {
    termLabel: 'Từ tiếng Trung',
    pronunciationLabel: 'Pinyin',
    pronunciationPlaceholder: 'chīfàn',
    meaningLabel: 'Nghĩa',
    exampleLabel: 'Ví dụ tiếng Trung',
    termHint: 'Từ tiếng Trung',
    exampleHint: 'Ví dụ tiếng Trung',
  },
};

const MEANING_LANGUAGE_DEFINITIONS = [
  { code: 'vietnamese', label: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'english', label: 'English', flag: '🇬🇧' },
  { code: 'chinese', label: '中文', flag: '🇨🇳' },
];

const MEANING_LANGUAGE_ALIASES = {
  vi: 'vietnamese',
  vn: 'vietnamese',
  vietnamese: 'vietnamese',
  en: 'english',
  english: 'english',
  zh: 'chinese',
  cn: 'chinese',
  chinese: 'chinese',
};

export function normalizeMeaningLanguageCode(value) {
  const normalizedValue = String(value || '').trim().toLowerCase();
  if (!normalizedValue) {
    return DEFAULT_MEANING_LANGUAGE;
  }

  return MEANING_LANGUAGE_ALIASES[normalizedValue] || (MEANING_LANGUAGE_DEFINITIONS.some((language) => language.code === normalizedValue) ? normalizedValue : DEFAULT_MEANING_LANGUAGE);
}

export function getMeaningLanguageOptions() {
  return MEANING_LANGUAGE_DEFINITIONS.map((language) => ({ ...language }));
}

export function getCurrentMeaningLanguage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_MEANING_LANGUAGE;
  }

  try {
    const storedValue = window.localStorage.getItem(MEANING_LANGUAGE_STORAGE_KEY);
    return normalizeMeaningLanguageCode(storedValue);
  } catch (error) {
    console.warn('Failed to read meaning language', error);
    return DEFAULT_MEANING_LANGUAGE;
  }
}

export function setCurrentMeaningLanguage(language) {
  const normalizedLanguage = normalizeMeaningLanguageCode(language);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(MEANING_LANGUAGE_STORAGE_KEY, normalizedLanguage);
    } catch (error) {
      console.warn('Failed to persist meaning language', error);
    }
  }
  return normalizedLanguage;
}

export function normalizeMeaningMap(value) {
  if (!value) {
    return {};
  }

  if (typeof value === 'string') {
    return { vietnamese: value.trim() };
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, nestedValue]) => typeof nestedValue === 'string' && nestedValue.trim())
        .map(([key, nestedValue]) => [String(key).trim().toLowerCase(), String(nestedValue).trim()]),
    );
  }

  return {};
}

export function buildMeaningMap(existingMeanings, languageCode, value) {
  const normalizedLanguage = normalizeMeaningLanguageCode(languageCode);
  const nextMeanings = normalizeMeaningMap(existingMeanings);
  if (value && typeof value === 'string' && value.trim()) {
    nextMeanings[normalizedLanguage] = value.trim();
  }
  return nextMeanings;
}

export function getMeaningValue(entry, meaningLanguage = getCurrentMeaningLanguage()) {
  const normalizedMeaningLanguage = normalizeMeaningLanguageCode(meaningLanguage);
  const meanings = normalizeMeaningMap(entry?.meanings || entry?.meaning);
  if (meanings[normalizedMeaningLanguage]) {
    return meanings[normalizedMeaningLanguage];
  }

  return '';
}

export function getMeaningDisplayValue(entry, meaningLanguage = getCurrentMeaningLanguage()) {
  const normalizedMeaningLanguage = normalizeMeaningLanguageCode(meaningLanguage);
  const value = getMeaningValue(entry, normalizedMeaningLanguage);
  if (value) {
    return value;
  }

  const fallbackConfig = getDisplayConfig('english', normalizedMeaningLanguage);
  const fallbackMessage = fallbackConfig.meaningLanguage === 'english' ? 'English meaning unavailable.' : 'Chưa có nghĩa tiếng Việt.';
  return fallbackMessage;
}

export function getDisplayConfig(learningLanguage = 'english', meaningLanguage = getCurrentMeaningLanguage()) {
  const normalizedLearningLanguage = normalizeLanguageCode(learningLanguage);
  const normalizedMeaningLanguage = normalizeMeaningLanguageCode(meaningLanguage);
  const baseConfig = DISPLAY_LANGUAGE_DEFINITIONS[normalizedLearningLanguage] || DISPLAY_LANGUAGE_DEFINITIONS.english;
  const meaningLabels = {
    vietnamese: { label: 'Nghĩa', placeholder: 'Nghĩa tiếng Việt' },
    english: { label: 'Meaning', placeholder: 'Meaning in English' },
    chinese: { label: '中文释义', placeholder: '中文释义' },
  };
  return {
    ...baseConfig,
    learningLanguage: normalizedLearningLanguage,
    meaningLanguage: normalizedMeaningLanguage,
    meaningLabel: meaningLabels[normalizedMeaningLanguage]?.label || 'Nghĩa',
    meaningPlaceholder: meaningLabels[normalizedMeaningLanguage]?.placeholder || 'Nghĩa',
  };
}
