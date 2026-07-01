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
