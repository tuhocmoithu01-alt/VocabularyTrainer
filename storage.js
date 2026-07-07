import { getDb } from './firebase.js';

export const DEFAULT_TOPIC = 'General';
export const DEFAULT_SUBTOPIC = 'Default';

const WORDS_COLLECTION = 'words';
const PREFERENCES_COLLECTION = 'preferences';
const SOUND_ENABLED_KEY = 'soundEnabled';
const TOPICS_KEY = 'topics';
const SUBTOPICS_KEY = 'subTopics';

let vocabularyCache = [];
let topicsCache = [];
let subTopicsCache = [];
let firestoreInitialized = false;
let firestoreSyncPromise = null;
let preferencesSyncPromise = null;
let soundPreferenceCache = true;

function notifyVocabularyChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vocabulary-storage-updated', { detail: [...vocabularyCache] }));
  }
}

async function getFirestoreHelpers() {
  const [{ collection, deleteDoc, doc, getDocs, setDoc }] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js'),
  ]);
  return { collection, deleteDoc, doc, getDocs, setDoc };
}

function deriveTopics(words) {
  return [...new Set(words.map((entry) => entry.topic || DEFAULT_TOPIC))].filter(Boolean).sort();
}

function deriveSubTopics(words) {
  return [...new Set(words.map((entry) => entry.subTopic || DEFAULT_SUBTOPIC))].filter(Boolean).sort();
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
  return (words || []).map(normalizeVocabularyEntry).filter((entry) => entry.word);
}

function updateDerivedCaches(words) {
  vocabularyCache = normalizeVocabularyList(words);
  topicsCache = deriveTopics(vocabularyCache);
  subTopicsCache = deriveSubTopics(vocabularyCache);
  if (!topicsCache.length) {
    topicsCache = [DEFAULT_TOPIC];
  }
  if (!subTopicsCache.length) {
    subTopicsCache = [DEFAULT_SUBTOPIC];
  }
}

function toFirestorePayload(entry) {
  return {
    word: entry.word,
    meaning: entry.meaning,
    example: entry.example,
    ipa: entry.ipa,
    topic: entry.topic,
    subTopic: entry.subTopic,
    writeCount: entry.writeCount,
    correct: entry.correct,
    wrong: entry.wrong,
    learned: entry.learned,
  };
}

function getDocIdForEntry(entry, index) {
  return normalizeWordKey(entry.word) || `word-${index + 1}`;
}

async function syncVocabularyFromFirestore() {
  const db = await getDb();
  if (!db) {
    updateDerivedCaches([]);
    notifyVocabularyChange();
    return [];
  }

  const { collection, getDocs } = await getFirestoreHelpers();
  const snapshot = await getDocs(collection(db, WORDS_COLLECTION));
  const loadedEntries = snapshot.docs.map((docSnapshot) => normalizeVocabularyEntry(docSnapshot.data()));

  updateDerivedCaches(loadedEntries);
  firestoreInitialized = true;
  notifyVocabularyChange();
  return vocabularyCache;
}

export async function ensureVocabularyLoaded() {
  if (firestoreInitialized) {
    return vocabularyCache;
  }

  if (!firestoreSyncPromise) {
    firestoreSyncPromise = syncVocabularyFromFirestore().catch((error) => {
      console.error('Failed to load vocabulary from Firestore', error);
      updateDerivedCaches([]);
      notifyVocabularyChange();
      return [];
    });
  }

  return firestoreSyncPromise;
}

/**
 * Load vocabulary data from Firestore.
 * @returns {Array<Object>} Vocabulary list.
 */
export function loadVocabulary() {
  void ensureVocabularyLoaded();
  return [...vocabularyCache];
}

export function normalizeWordKey(value) {
  return (value || '').trim().toLowerCase();
}

export function findDuplicateVocabularyEntry(words, candidateWord, currentWord = '') {
  const normalizedCandidate = normalizeWordKey(candidateWord);
  const normalizedCurrentWord = normalizeWordKey(currentWord);

  if (!normalizedCandidate) {
    return null;
  }

  return (
    words.find((entry) => {
      const normalizedEntryWord = normalizeWordKey(entry?.word);
      return normalizedEntryWord === normalizedCandidate && normalizedEntryWord !== normalizedCurrentWord;
    }) || null
  );
}

async function syncPreferencesFromFirestore() {
  const db = await getDb();
  if (!db) {
    return { topics: [...topicsCache], subTopics: [...subTopicsCache], soundEnabled: soundPreferenceCache };
  }

  const { collection, getDocs } = await getFirestoreHelpers();
  const snapshot = await getDocs(collection(db, PREFERENCES_COLLECTION));
  const preferenceValues = Object.fromEntries(snapshot.docs.map((docSnapshot) => [docSnapshot.id, docSnapshot.data()]));

  const storedTopics = Array.isArray(preferenceValues[TOPICS_KEY]?.value) ? preferenceValues[TOPICS_KEY].value : [];
  topicsCache = storedTopics.length ? storedTopics : (vocabularyCache.length ? deriveTopics(vocabularyCache) : [DEFAULT_TOPIC]);

  const storedSubTopics = Array.isArray(preferenceValues[SUBTOPICS_KEY]?.value) ? preferenceValues[SUBTOPICS_KEY].value : [];
  subTopicsCache = storedSubTopics.length ? storedSubTopics : (vocabularyCache.length ? deriveSubTopics(vocabularyCache) : [DEFAULT_SUBTOPIC]);

  const storedSoundValue = preferenceValues[SOUND_ENABLED_KEY]?.value;
  soundPreferenceCache = typeof storedSoundValue === 'boolean' ? storedSoundValue : true;
  return { topics: [...topicsCache], subTopics: [...subTopicsCache], soundEnabled: soundPreferenceCache };
}

export async function ensurePreferencesLoaded() {
  if (preferencesSyncPromise) {
    return preferencesSyncPromise;
  }

  preferencesSyncPromise = syncPreferencesFromFirestore().catch((error) => {
    console.error('Failed to load preferences from Firestore', error);
    return { topics: [...topicsCache], subTopics: [...subTopicsCache], soundEnabled: soundPreferenceCache };
  });

  return preferencesSyncPromise;
}

export async function migrateLocalStorageToFirestore() {
  console.log('MIGRATE START');

  try {
    const db = await getDb();
    if (!db) {
      return false;
    }

    const { collection, getDocs, doc, setDoc } = await getFirestoreHelpers();
    const [wordSnapshot, preferencesSnapshot] = await Promise.all([
      getDocs(collection(db, WORDS_COLLECTION)),
      getDocs(collection(db, PREFERENCES_COLLECTION)),
    ]);

    console.log('FIRESTORE SIZE', wordSnapshot.size, preferencesSnapshot.size);

    const readParsedLocalStorageValue = (key) => {
      if (typeof window === 'undefined' || !window.localStorage) {
        return null;
      }

      try {
        const rawValue = window.localStorage.getItem(key);
        if (!rawValue) {
          return null;
        }
        return JSON.parse(rawValue);
      } catch (error) {
        console.error('MIGRATE LOCAL STORAGE READ ERROR', { key, error });
        return null;
      }
    };

    const collectLocalStorageData = () => {
      const collected = {
        vocabulary: [],
        topics: [],
        subTopics: [],
        soundEnabled: null,
      };

      if (typeof window === 'undefined' || !window.localStorage) {
        return collected;
      }

      const seenWords = new Set();

      const addWordsFromValue = (value) => {
        if (Array.isArray(value)) {
          value.forEach(addWordsFromValue);
          return;
        }

        if (!value || typeof value !== 'object') {
          return;
        }

        if (typeof value.word === 'string' && (typeof value.meaning === 'string' || typeof value.example === 'string' || typeof value.topic === 'string' || typeof value.subTopic === 'string' || typeof value.ipa === 'string')) {
          const normalizedEntry = normalizeVocabularyEntry(value);
          const normalizedWordKeyValue = normalizeWordKey(normalizedEntry.word);
          if (normalizedWordKeyValue && !seenWords.has(normalizedWordKeyValue)) {
            seenWords.add(normalizedWordKeyValue);
            collected.vocabulary.push(normalizedEntry);
          }
        }

        Object.values(value).forEach(addWordsFromValue);
      };

      for (let index = 0; index < window.localStorage.length; index += 1) {
        const storageKey = window.localStorage.key(index);
        if (!storageKey) {
          continue;
        }

        const parsedValue = readParsedLocalStorageValue(storageKey);
        if (parsedValue === null) {
          continue;
        }

        if (typeof parsedValue === 'boolean') {
          if (storageKey.toLowerCase().includes('sound')) {
            collected.soundEnabled = parsedValue;
          }
          continue;
        }

        if (Array.isArray(parsedValue) && parsedValue.every((item) => typeof item === 'string')) {
          const storageKeyLower = storageKey.toLowerCase();
          if (storageKeyLower.includes('sub')) {
            collected.subTopics.push(...parsedValue);
          } else if (storageKeyLower.includes('topic')) {
            collected.topics.push(...parsedValue);
          }
        }

        if (parsedValue && typeof parsedValue === 'object') {
          const objectValue = parsedValue;
          const topicValues = Array.isArray(objectValue.topics) ? objectValue.topics : [];
          const subTopicValues = Array.isArray(objectValue.subTopics) ? objectValue.subTopics : [];
          const subtopicValues = Array.isArray(objectValue.subtopics) ? objectValue.subtopics : [];
          const soundValue = objectValue.soundEnabled;
          if (typeof soundValue === 'boolean') {
            collected.soundEnabled = soundValue;
          }
          if (topicValues.length) {
            collected.topics.push(...topicValues);
          }
          if (subTopicValues.length) {
            collected.subTopics.push(...subTopicValues);
          }
          if (subtopicValues.length) {
            collected.subTopics.push(...subtopicValues);
          }
          if (Array.isArray(objectValue.words)) {
            addWordsFromValue(objectValue.words);
          }
          if (Array.isArray(objectValue.vocabulary)) {
            addWordsFromValue(objectValue.vocabulary);
          }
          if (Array.isArray(objectValue.entries)) {
            addWordsFromValue(objectValue.entries);
          }
        }

        addWordsFromValue(parsedValue);
      }

      collected.vocabulary = collected.vocabulary.filter((entry) => entry.word);
      collected.topics = [...new Set(collected.topics.map((topic) => String(topic).trim()).filter(Boolean))];
      collected.subTopics = [...new Set(collected.subTopics.map((subTopic) => String(subTopic).trim()).filter(Boolean))];
      if (typeof collected.soundEnabled !== 'boolean') {
        collected.soundEnabled = null;
      }
      return collected;
    };

    const localData = collectLocalStorageData();
    console.log('LOCAL DATA', localData);

    const firestoreWords = wordSnapshot.docs.map((docSnapshot) => normalizeVocabularyEntry(docSnapshot.data()));
    const firestoreWordKeys = new Set(firestoreWords.map((entry) => normalizeWordKey(entry.word)));
    const mergedWords = [...firestoreWords];
    const mergedWordKeys = new Set(firestoreWordKeys);
    const missingWords = [];

    localData.vocabulary.forEach((entry) => {
      const normalizedWordKeyValue = normalizeWordKey(entry.word);
      if (!normalizedWordKeyValue || mergedWordKeys.has(normalizedWordKeyValue)) {
        return;
      }
      mergedWordKeys.add(normalizedWordKeyValue);
      mergedWords.push(entry);
      missingWords.push(entry);
    });

    const firestorePreferenceValues = Object.fromEntries(preferencesSnapshot.docs.map((docSnapshot) => [docSnapshot.id, docSnapshot.data()]));
    const existingTopics = Array.isArray(firestorePreferenceValues[TOPICS_KEY]?.value) ? firestorePreferenceValues[TOPICS_KEY].value : [];
    const existingSubTopics = Array.isArray(firestorePreferenceValues[SUBTOPICS_KEY]?.value) ? firestorePreferenceValues[SUBTOPICS_KEY].value : [];
    const existingSoundValue = firestorePreferenceValues[SOUND_ENABLED_KEY]?.value;
    const nextTopics = [...new Set([...existingTopics, ...localData.topics].map((topic) => String(topic).trim()).filter(Boolean))];
    const nextSubTopics = [...new Set([...existingSubTopics, ...localData.subTopics].map((subTopic) => String(subTopic).trim()).filter(Boolean))];
    const nextSoundEnabled = typeof existingSoundValue === 'boolean' ? existingSoundValue : (typeof localData.soundEnabled === 'boolean' ? localData.soundEnabled : true);

    for (const entry of missingWords) {
      const docId = getDocIdForEntry(entry, missingWords.indexOf(entry));
      const data = toFirestorePayload(entry);
      console.log('UPLOAD', docId, data);
      await setDoc(doc(db, WORDS_COLLECTION, docId), data);
    }

    if (nextTopics.length) {
      const data = { value: nextTopics };
      console.log('UPLOAD', TOPICS_KEY, data);
      await setDoc(doc(db, PREFERENCES_COLLECTION, TOPICS_KEY), data);
    }
    if (nextSubTopics.length) {
      const data = { value: nextSubTopics };
      console.log('UPLOAD', SUBTOPICS_KEY, data);
      await setDoc(doc(db, PREFERENCES_COLLECTION, SUBTOPICS_KEY), data);
    }
    if (typeof existingSoundValue !== 'boolean' && typeof localData.soundEnabled === 'boolean') {
      const soundData = { value: localData.soundEnabled };
      console.log('UPLOAD', SOUND_ENABLED_KEY, soundData);
      await setDoc(doc(db, PREFERENCES_COLLECTION, SOUND_ENABLED_KEY), soundData);
    }

    console.log('UPLOAD DONE');

    updateDerivedCaches(mergedWords);
    topicsCache = nextTopics.length ? nextTopics : topicsCache;
    subTopicsCache = nextSubTopics.length ? nextSubTopics : subTopicsCache;
    soundPreferenceCache = nextSoundEnabled;
    firestoreInitialized = false;
    firestoreSyncPromise = null;
    preferencesSyncPromise = null;
    notifyVocabularyChange();
    return true;
  } catch (error) {
    console.error('MIGRATE FAILED', error);
    console.error('MIGRATE FAILED DETAILS', { error, message: error?.message, stack: error?.stack });
    return false;
  }
}

export async function loadSoundEnabled(defaultValue = true) {
  const preferences = await ensurePreferencesLoaded();
  return typeof preferences?.soundEnabled === 'boolean' ? preferences.soundEnabled : defaultValue;
}

export function saveSoundEnabled(enabled) {
  soundPreferenceCache = Boolean(enabled);
  void (async () => {
    const db = await getDb();
    if (!db) {
      return;
    }
    const { doc, setDoc } = await getFirestoreHelpers();
    await setDoc(doc(db, PREFERENCES_COLLECTION, SOUND_ENABLED_KEY), { value: soundPreferenceCache });
  })();
}

export function loadTopics() {
  void ensureVocabularyLoaded();
  void ensurePreferencesLoaded();
  return [...topicsCache];
}

export function saveTopics(topics) {
  const nextTopics = [...new Set((topics || []).map((topic) => String(topic).trim()).filter(Boolean))];
  topicsCache = nextTopics.length ? nextTopics : [DEFAULT_TOPIC];
  void (async () => {
    const db = await getDb();
    if (!db) {
      return;
    }
    const { doc, setDoc } = await getFirestoreHelpers();
    await setDoc(doc(db, PREFERENCES_COLLECTION, TOPICS_KEY), { value: [...topicsCache] });
  })();
}

export function loadSubTopics(topic) {
  void ensureVocabularyLoaded();
  void ensurePreferencesLoaded();
  if (!topic) {
    return [...subTopicsCache];
  }

  const topicSubTopics = vocabularyCache.filter((entry) => entry.topic === topic).map((entry) => entry.subTopic || DEFAULT_SUBTOPIC);
  return [...new Set(topicSubTopics)].filter(Boolean).sort();
}

export function saveSubTopics(subTopics, topic) {
  const nextSubTopics = [...new Set((subTopics || []).map((subTopic) => String(subTopic).trim()).filter(Boolean))];
  if (topic) {
    const existingForOtherTopics = subTopicsCache.filter((stored) => !stored.startsWith(`${topic}::`));
    subTopicsCache = [...existingForOtherTopics, ...nextSubTopics.map((subTopic) => `${topic}::${subTopic}`)];
  } else {
    subTopicsCache = nextSubTopics.length ? nextSubTopics : [DEFAULT_SUBTOPIC];
  }
  void (async () => {
    const db = await getDb();
    if (!db) {
      return;
    }
    const { doc, setDoc } = await getFirestoreHelpers();
    await setDoc(doc(db, PREFERENCES_COLLECTION, SUBTOPICS_KEY), { value: [...subTopicsCache] });
  })();
}

/**
 * Persist vocabulary list to Firestore.
 * @param {Array<Object>} words
 */
export function saveVocabulary(words) {
  const normalized = normalizeVocabularyList(words);
  updateDerivedCaches(normalized);
  notifyVocabularyChange();

  return (async () => {
    const db = await getDb();
    if (!db) {
      return normalized;
    }

    const { collection, deleteDoc, doc, getDocs, setDoc } = await getFirestoreHelpers();
    const existingSnapshot = await getDocs(collection(db, WORDS_COLLECTION));
    await Promise.all(existingSnapshot.docs.map((docSnapshot) => deleteDoc(doc(db, WORDS_COLLECTION, docSnapshot.id))));

    await Promise.all(
      normalized.map((entry, index) => {
        const docId = getDocIdForEntry(entry, index);
        return setDoc(doc(db, WORDS_COLLECTION, docId), toFirestorePayload(entry));
      }),
    );

    firestoreInitialized = true;
    return normalized;
  })();
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
    word: String(word || '').trim(),
    meaning: String(meaning || '').trim(),
    example: String(example || '').trim(),
    ipa: String(ipa || '').trim(),
    topic: String(topic || '').trim() || DEFAULT_TOPIC,
    subTopic: String(subTopic || '').trim() || DEFAULT_SUBTOPIC,
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
  const normalizedEntry = createVocabularyEntry(entry.word, entry.meaning, entry.example, entry.ipa, entry.topic, entry.subTopic);
  const exists = words.some((item) => normalizeWordKey(item.word) === normalizeWordKey(normalizedEntry.word));
  if (exists) {
    throw new Error('Từ này đã tồn tại.');
  }

  const nextWords = [normalizedEntry, ...words];
  void saveVocabulary(nextWords);
  return normalizedEntry;
}

/**
 * Remove word by value.
 * @param {string} word
 */
export function removeVocabularyEntry(word) {
  const words = loadVocabulary().filter((item) => normalizeWordKey(item.word) !== normalizeWordKey(word));
  void saveVocabulary(words);
}

/**
 * Update an existing vocabulary entry while preserving its progress statistics.
 * @param {string} originalWord
 * @param {Partial<Object>} updates
 * @returns {Object | null}
 */
export function updateVocabularyEntryByWord(originalWord, updates) {
  const words = loadVocabulary();
  const normalizedOriginalWord = normalizeWordKey(originalWord);
  const nextWord = (updates?.word || '').trim();

  if (nextWord) {
    const duplicate = words.find((item) => normalizeWordKey(item.word) !== normalizedOriginalWord && normalizeWordKey(item.word) === normalizeWordKey(nextWord));
    if (duplicate) {
      throw new Error('Từ này đã tồn tại.');
    }
  }

  let updated = null;
  const newWords = words.map((item) => {
    if (normalizeWordKey(item.word) !== normalizedOriginalWord) {
      return item;
    }

    updated = normalizeVocabularyEntry({ ...item, ...updates, word: nextWord || item.word });
    return updated;
  });

  void saveVocabulary(newWords);
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
    if (normalizeWordKey(item.word) !== normalizeWordKey(word)) {
      return item;
    }
    updated = normalizeVocabularyEntry({ ...item, ...updates });
    return updated;
  });
  void saveVocabulary(newWords);
  return updated;
}

/**
 * Retrieve a word entry by word text.
 * @param {string} word
 * @returns {Object|undefined}
 */
export function findVocabularyEntry(word) {
  return loadVocabulary().find((item) => normalizeWordKey(item.word) === normalizeWordKey(word));
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

void ensureVocabularyLoaded();
