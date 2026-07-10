import { getDb } from './firebase.js';
import { getCurrentLanguage, normalizeLanguageCode } from './language-manager.js';
import { getFirestoreHelpers, getSettingsCollection, getVocabularyCollection } from './data-access.js';
import { buildMeaningMap, normalizeMeaningMap } from './language-config.js';

export const DEFAULT_TOPIC = 'General';
export const DEFAULT_SUBTOPIC = 'Default';
export const DEFAULT_TYPE = 'Word';

const SOUND_ENABLED_KEY = 'soundEnabled';
const TOPICS_KEY = 'topics';
const SUBTOPICS_KEY = 'subTopics';
const VOCABULARY_OFFLINE_CACHE_KEY_PREFIX = 'vocabularyTrainer.vocabulary';
const PREFERENCES_OFFLINE_CACHE_KEY_PREFIX = 'vocabularyTrainer.preferences';
const LEGACY_VOCABULARY_CACHE_KEY = 'vocabularyTrainer.vocabulary';
const LEGACY_PREFERENCES_CACHE_KEY = 'vocabularyTrainer.preferences';

let vocabularyCache = [];
let topicsCache = [];
let subTopicsCache = [];
let soundPreferenceCache = true;
let firestoreInitialized = false;
let firestoreSyncPromise = null;
let preferencesSyncPromise = null;
let vocabularyListenerActive = false;
let preferencesListenerActive = false;
let vocabularyListenerUnsubscribe = null;
let preferencesListenerUnsubscribe = null;
let vocabularyListenerPromise = null;
let preferencesListenerPromise = null;
let activeLanguage = normalizeLanguageCode(getCurrentLanguage());
let listenerGeneration = 0;
let vocabularyListenerLanguage = null;
let preferencesListenerLanguage = null;

function notifyVocabularyChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vocabulary-storage-updated', { detail: [...vocabularyCache] }));
  }
}

function readOfflineJson(key) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch (error) {
    console.warn('Failed to read offline cache', error);
    return null;
  }
}

function writeOfflineJson(key, value) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('Failed to persist offline cache', error);
  }
}

function clearCacheForLanguage(language) {
  const normalizedLanguage = normalizeLanguageCode(language);
  const keys = [
    `${VOCABULARY_OFFLINE_CACHE_KEY_PREFIX}.${normalizedLanguage}`,
    `${PREFERENCES_OFFLINE_CACHE_KEY_PREFIX}.${normalizedLanguage}`,
    normalizedLanguage === 'english' ? LEGACY_VOCABULARY_CACHE_KEY : `${LEGACY_VOCABULARY_CACHE_KEY}.${normalizedLanguage}`,
    normalizedLanguage === 'english' ? LEGACY_PREFERENCES_CACHE_KEY : `${LEGACY_PREFERENCES_CACHE_KEY}.${normalizedLanguage}`,
  ];

  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  keys.forEach((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.warn('Failed to clear offline cache', error);
    }
  });
}

function getLanguageKey(language = activeLanguage) {
  return normalizeLanguageCode(language);
}

function getVocabularyCacheKey(language = activeLanguage) {
  return `${VOCABULARY_OFFLINE_CACHE_KEY_PREFIX}.${getLanguageKey(language)}`;
}

function getPreferencesCacheKey(language = activeLanguage) {
  return `${PREFERENCES_OFFLINE_CACHE_KEY_PREFIX}.${getLanguageKey(language)}`;
}

function readOfflineVocabularyState(language = activeLanguage) {
  const keys = [
    getVocabularyCacheKey(language),
    language === 'english' ? LEGACY_VOCABULARY_CACHE_KEY : `${LEGACY_VOCABULARY_CACHE_KEY}.${language}`,
  ];

  for (const key of keys) {
    const cached = readOfflineJson(key);
    if (Array.isArray(cached)) {
      return cached;
    }
  }

  return [];
}

function readOfflinePreferencesState(language = activeLanguage) {
  const keys = [
    getPreferencesCacheKey(language),
    language === 'english' ? LEGACY_PREFERENCES_CACHE_KEY : `${LEGACY_PREFERENCES_CACHE_KEY}.${language}`,
  ];

  for (const key of keys) {
    const cached = readOfflineJson(key);
    if (cached && typeof cached === 'object') {
      return {
        topics: Array.isArray(cached.topics) ? cached.topics : [],
        subTopics: Array.isArray(cached.subTopics) ? cached.subTopics : [],
        soundEnabled: typeof cached.soundEnabled === 'boolean' ? cached.soundEnabled : true,
      };
    }
  }

  return { topics: [], subTopics: [], soundEnabled: true };
}

function persistVocabularyOfflineCache(words = vocabularyCache, language = activeLanguage) {
  const normalizedWords = normalizeVocabularyList(words, language);
  writeOfflineJson(getVocabularyCacheKey(language), normalizedWords);
  if (language === 'english') {
    writeOfflineJson(LEGACY_VOCABULARY_CACHE_KEY, normalizedWords);
  }
}

function persistPreferencesOfflineCache(language = activeLanguage) {
  const payload = {
    topics: [...topicsCache],
    subTopics: [...subTopicsCache],
    soundEnabled: soundPreferenceCache,
  };

  writeOfflineJson(getPreferencesCacheKey(language), payload);
  if (language === 'english') {
    writeOfflineJson(LEGACY_PREFERENCES_CACHE_KEY, payload);
  }
}

function deriveTopics(words) {
  return [...new Set(words.map((entry) => entry.topic || DEFAULT_TOPIC))].filter(Boolean).sort();
}

function deriveSubTopics(words) {
  return [...new Set(words.map((entry) => entry.subTopic || DEFAULT_SUBTOPIC))].filter(Boolean).sort();
}

function normalizeVocabularyEntry(entry = {}, language = activeLanguage) {
  const normalizedTypeValue = entry?.type ? String(entry.type).trim() : DEFAULT_TYPE;
  const normalizedType = normalizedTypeValue
    ? normalizedTypeValue.toLowerCase() === 'collocation' || normalizedTypeValue.toLowerCase() === 'sentence'
      ? 'Phrase'
      : String(normalizedTypeValue).trim()
    : DEFAULT_TYPE;

  const normalizedTopic = entry?.topic ? String(entry.topic).trim() : DEFAULT_TOPIC;
  const normalizedSubTopic = entry?.subTopic ? String(entry.subTopic).trim() : DEFAULT_SUBTOPIC;

  const meanings = normalizeMeaningMap(entry?.meanings || entry?.meaning);
  const legacyMeaningValue = meanings.vietnamese || meanings.vi || entry?.meaning || '';
  return {
    ...entry,
    docId: entry?.docId ? String(entry.docId).trim() : '',
    word: entry?.word ? String(entry.word).trim() : '',
    meanings,
    meaning: legacyMeaningValue,
    example: entry?.example ? String(entry.example).trim() : '',
    ipa: entry?.ipa ? String(entry.ipa).trim() : '',
    topic: normalizedTopic,
    subTopic: normalizedSubTopic,
    type: normalizedType || DEFAULT_TYPE,
    writeCount: Number(entry?.writeCount) || 0,
    correct: Number(entry?.correct) || 0,
    wrong: Number(entry?.wrong) || 0,
    learned: typeof entry?.learned === 'boolean' ? entry.learned : false,
    language: normalizeLanguageCode(entry?.language || language),
  };
}

function normalizeVocabularyList(words, language = activeLanguage) {
  return (words || []).map((entry) => normalizeVocabularyEntry(entry, language)).filter((entry) => entry.word);
}

function updateDerivedCaches(words, language = activeLanguage) {
  vocabularyCache = normalizeVocabularyList(words, language);
  topicsCache = deriveTopics(vocabularyCache);
  subTopicsCache = deriveSubTopics(vocabularyCache);
  if (!topicsCache.length) {
    topicsCache = [DEFAULT_TOPIC];
  }
  if (!subTopicsCache.length) {
    subTopicsCache = [DEFAULT_SUBTOPIC];
  }
  activeLanguage = normalizeLanguageCode(language);
}

function toFirestorePayload(entry) {
  return {
    word: entry.word,
    meanings: normalizeMeaningMap(entry.meanings || entry.meaning),
    meaning: entry.meaning,
    example: entry.example,
    ipa: entry.ipa,
    topic: entry.topic,
    subTopic: entry.subTopic,
    type: entry.type,
    writeCount: entry.writeCount,
    correct: entry.correct,
    wrong: entry.wrong,
    learned: entry.learned,
    language: normalizeLanguageCode(entry.language || activeLanguage),
  };
}

function resolveEntryDocumentId(entry, fallbackEntries = vocabularyCache) {
  if (entry?.docId) {
    return entry.docId;
  }

  if (entry?.word) {
    const matchingEntry = fallbackEntries.find((candidate) => normalizeWordKey(candidate.word) === normalizeWordKey(entry.word));
    if (matchingEntry?.docId) {
      return matchingEntry.docId;
    }
  }

  return normalizeWordKey(entry?.word) || '';
}

function buildEntryWithDocId(entry, fallbackEntries = vocabularyCache, language = activeLanguage) {
  const normalized = normalizeVocabularyEntry(entry, language);
  const resolvedDocId = resolveEntryDocumentId(normalized, fallbackEntries);
  return resolvedDocId ? { ...normalized, docId: resolvedDocId } : normalized;
}

function detachListeners() {
  listenerGeneration += 1;
  vocabularyListenerActive = false;
  preferencesListenerActive = false;
  vocabularyListenerPromise = null;
  preferencesListenerPromise = null;

  if (vocabularyListenerUnsubscribe) {
    vocabularyListenerUnsubscribe();
    vocabularyListenerUnsubscribe = null;
  }

  if (preferencesListenerUnsubscribe) {
    preferencesListenerUnsubscribe();
    preferencesListenerUnsubscribe = null;
  }
}

function applyLanguageState(language) {
  const normalizedLanguage = normalizeLanguageCode(language);
  if (activeLanguage === normalizedLanguage) {
    return normalizedLanguage;
  }

  detachListeners();
  clearCacheForLanguage(activeLanguage);
  activeLanguage = normalizedLanguage;
  firestoreInitialized = false;
  firestoreSyncPromise = null;
  preferencesSyncPromise = null;
  const offlineWords = readOfflineVocabularyState(normalizedLanguage);
  const offlinePreferences = readOfflinePreferencesState(normalizedLanguage);
  updateDerivedCaches(offlineWords, normalizedLanguage);
  topicsCache = offlinePreferences.topics.length ? offlinePreferences.topics : (vocabularyCache.length ? deriveTopics(vocabularyCache) : [DEFAULT_TOPIC]);
  subTopicsCache = offlinePreferences.subTopics.length ? offlinePreferences.subTopics : (vocabularyCache.length ? deriveSubTopics(vocabularyCache) : [DEFAULT_SUBTOPIC]);
  soundPreferenceCache = typeof offlinePreferences.soundEnabled === 'boolean' ? offlinePreferences.soundEnabled : true;
  persistVocabularyOfflineCache(vocabularyCache, normalizedLanguage);
  persistPreferencesOfflineCache(normalizedLanguage);
  notifyVocabularyChange();
  return normalizedLanguage;
}

async function writeWordDocument(entry) {
  const normalized = buildEntryWithDocId(entry, vocabularyCache, activeLanguage);
  const db = await getDb();
  if (!db) {
    const existingEntries = vocabularyCache.filter((candidate) => normalizeWordKey(candidate.word) !== normalizeWordKey(normalized.word));
    const nextEntries = [...existingEntries, normalized];
    updateDerivedCaches(nextEntries, activeLanguage);
    persistVocabularyOfflineCache(nextEntries, activeLanguage);
    notifyVocabularyChange();
    return normalized;
  }

  const { doc, setDoc } = await getFirestoreHelpers(activeLanguage);
  const collectionName = getVocabularyCollection(activeLanguage);
  const docId = resolveEntryDocumentId(normalized);
  await setDoc(doc(db, collectionName, docId || normalizeWordKey(normalized.word)), toFirestorePayload(normalized), { merge: true });
  return normalized;
}

async function deleteWordDocument(entryOrWord) {
  const db = await getDb();
  if (!db) {
    const normalizedWord = typeof entryOrWord === 'string' ? entryOrWord : entryOrWord?.word;
    const existingEntries = vocabularyCache.filter((currentEntry) => normalizeWordKey(currentEntry.word) !== normalizeWordKey(normalizedWord));
    updateDerivedCaches(existingEntries, activeLanguage);
    persistVocabularyOfflineCache(existingEntries, activeLanguage);
    notifyVocabularyChange();
    return;
  }

  const { deleteDoc, doc } = await getFirestoreHelpers(activeLanguage);
  const matchingEntry = typeof entryOrWord === 'string'
    ? vocabularyCache.find((currentEntry) => normalizeWordKey(currentEntry.word) === normalizeWordKey(entryOrWord))
    : entryOrWord;
  const docId = resolveEntryDocumentId(matchingEntry || entryOrWord);
  if (!docId) {
    return;
  }

  await deleteDoc(doc(db, getVocabularyCollection(activeLanguage), docId));
}

async function attachVocabularyListener(language = activeLanguage) {
  const normalizedLanguage = normalizeLanguageCode(language);
  if (vocabularyListenerActive && vocabularyListenerLanguage === normalizedLanguage) {
    return vocabularyListenerPromise || Promise.resolve(vocabularyCache);
  }

  detachListeners();
  vocabularyListenerLanguage = normalizedLanguage;
  const db = await getDb();
  if (!db) {
    updateDerivedCaches(readOfflineVocabularyState(normalizedLanguage), normalizedLanguage);
    topicsCache = topicsCache.length ? topicsCache : [DEFAULT_TOPIC];
    subTopicsCache = subTopicsCache.length ? subTopicsCache : [DEFAULT_SUBTOPIC];
    persistVocabularyOfflineCache(vocabularyCache, normalizedLanguage);
    notifyVocabularyChange();
    return Promise.resolve(vocabularyCache);
  }

  const { collection, onSnapshot } = await getFirestoreHelpers(normalizedLanguage);
  vocabularyListenerActive = true;
  const currentGeneration = listenerGeneration;
  vocabularyListenerPromise = new Promise((resolve) => {
    vocabularyListenerUnsubscribe = onSnapshot(
      collection(db, getVocabularyCollection(normalizedLanguage)),
      (snapshot) => {
        if (currentGeneration !== listenerGeneration || activeLanguage !== normalizedLanguage) {
          return;
        }

        const loadedEntries = snapshot.docs.map((docSnapshot) => normalizeVocabularyEntry({ ...docSnapshot.data(), docId: docSnapshot.id, language: normalizedLanguage }, normalizedLanguage));
        updateDerivedCaches(loadedEntries, normalizedLanguage);
        persistVocabularyOfflineCache(loadedEntries, normalizedLanguage);
        firestoreInitialized = true;
        notifyVocabularyChange();
        resolve(vocabularyCache);
      },
      (error) => {
        if (currentGeneration !== listenerGeneration) {
          return;
        }
        console.error('Failed to sync vocabulary from Firestore', error);
        resolve(vocabularyCache);
      },
    );
  });

  return vocabularyListenerPromise;
}

async function syncVocabularyFromFirestore(language = activeLanguage) {
  await attachVocabularyListener(language);
  return vocabularyCache;
}

async function attachPreferencesListener(language = activeLanguage) {
  const normalizedLanguage = normalizeLanguageCode(language);
  if (preferencesListenerActive && preferencesListenerLanguage === normalizedLanguage) {
    return preferencesListenerPromise || Promise.resolve({ topics: [...topicsCache], subTopics: [...subTopicsCache], soundEnabled: soundPreferenceCache });
  }

  const db = await getDb();
  if (!db) {
    const offlinePreferences = readOfflinePreferencesState(normalizedLanguage);
    topicsCache = offlinePreferences.topics.length ? offlinePreferences.topics : (vocabularyCache.length ? deriveTopics(vocabularyCache) : [DEFAULT_TOPIC]);
    subTopicsCache = offlinePreferences.subTopics.length ? offlinePreferences.subTopics : (vocabularyCache.length ? deriveSubTopics(vocabularyCache) : [DEFAULT_SUBTOPIC]);
    soundPreferenceCache = typeof offlinePreferences.soundEnabled === 'boolean' ? offlinePreferences.soundEnabled : true;
    persistPreferencesOfflineCache(normalizedLanguage);
    notifyVocabularyChange();
    return Promise.resolve({ topics: [...topicsCache], subTopics: [...subTopicsCache], soundEnabled: soundPreferenceCache });
  }

  const { collection, onSnapshot } = await getFirestoreHelpers(normalizedLanguage);
  preferencesListenerActive = true;
  preferencesListenerLanguage = normalizedLanguage;
  const currentGeneration = listenerGeneration;
  preferencesListenerPromise = new Promise((resolve) => {
    preferencesListenerUnsubscribe = onSnapshot(
      collection(db, getSettingsCollection(normalizedLanguage)),
      (snapshot) => {
        if (currentGeneration !== listenerGeneration || activeLanguage !== normalizedLanguage) {
          return;
        }

        const preferenceValues = Object.fromEntries(snapshot.docs.map((docSnapshot) => [docSnapshot.id, docSnapshot.data()]));
        const storedTopics = Array.isArray(preferenceValues[TOPICS_KEY]?.value) ? preferenceValues[TOPICS_KEY].value : [];
        topicsCache = storedTopics.length ? storedTopics : (vocabularyCache.length ? deriveTopics(vocabularyCache) : [DEFAULT_TOPIC]);

        const storedSubTopics = Array.isArray(preferenceValues[SUBTOPICS_KEY]?.value) ? preferenceValues[SUBTOPICS_KEY].value : [];
        subTopicsCache = storedSubTopics.length ? storedSubTopics : (vocabularyCache.length ? deriveSubTopics(vocabularyCache) : [DEFAULT_SUBTOPIC]);

        const storedSoundValue = preferenceValues[SOUND_ENABLED_KEY]?.value;
        soundPreferenceCache = typeof storedSoundValue === 'boolean' ? storedSoundValue : true;
        persistPreferencesOfflineCache(normalizedLanguage);
        notifyVocabularyChange();
        resolve({ topics: [...topicsCache], subTopics: [...subTopicsCache], soundEnabled: soundPreferenceCache });
      },
      (error) => {
        if (currentGeneration !== listenerGeneration) {
          return;
        }
        console.error('Failed to sync preferences from Firestore', error);
        resolve({ topics: [...topicsCache], subTopics: [...subTopicsCache], soundEnabled: soundPreferenceCache });
      },
    );
  });

  return preferencesListenerPromise;
}

async function syncPreferencesFromFirestore(language = activeLanguage) {
  await attachPreferencesListener(language);
  return { topics: [...topicsCache], subTopics: [...subTopicsCache], soundEnabled: soundPreferenceCache };
}

export async function ensureVocabularyLoaded() {
  const normalizedLanguage = normalizeLanguageCode(getCurrentLanguage());
  if (activeLanguage !== normalizedLanguage) {
    applyLanguageState(normalizedLanguage);
  }

  if (firestoreInitialized) {
    return vocabularyCache;
  }

  if (!firestoreSyncPromise) {
    firestoreSyncPromise = syncVocabularyFromFirestore(normalizedLanguage).catch((error) => {
      console.error('Failed to load vocabulary from Firestore', error);
      updateDerivedCaches(readOfflineVocabularyState(normalizedLanguage), normalizedLanguage);
      notifyVocabularyChange();
      return vocabularyCache;
    });
  }

  return firestoreSyncPromise;
}

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

export async function ensurePreferencesLoaded() {
  const normalizedLanguage = normalizeLanguageCode(getCurrentLanguage());
  if (activeLanguage !== normalizedLanguage) {
    applyLanguageState(normalizedLanguage);
  }

  if (preferencesSyncPromise) {
    return preferencesSyncPromise;
  }

  preferencesSyncPromise = syncPreferencesFromFirestore(normalizedLanguage).catch((error) => {
    console.error('Failed to load preferences from Firestore', error);
    return { topics: [...topicsCache], subTopics: [...subTopicsCache], soundEnabled: soundPreferenceCache };
  });

  return preferencesSyncPromise;
}

export async function migrateLocalStorageToFirestore() {
  try {
    const db = await getDb();
    if (!db) {
      return false;
    }

    const language = normalizeLanguageCode(getCurrentLanguage());
    const { collection, getDocs, doc, setDoc } = await getFirestoreHelpers(language);
    const [wordSnapshot, preferencesSnapshot] = await Promise.all([
      getDocs(collection(db, getVocabularyCollection(language))),
      getDocs(collection(db, getSettingsCollection(language))),
    ]);

    const localData = {
      vocabulary: readOfflineVocabularyState(language),
      topics: [],
      subTopics: [],
      soundEnabled: null,
    };

    const firestoreWords = wordSnapshot.docs.map((docSnapshot) => normalizeVocabularyEntry({ ...docSnapshot.data(), docId: docSnapshot.id, language }, language));
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
      const normalizedEntry = normalizeVocabularyEntry({ ...entry, language }, language);
      mergedWords.push(normalizedEntry);
      missingWords.push(normalizedEntry);
    });

    const firestorePreferenceValues = Object.fromEntries(preferencesSnapshot.docs.map((docSnapshot) => [docSnapshot.id, docSnapshot.data()]));
    const existingTopics = Array.isArray(firestorePreferenceValues[TOPICS_KEY]?.value) ? firestorePreferenceValues[TOPICS_KEY].value : [];
    const existingSubTopics = Array.isArray(firestorePreferenceValues[SUBTOPICS_KEY]?.value) ? firestorePreferenceValues[SUBTOPICS_KEY].value : [];
    const existingSoundValue = firestorePreferenceValues[SOUND_ENABLED_KEY]?.value;
    const nextTopics = [...new Set([...existingTopics, ...localData.topics].map((topic) => String(topic).trim()).filter(Boolean))];
    const nextSubTopics = [...new Set([...existingSubTopics, ...localData.subTopics].map((subTopic) => String(subTopic).trim()).filter(Boolean))];
    const nextSoundEnabled = typeof existingSoundValue === 'boolean' ? existingSoundValue : (typeof localData.soundEnabled === 'boolean' ? localData.soundEnabled : true);

    for (const entry of missingWords) {
      const docId = resolveEntryDocumentId(entry, mergedWords) || normalizeWordKey(entry.word);
      await setDoc(doc(db, getVocabularyCollection(language), docId), toFirestorePayload(entry), { merge: true });
    }

    if (nextTopics.length) {
      await setDoc(doc(db, getSettingsCollection(language), TOPICS_KEY), { value: nextTopics }, { merge: true });
    }
    if (nextSubTopics.length) {
      await setDoc(doc(db, getSettingsCollection(language), SUBTOPICS_KEY), { value: nextSubTopics }, { merge: true });
    }
    if (typeof existingSoundValue !== 'boolean' && typeof localData.soundEnabled === 'boolean') {
      await setDoc(doc(db, getSettingsCollection(language), SOUND_ENABLED_KEY), { value: localData.soundEnabled }, { merge: true });
    }

    updateDerivedCaches(mergedWords, language);
    topicsCache = nextTopics.length ? nextTopics : topicsCache;
    subTopicsCache = nextSubTopics.length ? nextSubTopics : subTopicsCache;
    soundPreferenceCache = nextSoundEnabled;
    persistVocabularyOfflineCache(mergedWords, language);
    persistPreferencesOfflineCache(language);
    firestoreInitialized = false;
    firestoreSyncPromise = null;
    preferencesSyncPromise = null;
    notifyVocabularyChange();
    return true;
  } catch (error) {
    console.error('MIGRATE FAILED', error);
    return false;
  }
}

export async function loadSoundEnabled(defaultValue = true) {
  const preferences = await ensurePreferencesLoaded();
  return typeof preferences?.soundEnabled === 'boolean' ? preferences.soundEnabled : defaultValue;
}

export function saveSoundEnabled(enabled) {
  soundPreferenceCache = Boolean(enabled);
  persistPreferencesOfflineCache(activeLanguage);
  void (async () => {
    const db = await getDb();
    if (!db) {
      return;
    }
    const { doc, setDoc } = await getFirestoreHelpers(activeLanguage);
    await setDoc(doc(db, getSettingsCollection(activeLanguage), SOUND_ENABLED_KEY), { value: soundPreferenceCache }, { merge: true });
  })();
}

export function loadTopics() {
  void ensureVocabularyLoaded();
  void ensurePreferencesLoaded();
  return [...topicsCache];
}

export async function saveTopics(topics) {
  const nextTopics = [...new Set((topics || []).map((topic) => String(topic).trim()).filter(Boolean))];
  const db = await getDb();
  if (!db) {
    topicsCache = nextTopics.length ? nextTopics : [DEFAULT_TOPIC];
    persistPreferencesOfflineCache(activeLanguage);
    notifyVocabularyChange();
    return;
  }

  topicsCache = nextTopics.length ? nextTopics : [DEFAULT_TOPIC];
  const { doc, setDoc } = await getFirestoreHelpers(activeLanguage);
  await setDoc(doc(db, getSettingsCollection(activeLanguage), TOPICS_KEY), { value: [...topicsCache] }, { merge: true });
  persistPreferencesOfflineCache(activeLanguage);
}

export function loadSubTopics(topic) {
  void ensureVocabularyLoaded();
  void ensurePreferencesLoaded();
  if (!topic) {
    return [...subTopicsCache].filter(Boolean);
  }

  const topicScopedSubTopics = (subTopicsCache || [])
    .filter((stored) => typeof stored === 'string' && stored.startsWith(`${topic}::`))
    .map((stored) => stored.slice(topic.length + 2));

  if (topicScopedSubTopics.length) {
    return [...new Set(topicScopedSubTopics)].filter(Boolean).sort();
  }

  const topicSubTopics = vocabularyCache.filter((entry) => entry.topic === topic).map((entry) => entry.subTopic || DEFAULT_SUBTOPIC);
  return [...new Set(topicSubTopics)].filter(Boolean).sort();
}

export async function saveSubTopics(subTopics, topic) {
  const nextSubTopics = [...new Set((subTopics || []).map((subTopic) => String(subTopic).trim()).filter(Boolean))];
  const db = await getDb();

  if (topic) {
    const existingForOtherTopics = subTopicsCache.filter((stored) => !stored.startsWith(`${topic}::`));
    subTopicsCache = [...existingForOtherTopics, ...nextSubTopics.map((subTopic) => `${topic}::${subTopic}`)];
  } else {
    subTopicsCache = nextSubTopics.length ? nextSubTopics : [DEFAULT_SUBTOPIC];
  }

  if (!db) {
    persistPreferencesOfflineCache(activeLanguage);
    notifyVocabularyChange();
    return;
  }

  const { doc, setDoc } = await getFirestoreHelpers(activeLanguage);
  await setDoc(doc(db, getSettingsCollection(activeLanguage), SUBTOPICS_KEY), { value: [...subTopicsCache] }, { merge: true });
  persistPreferencesOfflineCache(activeLanguage);
}

export async function renameTopic(oldTopic, newTopic) {
  if (!oldTopic || !oldTopic.trim() || !newTopic || !newTopic.trim()) {
    throw new Error('Topic name is required.');
  }

  const normalizedOldTopic = oldTopic.trim();
  const normalizedNewTopic = newTopic.trim();
  await ensureVocabularyLoaded();
  const topics = loadTopics();
  const duplicate = topics.some(
    (topic) => topic.toLowerCase() === normalizedNewTopic.toLowerCase() && topic.toLowerCase() !== normalizedOldTopic.toLowerCase(),
  );
  if (duplicate) {
    throw new Error('Topic already exists.');
  }

  const matchingWords = loadVocabulary().filter((entry) => entry.topic && entry.topic.toLowerCase() === normalizedOldTopic.toLowerCase());
  const updatedEntries = matchingWords.map((entry) => ({ ...entry, topic: normalizedNewTopic }));
  await Promise.all(updatedEntries.map((entry) => writeWordDocument(entry)));
  updateDerivedCaches(vocabularyCache.map((entry) => {
    const matchingEntry = updatedEntries.find((updated) => normalizeWordKey(updated.word) === normalizeWordKey(entry.word));
    return matchingEntry ? { ...entry, ...matchingEntry } : entry;
  }), activeLanguage);

  await saveTopics(topics.map((topic) => topic.toLowerCase() === normalizedOldTopic.toLowerCase() ? normalizedNewTopic : topic));
}

export async function renameSubTopic(topic, oldSubTopic, newSubTopic) {
  if (!topic || !topic.trim() || !oldSubTopic || !oldSubTopic.trim() || !newSubTopic || !newSubTopic.trim()) {
    throw new Error('Sub Topic name is required.');
  }

  const normalizedTopic = topic.trim();
  const normalizedOldSubTopic = oldSubTopic.trim();
  const normalizedNewSubTopic = newSubTopic.trim();
  await ensureVocabularyLoaded();
  const subTopics = loadSubTopics(normalizedTopic);
  const duplicate = subTopics.some(
    (subTopic) => subTopic.toLowerCase() === normalizedNewSubTopic.toLowerCase() && subTopic.toLowerCase() !== normalizedOldSubTopic.toLowerCase(),
  );
  if (duplicate) {
    throw new Error('Sub Topic already exists.');
  }

  const matchingWords = loadVocabulary().filter(
    (entry) => entry.topic === normalizedTopic && entry.subTopic && entry.subTopic.toLowerCase() === normalizedOldSubTopic.toLowerCase(),
  );
  const updatedEntries = matchingWords.map((entry) => ({ ...entry, subTopic: normalizedNewSubTopic }));
  await Promise.all(updatedEntries.map((entry) => writeWordDocument(entry)));
  updateDerivedCaches(vocabularyCache.map((entry) => {
    const matchingEntry = updatedEntries.find((updated) => normalizeWordKey(updated.word) === normalizeWordKey(entry.word));
    return matchingEntry ? { ...entry, ...matchingEntry } : entry;
  }), activeLanguage);

  await saveSubTopics(subTopics.map((subTopic) => subTopic.toLowerCase() === normalizedOldSubTopic.toLowerCase() ? normalizedNewSubTopic : subTopic), normalizedTopic);
}

export async function deleteTopic(topic) {
  if (!topic || !topic.trim()) {
    throw new Error('Topic name is required.');
  }

  const normalizedTopic = topic.trim();
  await ensureVocabularyLoaded();
  const nextTopics = loadTopics().filter((storedTopic) => storedTopic.toLowerCase() !== normalizedTopic.toLowerCase());
  const wordsToDelete = loadVocabulary().filter((entry) => entry.topic && entry.topic.toLowerCase() === normalizedTopic.toLowerCase());

  await Promise.all(wordsToDelete.map((entry) => deleteWordDocument(entry)));
  await saveTopics(nextTopics);
}

export async function deleteSubTopic(topic, subTopic) {
  if (!topic || !topic.trim() || !subTopic || !subTopic.trim()) {
    throw new Error('Sub Topic name is required.');
  }

  const normalizedTopic = topic.trim();
  const normalizedSubTopic = subTopic.trim();
  await ensureVocabularyLoaded();
  const wordsToDelete = loadVocabulary().filter(
    (entry) => entry.topic === normalizedTopic && entry.subTopic && entry.subTopic.toLowerCase() === normalizedSubTopic.toLowerCase(),
  );

  await Promise.all(wordsToDelete.map((entry) => deleteWordDocument(entry)));

  const nextSubTopics = loadSubTopics(normalizedTopic).filter((stored) => stored.toLowerCase() !== normalizedSubTopic.toLowerCase());
  await saveSubTopics(nextSubTopics, normalizedTopic);
}

export async function saveVocabulary(words) {
  const normalized = normalizeVocabularyList(words, activeLanguage);
  const db = await getDb();
  if (!db) {
    updateDerivedCaches(normalized, activeLanguage);
    persistVocabularyOfflineCache(normalized, activeLanguage);
    notifyVocabularyChange();
    return normalized;
  }

  await Promise.all(
    normalized.map((entry) => {
      const documentId = resolveEntryDocumentId(entry, normalized) || normalizeWordKey(entry.word);
      return writeWordDocument({ ...entry, docId });
    }),
  );

  updateDerivedCaches(normalized, activeLanguage);
  persistVocabularyOfflineCache(normalized, activeLanguage);
  firestoreInitialized = true;
  return normalized;
}

export function createVocabularyEntry(
  word,
  meaning,
  example,
  ipa = '',
  topic = DEFAULT_TOPIC,
  subTopic = DEFAULT_SUBTOPIC,
  type = DEFAULT_TYPE,
  meanings = {},
) {
  const normalizedMeanings = normalizeMeaningMap(meanings || meaning);
  const fallbackMeaning = normalizedMeanings.vietnamese || normalizedMeanings.vi || String(meaning || '').trim();
  return {
    word: String(word || '').trim(),
    meanings: normalizedMeanings,
    meaning: fallbackMeaning,
    example: String(example || '').trim(),
    ipa: String(ipa || '').trim(),
    topic: String(topic || '').trim() || DEFAULT_TOPIC,
    subTopic: String(subTopic || '').trim() || DEFAULT_SUBTOPIC,
    type: String(type || '').trim() || DEFAULT_TYPE,
    writeCount: 0,
    correct: 0,
    wrong: 0,
    learned: false,
    language: activeLanguage,
  };
}

export async function addVocabularyEntry(entry) {
  await ensureVocabularyLoaded();
  const words = loadVocabulary();
  const normalizedEntry = createVocabularyEntry(
    entry.word,
    entry.meaning,
    entry.example,
    entry.ipa,
    entry.topic,
    entry.subTopic,
    entry.type,
    entry.meanings || entry.meaning,
  );

  if (!normalizedEntry.word) {
    throw new Error('Từ không được để trống.');
  }

  const exists = words.some((item) => normalizeWordKey(item.word) === normalizeWordKey(normalizedEntry.word));
  if (exists) {
    throw new Error('Từ này đã tồn tại.');
  }

  await writeWordDocument(normalizedEntry);
  return normalizedEntry;
}

export async function removeVocabularyEntry(word) {
  await ensureVocabularyLoaded();
  await deleteWordDocument(word);
}

export async function updateVocabularyEntryByWord(originalWord, updates) {
  await ensureVocabularyLoaded();
  const words = loadVocabulary();
  const normalizedOriginalWord = normalizeWordKey(originalWord);
  const nextWord = (updates?.word || '').trim();

  if (nextWord) {
    const duplicate = words.find(
      (item) => normalizeWordKey(item.word) !== normalizedOriginalWord && normalizeWordKey(item.word) === normalizeWordKey(nextWord),
    );
    if (duplicate) {
      throw new Error('Từ này đã tồn tại.');
    }
  }

  const existing = words.find((item) => normalizeWordKey(item.word) === normalizedOriginalWord);
  if (!existing) {
    return null;
  }

  const updated = normalizeVocabularyEntry({ ...existing, ...updates, word: nextWord || existing.word }, activeLanguage);
  if (!updated.word) {
    throw new Error('Từ không được để trống.');
  }

  await writeWordDocument(updated);
  return updated;
}

export async function updateVocabularyEntry(word, updates) {
  await ensureVocabularyLoaded();
  const words = loadVocabulary();
  const normalizedOriginalWord = normalizeWordKey(word);
  const existing = words.find((item) => normalizeWordKey(item.word) === normalizedOriginalWord);
  if (!existing) {
    return null;
  }

  const updated = normalizeVocabularyEntry({ ...existing, ...updates }, activeLanguage);
  if (!updated.word) {
    throw new Error('Từ không được để trống.');
  }

  await writeWordDocument(updated);
  return updated;
}

export function findVocabularyEntry(word) {
  return loadVocabulary().find((item) => normalizeWordKey(item.word) === normalizeWordKey(word));
}

export function getUniqueTopics(words) {
  return [...new Set(words.map((entry) => entry.topic || DEFAULT_TOPIC))].sort();
}

export function getUniqueSubTopics(words, topic) {
  return [...new Set(words.filter((entry) => (topic ? entry.topic === topic : true)).map((entry) => entry.subTopic || DEFAULT_SUBTOPIC))].sort();
}

export function filterVocabularyByTopic(words, topic, subTopic) {
  return words.filter((entry) => {
    const matchesTopic = !topic || topic === '' || entry.topic === topic;
    const matchesSubTopic = !subTopic || subTopic === '' || entry.subTopic === subTopic;
    return matchesTopic && matchesSubTopic;
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('language-changed', (event) => {
    const nextLanguage = event?.detail?.language;
    if (nextLanguage) {
      applyLanguageState(nextLanguage);
    }
  });
}

void ensureVocabularyLoaded();
