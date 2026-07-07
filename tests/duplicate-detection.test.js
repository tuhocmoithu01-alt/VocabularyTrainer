import test from 'node:test';
import assert from 'node:assert/strict';
import { findDuplicateVocabularyEntry, normalizeWordKey } from '../storage.js';

test('normalizeWordKey trims and lowercases input', () => {
  assert.equal(normalizeWordKey(' ACHIEVE '), 'achieve');
  assert.equal(normalizeWordKey('Achieve'), 'achieve');
});

test('findDuplicateVocabularyEntry ignores casing and whitespace and skips the current word', () => {
  const entries = [
    { word: 'Achieve', topic: 'Lesson 20', subTopic: 'Growing an international company', meaning: 'đạt được', example: 'we would like to achieve our sales goal before december', ipa: '/əˈtʃiːv/' },
    { word: 'Build', topic: 'General', subTopic: 'Default', meaning: 'xây dựng', example: 'We build products', ipa: '/bɪld/' },
  ];

  assert.deepEqual(findDuplicateVocabularyEntry(entries, ' achieve '), entries[0]);
  assert.equal(findDuplicateVocabularyEntry(entries, ' build ', 'Build'), null);
  assert.equal(findDuplicateVocabularyEntry(entries, ' unknown '), null);
});
