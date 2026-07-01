/**
 * Shuffle an array with Fisher-Yates.
 * @param {Array} items
 * @returns {Array}
 */
function shuffle(items) {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Build a randomized test queue from all words.
 * @param {Array<Object>} words
 * @returns {Array<Object>}
 */
export function buildTestQueue(words) {
  return shuffle(words);
}

/**
 * Compare user answer with the expected word.
 * @param {string} answer
 * @param {Object} wordEntry
 * @returns {boolean}
 */
export function isTestAnswerCorrect(answer, wordEntry) {
  return answer.trim().toLowerCase() === wordEntry.word.toLowerCase();
}
