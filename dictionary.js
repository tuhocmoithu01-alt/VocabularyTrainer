const DICTIONARY_API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en';

const STATIC_SUPPORT_DATA = {
  problem: {
    meaning: 'vấn đề',
    definition: 'something difficult that needs to be solved',
    synonyms: ['issue', 'difficulty', 'trouble'],
    antonyms: ['solution', 'answer'],
    collocations: ['have a problem', 'solve a problem'],
    basicExample: 'There is a problem with the schedule.',
    conversationExample: 'I am having a problem with the booking system.',
    lessonExample: 'In today\'s business meeting, we need to solve this problem before the client arrives.',
  },
  solution: {
    meaning: 'giải pháp',
    definition: 'a way to solve a problem',
    synonyms: ['answer', 'remedy', 'fix'],
    antonyms: ['problem', 'difficulty'],
    collocations: ['find a solution', 'offer a solution'],
    basicExample: 'We found a solution quickly.',
    conversationExample: 'Do you have a solution for this issue?',
    lessonExample: 'The team proposed a practical solution during the discussion.',
  },
  create: {
    meaning: 'tạo ra',
    definition: 'to make something new',
    synonyms: ['make', 'build', 'produce'],
    antonyms: ['destroy', 'erase'],
    collocations: ['create a plan', 'create an opportunity'],
    basicExample: 'She wants to create a new app.',
    conversationExample: 'We can create a better workflow together.',
    lessonExample: 'The manager asked the team to create a proposal for the launch.',
  },
  answer: {
    meaning: 'câu trả lời',
    definition: 'a response to a question or problem',
    synonyms: ['reply', 'response', 'solution'],
    antonyms: ['question', 'problem'],
    collocations: ['give an answer', 'find an answer'],
    basicExample: 'Please give me an answer.',
    conversationExample: 'I need an answer before we continue.',
    lessonExample: 'The speaker gave a clear answer during the Q&A session.',
  },
  schedule: {
    meaning: 'xếp lịch',
    definition: 'to arrange something for a specific time',
    synonyms: ['arrange', 'plan', 'set'],
    antonyms: ['cancel', 'delay'],
    collocations: ['schedule a meeting', 'schedule an appointment'],
    basicExample: 'Can we schedule a meeting tomorrow?',
    conversationExample: 'I will schedule the appointment for next Monday.',
    lessonExample: 'During the business meeting, we need to schedule the conference for Thursday.',
  },
  deadline: {
    meaning: 'hạn chót',
    definition: 'the latest time something must happen',
    synonyms: ['due date', 'time limit', 'cutoff'],
    antonyms: ['extension', 'leniency'],
    collocations: ['meet the deadline', 'miss the deadline', 'set a deadline'],
    basicExample: 'The deadline for the project is Friday.',
    conversationExample: 'We need to meet the deadline before the client arrives.',
    lessonExample: 'The team discussed how to manage the deadline during the meeting.',
  },
  meeting: {
    meaning: 'cuộc họp',
    definition: 'a planned gathering of people for discussion or decision-making',
    synonyms: ['conference', 'session', 'discussion'],
    antonyms: ['break', 'separation'],
    collocations: ['hold a meeting', 'attend a meeting', 'schedule a meeting'],
    basicExample: 'We have a meeting at 10 a.m.',
    conversationExample: 'Can we move the meeting to tomorrow?',
    lessonExample: 'The client joined the meeting to discuss the proposal.',
  },
};

function normalizeStringArray(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value.split(/\n|,|;/).map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

export function normalizeSupportTextValue(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

function selectFirstSentence(value) {
  const normalized = normalizeSupportTextValue(value);
  if (!normalized) {
    return '';
  }

  const sentenceMatch = normalized.match(/^[^.!?]+[.!?]?/);
  if (!sentenceMatch) {
    return normalized;
  }

  return sentenceMatch[0].trim();
}

function cleanContextLabel(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const text = value.trim();
  if (!text) {
    return '';
  }

  const cleaned = text.replace(/lesson\s*\d+\s*[:\-]?\s*/i, '').replace(/unit\s*\d+\s*[:\-]?\s*/i, '').trim();
  return cleaned || text;
}

const VIETNAMESE_SUPPORT_MEANINGS = {
  record: 'hồ sơ',
  profile: 'hồ sơ cá nhân',
  'customer account': 'tài khoản khách hàng',
  issue: 'vấn đề',
  difficulty: 'khó khăn',
  trouble: 'rắc rối',
  solution: 'giải pháp',
  answer: 'câu trả lời',
  arrange: 'sắp xếp',
  plan: 'kế hoạch',
  set: 'đặt',
  cancel: 'hủy',
  delay: 'hoãn',
  'due date': 'hạn chót',
  'time limit': 'thời hạn',
  cutoff: 'hạn',
  extension: 'gia hạn',
  leniency: 'khoan dung',
  conference: 'hội nghị',
  session: 'phiên họp',
  discussion: 'thảo luận',
  break: 'nghỉ ngơi',
  separation: 'chia cách',
  create: 'tạo',
  build: 'xây dựng',
  produce: 'sản xuất',
  destroy: 'phá hủy',
  erase: 'xóa',
  reply: 'phản hồi',
  response: 'phản ứng',
  question: 'câu hỏi',
  problem: 'vấn đề',
  schedule: 'lịch trình',
  meeting: 'cuộc họp',
  appointment: 'cuộc hẹn',
  achieve: 'đạt được',
  inform: 'thông báo',
  successful: 'thành công',
  account: 'tài khoản',
};

function normalizeSupportObjectItem(item) {
  if (!item && item !== 0) {
    return null;
  }

  if (typeof item === 'string') {
    const rawValue = String(item || '').trim();
    if (!rawValue) {
      return null;
    }

    const [wordPart, meaningPart] = rawValue.split(':').map((part) => part.trim());
    return {
      word: wordPart,
      meaning: meaningPart || '',
    };
  }

  if (typeof item === 'object' && item !== null) {
    const word = String(item.word || item.text || item.label || '').trim();
    if (!word) {
      return null;
    }
    const meaning = String(item.meaning || item.translation || item.definition || '').trim();
    return { word, meaning };
  }

  return null;
}

function normalizeSupportObjectList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeSupportObjectItem(item))
      .filter((entry) => entry && entry.word);
  }

  if (typeof value === 'string') {
    return value
      .split(/\n|,|;/)
      .map((item) => normalizeSupportObjectItem(item))
      .filter((entry) => entry && entry.word);
  }

  return [];
}

function normalizeSupportWordKey(value) {
  return String(value || '').trim().toLowerCase();
}

function filterSupportEntries(entries, baseWord) {
  const normalizedBaseWord = normalizeSupportWordKey(baseWord);
  return (entries || [])
    .filter((entry) => entry && entry.word)
    .map((entry) => normalizeSupportObjectItem(entry))
    .filter((entry) => {
      if (!entry) {
        return false;
      }
      const wordLower = normalizeSupportWordKey(entry.word);
      if (!wordLower) {
        return false;
      }
      if (!normalizedBaseWord) {
        return true;
      }
      if (wordLower === normalizedBaseWord) {
        return false;
      }
      if (wordLower.includes(normalizedBaseWord) || normalizedBaseWord.includes(wordLower)) {
        return false;
      }
      return true;
    });
}

function uniqueSupportEntries(entries) {
  const seen = new Set();
  return (entries || []).reduce((acc, entry) => {
    if (!entry || !entry.word) {
      return acc;
    }
    const key = normalizeSupportWordKey(entry.word);
    if (!key || seen.has(key)) {
      return acc;
    }
    seen.add(key);
    acc.push(entry);
    return acc;
  }, []);
}

async function fetchVietnameseMeaning(word) {
  const normalized = normalizeSupportWordKey(word);
  if (!normalized) {
    return '';
  }

  if (Object.prototype.hasOwnProperty.call(VIETNAMESE_SUPPORT_MEANINGS, normalized)) {
    return VIETNAMESE_SUPPORT_MEANINGS[normalized];
  }

  try {
    const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|vi`);
    if (!response.ok) {
      return '';
    }

    const data = await response.json();
    const translated = data?.responseData?.translatedText || '';
    return String(translated).trim();
  } catch (error) {
    console.warn('Translation fetch failed:', error);
    return '';
  }
}

export async function enrichSupportEntriesWithMeanings(entries = []) {
  return Promise.all(
    (entries || []).map(async (entry) => {
      const normalizedEntry = normalizeSupportObjectItem(entry);
      if (!normalizedEntry || !normalizedEntry.word) {
        return null;
      }
      if (normalizedEntry.meaning) {
        return normalizedEntry;
      }

      const meaning = await fetchVietnameseMeaning(normalizedEntry.word);
      return {
        ...normalizedEntry,
        meaning: meaning || '',
      };
    }),
  ).then((results) => results.filter((entry) => entry && entry.word));
}

function buildContextSummary(context = {}) {
  const parts = [context.language, context.lesson, context.topic, context.subTopic, context.subTopicDescription, context.meaning]
    .filter((part) => typeof part === 'string' && part.trim())
    .map((part) => part.trim());

  return parts.join(' ').toLowerCase();
}

function buildSupportPayload({ meaning = '', ipa = '', definition = '', synonyms = [], antonyms = [], collocations = [], basicExample = '', conversationExample = '', lessonExample = '', examples = null } = {}) {
  const normalizedExamples = examples && typeof examples === 'object' && !Array.isArray(examples)
    ? {
        basic: String(examples.basic || '').trim(),
        conversation: String(examples.conversation || '').trim(),
        lessonContext: String(examples.lessonContext || '').trim(),
      }
    : {
        basic: String(basicExample || '').trim(),
        conversation: String(conversationExample || '').trim(),
        lessonContext: String(lessonExample || '').trim(),
      };

  const normalizedBasicExample = selectFirstSentence(normalizeSupportTextValue(normalizedExamples.basic));
  const normalizedConversationExample = selectFirstSentence(normalizeSupportTextValue(normalizedExamples.conversation));
  const normalizedLessonExample = selectFirstSentence(normalizeSupportTextValue(normalizedExamples.lessonContext));
  return {
    meaning: String(meaning || '').trim(),
    ipa: String(ipa || '').trim(),
    definition: String(definition || '').trim(),
    synonyms: normalizeSupportObjectList(synonyms),
    antonyms: normalizeSupportObjectList(antonyms),
    collocations: Array.isArray(collocations) ? collocations.map((item) => String(item || '').trim()).filter(Boolean) : [],
    example: normalizedBasicExample,
    basicExample: normalizedBasicExample,
    conversationExample: normalizedConversationExample,
    lessonExample: normalizedLessonExample,
    examples: {
      basic: normalizedBasicExample,
      conversation: normalizedConversationExample,
      lessonContext: normalizedLessonExample,
    },
  };
}

function buildGenericSupportData(word, context = {}) {
  const normalizedWord = String(word || '').trim().toLowerCase();
  const topic = cleanContextLabel(String(context.topic || '').trim());
  const subTopic = cleanContextLabel(String(context.subTopic || '').trim());
  const lesson = cleanContextLabel(String(context.lesson || '').trim());
  const contextLabel = [subTopic, topic, lesson].filter((value) => value && !/lesson\s*\d+/i.test(value)).filter(Boolean)[0] || 'this topic';
  const meaning = String(context.meaning || '').trim();
  const baseMeaning = meaning || (normalizedWord === 'meeting' ? 'cuộc họp' : '');
  const baseDefinition = normalizedWord === 'meeting'
    ? 'a planned gathering of people for discussion or decision-making'
    : 'a term related to the current topic';
  const basicExample = normalizedWord ? `${normalizedWord.charAt(0).toUpperCase() + normalizedWord.slice(1)} is important in ${contextLabel}.` : '';
  const conversationExample = normalizedWord ? `Can you explain what ${normalizedWord} means in this situation?` : '';
  const lessonExample = normalizedWord
    ? `In ${contextLabel}, ${normalizedWord} was one of the key terms discussed in class.`
    : '';

  return buildSupportPayload({
    meaning: baseMeaning,
    definition: baseDefinition,
    synonyms: [],
    antonyms: [],
    collocations: normalizedWord ? [`use ${normalizedWord} in conversation`, `${normalizedWord} appears in this topic`] : [],
    basicExample,
    conversationExample,
    lessonExample,
  });
}

function buildContextualSupportData(word, context = {}) {
  const normalizedWord = String(word || '').trim().toLowerCase();
  const staticData = STATIC_SUPPORT_DATA[normalizedWord];
  if (staticData) {
    return buildSupportPayload({
      meaning: staticData.meaning || '',
      definition: staticData.definition || '',
      synonyms: staticData.synonyms || [],
      antonyms: staticData.antonyms || [],
      collocations: staticData.collocations || [],
      basicExample: staticData.basicExample || '',
      conversationExample: staticData.conversationExample || '',
      lessonExample: staticData.lessonExample || '',
      examples: {
        basic: staticData.basicExample || '',
        conversation: staticData.conversationExample || '',
        lessonContext: staticData.lessonExample || '',
      },
    });
  }

  const contextSummary = buildContextSummary(context);
  const isBusinessTopic = contextSummary.includes('meeting') || contextSummary.includes('business') || contextSummary.includes('appointment') || contextSummary.includes('conference');
  const genericData = buildGenericSupportData(word, context);
  const lessonExample = isBusinessTopic
    ? `During the ${context.topic || 'lesson'} discussion, ${normalizedWord} was used in a practical example.`
    : genericData.lessonExample;

  return buildSupportPayload({
    ...genericData,
    lessonExample,
    examples: {
      basic: genericData.basicExample,
      conversation: genericData.conversationExample,
      lessonContext: lessonExample,
    },
  });
}

function mergeSupportDataWithContext(staticData = {}, word, context = {}) {
  const contextualData = buildContextualSupportData(word, context);
  const collocations = [...new Set([...(staticData.collocations || []), ...(contextualData.collocations || [])])];
  const lessonExample = contextualData.lessonExample || staticData.lessonExample || '';
  const conversationExample = contextualData.conversationExample || staticData.conversationExample || '';
  const basicExample = contextualData.basicExample || staticData.basicExample || '';
  const examples = {
    basic: contextualData.examples?.basic || staticData.basicExample || basicExample || '',
    conversation: contextualData.examples?.conversation || staticData.conversationExample || conversationExample || '',
    lessonContext: contextualData.examples?.lessonContext || staticData.lessonExample || lessonExample || '',
  };

  return buildSupportPayload({
    meaning: staticData.meaning || contextualData.meaning || '',
    definition: staticData.definition || contextualData.definition || '',
    synonyms: [...new Set([...(staticData.synonyms || []), ...(contextualData.synonyms || [])])],
    antonyms: [...new Set([...(staticData.antonyms || []), ...(contextualData.antonyms || [])])],
    collocations,
    basicExample,
    conversationExample,
    lessonExample,
    examples,
  });
}

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

function extractDefinitionFromResponse(responseData) {
  if (!Array.isArray(responseData) || responseData.length === 0) {
    return '';
  }

  const entry = responseData[0];
  if (!entry || typeof entry !== 'object') {
    return '';
  }

  if (Array.isArray(entry.meanings)) {
    for (const meaning of entry.meanings) {
      if (meaning && Array.isArray(meaning.definitions)) {
        const definition = meaning.definitions.find((item) => item && typeof item.definition === 'string' && item.definition.trim());
        if (definition) {
          return definition.definition.trim();
        }
      }
    }
  }

  return '';
}

function extractSupportWordsFromResponse(responseData) {
  const synonyms = [];
  const antonyms = [];

  if (!Array.isArray(responseData)) {
    return { synonyms, antonyms };
  }

  responseData.forEach((entry) => {
    if (!entry || typeof entry !== 'object' || !Array.isArray(entry.meanings)) {
      return;
    }

    entry.meanings.forEach((meaning) => {
      if (!meaning || typeof meaning !== 'object') {
        return;
      }

      if (Array.isArray(meaning.synonyms)) {
        meaning.synonyms.forEach((word) => {
          if (typeof word === 'string' && word.trim()) {
            synonyms.push(word.trim());
          }
        });
      }

      if (Array.isArray(meaning.antonyms)) {
        meaning.antonyms.forEach((word) => {
          if (typeof word === 'string' && word.trim()) {
            antonyms.push(word.trim());
          }
        });
      }

      if (Array.isArray(meaning.definitions)) {
        meaning.definitions.forEach((definitionItem) => {
          if (!definitionItem || typeof definitionItem !== 'object') {
            return;
          }
          if (Array.isArray(definitionItem.synonyms)) {
            definitionItem.synonyms.forEach((word) => {
              if (typeof word === 'string' && word.trim()) {
                synonyms.push(word.trim());
              }
            });
          }
          if (Array.isArray(definitionItem.antonyms)) {
            definitionItem.antonyms.forEach((word) => {
              if (typeof word === 'string' && word.trim()) {
                antonyms.push(word.trim());
              }
            });
          }
        });
      }
    });
  });

  return {
    synonyms: [...new Set(synonyms)].slice(0, 10),
    antonyms: [...new Set(antonyms)].slice(0, 10),
  };
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

/**
 * Suggest support data for a word without persisting it automatically.
 * @param {string} word
 * @param {Object} context
 * @returns {Promise<{ipa:string, definition:string, synonyms:string[], antonyms:string[], collocations:string[], basicExample:string, conversationExample:string, lessonExample:string}>}
 */
export async function fetchWordSupportData(word, context = {}) {
  if (!word || typeof word !== 'string') {
    return buildSupportPayload();
  }

  const normalizedWord = String(word).trim().toLowerCase();
  if (STATIC_SUPPORT_DATA[normalizedWord]) {
    const staticData = STATIC_SUPPORT_DATA[normalizedWord];
    const merged = mergeSupportDataWithContext(staticData, word, context);
    merged.synonyms = uniqueSupportEntries(filterSupportEntries(merged.synonyms, word));
    merged.antonyms = uniqueSupportEntries(filterSupportEntries(merged.antonyms, word));
    const enrichedSynonyms = await enrichSupportEntriesWithMeanings(merged.synonyms);
    const enrichedAntonyms = await enrichSupportEntriesWithMeanings(merged.antonyms);
    return {
      ...merged,
      synonyms: enrichedSynonyms.map((item) => item.word),
      antonyms: enrichedAntonyms.map((item) => item.word),
    };
  }

  const contextualData = buildContextualSupportData(word, context);
  if (contextualData.lessonExample || contextualData.basicExample || contextualData.conversationExample || contextualData.collocations.length) {
    const contextual = {
      ...contextualData,
      ipa: '',
    };
    contextual.synonyms = uniqueSupportEntries(filterSupportEntries(contextual.synonyms, word));
    contextual.antonyms = uniqueSupportEntries(filterSupportEntries(contextual.antonyms, word));
    contextual.collocations = Array.isArray(contextual.collocations)
      ? contextual.collocations.filter((item) => typeof item === 'string' && item.trim())
      : [];
    contextual.synonyms = await enrichSupportEntriesWithMeanings(contextual.synonyms);
    contextual.antonyms = await enrichSupportEntriesWithMeanings(contextual.antonyms);
    return {
      ...contextual,
      synonyms: contextual.synonyms.map((item) => item.word),
      antonyms: contextual.antonyms.map((item) => item.word),
    };
  }

  try {
    const response = await fetch(`${DICTIONARY_API_BASE}/${encodeURIComponent(word.trim())}`);
    if (!response.ok) {
      return buildSupportPayload();
    }

    const data = await response.json();
    const extracted = extractSupportWordsFromResponse(data);
    const payload = buildSupportPayload({
      meaning: context.meaning ? String(context.meaning).trim() : '',
      ipa: extractIpaFromResponse(data),
      definition: extractDefinitionFromResponse(data),
      synonyms: extracted.synonyms,
      antonyms: extracted.antonyms,
      collocations: [],
      basicExample: '',
      conversationExample: '',
      lessonExample: '',
    });
    payload.synonyms = uniqueSupportEntries(filterSupportEntries(payload.synonyms, word));
    payload.antonyms = uniqueSupportEntries(filterSupportEntries(payload.antonyms, word));
    const enrichedSynonyms = await enrichSupportEntriesWithMeanings(payload.synonyms);
    const enrichedAntonyms = await enrichSupportEntriesWithMeanings(payload.antonyms);
    return {
      ...payload,
      synonyms: enrichedSynonyms.map((item) => item.word),
      antonyms: enrichedAntonyms.map((item) => item.word),
      enrichedSynonyms,
      enrichedAntonyms,
    };
  } catch (error) {
    console.warn('Support data fetch failed:', error);
    return buildSupportPayload();
  }
}
