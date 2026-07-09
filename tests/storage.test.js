import test from 'node:test';
import assert from 'node:assert/strict';
import { createVocabularyEntry, DEFAULT_TYPE, loadSubTopics, saveSubTopics } from '../storage.js';

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
