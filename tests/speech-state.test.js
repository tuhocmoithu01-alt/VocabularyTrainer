import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeechStateMachine, SPEECH_STATES } from '../speech-state.js';

test('speech state machine serializes playback and recording without overlap', () => {
  const stateMachine = createSpeechStateMachine();

  assert.equal(stateMachine.getState(), SPEECH_STATES.IDLE);
  assert.equal(stateMachine.beginPlayback().allowed, true);
  assert.equal(stateMachine.getState(), SPEECH_STATES.PLAYING_AUDIO);

  const recordingAttempt = stateMachine.beginRecording();
  assert.equal(recordingAttempt.allowed, false);
  assert.equal(recordingAttempt.reason, 'busy');

  stateMachine.endPlayback();
  const queuedRecording = stateMachine.beginRecording();
  assert.equal(queuedRecording.allowed, true);
  assert.equal(stateMachine.getState(), SPEECH_STATES.RECORDING);
});

test('speech state machine prevents duplicate recognition sessions', () => {
  const stateMachine = createSpeechStateMachine();
  const first = { abort() { this.aborted = true; } };
  const second = { abort() { this.aborted = true; } };

  stateMachine.setActiveRecognition(first);
  const start = stateMachine.beginRecording();
  assert.equal(start.allowed, true);
  assert.equal(stateMachine.getActiveRecognition(), first);

  const replaced = stateMachine.setActiveRecognition(second);
  assert.equal(replaced, true);
  assert.equal(first.aborted, true);
  assert.equal(stateMachine.getActiveRecognition(), second);
});
