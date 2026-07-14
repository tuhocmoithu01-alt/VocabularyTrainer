import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTestQueue, filterWordSuggestions } from '../test.js';
import { fetchWordSupportData, normalizeSupportTextValue } from '../dictionary.js';

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

test('buildTestQueue keeps the word-group order intact', () => {
  const words = [
    { word: 'problem', synonyms: ['issue', 'difficulty', 'trouble'], antonyms: ['solution', 'answer'] },
    { word: 'create', synonyms: ['make'], antonyms: ['destroy'] },
  ];

  const queue = buildTestQueue(words);

  assert.deepEqual(queue.map((entry) => entry.word), ['problem', 'issue', 'difficulty', 'trouble', 'solution', 'answer', 'create', 'make', 'destroy']);
});

test('fetchWordSupportData uses lesson context to generate lesson-specific examples', async () => {
  const suggestion = await fetchWordSupportData('schedule', {
    language: 'english',
    lesson: 'Business Meeting',
    topic: 'Meeting Management',
    subTopic: 'Scheduling',
    subTopicDescription: 'How to arrange meetings and appointments',
    meaning: 'to arrange something for a specific time',
  });

  assert.ok(suggestion.collocations.some((item) => item.includes('meeting')));
  assert.ok(suggestion.lessonExample.includes('meeting'));
  assert.ok(suggestion.conversationExample.includes('schedule'));
});

test('fetchWordSupportData fills a complete support payload from topic and meaning context', async () => {
  const suggestion = await fetchWordSupportData('deadline', {
    language: 'english',
    topic: 'Lesson 22 : Business Meeting',
    subTopic: 'Scheduling',
    meaning: 'the latest time something must happen',
  });

  assert.ok(suggestion.meaning);
  assert.ok(suggestion.definition);
  assert.ok(suggestion.synonyms.length > 0);
  assert.ok(suggestion.antonyms.length > 0);
  assert.ok(suggestion.collocations.length > 0);
  assert.ok(suggestion.examples?.basic || suggestion.basicExample);
  assert.ok(suggestion.examples?.conversation || suggestion.conversationExample);
  assert.ok(suggestion.examples?.lessonContext || suggestion.lessonExample);
});

test('fetchWordSupportData keeps the meaning in Vietnamese and the other fields in English', async () => {
  const suggestion = await fetchWordSupportData('problem', {
    language: 'english',
    topic: 'Business Meeting',
    subTopic: 'Meetings',
    meaning: 'vấn đề',
  });

  assert.ok(suggestion.meaning);
  assert.equal(suggestion.definition, 'something difficult that needs to be solved');
  assert.ok(suggestion.synonyms.every((item) => /^[a-zA-Z\s-]+$/.test(item)));
  assert.ok(suggestion.antonyms.every((item) => /^[a-zA-Z\s-]+$/.test(item)));
  assert.ok(!suggestion.antonyms.some((item) => item.startsWith('not ')));
  assert.ok(suggestion.collocations.some((item) => item.includes('problem')));
  assert.ok(suggestion.examples?.basic && suggestion.examples?.conversation && suggestion.examples?.lessonContext);
  assert.notEqual(suggestion.examples?.basic, suggestion.examples?.conversation);
  assert.notEqual(suggestion.examples?.conversation, suggestion.examples?.lessonContext);
});

test('normalizeSupportTextValue converts escaped line breaks into real newline characters', () => {
  assert.equal(normalizeSupportTextValue('Line 1\\nLine 2\\nLine 3'), 'Line 1\nLine 2\nLine 3');
});
