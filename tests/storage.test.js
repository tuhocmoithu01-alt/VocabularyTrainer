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

test('language manager switches collections by language and exposes options', () => {
  setCurrentLanguage('english');
  assert.equal(getCurrentLanguage(), 'english');
  assert.equal(getVocabularyCollection('english'), 'words');
  assert.equal(getSettingsCollection('english'), 'preferences');
  assert.equal(getVocabularyCollection('japanese'), 'words_japanese');
  assert.equal(getSettingsCollection('japanese'), 'preferences_japanese');
  assert.ok(getLanguageOptions().some((language) => language.code === 'english'));
});
