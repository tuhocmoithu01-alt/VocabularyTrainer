import {
  addVocabularyEntry,
  ensurePreferencesLoaded,
  ensureVocabularyLoaded,
  findDuplicateVocabularyEntry,
  findVocabularyEntry,
  filterVocabularyByTopic,
  getUniqueSubTopics,
  getUniqueTopics,
  loadSubTopics,
  loadTopics,
  loadVocabulary,
  migrateLocalStorageToFirestore,
  removeVocabularyEntry,
  saveSubTopics,
  saveTopics,
  renameTopic,
  renameSubTopic,
  deleteTopic,
  deleteSubTopic,
  updateVocabularyEntry,
  updateVocabularyEntryByWord,
  DEFAULT_TOPIC,
  DEFAULT_SUBTOPIC,
  DEFAULT_TYPE,
  normalizeWordKey,
} from './storage.js';
import { getCurrentLanguage, getLanguageLabel, getLanguageOptions, setCurrentLanguage } from './language-manager.js';
import { buildMeaningMap, getCurrentMeaningLanguage, getDisplayConfig, getMeaningDisplayValue, getMeaningLanguageOptions, getMeaningValue, setCurrentMeaningLanguage } from './language-config.js';
import { fetchWordIpa } from './dictionary.js';
import {
  buildLearnQueue,
  formatLearnLabel,
  getSpellingSequence,
  isLearnAnswerCorrect,
  normalizeLearnReadingMode,
  toggleWordVisibility,
} from './learn.js';
import { buildTestQueue, filterWordSuggestions } from './test.js';
import { playAudioFeedback } from './sound.js';
import { loadSoundEnabled, saveSoundEnabled } from './storage.js';
import { createAutoNextController } from './auto-next.js';
import {
  getSpeechRecognitionConstructor,
  getSpeechRecognitionErrorMessage,
  getSpeechRecognitionUnsupportedMessage,
  isSpeechRecognitionSupported,
  requestMicrophoneAccess,
} from './speech-recognition.js';
import { createSpeechUtterance, getSpeechLanguageCode } from './speech.js';
import {
  getDictationInstruction,
  getDictationPromptLabel,
  getDictationPromptText,
  getSpeakingInstruction,
  getSpeakingPromptLabel,
  getSpeakingPromptText,
  normalizeDictationMode,
  normalizeSpeakingMode,
} from './speaking-mode.js';

const ADD_TOPIC_VALUE = '__add_topic__';
const ADD_SUBTOPIC_VALUE = '__add_subtopic__';
const SUBTOPIC_NOT_SELECTED_VALUE = '__not_selected__';
const ALL_FILTER_VALUE = '';

const pageButtons = document.querySelectorAll('.menu-button');
const pages = document.querySelectorAll('.page');
const addForm = document.getElementById('add-form');
const inputTopic = document.getElementById('input-topic');
const inputSubtopic = document.getElementById('input-subtopic');
const inputType = document.getElementById('input-type');
const inputWord = document.getElementById('input-word');
const inputMeaning = document.getElementById('input-meaning');
const inputIpa = document.getElementById('input-ipa');
const inputExample = document.getElementById('input-example');
const addFeedback = document.getElementById('add-feedback');
const addSubmitButton = document.getElementById('add-submit');
const addCancelButton = document.getElementById('add-cancel');
const wordSuggestions = document.getElementById('word-suggestions');
const duplicateStatus = document.getElementById('duplicate-status');
const duplicateCard = document.getElementById('duplicate-card');
const sortBySelect = document.getElementById('sort-by');
const filterTypeSelect = document.getElementById('filter-type');
const wordList = document.getElementById('word-list');
const learnTopicFilter = document.getElementById('learn-topic-filter');
const learnSubtopicFilter = document.getElementById('learn-subtopic-filter');
const learnSelection = document.getElementById('learn-selection');
const learnCount = document.getElementById('learn-count');
const learnReadingMode = document.getElementById('learn-reading-mode');
const learnStart = document.getElementById('learn-start');
const learnFeedback = document.getElementById('learn-feedback');
const learnSession = document.getElementById('learn-session');
const displayWord = document.getElementById('display-word');
const displayMeaning = document.getElementById('display-meaning');
const displayExample = document.getElementById('display-example');
const learnAnswer = document.getElementById('learn-answer');
const learnCheck = document.getElementById('learn-check');
const learnToggle = document.getElementById('learn-toggle');
const learnReplay = document.getElementById('learn-replay');
const learnKnown = document.getElementById('learn-known');
const learnMessage = document.getElementById('learn-message');
const learnProgress = document.getElementById('learn-progress');
const sessionCounter = document.getElementById('session-counter');
const testTopicFilter = document.getElementById('test-topic-filter');
const testSubtopicFilter = document.getElementById('test-subtopic-filter');
const testStart = document.getElementById('test-start');
const testFeedback = document.getElementById('test-feedback');
const testSession = document.getElementById('test-session');
const testMeaning = document.getElementById('test-meaning');
const testExample = document.getElementById('test-example');
const testAnswer = document.getElementById('test-answer');
const testSubmit = document.getElementById('test-submit');
const testNext = document.getElementById('test-next');
const testMessage = document.getElementById('test-message');
const testProgress = document.getElementById('test-progress');
const testCounter = document.getElementById('test-counter');
const testSummary = document.getElementById('test-summary');
const summaryScore = document.getElementById('summary-score');
const summaryBreakdown = document.getElementById('summary-breakdown');
const testRestart = document.getElementById('test-restart');
const testModeSpeaking = document.getElementById('test-mode-speaking');
const testModeDictation = document.getElementById('test-mode-dictation');
const testModeHint = document.getElementById('test-mode-hint');
const testModeLabel = document.getElementById('test-mode-label');
const testStageLabel = document.getElementById('test-stage-label');
const testInputLabel = document.getElementById('test-input-label');
const testListen = document.getElementById('test-listen');
const testRecord = document.getElementById('test-record');
const speakingModeWrapper = document.getElementById('speaking-mode-wrapper');
const speakingModeSelect = document.getElementById('speaking-mode-select');
const dictationModeWrapper = document.getElementById('dictation-mode-wrapper');
const dictationModeSelect = document.getElementById('dictation-mode-select');
const soundToggle = document.getElementById('sound-toggle');
const languageSelect = document.getElementById('language-select');
const languageLabel = document.getElementById('language-label');
const meaningLanguageSelect = document.getElementById('meaning-language-select');

// ===== SOUND SETTINGS =====
const SOUND_ENABLED_KEY = 'soundEnabled';
const SOUND_ENABLED_DEFAULT = true;
const SOUND_VOLUME = 0.6;
const CORRECT_SOUND_PATH = 'sounds/correct.mp3';
const WRONG_SOUND_PATH = 'sounds/wrong.mp3';
const AUTO_NEXT_DELAY_SECONDS = 3;
const AUTO_NEXT_DELAY = 3000;

const correctAudio = new Audio(CORRECT_SOUND_PATH);
const wrongAudio = new Audio(WRONG_SOUND_PATH);

let soundEnabled = SOUND_ENABLED_DEFAULT;

let vocabulary = [];
let learnQueue = [];
let currentLearnIndex = 0;
let isHiddenWord = false;
let selectedLearnReadingMode = 'normal';
let learnSpellingTimer = null;
let learnSpellingStepTimer = null;
let learnSpellingRunId = 0;
let testQueue = [];
let currentTestIndex = 0;
let testScore = 0;
let testWrong = 0;
let dictationWrongAttempts = 0;
let selectedTestMode = '';
let selectedSpeakingMode = 'vocabulary';
let selectedDictationMode = 'word';
let dictationStage = 'word';
let testRecognition = null;
let sessionActive = false;
let autoNextTimer = null;
let speakingAutoNextTimer = null;
let isTestTransitioning = false;
const autoNextController = createAutoNextController();
let editingWord = null;
let wordSuggestionItems = [];
let activeSuggestionIndex = -1;
let duplicateHighlightTimer = null;

function updateSoundToggleLabel() {
  if (!soundToggle) {
    return;
  }
  soundToggle.textContent = `🔊 Sound: ${soundEnabled ? 'ON' : 'OFF'}`;
}

async function loadSoundSetting() {
  try {
    soundEnabled = await loadSoundEnabled(SOUND_ENABLED_DEFAULT);
  } catch (error) {
    soundEnabled = SOUND_ENABLED_DEFAULT;
  }
  updateSoundToggleLabel();
}

function setSoundEnabled(enabled) {
  soundEnabled = enabled;
  void saveSoundEnabled(soundEnabled);
  updateSoundToggleLabel();
}

function initializeAudio() {
  [correctAudio, wrongAudio].forEach((audio) => {
    audio.preload = 'auto';
    audio.volume = SOUND_VOLUME;
    audio.loop = false;
  });
}

async function playCorrectSound() {
  if (!soundEnabled) {
    return false;
  }
  return playAudioFeedback(correctAudio, soundEnabled, console.error);
}

async function playWrongSound() {
  if (!soundEnabled) {
    return false;
  }
  return playAudioFeedback(wrongAudio, soundEnabled, console.error);
}

function showPage(pageName) {
  pages.forEach((page) => page.classList.toggle('active', page.id === `page-${pageName}`));
  pageButtons.forEach((button) => button.classList.toggle('active', button.dataset.page === pageName));
}

function clearAddFormInputFields() {
  inputWord.value = '';
  inputMeaning.value = '';
  inputIpa.value = '';
  inputExample.value = '';
  editingWord = null;
  addFeedback.textContent = '';
  hideWordSuggestions();
  updateDuplicateStatus();
}

function resetAddForm() {
  // Clear only input fields, preserve Topic/SubTopic/Type selections
  clearAddFormInputFields();
  addSubmitButton.textContent = 'Lưu từ';
  addSubmitButton.disabled = false;
  addCancelButton.classList.add('hidden');
}

function buildSelectOptions(items, includeAll = false, includeAdd = false) {
  const options = [];
  if (includeAll) {
    options.push({ value: ALL_FILTER_VALUE, label: 'All' });
  }

  items.forEach((item) => {
    options.push({ value: item, label: item });
  });

  if (includeAdd) {
    options.push({ value: ADD_TOPIC_VALUE, label: '+ Add Topic' });
  }

  return options;
}

function populateSelect(selectElement, options, selectedValue) {
  selectElement.innerHTML = options
    .map((option) => `<option value="${option.value}">${option.label}</option>`) // no escaping needed for trusted labels
    .join('');

  if (selectedValue && options.some((option) => option.value === selectedValue)) {
    selectElement.value = selectedValue;
  }
}

function getWordsFromFilters(topic, subTopic) {
  if (!topic && !subTopic) {
    return loadVocabulary();
  }

  return filterVocabularyByTopic(loadVocabulary(), topic || undefined, subTopic || undefined);
}

function getStoredTopics() {
  const topics = loadTopics();
  return topics.length ? topics : [DEFAULT_TOPIC];
}

function getStoredSubTopics(topic) {
  const subTopics = loadSubTopics(topic);
  return subTopics.length ? subTopics : [DEFAULT_SUBTOPIC];
}

async function addTopicToStorage(topic) {
  const topics = getStoredTopics();
  const normalizedTopic = topic.trim();
  const exists = topics.some((item) => item.toLowerCase() === normalizedTopic.toLowerCase());
  if (exists) {
    throw new Error('Topic đã tồn tại.');
  }
  await saveTopics([...topics, normalizedTopic]);
}

async function addSubTopicToStorage(topic, subTopic) {
  const normalizedTopic = topic.trim();
  const normalizedSubTopic = subTopic.trim();
  const subTopics = getStoredSubTopics(normalizedTopic);
  const exists = subTopics.some((item) => item.toLowerCase() === normalizedSubTopic.toLowerCase());
  if (exists) {
    throw new Error('Sub Topic đã tồn tại.');
  }
  await saveSubTopics([...subTopics, normalizedSubTopic], normalizedTopic);
}

async function promptForNewTopic() {
  const topicName = window.prompt('Nhập tên Topic mới:');
  if (!topicName || !topicName.trim()) {
    return null;
  }

  const normalizedTopic = topicName.trim();
  try {
    await addTopicToStorage(normalizedTopic);
    addFeedback.textContent = '';
    return normalizedTopic;
  } catch (error) {
    addFeedback.textContent = error.message;
    return null;
  }
}

async function promptForNewSubTopic(topic) {
  const subTopicName = window.prompt('Nhập tên Sub Topic mới:');
  if (!subTopicName || !subTopicName.trim()) {
    return null;
  }

  const normalizedSubTopic = subTopicName.trim();
  try {
    await addSubTopicToStorage(topic, normalizedSubTopic);
    addFeedback.textContent = '';
    return normalizedSubTopic;
  } catch (error) {
    addFeedback.textContent = error.message;
    return null;
  }
}

function getActiveTopicValue() {
  return inputTopic.value === ADD_TOPIC_VALUE ? (inputTopic.dataset.previousValue || DEFAULT_TOPIC) : inputTopic.value;
}

function getActiveSubTopicValue() {
  return inputSubtopic.value === ADD_SUBTOPIC_VALUE ? (inputSubtopic.dataset.previousValue || DEFAULT_SUBTOPIC) : inputSubtopic.value;
}

function promptForRenameTopic(topic) {
  const currentTopic = topic || getActiveTopicValue();
  const renamedTopic = window.prompt('Nhập tên Topic mới:', currentTopic);
  if (!renamedTopic || !renamedTopic.trim() || renamedTopic.trim() === currentTopic.trim()) {
    return null;
  }
  return renamedTopic.trim();
}

function promptForRenameSubTopic(topic, subTopic) {
  const topicName = topic || getActiveTopicValue();
  const currentSubTopic = subTopic || getActiveSubTopicValue();
  const renamedSubTopic = window.prompt('Nhập tên Sub Topic mới:', currentSubTopic);
  if (!renamedSubTopic || !renamedSubTopic.trim() || renamedSubTopic.trim() === currentSubTopic.trim()) {
    return null;
  }
  return renamedSubTopic.trim();
}

function refreshAddFormTopicList(selectedTopic = DEFAULT_TOPIC) {
  const topics = getStoredTopics();
  const topicOptions = buildSelectOptions(topics, false, true);
  populateSelect(inputTopic, topicOptions, selectedTopic);

  const topicValue = inputTopic.value === ADD_TOPIC_VALUE ? selectedTopic : inputTopic.value;
  refreshAddFormSubtopicList(topicValue);
}

function refreshAddFormSubtopicList(topic, selectedSubtopic = DEFAULT_SUBTOPIC) {
  const subTopics = getStoredSubTopics(topic);
  const subtopicOptions = subTopics
    .map((sub) => ({ value: sub, label: sub }))
    .concat([{ value: ADD_SUBTOPIC_VALUE, label: '+ Add Sub Topic' }]);
  populateSelect(inputSubtopic, subtopicOptions, selectedSubtopic);
}

function loadAddFormSubtopicListNotSelected(topic) {
  const subTopics = getStoredSubTopics(topic);
  const subtopicOptions = [
    { value: SUBTOPIC_NOT_SELECTED_VALUE, label: 'Vui lòng chọn Sub Topic' }
  ].concat(
    subTopics.map((sub) => ({ value: sub, label: sub }))
  ).concat([{ value: ADD_SUBTOPIC_VALUE, label: '+ Add Sub Topic' }]);
  populateSelect(inputSubtopic, subtopicOptions, SUBTOPIC_NOT_SELECTED_VALUE);
}

function refreshFilterControls() {
  const topics = getStoredTopics();
  const topicOptions = buildSelectOptions(topics, true, false);
  populateSelect(learnTopicFilter, topicOptions, ALL_FILTER_VALUE);
  populateSelect(testTopicFilter, topicOptions, ALL_FILTER_VALUE);

  updateLearnFilterSubtopics();
  updateTestFilterSubtopics();
}

function updateLearnFilterSubtopics() {
  const selectedTopic = learnTopicFilter.value;
  const subTopics = getStoredSubTopics(selectedTopic || undefined);
  const options = [{ value: ALL_FILTER_VALUE, label: 'All' }].concat(
    subTopics.map((sub) => ({ value: sub, label: sub })),
  );
  populateSelect(learnSubtopicFilter, options, ALL_FILTER_VALUE);
}

function updateTestFilterSubtopics() {
  const selectedTopic = testTopicFilter.value;
  const subTopics = getStoredSubTopics(selectedTopic || undefined);
  const options = [{ value: ALL_FILTER_VALUE, label: 'All' }].concat(
    subTopics.map((sub) => ({ value: sub, label: sub })),
  );
  populateSelect(testSubtopicFilter, options, ALL_FILTER_VALUE);
}

async function renderWordList() {
  await ensureVocabularyLoaded();
  const words = loadVocabulary();
  vocabulary = words;
  const selectedType = filterTypeSelect?.value || '';
  const filteredWords = selectedType ? words.filter((entry) => entry.type === selectedType) : words;
  const sortBy = sortBySelect?.value || 'alphabet';
  const html = sortBy === 'topic' ? renderWordListByTopic(filteredWords) : renderWordListAlphabetically(filteredWords);
  wordList.innerHTML = html;
}

function renderLanguageSelector() {
  if (!languageSelect) {
    return;
  }

  const options = getLanguageOptions();
  languageSelect.innerHTML = options
    .map((language) => `<option value="${language.code}" ${language.code === getCurrentLanguage() ? 'selected' : ''}>${language.flag} ${language.label}</option>`)
    .join('');
  languageSelect.value = getCurrentLanguage();
  if (languageLabel) {
    languageLabel.textContent = `Ngôn ngữ học: ${getLanguageLabel(getCurrentLanguage())}`;
  }
}

function renderMeaningLanguageSelector() {
  if (!meaningLanguageSelect) {
    return;
  }

  const options = getMeaningLanguageOptions();
  meaningLanguageSelect.innerHTML = options
    .map((language) => `<option value="${language.code}" ${language.code === getCurrentMeaningLanguage() ? 'selected' : ''}>${language.flag} ${language.label}</option>`)
    .join('');
  meaningLanguageSelect.value = getCurrentMeaningLanguage();
}

function getActiveDisplayConfig() {
  return getDisplayConfig(getCurrentLanguage(), getCurrentMeaningLanguage());
}

function updateDynamicLabels() {
  const config = getActiveDisplayConfig();
  const termLabel = document.querySelector('[data-field-label="term"]');
  const pronunciationLabel = document.querySelector('[data-field-label="pronunciation"]');
  const meaningLabel = document.querySelector('[data-field-label="meaning"]');
  const exampleLabel = document.querySelector('[data-field-label="example"]');
  const learnTermLabel = document.querySelector('[data-display-label="term"]');
  const learnMeaningLabel = document.querySelector('[data-display-label="meaning"]');
  const learnExampleLabel = document.querySelector('[data-display-label="example"]');
  const termInput = document.getElementById('input-word');
  const meaningInput = document.getElementById('input-meaning');
  const pronunciationInput = document.getElementById('input-ipa');
  const exampleInput = document.getElementById('input-example');

  if (termLabel) {
    termLabel.textContent = config.termLabel;
  }
  if (pronunciationLabel) {
    pronunciationLabel.textContent = config.pronunciationLabel;
  }
  if (meaningLabel) {
    meaningLabel.textContent = config.meaningLabel;
  }
  if (exampleLabel) {
    exampleLabel.textContent = config.exampleLabel;
  }
  if (learnTermLabel) {
    learnTermLabel.textContent = config.termLabel;
  }
  if (learnMeaningLabel) {
    learnMeaningLabel.textContent = config.meaningLabel;
  }
  if (learnExampleLabel) {
    learnExampleLabel.textContent = config.exampleLabel;
  }
  if (termInput) {
    termInput.placeholder = config.termHint || '';
  }
  if (meaningInput) {
    meaningInput.placeholder = config.meaningPlaceholder || '';
  }
  if (pronunciationInput) {
    pronunciationInput.placeholder = config.pronunciationPlaceholder || '';
  }
  if (exampleInput) {
    exampleInput.placeholder = config.exampleHint || '';
  }
}

function renderWordCard(entry) {
  const config = getActiveDisplayConfig();
  const meaningValue = getMeaningDisplayValue(entry, getCurrentMeaningLanguage());
  return `
    <div class="word-item" data-word="${entry.word}" data-doc-id="${entry.docId || ''}">
      <div>
        <h3>${entry.word}</h3>
        <p><strong>Type:</strong> ${entry.type || DEFAULT_TYPE}</p>
        <p><strong>Topic:</strong> ${entry.topic}</p>
        <p><strong>Sub Topic:</strong> ${entry.subTopic}</p>
        <p><strong>${config.meaningLabel}:</strong> ${meaningValue}</p>
        <p><strong>${config.exampleLabel}:</strong> ${entry.example}</p>
        <p><strong>${config.pronunciationLabel}:</strong> ${entry.ipa || entry.pronunciation || '—'}</p>
        <p><strong>Trạng thái:</strong> ${entry.learned ? 'Đã thuộc' : 'Chưa thuộc'}</p>
      </div>
      <div class="word-actions">
        <button type="button" class="edit-word secondary-button">✏ Edit</button>
        <button type="button" class="delete-word">🗑 Delete</button>
      </div>
    </div>
  `;
}

function renderWordListAlphabetically(words) {
  if (!words.length) {
    return '<p class="feedback">Chưa có từ nào. Thêm từ ngay để bắt đầu học.</p>';
  }

  const sortedWords = [...words].sort((first, second) => first.word.localeCompare(second.word, undefined, { sensitivity: 'base' }));
  const grouped = sortedWords.reduce((acc, entry) => {
    const letter = (entry.word.charAt(0) || '#').toUpperCase();
    if (!acc[letter]) {
      acc[letter] = [];
    }
    acc[letter].push(entry);
    return acc;
  }, {});

  return Object.keys(grouped)
    .sort()
    .map((letter) => `
      <section class="alphabet-group">
        <h3 class="word-group-heading">${letter}</h3>
        ${grouped[letter].map(renderWordCard).join('')}
      </section>
    `)
    .join('');
}

function renderWordListByTopic(words) {
  if (!words.length) {
    return '<p class="feedback">Chưa có từ nào. Thêm từ ngay để bắt đầu học.</p>';
  }

  const sortedWords = [...words].sort((first, second) => {
    const categoryComparison = (first.category || first.topic || DEFAULT_TOPIC).localeCompare(second.category || second.topic || DEFAULT_TOPIC, undefined, { sensitivity: 'base' });
    if (categoryComparison !== 0) {
      return categoryComparison;
    }
    const topicComparison = (first.topic || DEFAULT_TOPIC).localeCompare(second.topic || DEFAULT_TOPIC, undefined, { sensitivity: 'base' });
    if (topicComparison !== 0) {
      return topicComparison;
    }
    const subTopicComparison = (first.subTopic || DEFAULT_SUBTOPIC).localeCompare(second.subTopic || DEFAULT_SUBTOPIC, undefined, { sensitivity: 'base' });
    if (subTopicComparison !== 0) {
      return subTopicComparison;
    }
    return first.word.localeCompare(second.word, undefined, { sensitivity: 'base' });
  });

  const groupedByCategory = sortedWords.reduce((categoryAcc, entry) => {
    const category = entry.category || entry.topic || DEFAULT_TOPIC;
    const topic = entry.topic || DEFAULT_TOPIC;
    const subTopic = entry.subTopic || DEFAULT_SUBTOPIC;
    categoryAcc[category] = categoryAcc[category] || {};
    categoryAcc[category][topic] = categoryAcc[category][topic] || {};
    categoryAcc[category][topic][subTopic] = categoryAcc[category][topic][subTopic] || [];
    categoryAcc[category][topic][subTopic].push(entry);
    return categoryAcc;
  }, {});

  return Object.keys(groupedByCategory)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .map((category) => `
      <section class="topic-group">
        <h2 class="topic-heading">📁 ${category}</h2>
        ${Object.keys(groupedByCategory[category])
          .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
          .map((topic) => `
            <div class="subtopic-group">
              <h3 class="subtopic-heading">▶ ${topic}</h3>
              ${Object.keys(groupedByCategory[category][topic])
                .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
                .map((subTopic) => {
                  const entries = groupedByCategory[category][topic][subTopic];
                  const wordsSection = entries.filter((entry) => entry.type === 'Word');
                  const phrasesSection = entries.filter((entry) => entry.type === 'Phrase');
                  return `
                    <div class="subtopic-group nested">
                      <h4 class="subtopic-heading">• ${subTopic}</h4>
                      ${wordsSection.length ? `<div class="type-group"><h5>Words</h5>${wordsSection.map(renderWordCard).join('')}</div>` : ''}
                      ${phrasesSection.length ? `<div class="type-group"><h5>Phrases</h5>${phrasesSection.map(renderWordCard).join('')}</div>` : ''}
                    </div>
                  `;
                })
                .join('')}
            </div>
          `)
          .join('')}
      </section>
    `)
    .join('');
}

function renderLearnSelection() {
  const allWords = loadVocabulary();
  vocabulary = allWords;
  const topic = learnTopicFilter.value || undefined;
  const subTopic = learnSubtopicFilter.value || undefined;
  const words = filterVocabularyByTopic(allWords, topic, subTopic);
  learnSelection.innerHTML = words.length
    ? words
        .map(
          (entry) => `
            <div class="select-item">
              <label>
                <input type="radio" name="learn-word" value="${entry.word}" />
                <span>${formatLearnLabel(entry)} • ${entry.topic} / ${entry.subTopic}</span>
              </label>
            </div>
          `,
        )
        .join('')
    : '<p class="feedback">Không có từ để luyện. Vui lòng thêm từ mới hoặc thay đổi bộ lọc.</p>';
}

function renderTestState() {
  const allWords = loadVocabulary();
  vocabulary = allWords;
  const words = getWordsFromFilters(testTopicFilter.value, testSubtopicFilter.value);
  testFeedback.textContent = words.length ? '' : 'Không có từ để test theo bộ lọc hiện tại. Vui lòng chọn lại.';
}

function setLearnSessionVisibility(visible) {
  learnSession.classList.toggle('hidden', !visible);
  sessionActive = visible;
}

function setTestSessionVisibility(visible) {
  testSession.classList.toggle('hidden', !visible);
  if (!visible) {
    testSummary.classList.add('hidden');
  }
}

function clearLearnSpellingAnimation() {
  if (learnSpellingTimer) {
    window.clearTimeout(learnSpellingTimer);
  }
  if (learnSpellingStepTimer) {
    window.clearTimeout(learnSpellingStepTimer);
  }
  learnSpellingTimer = null;
  learnSpellingStepTimer = null;
}

function renderLearnWordDisplay(entry, highlightIndex = -1) {
  if (!entry) {
    return;
  }

  if (isHiddenWord) {
    displayWord.textContent = '••••••';
    return;
  }

  const mode = normalizeLearnReadingMode(learnReadingMode?.value || selectedLearnReadingMode);
  if (mode !== 'spelling') {
    displayWord.textContent = entry.word;
    return;
  }

  const letters = getSpellingSequence(entry.word);
  displayWord.innerHTML = letters
    .map((letter, index) => {
      const isActive = index <= highlightIndex;
      return `<span class="spelling-letter${isActive ? ' active' : ''}">${letter}</span>`;
    })
    .join('');
}

function updateLearnDisplay() {
  const currentEntry = learnQueue[currentLearnIndex];
  displayMeaning.textContent = getMeaningDisplayValue(currentEntry, getCurrentMeaningLanguage());
  displayExample.textContent = currentEntry.example;
  renderLearnWordDisplay(currentEntry);
  learnToggle.textContent = isHiddenWord ? 'Hiện từ' : 'Ẩn từ';
  sessionCounter.textContent = `Từ ${currentLearnIndex + 1} / ${learnQueue.length}`;
  const progressPercent = Math.round(((currentLearnIndex + 1) / learnQueue.length) * 100);
  learnProgress.style.width = `${progressPercent}%`;
}

function speakLearnWord(entry) {
  if (!entry || !('speechSynthesis' in window)) {
    return false;
  }

  const synth = window.speechSynthesis;
  const mode = normalizeLearnReadingMode(learnReadingMode?.value || selectedLearnReadingMode);
  clearLearnSpellingAnimation();
  synth.cancel();

  if (mode !== 'spelling') {
    const utterance = createSpeechUtterance(entry.word, getCurrentLanguage(), { rate: 0.8, pitch: 1 });
    utterance.onstart = () => {
      if (learnMessage) {
        learnMessage.textContent = 'Đang phát âm...';
      }
    };
    utterance.onerror = () => {
      if (learnMessage) {
        learnMessage.textContent = 'Không thể phát âm từ này lúc này.';
      }
    };
    utterance.onend = () => {
      if (learnMessage) {
        learnMessage.textContent = '';
      }
    };
    synth.speak(utterance);
    return true;
  }

  const letters = getSpellingSequence(entry.word);
  if (!letters.length) {
    return false;
  }

  const letterPauseMs = 500;
  const finishPauseMs = 800;
  let index = 0;
  learnSpellingRunId += 1;
  const currentRunId = learnSpellingRunId;

  const updateHighlight = (nextIndex) => {
    if (currentRunId !== learnSpellingRunId) {
      return;
    }
    renderLearnWordDisplay(entry, nextIndex);
  };

  const speakNextLetter = () => {
    if (currentRunId !== learnSpellingRunId || index >= letters.length) {
      return;
    }

    const letterUtterance = createSpeechUtterance(letters[index], getCurrentLanguage(), { rate: 0.8, pitch: 1 });
    letterUtterance.onstart = () => {
      if (learnMessage) {
        learnMessage.textContent = 'Đang phát âm...';
      }
    };
    letterUtterance.onerror = () => {
      if (learnMessage) {
        learnMessage.textContent = 'Không thể phát âm từ này lúc này.';
      }
    };
    letterUtterance.onend = () => {
      if (currentRunId !== learnSpellingRunId) {
        return;
      }
      updateHighlight(index);
      index += 1;
      if (index < letters.length) {
        learnSpellingStepTimer = window.setTimeout(speakNextLetter, letterPauseMs);
      } else {
        learnSpellingTimer = window.setTimeout(() => {
          if (currentRunId !== learnSpellingRunId) {
            return;
          }
          const wholeWordUtterance = createSpeechUtterance(entry.word, getCurrentLanguage(), { rate: 0.8, pitch: 1 });
          wholeWordUtterance.onstart = () => {
            if (learnMessage) {
              learnMessage.textContent = 'Đang phát âm...';
            }
          };
          wholeWordUtterance.onerror = () => {
            if (learnMessage) {
              learnMessage.textContent = 'Không thể phát âm từ này lúc này.';
            }
          };
          wholeWordUtterance.onend = () => {
            if (learnMessage) {
              learnMessage.textContent = '';
            }
          };
          synth.speak(wholeWordUtterance);
          renderLearnWordDisplay(entry, letters.length - 1);
        }, finishPauseMs);
      }
    };
    synth.speak(letterUtterance);
  };

  renderLearnWordDisplay(entry, -1);
  speakNextLetter();
  return true;
}

// Normalize user input so comparisons are robust across punctuation and casing.
function normalizeText(value) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function testTimeout(callback, delay) {
  window.setTimeout(callback, delay);
}

function cancelAutoNext() {
  autoNextController.cancel();
  autoNextTimer = null;
}

function cancelSpeakingAutoNext() {
  if (speakingAutoNextTimer !== null) {
    window.clearInterval(speakingAutoNextTimer);
    speakingAutoNextTimer = null;
  }
}

function startSpeakingAutoNext() {
  cancelSpeakingAutoNext();

  if (selectedTestMode !== 'speaking' || !sessionActive) {
    return;
  }

  const startedAt = Date.now();
  const updateCountdown = () => {
    if (selectedTestMode !== 'speaking' || !sessionActive) {
      cancelSpeakingAutoNext();
      return;
    }

    const elapsedMs = Date.now() - startedAt;
    const secondsLeft = Math.max(0, Math.ceil((AUTO_NEXT_DELAY - elapsedMs) / 1000));

    if (secondsLeft <= 0) {
      cancelSpeakingAutoNext();
      proceedToNextTestQuestion();
      return;
    }

    testMessage.textContent = `✅ Chính xác. Chuyển câu sau: ${secondsLeft}...`;
  };

  updateCountdown();
  speakingAutoNextTimer = window.setInterval(updateCountdown, 1000);
}

function startAutoNext() {
  cancelAutoNext();
  autoNextTimer = autoNextController;
  autoNextController.start(
    () => {
      proceedToNextTestQuestion();
    },
    AUTO_NEXT_DELAY_SECONDS,
    (remainingSeconds) => {
      if (selectedTestMode !== 'dictation' || !sessionActive) {
        return;
      }
      testMessage.textContent = `✅ Chính xác. Chuyển câu sau: ${remainingSeconds}...`;
    },
  );
}

// Toggle the active test mode between speaking and dictation.
function setSelectedTestMode(mode) {
  cancelAutoNext();
  cancelSpeakingAutoNext();
  isTestTransitioning = false;
  selectedTestMode = mode;
  selectedSpeakingMode = normalizeSpeakingMode(speakingModeSelect?.value || selectedSpeakingMode);
  selectedDictationMode = normalizeDictationMode(dictationModeSelect?.value || selectedDictationMode);
  testModeSpeaking.classList.toggle('active-mode', mode === 'speaking');
  testModeDictation.classList.toggle('active-mode', mode === 'dictation');
  speakingModeWrapper?.classList.toggle('hidden', mode !== 'speaking');
  dictationModeWrapper?.classList.toggle('hidden', mode !== 'dictation');

  if (mode === 'speaking' && !isSpeechRecognitionSupported()) {
    testRecord.disabled = true;
    testModeHint.textContent = getSpeechRecognitionUnsupportedMessage();
    return;
  }

  testRecord.disabled = false;
  testModeHint.textContent = mode === 'speaking' ? 'Chế độ Speaking Test đã được chọn.' : 'Chế độ Dictation Test đã được chọn.';
}

function stopVoiceRecognition() {
  if (testRecognition) {
    testRecognition.stop();
  }
  testRecognition = null;
}

// Use Web Speech Synthesis to read the target word or example sentence.
function speakText(text, rate = 0.8) {
  if (!('speechSynthesis' in window)) {
    return false;
  }

  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = createSpeechUtterance(text, getCurrentLanguage(), { rate, pitch: 1 });
  utterance.onstart = () => {
    testMessage.textContent = 'Đang phát âm...';
  };
  utterance.onerror = () => {
    testMessage.textContent = 'Không thể phát âm nội dung này lúc này.';
  };
  utterance.onend = () => {
    if (selectedTestMode === 'speaking') {
      testMessage.textContent = 'Sẵn sàng.';
    }
  };
  synth.speak(utterance);
  return true;
}

function speakSpeakingPrompt(entry) {
  if (!('speechSynthesis' in window)) {
    testMessage.textContent = 'Trình duyệt không hỗ trợ Speech Synthesis.';
    return;
  }

  const promptText = getSpeakingPromptText(selectedSpeakingMode, entry);
  if (!promptText) {
    return;
  }

  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = createSpeechUtterance(promptText, getCurrentLanguage(), { rate: 0.8, pitch: 1 });
  utterance.onstart = () => {
    testMessage.textContent = 'Đang phát âm...';
  };
  utterance.onerror = () => {
    testMessage.textContent = 'Không thể phát âm yêu cầu này lúc này.';
  };
  utterance.onend = () => {
    testMessage.textContent = 'Sẵn sàng.';
  };
  synth.speak(utterance);
}

function updateTestProgress() {
  const totalQuestions = Math.max(testQueue.length, 1);
  testCounter.textContent = `Câu ${currentTestIndex + 1} / ${testQueue.length}`;
  const progressPercent = Math.round(((currentTestIndex + 1) / totalQuestions) * 100);
  testProgress.style.width = `${progressPercent}%`;
}

function showTestSummary() {
  cancelAutoNext();
  cancelSpeakingAutoNext();
  isTestTransitioning = false;
  const totalChecks = testScore + testWrong;
  const accuracy = totalChecks ? Math.round((testScore / totalChecks) * 100) : 0;
  testSummary.classList.remove('hidden');
  summaryScore.textContent = `Correct: ${testScore} | Wrong: ${testWrong}`;
  summaryBreakdown.textContent = `Accuracy: ${accuracy}%`;
  testSubmit.classList.add('hidden');
  testNext.classList.add('hidden');
  testAnswer.classList.add('hidden');
  testRecord.classList.add('hidden');
  testListen.classList.add('hidden');
  testMessage.textContent = 'Hoàn tất bài test.';
  sessionActive = false;
}

function updateTestDisplay() {
  cancelAutoNext();
  cancelSpeakingAutoNext();
  isTestTransitioning = false;
  const currentEntry = testQueue[currentTestIndex];
  if (!currentEntry) {
    return;
  }

  if (selectedTestMode === 'speaking') {
    selectedSpeakingMode = normalizeSpeakingMode(speakingModeSelect?.value || selectedSpeakingMode);
    testModeLabel.textContent = 'Mode: Speaking Test';
    testStageLabel.textContent = 'Pronunciation';
    testMeaning.textContent = getSpeakingInstruction(selectedSpeakingMode);
    testExample.textContent = `${getSpeakingPromptLabel(selectedSpeakingMode)}: ${getSpeakingPromptText(selectedSpeakingMode, currentEntry)}`;
    testInputLabel.textContent = 'Phản hồi';
    testAnswer.classList.add('hidden');
    testAnswer.disabled = false;
    testAnswer.value = '';
    testRecord.classList.remove('hidden');
    testListen.classList.remove('hidden');
    testSubmit.classList.add('hidden');
    testNext.classList.add('hidden');
    testListen.disabled = false;
    testRecord.disabled = false;
    testSubmit.disabled = false;

    if (!isSpeechRecognitionSupported()) {
      testRecord.disabled = true;
      testMessage.textContent = getSpeechRecognitionUnsupportedMessage();
    } else {
      testMessage.textContent = `Nhấn 🔊 Listen để nghe ${selectedSpeakingMode === 'example' ? 'câu ví dụ' : 'từ'} rồi bấm 🎤 Record để ghi âm.`;
    }

    speakSpeakingPrompt(currentEntry);
  } else {
    selectedDictationMode = normalizeDictationMode(dictationModeSelect?.value || selectedDictationMode);
    testModeLabel.textContent = 'Mode: Dictation Test';
    testStageLabel.textContent = selectedDictationMode === 'example' ? 'Stage: Example' : 'Stage: Word';
    testMeaning.textContent = getDictationInstruction(selectedDictationMode);
    testExample.textContent = `${getDictationPromptLabel(selectedDictationMode)}: ${getDictationPromptText(selectedDictationMode, currentEntry)}`;
    testInputLabel.textContent = selectedDictationMode === 'example' ? 'Nhập câu ví dụ' : 'Nhập từ';
    testAnswer.classList.remove('hidden');
    testAnswer.disabled = false;
    testAnswer.removeAttribute('aria-disabled');
    testAnswer.value = '';
    testRecord.classList.add('hidden');
    testSubmit.classList.remove('hidden');
    testSubmit.disabled = false;
    testNext.classList.add('hidden');
    testListen.classList.remove('hidden');
    testListen.disabled = false;
    testMessage.textContent = selectedDictationMode === 'example' ? 'Bấm 🔊 Listen để nghe câu ví dụ.' : 'Bấm 🔊 Listen để nghe từ.';

    dictationWrongAttempts = 0;
    if (selectedDictationMode === 'example') {
      speakText(currentEntry.example);
    } else {
      speakText(currentEntry.word);
    }
    testTimeout(() => testAnswer.focus(), 120);
  }

  updateTestProgress();
}

function resetLearnSession() {
  clearLearnSpellingAnimation();
  learnQueue = [];
  currentLearnIndex = 0;
  isHiddenWord = false;
  learnAnswer.value = '';
  learnMessage.textContent = '';
  setLearnSessionVisibility(false);
}

function resetTestSession() {
  cancelAutoNext();
  cancelSpeakingAutoNext();
  isTestTransitioning = false;
  testQueue = [];
  currentTestIndex = 0;
  testScore = 0;
  testWrong = 0;
  dictationWrongAttempts = 0;
  dictationStage = 'word';
  testAnswer.value = '';
  testMessage.textContent = '';
  testNext.classList.add('hidden');
  testSubmit.classList.remove('hidden');
  testSummary.classList.add('hidden');
  testAnswer.classList.remove('hidden');
  testAnswer.disabled = false;
  testRecord.classList.remove('hidden');
  testListen.classList.remove('hidden');
  testMeaning.textContent = '';
  testExample.textContent = '';
  testInputLabel.textContent = 'Gõ từ';
  testModeLabel.textContent = '';
  testStageLabel.textContent = '';
  stopVoiceRecognition();
  setTestSessionVisibility(false);
  sessionActive = false;
}

function moveToNextLearnWord() {
  if (currentLearnIndex + 1 >= learnQueue.length) {
    learnMessage.textContent = 'Hoàn tất buổi luyện viết. Chúc mừng!';
    setTimeout(resetLearnSession, 1200);
    return;
  }
  currentLearnIndex += 1;
  learnAnswer.value = '';
  learnMessage.textContent = '';
  isHiddenWord = false;
  updateLearnDisplay();
  speakLearnWord(learnQueue[currentLearnIndex]);
  learnAnswer.focus();
}

async function processLearnCheck() {
  const answer = learnAnswer.value;
  if (!answer.trim()) {
    learnMessage.textContent = 'Vui lòng nhập từ để kiểm tra.';
    return;
  }

  const entry = learnQueue[currentLearnIndex];
  const correct = isLearnAnswerCorrect(answer, entry);
  const updateFields = { writeCount: entry.writeCount + 1 };

  if (correct) {
    updateFields.correct = entry.correct + 1;
    await updateVocabularyEntry(entry.word, updateFields);
    learnMessage.textContent = 'Chính xác! Tiếp tục nào.';
    moveToNextLearnWord();
  } else {
    updateFields.wrong = entry.wrong + 1;
    await updateVocabularyEntry(entry.word, updateFields);
    learnMessage.textContent = `Sai rồi. Đáp án: ${entry.word}`;
    displayWord.textContent = entry.word;
    learnNextState();
  }

  renderWordList();
}

function learnNextState() {
  learnAnswer.value = '';
  testTimeout(() => {
    learnAnswer.focus();
  }, 50);
}

async function processLearnKnown() {
  const entry = learnQueue[currentLearnIndex];
  await updateVocabularyEntry(entry.word, { learned: true });
  renderWordList();
  moveToNextLearnWord();
}

function processLearnToggle() {
  isHiddenWord = toggleWordVisibility(isHiddenWord);
  updateLearnDisplay();
}

function replayLearnWord() {
  const currentEntry = learnQueue[currentLearnIndex];
  if (!currentEntry) {
    return;
  }

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  clearLearnSpellingAnimation();
  renderLearnWordDisplay(currentEntry, -1);
  speakLearnWord(currentEntry);
}

function processTestListening() {
  const entry = testQueue[currentTestIndex];
  if (!entry) {
    return;
  }

  if (selectedTestMode === 'speaking') {
    speakSpeakingPrompt(entry);
    testMessage.textContent = 'Đang phát âm...';
  } else if (selectedDictationMode === 'example') {
    speakText(entry.example);
    testMessage.textContent = 'Đã phát âm câu ví dụ.';
  } else {
    speakText(entry.word);
    testMessage.textContent = 'Đã phát âm từ.';
  }
}

// Capture spoken input for the speaking test using Web Speech Recognition when available.
function processTestRecording() {
  const entry = testQueue[currentTestIndex];
  if (selectedTestMode !== 'speaking' || !entry) {
    return;
  }

  const SpeechRecognition = getSpeechRecognitionConstructor();
  if (!SpeechRecognition) {
    testMessage.textContent = getSpeechRecognitionUnsupportedMessage();
    testRecord.disabled = true;
    console.error('SpeechRecognition is not available in this browser.', window);
    return;
  }

  testMessage.textContent = 'Đang nghe...';
  testRecord.textContent = '🎤 Listening...';

  if (testRecognition) {
    testRecognition.stop();
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  void requestMicrophoneAccess().then(({ success, reason, error }) => {
    if (!success) {
      testMessage.textContent = reason === 'NotAllowedError' || reason === 'PermissionDeniedError' || reason === 'not-allowed'
        ? 'Bạn cần cấp quyền Microphone để sử dụng Speaking Test.'
        : getSpeechRecognitionUnsupportedMessage();
      testRecord.textContent = '🎤 Record';
      console.error('Microphone access request was denied or unavailable.', { reason, error });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = getSpeechLanguageCode(getCurrentLanguage());
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(' ');
      const expected = normalizeText(getSpeakingPromptText(selectedSpeakingMode, entry));
      const actual = normalizeText(transcript);
      const correct = actual === expected;

      if (correct) {
        testScore += 1;
        testMessage.textContent = '✅ Chính xác.';
        testListen.disabled = true;
        testRecord.disabled = true;
        testSubmit.disabled = true;
        testNext.classList.remove('hidden');
        testRecord.textContent = '🎤 Record';
        void playCorrectSound();
        startSpeakingAutoNext();
      } else {
        testWrong += 1;
        testMessage.textContent = `❌ Incorrect. Đáp án đúng: ${expected}`;
        testNext.classList.add('hidden');
        playWrongSound();
      }

      testRecord.textContent = '🎤 Record';
    };

    recognition.onerror = (event) => {
      const errorCode = event?.error || 'unknown';
      console.error('Speech recognition error', { errorCode, event });
      testMessage.textContent = getSpeechRecognitionErrorMessage(errorCode);
      testRecord.textContent = '🎤 Record';
    };

    recognition.onend = () => {
      testRecognition = null;
      testRecord.textContent = '🎤 Record';
    };

    testRecognition = recognition;
    recognition.start();
  });
}

// Validate the user's typed response for the dictation flow and update scores.
function processTestSubmission() {
  const entry = testQueue[currentTestIndex];
  if (!entry || selectedTestMode !== 'dictation') {
    return;
  }

  const answer = testAnswer.value.trim();
  if (!answer) {
    testMessage.textContent = 'Nhập câu trả lời để kiểm tra.';
    return;
  }

  let correct = false;
  let feedback = '';

  if (selectedDictationMode === 'example') {
    correct = normalizeText(answer) === normalizeText(entry.example);
    feedback = correct ? '✅ Chính xác.' : '❌ Sai. Hãy thử lại.';
  } else {
    correct = normalizeText(answer) === normalizeText(entry.word);
    feedback = correct ? '✅ Chính xác.' : '❌ Sai. Hãy thử lại.';
  }

  if (correct) {
    testScore += 1;
    testMessage.textContent = feedback;
    playCorrectSound();
    testSubmit.classList.add('hidden');
    testNext.classList.add('hidden');
    testAnswer.disabled = true;
    testAnswer.setAttribute('aria-disabled', 'true');
    testSubmit.disabled = true;
    testListen.disabled = true;
    if (selectedTestMode === 'dictation') {
      startAutoNext();
    }
  } else {
    dictationWrongAttempts += 1;
    testWrong += 1;
    testMessage.textContent = feedback;
    playWrongSound();
    testAnswer.focus();
  }
}

function proceedToNextTestQuestion() {
  if (isTestTransitioning) {
    return;
  }

  isTestTransitioning = true;
  cancelAutoNext();
  cancelSpeakingAutoNext();

  if (selectedTestMode === 'dictation') {
    dictationStage = 'word';
  }

  if (currentTestIndex + 1 >= testQueue.length) {
    showTestSummary();
    isTestTransitioning = false;
    return;
  }

  currentTestIndex += 1;
  updateTestDisplay();
  isTestTransitioning = false;
}

function startLearnSession() {
  const selectedInput = document.querySelector('input[name="learn-word"]:checked');
  const count = Number(learnCount.value);

  if (!selectedInput) {
    learnFeedback.textContent = 'Vui lòng chọn một từ để luyện.';
    return;
  }

  const selectedWord = selectedInput.value;
  const wordEntry = findVocabularyEntry(selectedWord);
  if (!wordEntry) {
    learnFeedback.textContent = 'Từ đã chọn không tồn tại. Vui lòng tải lại.';
    return;
  }

  learnQueue = buildLearnQueue([wordEntry], count);
  if (!learnQueue.length) {
    learnFeedback.textContent = 'Không thể bắt đầu luyện. Thêm từ mới.';
    return;
  }

  currentLearnIndex = 0;
  isHiddenWord = false;
  selectedLearnReadingMode = normalizeLearnReadingMode(learnReadingMode?.value || selectedLearnReadingMode);
  learnFeedback.textContent = '';
  setLearnSessionVisibility(true);
  updateLearnDisplay();
  speakLearnWord(learnQueue[currentLearnIndex]);
  learnAnswer.value = '';
  testTimeout(() => learnAnswer.focus(), 120);
}

function startTestSession() {
  cancelAutoNext();
  cancelSpeakingAutoNext();
  if (!selectedTestMode) {
    testFeedback.textContent = 'Vui lòng chọn một chế độ Test trước.';
    return;
  }

  const words = getWordsFromFilters(testTopicFilter.value, testSubtopicFilter.value);
  if (!words.length) {
    testFeedback.textContent = 'Không có từ để test theo bộ lọc hiện tại. Vui lòng chọn lại.';
    return;
  }

  testQueue = buildTestQueue(words);
  currentTestIndex = 0;
  isTestTransitioning = false;
  testScore = 0;
  testWrong = 0;
  dictationWrongAttempts = 0;
  dictationStage = 'word';
  testFeedback.textContent = '';
  setTestSessionVisibility(true);
  updateTestDisplay();
  testSummary.classList.add('hidden');
  testSubmit.classList.remove('hidden');
  testNext.classList.add('hidden');
  testMessage.textContent = '';
  testAnswer.value = '';
  sessionActive = true;
}

function updateDuplicateStatus() {
  const currentWord = inputWord.value.trim();
  if (!currentWord) {
    duplicateStatus.classList.add('hidden');
    duplicateCard.classList.add('hidden');
    duplicateStatus.textContent = '';
    addSubmitButton.disabled = false;
    return;
  }

  const duplicateEntry = findDuplicateVocabularyEntry(getVocabularySnapshot(), currentWord, editingWord || '');
  const duplicateMeaningValue = getMeaningDisplayValue(duplicateEntry, getCurrentMeaningLanguage());
  if (duplicateEntry) {
    duplicateStatus.classList.remove('hidden');
    duplicateStatus.classList.add('is-duplicate');
    duplicateStatus.classList.remove('is-new');
    duplicateStatus.innerHTML = '<span class="duplicate-pill">⚠️ Từ này đã tồn tại trong bộ từ vựng</span>';
    duplicateCard.classList.remove('hidden');
    duplicateCard.innerHTML = `
      <div class="duplicate-card-top">
        <div>
          <h4>${duplicateEntry.word}</h4>
          <p>${duplicateEntry.topic} / ${duplicateEntry.subTopic}</p>
        </div>
        <div class="duplicate-actions">
          <button type="button" class="secondary-button duplicate-action-button" id="duplicate-view">👁 Xem</button>
          <button type="button" class="secondary-button duplicate-action-button" id="duplicate-edit">✏ Chỉnh sửa</button>
        </div>
      </div>
      <div class="duplicate-card-details">
        <p><strong>${getActiveDisplayConfig().meaningLabel}:</strong> ${duplicateMeaningValue}</p>
        <p><strong>Example:</strong> ${duplicateEntry.example}</p>
        <p><strong>IPA:</strong> ${duplicateEntry.ipa || '—'}</p>
      </div>
    `;
    duplicateCard.querySelector('#duplicate-view')?.addEventListener('click', () => scrollToWordCard(duplicateEntry.word));
    duplicateCard.querySelector('#duplicate-edit')?.addEventListener('click', () => {
      startEditMode(duplicateEntry);
      showPage('add');
    });
    addSubmitButton.disabled = true;
    return;
  }

  duplicateStatus.classList.remove('hidden');
  duplicateStatus.classList.remove('is-duplicate');
  duplicateStatus.classList.add('is-new');
  duplicateStatus.innerHTML = '<span class="duplicate-pill duplicate-pill-new">🟢 New Word</span>';
  duplicateCard.classList.add('hidden');
  duplicateCard.innerHTML = '';
  addSubmitButton.disabled = false;
}

function getVocabularySnapshot() {
  if (!vocabulary.length) {
    vocabulary = loadVocabulary();
  }
  return vocabulary;
}

function scrollToWordCard(word) {
  const targetCard = Array.from(wordList.querySelectorAll('.word-item')).find((card) => normalizeWordKey(card.dataset.word) === normalizeWordKey(word));
  if (!targetCard) {
    return;
  }

  targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  targetCard.classList.add('is-highlighted');
  if (duplicateHighlightTimer) {
    window.clearTimeout(duplicateHighlightTimer);
  }
  duplicateHighlightTimer = window.setTimeout(() => {
    targetCard.classList.remove('is-highlighted');
  }, 2400);
}

function renderWordSuggestions() {
  const query = inputWord.value.trim();
  const suggestions = filterWordSuggestions(getVocabularySnapshot(), query, 10);
  wordSuggestionItems = suggestions;

  if (!query || !suggestions.length) {
    hideWordSuggestions();
    return;
  }

  wordSuggestions.innerHTML = suggestions
    .map(
      (entry, index) => `
        <li class="suggestion-item ${index === activeSuggestionIndex ? 'active' : ''}" role="option" data-word="${entry.word}">
          ${entry.word}
        </li>
      `,
    )
    .join('');

  wordSuggestions.classList.remove('hidden');
}

function hideWordSuggestions() {
  wordSuggestions.classList.add('hidden');
  wordSuggestions.innerHTML = '';
  activeSuggestionIndex = -1;
  wordSuggestionItems = [];
}

function selectSuggestion() {
  const targetIndex = activeSuggestionIndex >= 0 ? activeSuggestionIndex : 0;
  const selected = wordSuggestionItems[targetIndex];
  if (!selected) {
    return false;
  }

  inputWord.value = selected.word;
  hideWordSuggestions();
  return true;
}

function startEditMode(entry) {
  editingWord = entry.word;
  addSubmitButton.textContent = 'Cập nhật';
  addSubmitButton.disabled = false;
  addCancelButton.classList.remove('hidden');
  addFeedback.textContent = '';

  const topic = entry.topic || DEFAULT_TOPIC;
  const subTopic = entry.subTopic || DEFAULT_SUBTOPIC;
  refreshAddFormTopicList(topic);
  inputTopic.value = topic;
  refreshAddFormSubtopicList(topic, subTopic);
  inputSubtopic.value = subTopic;
  inputType.value = entry.type || DEFAULT_TYPE;
  inputWord.value = entry.word || '';
  inputMeaning.value = getMeaningValue(entry, getCurrentMeaningLanguage()) || '';
  inputIpa.value = entry.ipa || '';
  inputExample.value = entry.example || '';
  hideWordSuggestions();
  updateDuplicateStatus();
  inputWord.focus();
}

function bindEvents() {
  pageButtons.forEach((button) => {
    button.addEventListener('click', () => showPage(button.dataset.page));
  });

  addForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const word = inputWord.value.trim();
    const meaning = inputMeaning.value.trim();
    const meanings = buildMeaningMap((editingWord ? vocabulary.find((item) => normalizeWordKey(item.word) === normalizeWordKey(editingWord)) : null)?.meanings || {}, getCurrentMeaningLanguage(), meaning);
    const example = inputExample.value.trim();
    let ipa = inputIpa.value.trim();
    let topic = inputTopic.value;
    let subTopic = inputSubtopic.value;
    let type = inputType?.value || DEFAULT_TYPE;

    if (!word || !meaning || !example) {
      addFeedback.textContent = 'Vui lòng nhập đủ thông tin.';
      return;
    }

    if (topic === ADD_TOPIC_VALUE) {
      const newTopic = promptForNewTopic();
      if (!newTopic) {
        return;
      }
      topic = newTopic;
    }

    // Check if subtopic is in "not selected" state
    if (subTopic === SUBTOPIC_NOT_SELECTED_VALUE) {
      addFeedback.textContent = 'Vui lòng chọn Sub Topic.';
      return;
    }

    if (subTopic === ADD_SUBTOPIC_VALUE) {
      const activeTopic = topic === ADD_TOPIC_VALUE ? DEFAULT_TOPIC : topic;
      const newSubTopic = promptForNewSubTopic(activeTopic);
      if (!newSubTopic) {
        return;
      }
      subTopic = newSubTopic;
    }

    if (!ipa) {
      ipa = await fetchWordIpa(word);
    }

    const duplicateEntry = findDuplicateVocabularyEntry(getVocabularySnapshot(), word, editingWord || '');
    if (duplicateEntry) {
      addFeedback.textContent = 'Word already exists.';
      updateDuplicateStatus();
      return;
    }

    try {
      if (editingWord) {
        await updateVocabularyEntryByWord(editingWord, { word, meaning, example, ipa, topic, subTopic, type, meanings });
        addFeedback.textContent = 'Cập nhật thành công.';
      } else {
        await addVocabularyEntry({ word, meaning, example, ipa, topic, subTopic, type, meanings });
        addFeedback.textContent = 'Lưu từ thành công.';
      }

      resetAddForm();
      refreshFilterControls();
      renderWordList();
      renderLearnSelection();
      renderTestState();
    } catch (error) {
      addFeedback.textContent = error.message;
    }
  });

  addCancelButton.addEventListener('click', () => {
    resetAddForm();
  });

  inputWord.addEventListener('input', () => {
    activeSuggestionIndex = -1;
    renderWordSuggestions();
    updateDuplicateStatus();
  });

  inputWord.addEventListener('focus', () => {
    renderWordSuggestions();
    updateDuplicateStatus();
  });

  inputWord.addEventListener('blur', () => {
    window.setTimeout(() => {
      hideWordSuggestions();
    }, 140);
  });

  inputWord.addEventListener('keydown', (event) => {
    if (!wordSuggestionItems.length) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      activeSuggestionIndex = (activeSuggestionIndex + 1) % wordSuggestionItems.length;
      renderWordSuggestions();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      activeSuggestionIndex = activeSuggestionIndex <= 0 ? wordSuggestionItems.length - 1 : activeSuggestionIndex - 1;
      renderWordSuggestions();
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      if (selectSuggestion()) {
        return;
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      hideWordSuggestions();
    }
  });

  wordSuggestions.addEventListener('mousedown', (event) => {
    const suggestionItem = event.target.closest('.suggestion-item');
    if (!suggestionItem) {
      return;
    }

    event.preventDefault();
    inputWord.value = suggestionItem.dataset.word;
    hideWordSuggestions();
    inputMeaning.focus();
  });

  wordList.addEventListener('click', async (event) => {
    const editButton = event.target.closest('.edit-word');
    if (editButton) {
      const wordItem = editButton.closest('.word-item');
      if (!wordItem) {
        return;
      }
      const entryToEdit = vocabulary.find((item) => normalizeWordKey(item.word) === normalizeWordKey(wordItem.dataset.word));
      if (entryToEdit) {
        startEditMode(entryToEdit);
      }
      return;
    }

    const deleteButton = event.target.closest('.delete-word');
    if (!deleteButton) {
      return;
    }
    const wordItem = deleteButton.closest('.word-item');
    if (!wordItem) {
      return;
    }
    const wordToDelete = wordItem.dataset.word;
    await removeVocabularyEntry(wordToDelete);
    resetAddForm();
    refreshFilterControls();
    renderWordList();
    renderLearnSelection();
    renderTestState();
  });

  inputTopic.addEventListener('focus', () => {
    inputTopic.dataset.previousValue = inputTopic.value;
  });

  inputTopic.addEventListener('change', async () => {
    updateDuplicateStatus();
    if (inputTopic.value === ADD_TOPIC_VALUE) {
      const previousTopic = inputTopic.dataset.previousValue || DEFAULT_TOPIC;
      const newTopic = await promptForNewTopic();
      if (newTopic) {
        refreshAddFormTopicList(newTopic);
        inputTopic.value = newTopic;
        loadAddFormSubtopicListNotSelected(newTopic);
      } else {
        refreshAddFormTopicList(previousTopic);
        inputTopic.value = previousTopic;
      }
      return;
    }
    // When user actively changes to a different topic, reset subtopic to "not selected" state
    loadAddFormSubtopicListNotSelected(inputTopic.value);
  });

  inputSubtopic.addEventListener('focus', () => {
    inputSubtopic.dataset.previousValue = inputSubtopic.value;
  });

  inputSubtopic.addEventListener('change', async () => {
    updateDuplicateStatus();
    if (inputSubtopic.value === ADD_SUBTOPIC_VALUE) {
      const topicName = inputTopic.value === ADD_TOPIC_VALUE ? DEFAULT_TOPIC : inputTopic.value;
      const previousSubTopic = inputSubtopic.dataset.previousValue || DEFAULT_SUBTOPIC;
      const newSubTopic = await promptForNewSubTopic(topicName);
      if (newSubTopic) {
        refreshAddFormSubtopicList(topicName, newSubTopic);
        inputSubtopic.value = newSubTopic;
      } else {
        refreshAddFormSubtopicList(topicName, previousSubTopic);
        inputSubtopic.value = previousSubTopic;
      }
    }
  });

  document.getElementById('rename-topic')?.addEventListener('click', async () => {
    const topicName = getActiveTopicValue();
    const newTopicName = promptForRenameTopic(topicName);
    if (!newTopicName) {
      return;
    }

    try {
      await renameTopic(topicName, newTopicName);
      addFeedback.textContent = 'Đổi tên Topic thành công.';
      refreshAddFormTopicList(newTopicName);
      refreshFilterControls();
      renderWordList();
      renderLearnSelection();
      renderTestState();
    } catch (error) {
      addFeedback.textContent = error.message;
    }
  });

  document.getElementById('delete-topic')?.addEventListener('click', async () => {
    const topicName = getActiveTopicValue();
    if (!topicName || !window.confirm(`Xóa Topic "${topicName}" và tất cả từ liên quan?`)) {
      return;
    }

    try {
      await deleteTopic(topicName);
      addFeedback.textContent = 'Topic đã được xóa.';
      refreshAddFormTopicList(DEFAULT_TOPIC);
      refreshFilterControls();
      renderWordList();
      renderLearnSelection();
      renderTestState();
    } catch (error) {
      addFeedback.textContent = error.message;
    }
  });

  document.getElementById('rename-subtopic')?.addEventListener('click', async () => {
    const topicName = getActiveTopicValue();
    const subTopicName = getActiveSubTopicValue();
    const newSubTopicName = promptForRenameSubTopic(topicName, subTopicName);
    if (!newSubTopicName) {
      return;
    }

    try {
      await renameSubTopic(topicName, subTopicName, newSubTopicName);
      addFeedback.textContent = 'Đổi tên Sub Topic thành công.';
      refreshAddFormSubtopicList(topicName, newSubTopicName);
      refreshFilterControls();
      renderWordList();
      renderLearnSelection();
      renderTestState();
    } catch (error) {
      addFeedback.textContent = error.message;
    }
  });

  document.getElementById('delete-subtopic')?.addEventListener('click', async () => {
    const topicName = getActiveTopicValue();
    const subTopicName = getActiveSubTopicValue();
    if (!subTopicName || !window.confirm(`Xóa Sub Topic "${subTopicName}" và tất cả từ liên quan?`)) {
      return;
    }

    try {
      await deleteSubTopic(topicName, subTopicName);
      addFeedback.textContent = 'Sub Topic đã được xóa.';
      refreshAddFormSubtopicList(topicName, DEFAULT_SUBTOPIC);
      refreshFilterControls();
      renderWordList();
      renderLearnSelection();
      renderTestState();
    } catch (error) {
      addFeedback.textContent = error.message;
    }
  });

  learnTopicFilter.addEventListener('change', () => {
    updateLearnFilterSubtopics();
    renderLearnSelection();
  });

  learnSubtopicFilter.addEventListener('change', () => {
    renderLearnSelection();
  });

  sortBySelect?.addEventListener('change', () => {
    renderWordList();
  });

  languageSelect?.addEventListener('change', async () => {
    setCurrentLanguage(languageSelect.value);
    renderLanguageSelector();
    updateDynamicLabels();
    await ensureVocabularyLoaded();
    await ensurePreferencesLoaded();
    refreshAddFormTopicList();
    refreshFilterControls();
    renderWordList();
    renderLearnSelection();
    renderTestState();
    updateDuplicateStatus();
  });

  meaningLanguageSelect?.addEventListener('change', () => {
    setCurrentMeaningLanguage(meaningLanguageSelect.value);
    renderMeaningLanguageSelector();
    updateDynamicLabels();
    renderWordList();
    if (learnQueue[currentLearnIndex]) {
      updateLearnDisplay();
    }
  });

  filterTypeSelect?.addEventListener('change', () => {
    renderWordList();
  });

  testTopicFilter.addEventListener('change', () => {
    updateTestFilterSubtopics();
    renderTestState();
  });

  testSubtopicFilter.addEventListener('change', () => {
    renderTestState();
  });

  learnReadingMode?.addEventListener('change', () => {
    selectedLearnReadingMode = normalizeLearnReadingMode(learnReadingMode.value);
    if (sessionActive && learnQueue[currentLearnIndex]) {
      speakLearnWord(learnQueue[currentLearnIndex]);
    }
  });

  learnStart.addEventListener('click', startLearnSession);
  learnCheck.addEventListener('click', processLearnCheck);
  learnKnown.addEventListener('click', processLearnKnown);
  learnToggle.addEventListener('click', processLearnToggle);
  learnReplay.addEventListener('click', replayLearnWord);

  testModeSpeaking.addEventListener('click', () => setSelectedTestMode('speaking'));
  testModeDictation.addEventListener('click', () => setSelectedTestMode('dictation'));
  testStart.addEventListener('click', startTestSession);
  testListen.addEventListener('click', processTestListening);
  testRecord.addEventListener('click', processTestRecording);
  testSubmit.addEventListener('click', processTestSubmission);
  testNext.addEventListener('click', proceedToNextTestQuestion);
  soundToggle?.addEventListener('click', () => {
    setSoundEnabled(!soundEnabled);
  });
  testRestart.addEventListener('click', () => {
    resetTestSession();
    testFeedback.textContent = 'Bạn có thể bắt đầu lại test bất cứ lúc nào.';
  });

  speakingModeSelect?.addEventListener('change', () => {
    selectedSpeakingMode = normalizeSpeakingMode(speakingModeSelect.value);
    if (selectedTestMode === 'speaking' && testQueue[currentTestIndex]) {
      updateTestDisplay();
    }
  });

  dictationModeSelect?.addEventListener('change', () => {
    selectedDictationMode = normalizeDictationMode(dictationModeSelect.value);
    if (selectedTestMode === 'dictation' && testQueue[currentTestIndex]) {
      updateTestDisplay();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && document.activeElement === learnAnswer) {
      event.preventDefault();
      processLearnCheck();
    }

    if (event.key === 'Enter' && document.activeElement === testAnswer) {
      event.preventDefault();
      if (testSubmit.classList.contains('hidden')) {
        proceedToNextTestQuestion();
      } else {
        processTestSubmission();
      }
    }
  });
}


async function initializeApp() {
  bindEvents();
  initializeAudio();
  renderLanguageSelector();
  renderMeaningLanguageSelector();
  updateDynamicLabels();
  window.addEventListener('vocabulary-storage-updated', () => {
    // Preserve current topic and subtopic selections
    const currentTopic = inputTopic.value && inputTopic.value !== ADD_TOPIC_VALUE ? inputTopic.value : DEFAULT_TOPIC;
    const currentSubTopic = inputSubtopic.value && inputSubtopic.value !== SUBTOPIC_NOT_SELECTED_VALUE ? inputSubtopic.value : DEFAULT_SUBTOPIC;
    
    refreshAddFormTopicList(currentTopic);
    
    // Only refresh subtopic if the topic still exists, otherwise reset to default
    const topics = getStoredTopics();
    if (!topics.some((t) => t === currentTopic)) {
      refreshAddFormTopicList(DEFAULT_TOPIC);
    } else {
      refreshAddFormSubtopicList(currentTopic, currentSubTopic);
    }
    
    refreshFilterControls();
    renderWordList();
    renderLearnSelection();
    renderTestState();
    updateDuplicateStatus();
  });
  await migrateLocalStorageToFirestore();
  await ensureVocabularyLoaded();
  await ensurePreferencesLoaded();
  await loadSoundSetting();
  renderLanguageSelector();
  renderMeaningLanguageSelector();
  updateDynamicLabels();
  refreshAddFormTopicList();
  refreshFilterControls();
  renderWordList();
  renderLearnSelection();
  renderTestState();
  setSelectedTestMode('');
  speakingModeWrapper?.classList.add('hidden');
  dictationModeWrapper?.classList.add('hidden');
  showPage('add');
}

void initializeApp();
