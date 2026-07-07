import test from 'node:test';
import assert from 'node:assert/strict';
import { playAudioFeedback } from '../sound.js';

test('playAudioFeedback skips playback when sound is disabled', async () => {
  let playCount = 0;
  const audio = {
    currentTime: 0,
    play: async () => {
      playCount += 1;
    },
  };

  await playAudioFeedback(audio, false);

  assert.equal(playCount, 0);
});

test('playAudioFeedback resets audio and surfaces playback errors', async () => {
  let errorMessage = '';
  const audio = {
    currentTime: 0,
    play: async () => {
      throw new Error('play failed');
    },
  };

  await playAudioFeedback(audio, true, (error) => {
    errorMessage = error.message;
  });

  assert.equal(audio.currentTime, 0);
  assert.equal(errorMessage, 'play failed');
});
