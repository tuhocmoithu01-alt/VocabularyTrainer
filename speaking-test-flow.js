export function createSpeakingTestFlowState() {
  const failureAttempts = new Map();
  const skippedQuestions = new Set();
  const completedQuestions = new Set();
  let currentQuestionKey = null;

  function beginQuestion(questionKey) {
    currentQuestionKey = questionKey;
    return currentQuestionKey;
  }

  function getFailureAttempt(questionKey = currentQuestionKey) {
    return failureAttempts.get(questionKey) || 0;
  }

  function handleSuccess(questionKey = currentQuestionKey) {
    failureAttempts.set(questionKey, 0);
    completedQuestions.add(questionKey);
    return { success: true };
  }

  function handleFailure(questionKey = currentQuestionKey) {
    const nextAttempt = (failureAttempts.get(questionKey) || 0) + 1;
    failureAttempts.set(questionKey, nextAttempt);

    if (nextAttempt === 1) {
      return {
        attempt: 1,
        maxAttempts: 3,
        message: 'Không nhận diện được. Vui lòng thử lại.',
        showRetryOptions: false,
      };
    }

    if (nextAttempt === 2) {
      return {
        attempt: 2,
        maxAttempts: 3,
        message: 'Vẫn chưa nhận diện được. Hãy thử nói rõ hơn.',
        showRetryOptions: false,
      };
    }

    return {
      attempt: 3,
      maxAttempts: 3,
      message: 'Bạn đã thử 3 lần nhưng hệ thống vẫn chưa nhận diện được.',
      showRetryOptions: true,
    };
  }

  function handleRetry(questionKey = currentQuestionKey) {
    failureAttempts.set(questionKey, 0);
    return { success: true };
  }

  function skipCurrentQuestion(questionKey = currentQuestionKey) {
    if (!questionKey) {
      return { success: false };
    }

    failureAttempts.set(questionKey, 0);
    skippedQuestions.add(questionKey);
    completedQuestions.add(questionKey);
    currentQuestionKey = null;
    return { success: true, skipped: true };
  }

  function getSkippedCount() {
    return skippedQuestions.size;
  }

  function getSummaryStats() {
    return {
      skipped: skippedQuestions.size,
      completed: completedQuestions.size,
    };
  }

  return {
    beginQuestion,
    getFailureAttempt,
    handleSuccess,
    handleFailure,
    handleRetry,
    skipCurrentQuestion,
    getSkippedCount,
    getSummaryStats,
  };
}
