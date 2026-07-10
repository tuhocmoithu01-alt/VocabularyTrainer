import { getDb } from './firebase.js';
import { getCurrentLanguage, normalizeLanguageCode } from './language-manager.js';

const FIRESTORE_COLLECTIONS = {
  english: {
    vocabulary: 'words',
    topics: 'preferences',
    settings: 'preferences',
  },
  japanese: {
    vocabulary: 'words_japanese',
    topics: 'preferences_japanese',
    settings: 'preferences_japanese',
  },
  chinese: {
    vocabulary: 'words_chinese',
    topics: 'preferences_chinese',
    settings: 'preferences_chinese',
  },
};

function getCollectionConfig(language = getCurrentLanguage()) {
  const normalizedLanguage = normalizeLanguageCode(language);
  return FIRESTORE_COLLECTIONS[normalizedLanguage] || FIRESTORE_COLLECTIONS.english;
}

export function getVocabularyCollection(language = getCurrentLanguage()) {
  return getCollectionConfig(language).vocabulary;
}

export function getTopicCollection(language = getCurrentLanguage()) {
  return getCollectionConfig(language).topics;
}

export function getCategoryCollection(language = getCurrentLanguage()) {
  return getCollectionConfig(language).topics;
}

export function getSettingsCollection(language = getCurrentLanguage()) {
  return getCollectionConfig(language).settings;
}

export async function getFirestoreHelpers(language = getCurrentLanguage()) {
  const [{ collection, deleteDoc, doc, getDocs, onSnapshot, setDoc }] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js'),
  ]);
  const db = await getDb();
  return { collection, deleteDoc, doc, getDocs, onSnapshot, setDoc, db, language: normalizeLanguageCode(language) };
}

export async function getCollectionRef(collectionName, language = getCurrentLanguage()) {
  const { db, collection } = await getFirestoreHelpers(language);
  return collection(db, collectionName);
}
