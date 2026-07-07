import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSpeakingMode,
  getSpeakingPromptText,
  getSpeakingInstruction,
  getSpeakingPromptLabel,
  normalizeDictationMode,
  getDictationPromptText,
  getDictationInstruction,
  getDictationPromptLabel,
} from '../speaking-mode.js';

test('normalizeSpeakingMode defaults to vocabulary', () => {
  assert.equal(normalizeSpeakingMode('example'), 'example');
  assert.equal(normalizeSpeakingMode('vocabulary'), 'vocabulary');
  assert.equal(normalizeSpeakingMode('unknown'), 'vocabulary');
});

test('speaking mode helpers return the correct prompt and instruction', () => {
  const entry = { word: 'product', example: 'Will the company launch a new product next summer?' };

  assert.equal(getSpeakingPromptText('vocabulary', entry), 'product');
  assert.equal(getSpeakingPromptText('example', entry), 'Will the company launch a new product next summer?');
  assert.equal(getSpeakingInstruction('vocabulary'), 'Nghe từ rồi đọc lại đúng từ đó.');
  assert.equal(getSpeakingInstruction('example'), 'Nghe câu ví dụ rồi đọc lại toàn bộ câu.');
  assert.equal(getSpeakingPromptLabel('vocabulary'), 'Word');
  assert.equal(getSpeakingPromptLabel('example'), 'Example');
});

test('dictation mode helpers default to word and return the correct prompt', () => {
  const entry = { word: 'product', example: 'Will the company launch a new product next summer?' };

  assert.equal(normalizeDictationMode('example'), 'example');
  assert.equal(normalizeDictationMode('word'), 'word');
  assert.equal(normalizeDictationMode('unknown'), 'word');
  assert.equal(getDictationPromptText('word', entry), 'product');
  assert.equal(getDictationPromptText('example', entry), 'Will the company launch a new product next summer?');
  assert.equal(getDictationInstruction('word'), 'Nghe từ rồi nhập lại đúng từ đó.');
  assert.equal(getDictationInstruction('example'), 'Nghe câu ví dụ rồi nhập lại nguyên câu.');
  assert.equal(getDictationPromptLabel('word'), 'Word');
  assert.equal(getDictationPromptLabel('example'), 'Example');
});
