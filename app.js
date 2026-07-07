import {
  addVocabularyEntry,
  findDuplicateVocabularyEntry,
  findVocabularyEntry,
  filterVocabularyByTopic,
  getUniqueSubTopics,
  getUniqueTopics,
  loadSubTopics,
  loadTopics,
  loadVocabulary,
  removeVocabularyEntry,
  saveSubTopics,
  saveTopics,
  updateVocabularyEntry,
  updateVocabularyEntryByWord,
  DEFAULT_TOPIC,
  DEFAULT_SUBTOPIC,
  normalizeWordKey,
} from './storage.js';
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
const ALL_FILTER_VALUE = '';

const pageButtons = document.querySelectorAll('.menu-button');
const pages = document.querySelectorAll('.page');
const addForm = document.getElementById('add-form');
const inputTopic = document.getElementById('input-topic');
const inputSubtopic = document.getElementById('input-subtopic');
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

// ===== SOUND SETTINGS =====
const SOUND_ENABLED_KEY = 'soundEnabled';
const SOUND_ENABLED_DEFAULT = true;
const SOUND_VOLUME = 0.6;
const CORRECT_SOUND_PATH = 'sounds/correct.mp3';
const WRONG_SOUND_PATH = 'sounds/wrong.mp3';

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

function loadSoundSetting() {
  try {
    const storedValue = localStorage.getItem(SOUND_ENABLED_KEY);
    soundEnabled = storedValue === null ? SOUND_ENABLED_DEFAULT : JSON.parse(storedValue);
  } catch (error) {
    soundEnabled = SOUND_ENABLED_DEFAULT;
  }
  updateSoundToggleLabel();
}

function setSoundEnabled(enabled) {
  soundEnabled = enabled;
  localStorage.setItem(SOUND_ENABLED_KEY, JSON.stringify(soundEnabled));
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

function resetAddForm() {
  addForm.reset();
  editingWord = null;
  addSubmitButton.textContent = 'Lưu từ';
  addSubmitButton.disabled = false;
  addCancelButton.classList.add('hidden');
  addFeedback.textContent = '';
  refreshAddFormTopicList(DEFAULT_TOPIC);
  hideWordSuggestions();
  updateDuplicateStatus();
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

function addTopicToStorage(topic) {
  const topics = getStoredTopics();
  const normalizedTopic = topic.trim();
  const exists = topics.some((item) => item.toLowerCase() === normalizedTopic.toLowerCase());
  if (exists) {
    throw new Error('Topic đã tồn tại.');
  }
  saveTopics([...topics, normalizedTopic]);
}

function addSubTopicToStorage(topic, subTopic) {
  const normalizedTopic = topic.trim();
  const normalizedSubTopic = subTopic.trim();
  const subTopics = getStoredSubTopics(normalizedTopic);
  const exists = subTopics.some((item) => item.toLowerCase() === normalizedSubTopic.toLowerCase());
  if (exists) {
    throw new Error('Sub Topic đã tồn tại.');
  }
  saveSubTopics([...subTopics, normalizedSubTopic], normalizedTopic);
}

function promptForNewTopic() {
  const topicName = window.prompt('Nhập tên Topic mới:');
  if (!topicName || !topicName.trim()) {
    return null;
  }

  const normalizedTopic = topicName.trim();
  try {
    addTopicToStorage(normalizedTopic);
    addFeedback.textContent = '';
    return normalizedTopic;
  } catch (error) {
    addFeedback.textContent = error.message;
    return null;
  }
}

function promptForNewSubTopic(topic) {
  const subTopicName = window.prompt('Nhập tên Sub Topic mới:');
  if (!subTopicName || !subTopicName.trim()) {
    return null;
  }

  const normalizedSubTopic = subTopicName.trim();
  try {
    addSubTopicToStorage(topic, normalizedSubTopic);
    addFeedback.textContent = '';
    return normalizedSubTopic;
  } catch (error) {
    addFeedback.textContent = error.message;
    return null;
  }
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

function renderWordList() {
  const words = loadVocabulary();
  vocabulary = words;
  wordList.innerHTML = words.length
    ? words
        .map(
          (entry) => `
            <div class="word-item" data-word="${entry.word}">
              <div>
                <h3>${entry.word}</h3>
                <p><strong>Topic:</strong> ${entry.topic}</p>
                <p><strong>Sub Topic:</strong> ${entry.subTopic}</p>
                <p><strong>Meaning:</strong> ${entry.meaning}</p>
                <p><strong>Example:</strong> ${entry.example}</p>
                <p><strong>IPA:</strong> ${entry.ipa || '—'}</p>
                <p><strong>Trạng thái:</strong> ${entry.learned ? 'Đã thuộc' : 'Chưa thuộc'}</p>
              </div>
              <div class="word-actions">
                <button type="button" class="edit-word secondary-button">✏ Edit</button>
                <button type="button" class="delete-word">🗑 Delete</button>
              </div>
            </div>
          `,
        )
        .join('')
    : '<p class="feedback">Chưa có từ nào. Thêm từ ngay để bắt đầu học.</p>';
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
  displayMeaning.textContent = currentEntry.meaning;
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
    const utterance = new SpeechSynthesisUtterance(entry.word);
    utterance.lang = 'en-US';
    utterance.rate = 0.8;
    utterance.pitch = 1;
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

    const letterUtterance = new SpeechSynthesisUtterance(letters[index]);
    letterUtterance.lang = 'en-US';
    letterUtterance.rate = 0.8;
    letterUtterance.pitch = 1;
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
          const wholeWordUtterance = new SpeechSynthesisUtterance(entry.word);
          wholeWordUtterance.lang = 'en-US';
          wholeWordUtterance.rate = 0.8;
          wholeWordUtterance.pitch = 1;
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

function isSpeechRecognitionSupported() {
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

// Toggle the active test mode between speaking and dictation.
function setSelectedTestMode(mode) {
  selectedTestMode = mode;
  selectedSpeakingMode = normalizeSpeakingMode(speakingModeSelect?.value || selectedSpeakingMode);
  selectedDictationMode = normalizeDictationMode(dictationModeSelect?.value || selectedDictationMode);
  testModeSpeaking.classList.toggle('active-mode', mode === 'speaking');
  testModeDictation.classList.toggle('active-mode', mode === 'dictation');
  speakingModeWrapper?.classList.toggle('hidden', mode !== 'speaking');
  dictationModeWrapper?.classList.toggle('hidden', mode !== 'dictation');

  if (mode === 'speaking' && !isSpeechRecognitionSupported()) {
    testRecord.disabled = true;
    testModeHint.textContent = 'Trình duyệt không hỗ trợ Speech Recognition.';
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
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = rate;
  utterance.pitch = 1;
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
  const utterance = new SpeechSynthesisUtterance(promptText);
  utterance.lang = 'en-US';
  utterance.rate = 0.8;
  utterance.pitch = 1;
  synth.speak(utterance);
}

function updateTestProgress() {
  const totalQuestions = Math.max(testQueue.length, 1);
  testCounter.textContent = `Câu ${currentTestIndex + 1} / ${testQueue.length}`;
  const progressPercent = Math.round(((currentTestIndex + 1) / totalQuestions) * 100);
  testProgress.style.width = `${progressPercent}%`;
}

function showTestSummary() {
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

    if (!isSpeechRecognitionSupported()) {
      testRecord.disabled = true;
      testMessage.textContent = 'Trình duyệt không hỗ trợ Speech Recognition.';
    } else {
      testRecord.disabled = false;
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
    testAnswer.value = '';
    testRecord.classList.add('hidden');
    testSubmit.classList.remove('hidden');
    testNext.classList.add('hidden');
    testListen.classList.remove('hidden');
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

function processLearnCheck() {
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
    updateVocabularyEntry(entry.word, updateFields);
    learnMessage.textContent = 'Chính xác! Tiếp tục nào.';
    moveToNextLearnWord();
  } else {
    updateFields.wrong = entry.wrong + 1;
    updateVocabularyEntry(entry.word, updateFields);
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

function processLearnKnown() {
  const entry = learnQueue[currentLearnIndex];
  updateVocabularyEntry(entry.word, { learned: true });
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

  if (!isSpeechRecognitionSupported()) {
    testMessage.textContent = 'Trình duyệt không hỗ trợ Speech Recognition.';
    testRecord.disabled = true;
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  testMessage.textContent = 'Đang nghe...';
  testRecord.textContent = '🎤 Listening...';

  if (testRecognition) {
    testRecognition.stop();
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
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
      testMessage.textContent = '✅ Correct';
      playCorrectSound();
    } else {
      testWrong += 1;
      testMessage.textContent = `❌ Incorrect. Đáp án đúng: ${expected}`;
      playWrongSound();
    }

    testNext.classList.remove('hidden');
    testRecord.textContent = '🎤 Record';
  };

  recognition.onerror = () => {
    testMessage.textContent = 'Trình duyệt không hỗ trợ Speech Recognition.';
    testRecord.textContent = '🎤 Record';
  };

  recognition.onend = () => {
    testRecognition = null;
    testRecord.textContent = '🎤 Record';
  };

  testRecognition = recognition;
  recognition.start();
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
    testNext.classList.remove('hidden');
    testAnswer.disabled = true;
  } else {
    dictationWrongAttempts += 1;
    testWrong += 1;
    testMessage.textContent = feedback;
    playWrongSound();
    testAnswer.focus();
  }
}

function proceedToNextTestQuestion() {
  if (selectedTestMode === 'dictation') {
    dictationStage = 'word';
  }

  if (currentTestIndex + 1 >= testQueue.length) {
    showTestSummary();
    return;
  }

  currentTestIndex += 1;
  updateTestDisplay();
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
        <p><strong>Meaning:</strong> ${duplicateEntry.meaning}</p>
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
  inputWord.value = entry.word || '';
  inputMeaning.value = entry.meaning || '';
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
    const example = inputExample.value.trim();
    let ipa = inputIpa.value.trim();
    let topic = inputTopic.value;
    let subTopic = inputSubtopic.value;

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
        updateVocabularyEntryByWord(editingWord, { word, meaning, example, ipa, topic, subTopic });
        addFeedback.textContent = 'Cập nhật thành công.';
      } else {
        addVocabularyEntry({ word, meaning, example, ipa, topic, subTopic });
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

  wordList.addEventListener('click', (event) => {
    const editButton = event.target.closest('.edit-word');
    if (editButton) {
      const wordItem = editButton.closest('.word-item');
      if (!wordItem) {
        return;
      }
      const entryToEdit = findVocabularyEntry(wordItem.dataset.word);
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
    removeVocabularyEntry(wordToDelete);
    resetAddForm();
    refreshFilterControls();
    renderWordList();
    renderLearnSelection();
    renderTestState();
  });

  inputTopic.addEventListener('focus', () => {
    inputTopic.dataset.previousValue = inputTopic.value;
  });

  inputTopic.addEventListener('change', () => {
    updateDuplicateStatus();
    if (inputTopic.value === ADD_TOPIC_VALUE) {
      const previousTopic = inputTopic.dataset.previousValue || DEFAULT_TOPIC;
      const newTopic = promptForNewTopic();
      if (newTopic) {
        refreshAddFormTopicList(newTopic);
        inputTopic.value = newTopic;
        refreshAddFormSubtopicList(newTopic);
      } else {
        refreshAddFormTopicList(previousTopic);
        inputTopic.value = previousTopic;
      }
      return;
    }
    refreshAddFormSubtopicList(inputTopic.value);
  });

  inputSubtopic.addEventListener('focus', () => {
    inputSubtopic.dataset.previousValue = inputSubtopic.value;
  });

  inputSubtopic.addEventListener('change', () => {
    updateDuplicateStatus();
    if (inputSubtopic.value === ADD_SUBTOPIC_VALUE) {
      const topicName = inputTopic.value === ADD_TOPIC_VALUE ? DEFAULT_TOPIC : inputTopic.value;
      const previousSubTopic = inputSubtopic.dataset.previousValue || DEFAULT_SUBTOPIC;
      const newSubTopic = promptForNewSubTopic(topicName);
      if (newSubTopic) {
        refreshAddFormSubtopicList(topicName, newSubTopic);
        inputSubtopic.value = newSubTopic;
      } else {
        refreshAddFormSubtopicList(topicName, previousSubTopic);
        inputSubtopic.value = previousSubTopic;
      }
    }
  });

  learnTopicFilter.addEventListener('change', () => {
    updateLearnFilterSubtopics();
    renderLearnSelection();
  });

  learnSubtopicFilter.addEventListener('change', () => {
    renderLearnSelection();
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


function initializeApp() {
  bindEvents();
  initializeAudio();
  loadSoundSetting();
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

initializeApp();
