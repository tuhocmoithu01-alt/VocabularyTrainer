const STORAGE_KEY = 'vocabulary-trainer.words';

/**
 * Load vocabulary data from LocalStorage.
 * @returns {Array<Object>} Vocabulary list.
 */
export function loadVocabulary() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error('Failed to parse storage data', error);
    return [];
  }
}

/**
 * Persist vocabulary list to LocalStorage.
 * @param {Array<Object>} words
 */
export function saveVocabulary(words) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
}

/**
 * Generate a word entry with defaults.
 * @param {string} word
 * @param {string} meaning
 * @param {string} example
 * @returns {Object}
 */
export function createVocabularyEntry(word, meaning, example, ipa = '') {
  return {
    word: word.trim(),
    meaning: meaning.trim(),
    example: example.trim(),
    ipa: ipa.trim(),
    writeCount: 0,
    correct: 0,
    wrong: 0,
    learned: false,
  };
}

/**
 * Add a new word if it does not already exist.
 * @param {Object} entry
 * @returns {Object} The saved word object.
 */
export function addVocabularyEntry(entry) {
  const words = loadVocabulary();
  const exists = words.some((item) => item.word.toLowerCase() === entry.word.toLowerCase());
  if (exists) {
    throw new Error('Từ này đã tồn tại.');
  }

  const newEntry = createVocabularyEntry(entry.word, entry.meaning, entry.example, entry.ipa);
  words.unshift(newEntry);
  saveVocabulary(words);
  return newEntry;
}

/**
 * Remove word by value.
 * @param {string} word
 */
export function removeVocabularyEntry(word) {
  const words = loadVocabulary().filter((item) => item.word.toLowerCase() !== word.toLowerCase());
  saveVocabulary(words);
}

/**
 * Update a word entry with partial values.
 * @param {string} word
 * @param {Partial<Object>} updates
 * @returns {Object | null}
 */
export function updateVocabularyEntry(word, updates) {
  const words = loadVocabulary();
  let updated = null;
  const newWords = words.map((item) => {
    if (item.word.toLowerCase() !== word.toLowerCase()) {
      return item;
    }
    updated = { ...item, ...updates };
    return updated;
  });
  saveVocabulary(newWords);
  return updated;
}

/**
 * Retrieve a word entry by word text.
 * @param {string} word
 * @returns {Object|undefined}
 */
export function findVocabularyEntry(word) {
  return loadVocabulary().find((item) => item.word.toLowerCase() === word.toLowerCase());
}
