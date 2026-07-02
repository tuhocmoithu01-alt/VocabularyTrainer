const DICTIONARY_API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en';

/**
 * Extract the first available phonetic transcription from API response.
 * @param {unknown} responseData
 * @returns {string}
 */
function extractIpaFromResponse(responseData) {
  if (!Array.isArray(responseData) || responseData.length === 0) {
    return '';
  }

  const entry = responseData[0];
  if (!entry || typeof entry !== 'object') {
    return '';
  }

  if (typeof entry.phonetic === 'string' && entry.phonetic.trim()) {
    return entry.phonetic.trim();
  }

  if (Array.isArray(entry.phonetics)) {
    const phoneticItem = entry.phonetics.find((item) => item && typeof item.text === 'string' && item.text.trim());
    return phoneticItem ? phoneticItem.text.trim() : '';
  }

  return '';
}

/**
 * Fetch IPA transcription for a word from dictionaryapi.dev.
 * If the API fails or the transcription is not present, returns an empty string.
 * @param {string} word
 * @returns {Promise<string>}
 */
export async function fetchWordIpa(word) {
  if (!word || typeof word !== 'string') {
    return '';
  }

  try {
    const response = await fetch(`${DICTIONARY_API_BASE}/${encodeURIComponent(word.trim())}`);
    if (!response.ok) {
      return '';
    }

    const data = await response.json();
    return extractIpaFromResponse(data);
  } catch (error) {
    console.warn('IPA fetch failed:', error);
    return '';
  }
}
