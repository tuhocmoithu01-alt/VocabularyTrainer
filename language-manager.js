export const DEFAULT_LANGUAGE = 'english';

const LANGUAGE_STORAGE_KEY = 'vocabularyTrainer.currentLanguage';

export const LANGUAGE_DEFINITIONS = [
  { code: 'english', label: 'English', flag: '🇬🇧' },
  { code: 'japanese', label: 'Japanese', flag: '🇯🇵' },
  { code: 'chinese', label: 'Chinese', flag: '🇨🇳' },
];

let currentLanguage = DEFAULT_LANGUAGE;

function readStoredLanguage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_LANGUAGE;
  }

  try {
    const storedValue = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return normalizeLanguageCode(storedValue) || DEFAULT_LANGUAGE;
  } catch (error) {
    console.warn('Failed to read selected language', error);
    return DEFAULT_LANGUAGE;
  }
}

export function normalizeLanguageCode(value) {
  const normalizedValue = String(value || '').trim().toLowerCase();
  if (!normalizedValue) {
    return DEFAULT_LANGUAGE;
  }

  return LANGUAGE_DEFINITIONS.some((language) => language.code === normalizedValue) ? normalizedValue : DEFAULT_LANGUAGE;
}

export function getLanguageOptions() {
  return LANGUAGE_DEFINITIONS.map((language) => ({ ...language }));
}

export function getCurrentLanguage() {
  return currentLanguage;
}

export function getCurrentLanguageConfig() {
  return LANGUAGE_DEFINITIONS.find((language) => language.code === currentLanguage) || LANGUAGE_DEFINITIONS[0];
}

export function setCurrentLanguage(language) {
  const normalizedLanguage = normalizeLanguageCode(language);
  if (normalizedLanguage === currentLanguage) {
    return currentLanguage;
  }

  const previousLanguage = currentLanguage;
  currentLanguage = normalizedLanguage;

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalizedLanguage);
    } catch (error) {
      console.warn('Failed to persist selected language', error);
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('language-changed', { detail: { language: normalizedLanguage, previous: previousLanguage } }));
  }

  return normalizedLanguage;
}

export function getLanguageLabel(language) {
  const config = LANGUAGE_DEFINITIONS.find((candidate) => candidate.code === normalizeLanguageCode(language));
  return config ? config.label : 'English';
}

currentLanguage = readStoredLanguage();
