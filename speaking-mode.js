const DEFAULT_SPEAKING_MODE = 'vocabulary';
const DEFAULT_DICTATION_MODE = 'word';

export function normalizeSpeakingMode(mode) {
  return mode === 'example' ? 'example' : DEFAULT_SPEAKING_MODE;
}

export function normalizeDictationMode(mode) {
  return mode === 'example' ? 'example' : DEFAULT_DICTATION_MODE;
}

export function getSpeakingPromptText(mode, entry) {
  if (!entry) {
    return '';
  }

  return normalizeSpeakingMode(mode) === 'example' ? entry.example : entry.word;
}

export function getSpeakingInstruction(mode) {
  return normalizeSpeakingMode(mode) === 'example'
    ? 'Nghe câu ví dụ rồi đọc lại toàn bộ câu.'
    : 'Nghe từ rồi đọc lại đúng từ đó.';
}

export function getSpeakingPromptLabel(mode) {
  return normalizeSpeakingMode(mode) === 'example' ? 'Example' : 'Word';
}

export function getDictationPromptText(mode, entry) {
  if (!entry) {
    return '';
  }

  return normalizeDictationMode(mode) === 'example' ? entry.example : entry.word;
}

export function getDictationInstruction(mode) {
  return normalizeDictationMode(mode) === 'example'
    ? 'Nghe câu ví dụ rồi nhập lại nguyên câu.'
    : 'Nghe từ rồi nhập lại đúng từ đó.';
}

export function getDictationPromptLabel(mode) {
  return normalizeDictationMode(mode) === 'example' ? 'Example' : 'Word';
}
