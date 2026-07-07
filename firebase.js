const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyB4jT4jU8I9zW4J3A0nQ0Y4I0r1m7k6pG0',
  authDomain: 'englishvocabularyi.firebaseapp.com',
  projectId: 'englishvocabularyi',
  storageBucket: 'englishvocabularyi.appspot.com',
  messagingSenderId: '549898231806',
  appId: '1:549898231806:web:8d4a7cb7b07d410a3b2e9f',
};

let firestoreDb = null;
let firebaseModules = null;

function getRuntimeConfig() {
  if (typeof window !== 'undefined' && window.__FIREBASE_CONFIG__) {
    return window.__FIREBASE_CONFIG__;
  }

  return FIREBASE_CONFIG;
}

export async function initializeFirebase() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  if (firestoreDb) {
    return firestoreDb;
  }

  try {
    if (!firebaseModules) {
      firebaseModules = await Promise.all([
        import('https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js'),
      ]);
    }

    const [{ initializeApp }, { getFirestore }] = firebaseModules;
    const config = getRuntimeConfig();
    const app = initializeApp(config);
    firestoreDb = getFirestore(app);
    return firestoreDb;
  } catch (error) {
    console.error('Firebase initialization failed', error);
    return null;
  }
}

export async function getDb() {
  if (firestoreDb) {
    return firestoreDb;
  }

  return initializeFirebase();
}

export const db = null;