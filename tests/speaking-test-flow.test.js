import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeakingTestFlowState } from '../speaking-test-flow.js';

test('speaking test flow tracks failed recognitions and shows retry options on the third failure', () => {
  const flow = createSpeakingTestFlowState();
  const questionKey = 'word-1';

  flow.beginQuestion(questionKey);
  assert.deepEqual(flow.handleFailure(questionKey), {
    attempt: 1,
    maxAttempts: 3,
    message: 'Không nhận diện được. Vui lòng thử lại.',
    showRetryOptions: false,
  });

  assert.deepEqual(flow.handleFailure(questionKey), {
    attempt: 2,
    maxAttempts: 3,
    message: 'Vẫn chưa nhận diện được. Hãy thử nói rõ hơn.',
    showRetryOptions: false,
  });

  assert.deepEqual(flow.handleFailure(questionKey), {
    attempt: 3,
    maxAttempts: 3,
    message: 'Bạn đã thử 3 lần nhưng hệ thống vẫn chưa nhận diện được.',
    showRetryOptions: true,
  });
});

test('speaking test flow resets counters after success or skip and records skipped questions', () => {
  const flow = createSpeakingTestFlowState();
  const questionKey = 'word-2';

  flow.beginQuestion(questionKey);
  flow.handleFailure(questionKey);
  flow.handleFailure(questionKey);
  flow.handleSuccess(questionKey);
  assert.equal(flow.getFailureAttempt(questionKey), 0);

  flow.beginQuestion(questionKey);
  flow.handleFailure(questionKey);
  flow.handleFailure(questionKey);
  flow.handleFailure(questionKey);
  flow.skipCurrentQuestion(questionKey);

  assert.equal(flow.getFailureAttempt(questionKey), 0);
  assert.equal(flow.getSkippedCount(), 1);
  assert.equal(flow.getSummaryStats().skipped, 1);
});

test('retry resets the failure counter for the current question', () => {
  const flow = createSpeakingTestFlowState();
  const questionKey = 'word-3';

  flow.beginQuestion(questionKey);
  flow.handleFailure(questionKey);
  flow.handleFailure(questionKey);
  flow.handleFailure(questionKey);
  flow.handleRetry(questionKey);

  assert.equal(flow.getFailureAttempt(questionKey), 0);
  assert.deepEqual(flow.handleFailure(questionKey), {
    attempt: 1,
    maxAttempts: 3,
    message: 'Không nhận diện được. Vui lòng thử lại.',
    showRetryOptions: false,
  });
});
