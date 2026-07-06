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
 * Suggest matching words from the saved vocabulary list.
 * @param {Array<Object>} words
 * @param {string} query
 * @param {number} limit
 * @returns {Array<Object>}
 */
export function filterWordSuggestions(words, query, limit = 10) {
  const normalizedQuery = (query || '').trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  const matches = words.filter((entry) => typeof entry?.word === 'string' && entry.word.trim().toLowerCase().includes(normalizedQuery));
  const prefixMatches = matches.filter((entry) => entry.word.trim().toLowerCase().startsWith(normalizedQuery));
  const otherMatches = matches.filter((entry) => !entry.word.trim().toLowerCase().startsWith(normalizedQuery));

  return [...prefixMatches, ...otherMatches]
    .map((entry) => ({ ...entry, word: entry.word.trim() }))
    .slice(0, limit);
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
