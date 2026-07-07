/**
 * Shuffle an array using Fisher-Yates algorithm.
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
 * Build learn session queue with a target number of steps.
 * @param {Array<Object>} words
 * @param {number} targetCount
 * @returns {Array<Object>}
 */
export function buildLearnQueue(words, targetCount) {
  if (!words.length) {
    return [];
  }

  const pool = shuffle(words);
  const queue = [];
  let index = 0;

  while (queue.length < targetCount) {
    queue.push(pool[index]);
    index += 1;
    if (index >= pool.length) {
      index = 0;
    }
  }

  return shuffle(queue);
}

/**
 * Evaluate the typed answer against the current word.
 * @param {string} answer
 * @param {Object} wordEntry
 * @returns {boolean}
 */
export function isLearnAnswerCorrect(answer, wordEntry) {
  return answer.trim().toLowerCase() === wordEntry.word.toLowerCase();
}

/**
 * Toggle whether the target word is hidden.
 * @param {boolean} currentState
 * @returns {boolean}
 */
export function toggleWordVisibility(currentState) {
  return !currentState;
}

/**
 * Build a plain label for a learn queue item.
 * @param {Object} entry
 * @returns {string}
 */
export function formatLearnLabel(entry) {
  return `${entry.word} — ${entry.meaning}`;
}

/**
 * Normalize the learn reading mode value.
 * @param {string} mode
 * @returns {string}
 */
export function normalizeLearnReadingMode(mode) {
  return mode === 'spelling' ? 'spelling' : 'normal';
}

/**
 * Split a word into individual letters for spelling mode.
 * @param {string} word
 * @returns {Array<string>}
 */
export function getSpellingSequence(word) {
  return String(word || '')
    .split('')
    .filter((character) => /[A-Za-z]/.test(character))
    .map((character) => character.toUpperCase());
}

/**
 * Build the progressive letter prefixes used for spelling highlighting.
 * @param {string} word
 * @returns {Array<string>}
 */
export function getSpellingProgressSteps(word) {
  const letters = getSpellingSequence(word);
  return letters.map((_, index) => letters.slice(0, index + 1).join(''));
}
