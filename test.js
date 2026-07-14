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

function buildWordGroupItems(wordEntry) {
  const baseWord = wordEntry?.word ? String(wordEntry.word).trim() : '';
  if (!baseWord) {
    return [];
  }

  const synonyms = Array.isArray(wordEntry?.synonyms) ? wordEntry.synonyms : [];
  const antonyms = Array.isArray(wordEntry?.antonyms) ? wordEntry.antonyms : [];
  const supportWords = [...synonyms, ...antonyms]
    .filter((item) => typeof item === 'string' && item.trim())
    .map((item) => item.trim());

  const uniqueWords = [baseWord, ...supportWords.filter((item) => item.toLowerCase() !== baseWord.toLowerCase())];
  return uniqueWords.map((item, index) => ({
    word: item,
    groupWord: baseWord,
    groupSize: uniqueWords.length,
    groupPosition: index + 1,
  }));
}

/**
 * Build a test queue that progresses through word groups in order.
 * Each word group includes the main word plus its suggested support words.
 * @param {Array<Object>} words
 * @returns {Array<Object>}
 */
export function buildTestQueue(words) {
  const groupedEntries = [];

  words.forEach((wordEntry, wordIndex) => {
    const groupItems = buildWordGroupItems(wordEntry);
    if (!groupItems.length) {
      groupedEntries.push({ ...wordEntry, groupWord: wordEntry.word, groupKey: wordEntry.word, groupSize: 1, groupPosition: 1, groupIndex: wordIndex });
      return;
    }

    groupItems.forEach((item, itemIndex) => {
      groupedEntries.push({
        ...wordEntry,
        ...item,
        word: item.word,
        groupWord: wordEntry.word,
        groupKey: wordEntry.word,
        groupIndex: wordIndex,
        groupSize: groupItems.length,
        groupPosition: itemIndex + 1,
      });
    });
  });

  return groupedEntries;
}

/**
 * Compare user answer with the expected word.
 * Normalizes: trim + lowercase + whitespace normalization
 * @param {string} answer
 * @param {Object} wordEntry
 * @returns {boolean}
 */
export function isTestAnswerCorrect(answer, wordEntry) {
  // Normalize both answer and expected word
  const normalizedAnswer = String(answer || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  
  const normalizedExpected = String(wordEntry?.word || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  
  return normalizedAnswer === normalizedExpected;
}
