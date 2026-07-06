import test from 'node:test';
import assert from 'node:assert/strict';
import { filterWordSuggestions } from '../test.js';

test('filterWordSuggestions returns case-insensitive matches and limits results', () => {
  const words = [
    { word: 'solution' },
    { word: 'solve' },
    { word: 'software' },
    { word: 'society' },
    { word: 'social' },
    { word: 'soda' },
  ];

  const result = filterWordSuggestions(words, 'SO', 4);

  assert.deepEqual(result.map((item) => item.word), ['solution', 'solve', 'software', 'society']);
});

test('filterWordSuggestions returns empty list when no matches exist', () => {
  const words = [{ word: 'solution' }, { word: 'solve' }];
  assert.deepEqual(filterWordSuggestions(words, 'xyz'), []);
});
