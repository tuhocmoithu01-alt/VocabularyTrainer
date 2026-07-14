import test from 'node:test';
import assert from 'node:assert/strict';
import { createVocabularyEntry, DEFAULT_TYPE, loadSubTopics, saveSubTopics } from '../storage.js';
import { getCurrentLanguage, getLanguageOptions, setCurrentLanguage } from '../language-manager.js';
import { getVocabularyCollection, getSettingsCollection } from '../data-access.js';

test('loadSubTopics returns newly saved subtopics for the selected topic', async () => {
  await saveSubTopics(['meeting'], 'Work');

  const subTopics = loadSubTopics('Work');

  assert.deepEqual(subTopics, ['meeting']);
});

test('createVocabularyEntry defaults the type to Word when none provided', () => {
  const entry = createVocabularyEntry('learn', 'to study', 'I like to learn.', '/lɜːn/', 'Education', 'School');

  assert.equal(entry.type, DEFAULT_TYPE);
  assert.equal(entry.word, 'learn');
  assert.equal(entry.topic, 'Education');
});

test('createVocabularyEntry preserves support data as object arrays', () => {
  const entry = createVocabularyEntry('problem', 'vấn đề', 'This is a problem.', '/ˈprɑːbləm/', 'Education', 'School', 'Word', {}, ['issue', 'difficulty'], ['solution', 'answer'], 'something difficult that needs to be solved');

  assert.deepEqual(entry.synonyms, [{ word: 'issue', meaning: '' }, { word: 'difficulty', meaning: '' }]);
  assert.deepEqual(entry.antonyms, [{ word: 'solution', meaning: '' }, { word: 'answer', meaning: '' }]);
});

test('createVocabularyEntry preserves word family and fixed phrases as object arrays', () => {
  const entry = createVocabularyEntry(
    'explanation',
    'lời giải thích',
    'This is an explanation.',
    '/ˌɛk.spləˈneɪ.ʃən/',
    'Education',
    'School',
    'Word',
    {},
    ['synonym'],
    ['antonym'],
    'a statement that makes something clear',
    [],
    {},
    {},
    {},
    { basic: 'This is an explanation.' },
    [{ word: 'explanatory', meaning: 'mang tính giải thích', type: 'Tính từ' }],
    [{ word: 'give an explanation', meaning: 'đưa ra lời giải thích' }],
  );

  assert.deepEqual(entry.wordFamily, [{ word: 'explanatory', meaning: 'mang tính giải thích', type: 'Tính từ' }]);
  assert.deepEqual(entry.fixedPhrases, [{ word: 'give an explanation', meaning: 'đưa ra lời giải thích' }]);
});

test('createVocabularyEntry normalizes the compact Examples structure', () => {
  const entry = createVocabularyEntry(
    'schedule',
    'sắp xếp lịch',
    'This is a basic example.',
    '/ˈʃedjuːl/',
    'Education',
    'School',
    'Word',
    {},
    ['arrange', 'plan'],
    ['cancel', 'delay'],
    'to arrange something for a specific time',
    'Business Meeting',
    '',
    [],
    {},
    { basic: 'Please schedule the meeting.', conversation: 'Can we schedule a call?', lessonContext: 'We will schedule the meeting tomorrow.' },
  );

  assert.deepEqual(entry.examples, {
    basic: 'Please schedule the meeting.',
    conversation: 'Can we schedule a call?',
    lessonContext: 'We will schedule the meeting tomorrow.',
  });
  assert.equal(entry.example, 'Please schedule the meeting.');
});

import { toFirestorePayload } from '../storage.js';

test('toFirestorePayload preserves the canonical example and drops legacy example fields', () => {
  const entry = createVocabularyEntry(
    'test',
    'kiểm tra',
    'One example sentence.',
    '/tɛst/',
    'Education',
    'School',
    'Word',
    {},
    ['trial'],
    ['ignore'],
    'a procedure for evaluation',
    [],
    { basic: 'One example sentence.' },
  );

  const payload = toFirestorePayload(entry);

  assert.equal(payload.example, 'One example sentence.');
  assert.deepEqual(payload.examples, { basic: 'One example sentence.' });
});

test('language manager switches collections by language and exposes options', () => {
  setCurrentLanguage('english');
  assert.equal(getCurrentLanguage(), 'english');
  assert.equal(getVocabularyCollection('english'), 'words');
  assert.equal(getSettingsCollection('english'), 'preferences');
  assert.equal(getVocabularyCollection('japanese'), 'words_japanese');
  assert.equal(getSettingsCollection('japanese'), 'preferences_japanese');
  assert.ok(getLanguageOptions().some((language) => language.code === 'english'));
});
