import test from 'node:test';
import assert from 'node:assert/strict';
import { getSpeechLanguageCode, selectBestVoice } from '../speech.js';

test('getSpeechLanguageCode prefers the correct locale for Japanese', () => {
  assert.equal(getSpeechLanguageCode('japanese'), 'ja-JP');
});

test('getSpeechLanguageCode prefers the correct locale for English', () => {
  assert.equal(getSpeechLanguageCode('english'), 'en-US');
});

test('selectBestVoice falls back to the closest matching voice for the selected language', () => {
  const voices = [
    { name: 'Microsoft Zira', lang: 'en-GB' },
    { name: 'Google Japanese', lang: 'ja-JP' },
    { name: 'Google US English', lang: 'en-US' },
  ];

  assert.equal(selectBestVoice(voices, 'japanese').name, 'Google Japanese');
  assert.equal(selectBestVoice(voices, 'english').name, 'Google US English');
});
