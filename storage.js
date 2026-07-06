const STORAGE_KEY = 'vocabulary-trainer.words';
const TOPICS_KEY = 'vocabulary-trainer.topics';
const SUBTOPICS_KEY = 'vocabulary-trainer.subTopics';
export const DEFAULT_TOPIC = 'General';
export const DEFAULT_SUBTOPIC = 'Default';

function parseList(raw, defaultValue) {
  if (!raw) {
    return defaultValue;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return defaultValue;
    }

    return parsed.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim());
  } catch {
    return defaultValue;
  }
}

function parseObjectList(raw, defaultValue) {
  if (!raw) {
    return defaultValue;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return defaultValue;
    }

    return parsed
      .filter(
        (item) =>
          item &&
          typeof item === 'object' &&
          typeof item.topic === 'string' &&
          item.topic.trim() &&
          typeof item.subTopic === 'string' &&
          item.subTopic.trim(),
      )
      .map((item) => ({ topic: item.topic.trim(), subTopic: item.subTopic.trim() }));
  } catch {
    return defaultValue;
  }
}

function saveList(key, list) {
  localStorage.setItem(key, JSON.stringify(list));
}

function normalizeVocabularyEntry(entry) {
  const normalized = {
    ...entry,
    word: entry?.word ? String(entry.word).trim() : '',
    meaning: entry?.meaning ? String(entry.meaning).trim() : '',
    example: entry?.example ? String(entry.example).trim() : '',
    ipa: entry?.ipa ? String(entry.ipa).trim() : '',
    topic: entry?.topic ? String(entry.topic).trim() : DEFAULT_TOPIC,
    subTopic: entry?.subTopic ? String(entry.subTopic).trim() : DEFAULT_SUBTOPIC,
    writeCount: Number(entry?.writeCount) || 0,
    correct: Number(entry?.correct) || 0,
    wrong: Number(entry?.wrong) || 0,
    learned: typeof entry?.learned === 'boolean' ? entry.learned : false,
  };

  if (!normalized.topic) {
    normalized.topic = DEFAULT_TOPIC;
  }

  if (!normalized.subTopic) {
    normalized.subTopic = DEFAULT_SUBTOPIC;
  }

  return normalized;
}

function normalizeVocabularyList(words) {
  return words.map(normalizeVocabularyEntry);
}

function shouldMigrateEntries(entries) {
  return entries.some(
    (entry) =>
      !entry ||
      typeof entry !== 'object' ||
      !('topic' in entry) ||
      !('subTopic' in entry) ||
      !('ipa' in entry) ||
      !('writeCount' in entry) ||
      !('correct' in entry) ||
      !('wrong' in entry) ||
      !('learned' in entry),
  );
}

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
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const entries = normalizeVocabularyList(parsed);
    if (shouldMigrateEntries(parsed)) {
      saveVocabulary(entries);
    }

    return entries;
  } catch (error) {
    console.error('Failed to parse storage data', error);
    return [];
  }
}

export function loadTopics() {
  const storedTopics = parseList(localStorage.getItem(TOPICS_KEY), []);
  if (storedTopics.length) {
    return storedTopics;
  }

  const vocabularyTopics = [...new Set(loadVocabulary().map((entry) => entry.topic || DEFAULT_TOPIC))].filter(Boolean).sort();
  return vocabularyTopics.length ? vocabularyTopics : [DEFAULT_TOPIC];
}

export function saveTopics(topics) {
  const nextTopics = [...new Set(topics.map((topic) => topic.trim()))].filter(Boolean);
  saveList(TOPICS_KEY, nextTopics);
}

export function loadSubTopics(topic) {
  const allSubTopics = parseList(localStorage.getItem(SUBTOPICS_KEY), []);
  if (!topic) {
    const globalSubTopics = allSubTopics.length
      ? [...new Set(allSubTopics.map((stored) => (stored.includes('::') ? stored.split('::')[1] : stored)))].sort()
      : [];
    if (globalSubTopics.length) {
      return globalSubTopics;
    }

    const vocabularySubTopics = [...new Set(loadVocabulary().map((entry) => entry.subTopic || DEFAULT_SUBTOPIC))].filter(Boolean).sort();
    return vocabularySubTopics.length ? vocabularySubTopics : [DEFAULT_SUBTOPIC];
  }

  const topicSubTopics = allSubTopics
    .filter((subTopic) => subTopic.startsWith(`${topic}::`))
    .map((subTopic) => subTopic.replace(`${topic}::`, ''));

  if (topicSubTopics.length) {
    return topicSubTopics;
  }

  const vocabularySubTopics = [...new Set(loadVocabulary().filter((entry) => entry.topic === topic).map((entry) => entry.subTopic || DEFAULT_SUBTOPIC))]
    .filter(Boolean)
    .sort();
  return vocabularySubTopics.length ? vocabularySubTopics : [DEFAULT_SUBTOPIC];
}

export function saveSubTopics(subTopics, topic) {
  const existingSubTopics = parseList(localStorage.getItem(SUBTOPICS_KEY), []);
  const topicPrefix = topic ? `${topic}::` : '';
  const nextSubTopicsForTopic = subTopics.map((subTopic) => `${topicPrefix}${subTopic.trim()}`);
  const preservedSubTopics = existingSubTopics.filter((stored) => {
    return topic ? !stored.startsWith(topicPrefix) : true;
  });
  const uniqueSubTopics = [...new Set([...preservedSubTopics, ...nextSubTopicsForTopic])].filter(Boolean);
  saveList(SUBTOPICS_KEY, uniqueSubTopics);
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
 * @param {string} ipa
 * @param {string} topic
 * @param {string} subTopic
 * @returns {Object}
 */
export function createVocabularyEntry(
  word,
  meaning,
  example,
  ipa = '',
  topic = DEFAULT_TOPIC,
  subTopic = DEFAULT_SUBTOPIC,
) {
  return {
    word: word.trim(),
    meaning: meaning.trim(),
    example: example.trim(),
    ipa: ipa.trim(),
    topic: topic.trim() || DEFAULT_TOPIC,
    subTopic: subTopic.trim() || DEFAULT_SUBTOPIC,
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

  const newEntry = createVocabularyEntry(
    entry.word,
    entry.meaning,
    entry.example,
    entry.ipa,
    entry.topic,
    entry.subTopic,
  );
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
 * Update an existing vocabulary entry while preserving its progress statistics.
 * @param {string} originalWord
 * @param {Partial<Object>} updates
 * @returns {Object | null}
 */
export function updateVocabularyEntryByWord(originalWord, updates) {
  const words = loadVocabulary();
  const normalizedOriginalWord = (originalWord || '').trim().toLowerCase();
  const nextWord = (updates?.word || '').trim();

  if (nextWord) {
    const duplicate = words.find((item) => item.word.toLowerCase() !== normalizedOriginalWord && item.word.toLowerCase() === nextWord.toLowerCase());
    if (duplicate) {
      throw new Error('Từ này đã tồn tại.');
    }
  }

  let updated = null;
  const newWords = words.map((item) => {
    if (item.word.toLowerCase() !== normalizedOriginalWord) {
      return item;
    }

    updated = normalizeVocabularyEntry({ ...item, ...updates, word: nextWord || item.word });
    return updated;
  });

  saveVocabulary(newWords);
  return updated;
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

/**
 * Return unique topic names from a vocabulary list.
 * @param {Array<Object>} words
 * @returns {Array<string>}
 */
export function getUniqueTopics(words) {
  return [...new Set(words.map((entry) => entry.topic || DEFAULT_TOPIC))].sort();
}

/**
 * Return unique subtopic names for a topic.
 * @param {Array<Object>} words
 * @param {string} [topic]
 * @returns {Array<string>}
 */
export function getUniqueSubTopics(words, topic) {
  const subTopics = words
    .filter((entry) => (topic ? entry.topic === topic : true))
    .map((entry) => entry.subTopic || DEFAULT_SUBTOPIC);

  return [...new Set(subTopics)].sort();
}

/**
 * Filter vocabulary by topic and subtopic.
 * @param {Array<Object>} words
 * @param {string} [topic]
 * @param {string} [subTopic]
 * @returns {Array<Object>}
 */
export function filterVocabularyByTopic(words, topic, subTopic) {
  return words.filter((entry) => {
    const matchesTopic = !topic || topic === '' || entry.topic === topic;
    const matchesSubTopic = !subTopic || subTopic === '' || entry.subTopic === subTopic;
    return matchesTopic && matchesSubTopic;
  });
}
