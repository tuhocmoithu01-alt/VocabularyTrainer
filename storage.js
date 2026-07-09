import { getDb } from './firebase.js';

export const DEFAULT_TOPIC = 'General';
export const DEFAULT_SUBTOPIC = 'Default';
export const DEFAULT_TYPE = 'Word';

const WORDS_COLLECTION = 'words';
const PREFERENCES_COLLECTION = 'preferences';
const SOUND_ENABLED_KEY = 'soundEnabled';
const TOPICS_KEY = 'topics';
const SUBTOPICS_KEY = 'subTopics';
const VOCABULARY_OFFLINE_CACHE_KEY = 'vocabularyTrainer.vocabulary';
const PREFERENCES_OFFLINE_CACHE_KEY = 'vocabularyTrainer.preferences';

let vocabularyCache = [];
let topicsCache = [];
let subTopicsCache = [];
let firestoreInitialized = false;
let firestoreSyncPromise = null;
let preferencesSyncPromise = null;
let soundPreferenceCache = true;
let vocabularyListenerActive = false;
let preferencesListenerActive = false;
let vocabularyListenerUnsubscribe = null;
let preferencesListenerUnsubscribe = null;
let vocabularyListenerPromise = null;
let preferencesListenerPromise = null;

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

function readOfflineVocabularyState() {
  const cached = readOfflineJson(VOCABULARY_OFFLINE_CACHE_KEY);
  return Array.isArray(cached) ? cached : [];
}

function readOfflinePreferencesState() {
  const cached = readOfflineJson(PREFERENCES_OFFLINE_CACHE_KEY);
  if (!cached || typeof cached !== 'object') {
    return { topics: [], subTopics: [], soundEnabled: true };
  }

  return {
    topics: Array.isArray(cached.topics) ? cached.topics : [],
    subTopics: Array.isArray(cached.subTopics) ? cached.subTopics : [],
    soundEnabled: typeof cached.soundEnabled === 'boolean' ? cached.soundEnabled : true,
  };
}

function persistVocabularyOfflineCache(words = vocabularyCache) {
  writeOfflineJson(VOCABULARY_OFFLINE_CACHE_KEY, normalizeVocabularyList(words));
}

function persistPreferencesOfflineCache() {
  writeOfflineJson(PREFERENCES_OFFLINE_CACHE_KEY, {
    topics: [...topicsCache],
    subTopics: [...subTopicsCache],
    soundEnabled: soundPreferenceCache,
  });
}

async function getFirestoreHelpers() {
  const [{ collection, deleteDoc, doc, getDocs, onSnapshot, setDoc }] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js'),
  ]);
  return { collection, deleteDoc, doc, getDocs, onSnapshot, setDoc };
}

function deriveTopics(words) {
  return [...new Set(words.map((entry) => entry.topic || DEFAULT_TOPIC))].filter(Boolean).sort();
}

function deriveSubTopics(words) {
  return [...new Set(words.map((entry) => entry.subTopic || DEFAULT_SUBTOPIC))].filter(Boolean).sort();
}

function normalizeVocabularyEntry(entry) {
  let typeValue = entry?.type ? String(entry.type).trim() : DEFAULT_TYPE;
  const normalizedType = typeValue
    ? typeValue.toLowerCase() === 'collocation' || typeValue.toLowerCase() === 'sentence'
      ? 'Phrase'
      : String(typeValue).trim()
    : DEFAULT_TYPE;

  const normalized = {
    ...entry,
    docId: entry?.docId ? String(entry.docId).trim() : '',
    word: entry?.word ? String(entry.word).trim() : '',
    meaning: entry?.meaning ? String(entry.meaning).trim() : '',
    example: entry?.example ? String(entry.example).trim() : '',
    ipa: entry?.ipa ? String(entry.ipa).trim() : '',
    topic: entry?.topic ? String(entry.topic).trim() : DEFAULT_TOPIC,
    subTopic: entry?.subTopic ? String(entry.subTopic).trim() : DEFAULT_SUBTOPIC,
    type: normalizedType || DEFAULT_TYPE,
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
    type: entry.type,
    writeCount: entry.writeCount,
    correct: entry.correct,
    wrong: entry.wrong,
    learned: entry.learned,
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

function buildEntryWithDocId(entry, fallbackEntries = vocabularyCache) {
  const normalized = normalizeVocabularyEntry(entry);
  const resolvedDocId = resolveEntryDocumentId(normalized, fallbackEntries);
  return resolvedDocId ? { ...normalized, docId: resolvedDocId } : normalized;
}

async function writeWordDocument(entry) {
  const normalized = buildEntryWithDocId(entry);
  const db = await getDb();
  if (!db) {
    const existingEntries = vocabularyCache.filter((candidate) => normalizeWordKey(candidate.word) !== normalizeWordKey(normalized.word));
    const nextEntries = [...existingEntries, normalized];
    updateDerivedCaches(nextEntries);
    persistVocabularyOfflineCache(nextEntries);
    notifyVocabularyChange();
    return normalized;
  }

  const { doc, setDoc } = await getFirestoreHelpers();
  const docId = resolveEntryDocumentId(normalized);
  await setDoc(doc(db, WORDS_COLLECTION, docId || normalizeWordKey(normalized.word)), toFirestorePayload(normalized), { merge: true });
  return normalized;
}

async function deleteWordDocument(entryOrWord) {
  const db = await getDb();
  if (!db) {
    const normalizedWord = typeof entryOrWord === 'string' ? entryOrWord : entryOrWord?.word;
    const existingEntries = vocabularyCache.filter((currentEntry) => normalizeWordKey(currentEntry.word) !== normalizeWordKey(normalizedWord));
    updateDerivedCaches(existingEntries);
    persistVocabularyOfflineCache(existingEntries);
    notifyVocabularyChange();
    return;
  }

  const { deleteDoc, doc } = await getFirestoreHelpers();
  const matchingEntry = typeof entryOrWord === 'string'
    ? vocabularyCache.find((currentEntry) => normalizeWordKey(currentEntry.word) === normalizeWordKey(entryOrWord))
    : entryOrWord;
  const docId = resolveEntryDocumentId(matchingEntry || entryOrWord);
  if (!docId) {
    return;
  }

  await deleteDoc(doc(db, WORDS_COLLECTION, docId));
}

async function attachVocabularyListener() {
  if (vocabularyListenerActive) {
    return vocabularyListenerPromise || Promise.resolve();
  }

  const db = await getDb();
  if (!db) {
    updateDerivedCaches(readOfflineVocabularyState());
    topicsCache = topicsCache.length ? topicsCache : [DEFAULT_TOPIC];
    subTopicsCache = subTopicsCache.length ? subTopicsCache : [DEFAULT_SUBTOPIC];
    persistVocabularyOfflineCache(vocabularyCache);
    notifyVocabularyChange();
    return Promise.resolve(vocabularyCache);
  }

  const { collection, onSnapshot } = await getFirestoreHelpers();
  vocabularyListenerActive = true;
  vocabularyListenerPromise = new Promise((resolve) => {
    vocabularyListenerUnsubscribe = onSnapshot(
      collection(db, WORDS_COLLECTION),
      (snapshot) => {
        const loadedEntries = snapshot.docs.map((docSnapshot) => normalizeVocabularyEntry({ ...docSnapshot.data(), docId: docSnapshot.id }));
        updateDerivedCaches(loadedEntries);
        persistVocabularyOfflineCache(loadedEntries);
        firestoreInitialized = true;
        notifyVocabularyChange();
        resolve(vocabularyCache);
      },
      (error) => {
        console.error('Failed to sync vocabulary from Firestore', error);
        resolve(vocabularyCache);
      },
    );
  });

  return vocabularyListenerPromise;
}

async function syncVocabularyFromFirestore() {
  await attachVocabularyListener();
  return vocabularyCache;
}

export async function ensureVocabularyLoaded() {
  if (firestoreInitialized) {
    return vocabularyCache;
  }

  if (!firestoreSyncPromise) {
    firestoreSyncPromise = syncVocabularyFromFirestore().catch((error) => {
      console.error('Failed to load vocabulary from Firestore', error);
      updateDerivedCaches(readOfflineVocabularyState());
      notifyVocabularyChange();
      return vocabularyCache;
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

async function attachPreferencesListener() {
  if (preferencesListenerActive) {
    return preferencesListenerPromise || Promise.resolve();
  }

  const db = await getDb();
  if (!db) {
    const offlinePreferences = readOfflinePreferencesState();
    topicsCache = offlinePreferences.topics.length ? offlinePreferences.topics : (vocabularyCache.length ? deriveTopics(vocabularyCache) : [DEFAULT_TOPIC]);
    subTopicsCache = offlinePreferences.subTopics.length ? offlinePreferences.subTopics : (vocabularyCache.length ? deriveSubTopics(vocabularyCache) : [DEFAULT_SUBTOPIC]);
    soundPreferenceCache = typeof offlinePreferences.soundEnabled === 'boolean' ? offlinePreferences.soundEnabled : true;
    persistPreferencesOfflineCache();
    notifyVocabularyChange();
    return Promise.resolve({ topics: [...topicsCache], subTopics: [...subTopicsCache], soundEnabled: soundPreferenceCache });
  }

  const { collection, onSnapshot } = await getFirestoreHelpers();
  preferencesListenerActive = true;
  preferencesListenerPromise = new Promise((resolve) => {
    preferencesListenerUnsubscribe = onSnapshot(
      collection(db, PREFERENCES_COLLECTION),
      (snapshot) => {
        const preferenceValues = Object.fromEntries(snapshot.docs.map((docSnapshot) => [docSnapshot.id, docSnapshot.data()]));

        const storedTopics = Array.isArray(preferenceValues[TOPICS_KEY]?.value) ? preferenceValues[TOPICS_KEY].value : [];
        topicsCache = storedTopics.length ? storedTopics : (vocabularyCache.length ? deriveTopics(vocabularyCache) : [DEFAULT_TOPIC]);

        const storedSubTopics = Array.isArray(preferenceValues[SUBTOPICS_KEY]?.value) ? preferenceValues[SUBTOPICS_KEY].value : [];
        subTopicsCache = storedSubTopics.length ? storedSubTopics : (vocabularyCache.length ? deriveSubTopics(vocabularyCache) : [DEFAULT_SUBTOPIC]);

        const storedSoundValue = preferenceValues[SOUND_ENABLED_KEY]?.value;
        soundPreferenceCache = typeof storedSoundValue === 'boolean' ? storedSoundValue : true;
        persistPreferencesOfflineCache();
        notifyVocabularyChange();
        resolve({ topics: [...topicsCache], subTopics: [...subTopicsCache], soundEnabled: soundPreferenceCache });
      },
      (error) => {
        console.error('Failed to sync preferences from Firestore', error);
        resolve({ topics: [...topicsCache], subTopics: [...subTopicsCache], soundEnabled: soundPreferenceCache });
      },
    );
  });

  return preferencesListenerPromise;
}

async function syncPreferencesFromFirestore() {
  await attachPreferencesListener();
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

    const localData = {
      vocabulary: readOfflineVocabularyState(),
      topics: [],
      subTopics: [],
      soundEnabled: null,
    };

    const firestoreWords = wordSnapshot.docs.map((docSnapshot) => normalizeVocabularyEntry({ ...docSnapshot.data(), docId: docSnapshot.id }));
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
      const docId = resolveEntryDocumentId(entry, mergedWords) || normalizeWordKey(entry.word);
      await setDoc(doc(db, WORDS_COLLECTION, docId), toFirestorePayload(entry), { merge: true });
    }

    if (nextTopics.length) {
      await setDoc(doc(db, PREFERENCES_COLLECTION, TOPICS_KEY), { value: nextTopics }, { merge: true });
    }
    if (nextSubTopics.length) {
      await setDoc(doc(db, PREFERENCES_COLLECTION, SUBTOPICS_KEY), { value: nextSubTopics }, { merge: true });
    }
    if (typeof existingSoundValue !== 'boolean' && typeof localData.soundEnabled === 'boolean') {
      await setDoc(doc(db, PREFERENCES_COLLECTION, SOUND_ENABLED_KEY), { value: localData.soundEnabled }, { merge: true });
    }

    updateDerivedCaches(mergedWords);
    topicsCache = nextTopics.length ? nextTopics : topicsCache;
    subTopicsCache = nextSubTopics.length ? nextSubTopics : subTopicsCache;
    soundPreferenceCache = nextSoundEnabled;
    persistVocabularyOfflineCache(mergedWords);
    persistPreferencesOfflineCache();
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
  persistPreferencesOfflineCache();
  void (async () => {
    const db = await getDb();
    if (!db) {
      return;
    }
    const { doc, setDoc } = await getFirestoreHelpers();
    await setDoc(doc(db, PREFERENCES_COLLECTION, SOUND_ENABLED_KEY), { value: soundPreferenceCache }, { merge: true });
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
    persistPreferencesOfflineCache();
    notifyVocabularyChange();
    return;
  }

  topicsCache = nextTopics.length ? nextTopics : [DEFAULT_TOPIC];
  const { doc, setDoc } = await getFirestoreHelpers();
  await setDoc(doc(db, PREFERENCES_COLLECTION, TOPICS_KEY), { value: [...topicsCache] }, { merge: true });
  persistPreferencesOfflineCache();
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
    persistPreferencesOfflineCache();
    notifyVocabularyChange();
    return;
  }

  const { doc, setDoc } = await getFirestoreHelpers();
  await setDoc(doc(db, PREFERENCES_COLLECTION, SUBTOPICS_KEY), { value: [...subTopicsCache] }, { merge: true });
  persistPreferencesOfflineCache();
}

async function persistSubTopicsCache() {
  const db = await getDb();
  if (!db) {
    persistPreferencesOfflineCache();
    return;
  }

  const { doc, setDoc } = await getFirestoreHelpers();
  await setDoc(doc(db, PREFERENCES_COLLECTION, SUBTOPICS_KEY), { value: [...subTopicsCache] }, { merge: true });
  persistPreferencesOfflineCache();
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

  const nextTopics = topics.map((topic) =>
    topic.toLowerCase() === normalizedOldTopic.toLowerCase() ? normalizedNewTopic : topic,
  );

  const currentSubTopics = loadSubTopics(normalizedOldTopic);
  const matchingWords = loadVocabulary().filter(
    (entry) => entry.topic && entry.topic.toLowerCase() === normalizedOldTopic.toLowerCase(),
  );

  const updatedEntries = matchingWords.map((entry) => ({ ...entry, topic: normalizedNewTopic }));
  await Promise.all(updatedEntries.map((entry) => writeWordDocument(entry)));
  updateDerivedCaches(vocabularyCache.map((entry) => {
    const matchingEntry = updatedEntries.find((updated) => normalizeWordKey(updated.word) === normalizeWordKey(entry.word));
    return matchingEntry ? { ...entry, ...matchingEntry } : entry;
  }));

  await saveTopics(nextTopics);

  const updatedSubTopics = subTopicsCache
    .filter((stored) => !stored.startsWith(`${normalizedOldTopic}::`))
    .concat(currentSubTopics.map((subTopic) => `${normalizedNewTopic}::${subTopic}`));
  subTopicsCache = [...new Set(updatedSubTopics)];
  await persistSubTopicsCache();
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

  const nextSubTopics = subTopics.map((subTopic) =>
    subTopic.toLowerCase() === normalizedOldSubTopic.toLowerCase() ? normalizedNewSubTopic : subTopic,
  );

  const matchingWords = loadVocabulary().filter(
    (entry) =>
      entry.topic === normalizedTopic &&
      entry.subTopic &&
      entry.subTopic.toLowerCase() === normalizedOldSubTopic.toLowerCase(),
  );

  const updatedEntries = matchingWords.map((entry) => ({ ...entry, subTopic: normalizedNewSubTopic }));
  await Promise.all(updatedEntries.map((entry) => writeWordDocument(entry)));
  updateDerivedCaches(vocabularyCache.map((entry) => {
    const matchingEntry = updatedEntries.find((updated) => normalizeWordKey(updated.word) === normalizeWordKey(entry.word));
    return matchingEntry ? { ...entry, ...matchingEntry } : entry;
  }));

  await saveSubTopics(nextSubTopics, normalizedTopic);
}

export async function deleteTopic(topic) {
  if (!topic || !topic.trim()) {
    throw new Error('Topic name is required.');
  }

  const normalizedTopic = topic.trim();
  await ensureVocabularyLoaded();
  const nextTopics = loadTopics().filter((storedTopic) => storedTopic.toLowerCase() !== normalizedTopic.toLowerCase());
  const wordsToDelete = loadVocabulary().filter(
    (entry) => entry.topic && entry.topic.toLowerCase() === normalizedTopic.toLowerCase(),
  );

  await Promise.all(wordsToDelete.map((entry) => deleteWordDocument(entry)));
  await saveTopics(nextTopics);
  subTopicsCache = subTopicsCache.filter((stored) => !stored.startsWith(`${normalizedTopic}::`));
  await persistSubTopicsCache();
}

export async function deleteSubTopic(topic, subTopic) {
  if (!topic || !topic.trim() || !subTopic || !subTopic.trim()) {
    throw new Error('Sub Topic name is required.');
  }

  const normalizedTopic = topic.trim();
  const normalizedSubTopic = subTopic.trim();
  await ensureVocabularyLoaded();
  const wordsToDelete = loadVocabulary().filter(
    (entry) =>
      entry.topic === normalizedTopic &&
      entry.subTopic &&
      entry.subTopic.toLowerCase() === normalizedSubTopic.toLowerCase(),
  );

  await Promise.all(wordsToDelete.map((entry) => deleteWordDocument(entry)));

  const nextSubTopics = loadSubTopics(normalizedTopic).filter(
    (stored) => stored.toLowerCase() !== normalizedSubTopic.toLowerCase(),
  );
  await saveSubTopics(nextSubTopics, normalizedTopic);
}

/**
 * Persist vocabulary list to Firestore.
 * @param {Array<Object>} words
 */
export async function saveVocabulary(words) {
  const normalized = normalizeVocabularyList(words);
  const db = await getDb();
  if (!db) {
    updateDerivedCaches(normalized);
    persistVocabularyOfflineCache(normalized);
    notifyVocabularyChange();
    return normalized;
  }

  await Promise.all(
    normalized.map((entry) => {
      const documentId = resolveEntryDocumentId(entry, normalized) || normalizeWordKey(entry.word);
      return writeWordDocument({ ...entry, docId: documentId });
    }),
  );

  updateDerivedCaches(normalized);
  persistVocabularyOfflineCache(normalized);
  firestoreInitialized = true;
  return normalized;
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
  type = DEFAULT_TYPE,
) {
  return {
    word: String(word || '').trim(),
    meaning: String(meaning || '').trim(),
    example: String(example || '').trim(),
    ipa: String(ipa || '').trim(),
    topic: String(topic || '').trim() || DEFAULT_TOPIC,
    subTopic: String(subTopic || '').trim() || DEFAULT_SUBTOPIC,
    type: String(type || '').trim() || DEFAULT_TYPE,
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

/**
 * Remove word by value.
 * @param {string} word
 */
export async function removeVocabularyEntry(word) {
  await ensureVocabularyLoaded();
  await deleteWordDocument(word);
}

/**
 * Update an existing vocabulary entry while preserving its progress statistics.
 * @param {string} originalWord
 * @param {Partial<Object>} updates
 * @returns {Object | null}
 */
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

  const updated = normalizeVocabularyEntry({ ...existing, ...updates, word: nextWord || existing.word });
  if (!updated.word) {
    throw new Error('Từ không được để trống.');
  }

  await writeWordDocument(updated);
  return updated;
}

/**
 * Update a word entry with partial values.
 * @param {string} word
 * @param {Partial<Object>} updates
 * @returns {Object | null}
 */
export async function updateVocabularyEntry(word, updates) {
  await ensureVocabularyLoaded();
  const words = loadVocabulary();
  const normalizedOriginalWord = normalizeWordKey(word);
  const existing = words.find((item) => normalizeWordKey(item.word) === normalizedOriginalWord);
  if (!existing) {
    return null;
  }

  const updated = normalizeVocabularyEntry({ ...existing, ...updates });
  if (!updated.word) {
    throw new Error('Từ không được để trống.');
  }

  await writeWordDocument(updated);
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
