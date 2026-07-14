export const SPEECH_STATES = Object.freeze({
  IDLE: 'idle',
  PLAYING_AUDIO: 'playing-audio',
  RECORDING: 'recording',
  PROCESSING: 'processing',
  RESULT: 'result',
});

export function createSpeechStateMachine() {
  let state = SPEECH_STATES.IDLE;
  let activeRecognition = null;
  let pendingTransition = null;
  let logs = [];

  function log(event, detail = {}) {
    logs.push({ event, state, detail });
  }

  function setState(nextState, detail = {}) {
    if (state === nextState) {
      log('state-stay', { ...detail, nextState });
      return state;
    }

    const previousState = state;
    state = nextState;
    log('state-transition', { ...detail, from: previousState, to: nextState });
    return state;
  }

  function beginPlayback() {
    if (state !== SPEECH_STATES.IDLE) {
      return { allowed: false, reason: 'busy' };
    }

    setState(SPEECH_STATES.PLAYING_AUDIO, { action: 'beginPlayback' });
    return { allowed: true, reason: null };
  }

  function endPlayback() {
    if (state === SPEECH_STATES.PLAYING_AUDIO) {
      setState(SPEECH_STATES.IDLE, { action: 'endPlayback' });
    }
    return state;
  }

  function beginRecording() {
    if (state !== SPEECH_STATES.IDLE) {
      return { allowed: false, reason: 'busy' };
    }

    setState(SPEECH_STATES.RECORDING, { action: 'beginRecording' });
    return { allowed: true, reason: null };
  }

  function beginProcessing() {
    if (state !== SPEECH_STATES.RECORDING) {
      return { allowed: false, reason: 'busy' };
    }

    setState(SPEECH_STATES.PROCESSING, { action: 'beginProcessing' });
    return { allowed: true, reason: null };
  }

  function finishResult() {
    setState(SPEECH_STATES.RESULT, { action: 'finishResult' });
    setState(SPEECH_STATES.IDLE, { action: 'resetResult' });
    return state;
  }

  function reset() {
    setState(SPEECH_STATES.IDLE, { action: 'reset' });
    return state;
  }

  function setActiveRecognition(recognition) {
    if (activeRecognition && activeRecognition !== recognition) {
      activeRecognition.abort();
    }

    activeRecognition = recognition;
    pendingTransition = null;
    log('recognition-set', { activeRecognition: Boolean(activeRecognition) });
    return true;
  }

  function clearActiveRecognition() {
    activeRecognition = null;
    return true;
  }

  function getActiveRecognition() {
    return activeRecognition;
  }

  function getState() {
    return state;
  }

  function getLogs() {
    return logs;
  }

  return {
    beginPlayback,
    endPlayback,
    beginRecording,
    beginProcessing,
    finishResult,
    reset,
    setActiveRecognition,
    clearActiveRecognition,
    getActiveRecognition,
    getState,
    getLogs,
  };
}
