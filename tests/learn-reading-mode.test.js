import test from 'node:test';
import assert from 'node:assert/strict';
import { getSpellingProgressSteps, getSpellingSequence, normalizeLearnReadingMode } from '../learn.js';

test('normalizeLearnReadingMode defaults to normal and accepts spelling', () => {
  assert.equal(normalizeLearnReadingMode('spelling'), 'spelling');
  assert.equal(normalizeLearnReadingMode('normal'), 'normal');
  assert.equal(normalizeLearnReadingMode('unknown'), 'normal');
});

test('getSpellingSequence returns one character per letter in order', () => {
  assert.deepEqual(getSpellingSequence('hello'), ['H', 'E', 'L', 'L', 'O']);
  assert.deepEqual(getSpellingSequence('apple'), ['A', 'P', 'P', 'L', 'E']);
  assert.deepEqual(getSpellingSequence('company'), ['C', 'O', 'M', 'P', 'A', 'N', 'Y']);
});

test('getSpellingProgressSteps returns progressive prefixes for highlight animation', () => {
  assert.deepEqual(getSpellingProgressSteps('hello'), ['H', 'HE', 'HEL', 'HELL', 'HELLO']);
  assert.deepEqual(getSpellingProgressSteps('company'), ['C', 'CO', 'COM', 'COMP', 'COMPA', 'COMPAN', 'COMPANY']);
});
