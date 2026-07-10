import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMeaningMap, getDisplayConfig, getMeaningDisplayValue, getMeaningLanguageOptions, getMeaningValue, normalizeMeaningLanguageCode, normalizeMeaningMap } from '../language-config.js';

test('meaning language defaults to Vietnamese and normalizes supported values', () => {
  assert.equal(normalizeMeaningLanguageCode('vietnamese'), 'vietnamese');
  assert.equal(normalizeMeaningLanguageCode('english'), 'english');
  assert.equal(getMeaningLanguageOptions().length, 3);
});

test('display config uses learning language for term and pronunciation labels', () => {
  const config = getDisplayConfig('japanese', 'vietnamese');
  assert.equal(config.termLabel, 'Từ tiếng Nhật');
  assert.equal(config.pronunciationLabel, 'Kana');
  assert.equal(config.exampleLabel, 'Ví dụ tiếng Nhật');
  assert.equal(config.meaningLabel, 'Nghĩa');
});

test('display config switches meaning label without changing the learning-language labels', () => {
  const config = getDisplayConfig('english', 'english');
  assert.equal(config.termLabel, 'Word');
  assert.equal(config.pronunciationLabel, 'IPA');
  assert.equal(config.meaningLabel, 'Meaning');
});

test('legacy meaning strings are converted into the new meanings map', () => {
  assert.deepEqual(normalizeMeaningMap('ăn'), { vietnamese: 'ăn' });
});

test('meaning values resolve per meaning language and show a fallback message when missing', () => {
  const entry = { meanings: { vietnamese: 'ăn', english: 'to eat' } };
  assert.equal(getMeaningValue(entry, 'english'), 'to eat');
  assert.equal(getMeaningDisplayValue({ meanings: { english: 'to eat' } }, 'vietnamese'), 'Chưa có nghĩa tiếng Việt.');
});

test('buildMeaningMap preserves existing translations and updates the selected language', () => {
  const meanings = buildMeaningMap({ vietnamese: 'ăn', english: 'to eat' }, 'english', 'to eat more');
  assert.equal(meanings.vietnamese, 'ăn');
  assert.equal(meanings.english, 'to eat more');
});
