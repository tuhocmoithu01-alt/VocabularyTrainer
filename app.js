import {
  addVocabularyEntry,
  createVocabularyEntry,
  findVocabularyEntry,
  loadVocabulary,
  removeVocabularyEntry,
  saveVocabulary,
  updateVocabularyEntry,
} from './storage.js';
import { buildLearnQueue, formatLearnLabel, isLearnAnswerCorrect, toggleWordVisibility } from './learn.js';
import { buildTestQueue, isTestAnswerCorrect } from './test.js';

const pageButtons = document.querySelectorAll('.menu-button');
const pages = document.querySelectorAll('.page');
const addForm = document.getElementById('add-form');
const inputWord = document.getElementById('input-word');
const inputMeaning = document.getElementById('input-meaning');
const inputIpa = document.getElementById('input-ipa');
const inputExample = document.getElementById('input-example');
const addFeedback = document.getElementById('add-feedback');
const wordList = document.getElementById('word-list');
const learnSelection = document.getElementById('learn-selection');
const learnCount = document.getElementById('learn-count');
const learnStart = document.getElementById('learn-start');
const learnFeedback = document.getElementById('learn-feedback');
const learnSession = document.getElementById('learn-session');
const displayWord = document.getElementById('display-word');
const displayMeaning = document.getElementById('display-meaning');
const displayExample = document.getElementById('display-example');
const learnAnswer = document.getElementById('learn-answer');
const learnCheck = document.getElementById('learn-check');
const learnToggle = document.getElementById('learn-toggle');
const learnKnown = document.getElementById('learn-known');
const learnMessage = document.getElementById('learn-message');
const learnProgress = document.getElementById('learn-progress');
const sessionCounter = document.getElementById('session-counter');
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

let vocabulary = [];
let learnQueue = [];
let currentLearnIndex = 0;
let isHiddenWord = false;
let testQueue = [];
let currentTestIndex = 0;
let testScore = 0;
let testWrong = 0;
let selectedTestMode = '';
let dictationStage = 'word';
let testRecognition = null;
let sessionActive = false;

function showPage(pageName) {
  pages.forEach((page) => page.classList.toggle('active', page.id === `page-${pageName}`));
  pageButtons.forEach((button) => button.classList.toggle('active', button.dataset.page === pageName));
}

function resetAddForm() {
  addForm.reset();
  addFeedback.textContent = '';
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
                <p><strong>Meaning:</strong> ${entry.meaning}</p>
                <p><strong>Example:</strong> ${entry.example}</p>
                <p><strong>IPA:</strong> ${entry.ipa || '—'}</p>
                <p><strong>Trạng thái:</strong> ${entry.learned ? 'Đã thuộc' : 'Chưa thuộc'}</p>
              </div>
              <button type="button" class="delete-word">Xóa</button>
            </div>
          `,
        )
        .join('')
    : '<p class="feedback">Chưa có từ nào. Thêm từ ngay để bắt đầu học.</p>';
}

function renderLearnSelection() {
  const words = loadVocabulary();
  vocabulary = words;
  learnSelection.innerHTML = words.length
    ? words
        .map(
          (entry) => `
            <div class="select-item">
              <label>
                <input type="radio" name="learn-word" value="${entry.word}" />
                <span>${formatLearnLabel(entry)}</span>
              </label>
            </div>
          `,
        )
        .join('')
    : '<p class="feedback">Không có từ để luyện. Vui lòng thêm từ mới.</p>';
}

function renderTestState() {
  const words = loadVocabulary();
  vocabulary = words;
  testFeedback.textContent = words.length ? '' : 'Không có từ để test. Vui lòng thêm từ mới.';
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

function updateLearnDisplay() {
  const currentEntry = learnQueue[currentLearnIndex];
  displayMeaning.textContent = currentEntry.meaning;
  displayExample.textContent = currentEntry.example;
  displayWord.textContent = isHiddenWord ? '••••••' : currentEntry.word;
  learnToggle.textContent = isHiddenWord ? 'Hiện từ' : 'Ẩn từ';
  sessionCounter.textContent = `Từ ${currentLearnIndex + 1} / ${learnQueue.length}`;
  const progressPercent = Math.round(((currentLearnIndex + 1) / learnQueue.length) * 100);
  learnProgress.style.width = `${progressPercent}%`;
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
  testModeSpeaking.classList.toggle('active-mode', mode === 'speaking');
  testModeDictation.classList.toggle('active-mode', mode === 'dictation');

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

  const synth = window.speechSynthesis;
  synth.cancel();
  [entry.word, entry.word, entry.example].forEach((text, index) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.8;
    utterance.pitch = 1;
    if (index === 0) {
      utterance.rate = 0.74;
    }
    synth.speak(utterance);
  });
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
    testModeLabel.textContent = 'Mode: Speaking Test';
    testStageLabel.textContent = 'Pronunciation';
    testMeaning.textContent = 'Nghe từ rồi nói lại đúng như từ gốc.';
    testExample.textContent = `Từ: ${currentEntry.word} • Ví dụ: ${currentEntry.example}`;
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
      testMessage.textContent = 'Nhấn 🔊 Listen để nghe từ rồi bấm 🎤 Record để ghi âm.';
    }

    speakSpeakingPrompt(currentEntry);
  } else {
    testModeLabel.textContent = 'Mode: Dictation Test';
    testStageLabel.textContent = dictationStage === 'word' ? 'Stage 1: Word' : dictationStage === 'sentence' ? 'Stage 2: Sentence' : 'Stage 3: IPA';
    testMeaning.textContent = dictationStage === 'word' ? 'Nghe từ và nhập lại đúng chính tả.' : dictationStage === 'sentence' ? 'Nghe câu ví dụ và nhập lại nguyên câu.' : 'Nhập IPA của từ.';
    testExample.textContent = dictationStage === 'word' ? 'Từ sẽ được đọc trước.' : dictationStage === 'sentence' ? 'Câu ví dụ sẽ được đọc trước.' : 'Ví dụ: /wɜːrk/.';
    testInputLabel.textContent = dictationStage === 'word' ? 'Nhập từ' : dictationStage === 'sentence' ? 'Nhập câu ví dụ' : 'Nhập IPA';
    testAnswer.classList.remove('hidden');
    testAnswer.disabled = false;
    testAnswer.value = '';
    testRecord.classList.add('hidden');
    testSubmit.classList.remove('hidden');
    testNext.classList.add('hidden');
    testListen.classList.remove('hidden');
    testMessage.textContent = dictationStage === 'word' ? 'Bấm 🔊 Listen để nghe từ.' : dictationStage === 'sentence' ? 'Bấm 🔊 Listen để nghe câu ví dụ.' : 'Nhập phiên âm nếu từ có IPA.';

    if (dictationStage === 'word') {
      speakText(currentEntry.word);
    } else if (dictationStage === 'sentence') {
      speakText(currentEntry.example);
    }
    testTimeout(() => testAnswer.focus(), 120);
  }

  updateTestProgress();
}

function resetLearnSession() {
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

function processTestListening() {
  const entry = testQueue[currentTestIndex];
  if (!entry) {
    return;
  }

  if (selectedTestMode === 'speaking') {
    speakSpeakingPrompt(entry);
    testMessage.textContent = 'Đang phát âm...';
  } else if (dictationStage === 'word') {
    speakText(entry.word);
    testMessage.textContent = 'Đã phát âm từ.';
  } else if (dictationStage === 'sentence') {
    speakText(entry.example);
    testMessage.textContent = 'Đã phát âm câu ví dụ.';
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

  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map((result) => result[0].transcript)
      .join(' ');
    const expected = normalizeText(entry.word);
    const actual = normalizeText(transcript);
    const correct = actual === expected;

    if (correct) {
      testScore += 1;
      testMessage.textContent = '✅ Correct';
    } else {
      testWrong += 1;
      testMessage.textContent = `❌ Incorrect. Đáp án đúng: ${entry.word}`;
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

  if (dictationStage === 'word') {
    correct = normalizeText(answer) === normalizeText(entry.word);
    feedback = correct ? '✅ Correct' : `❌ Incorrect. Đáp án đúng: ${entry.word}`;
  } else if (dictationStage === 'sentence') {
    correct = normalizeText(answer) === normalizeText(entry.example);
    feedback = correct ? '✅ Correct sentence' : `❌ Incorrect. Đáp án đúng: ${entry.example}`;
  } else if (dictationStage === 'ipa') {
    if (!entry.ipa) {
      correct = true;
      feedback = '✅ IPA không có sẵn cho từ này.';
    } else {
      correct = normalizeText(answer) === normalizeText(entry.ipa);
      feedback = correct ? '✅ Correct IPA' : `❌ Wrong IPA. Đáp án đúng: ${entry.ipa}`;
    }
  }

  if (correct) {
    testScore += 1;
  } else {
    testWrong += 1;
  }

  testMessage.textContent = feedback;
  testSubmit.classList.add('hidden');
  testNext.classList.remove('hidden');
  testAnswer.disabled = true;
}

function proceedToNextTestQuestion() {
  if (selectedTestMode === 'dictation') {
    if (dictationStage === 'word') {
      dictationStage = 'sentence';
      updateTestDisplay();
      return;
    }

    if (dictationStage === 'sentence') {
      dictationStage = 'ipa';
      updateTestDisplay();
      return;
    }

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
  learnFeedback.textContent = '';
  setLearnSessionVisibility(true);
  updateLearnDisplay();
  learnAnswer.value = '';
  testTimeout(() => learnAnswer.focus(), 120);
}

function startTestSession() {
  if (!selectedTestMode) {
    testFeedback.textContent = 'Vui lòng chọn một chế độ Test trước.';
    return;
  }

  const words = loadVocabulary();
  if (!words.length) {
    testFeedback.textContent = 'Không có từ để test. Thêm từ mới trước.';
    return;
  }

  testQueue = buildTestQueue(words);
  currentTestIndex = 0;
  testScore = 0;
  testWrong = 0;
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

function bindEvents() {
  pageButtons.forEach((button) => {
    button.addEventListener('click', () => showPage(button.dataset.page));
  });

  addForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const word = inputWord.value.trim();
    const meaning = inputMeaning.value.trim();
    const example = inputExample.value.trim();
    const ipa = inputIpa.value.trim();

    if (!word || !meaning || !example) {
      addFeedback.textContent = 'Vui lòng nhập đủ thông tin.';
      return;
    }

    try {
      addVocabularyEntry({ word, meaning, example, ipa });
      addFeedback.textContent = 'Lưu từ thành công.';
      resetAddForm();
      renderWordList();
      renderLearnSelection();
      renderTestState();
    } catch (error) {
      addFeedback.textContent = error.message;
    }
  });

  wordList.addEventListener('click', (event) => {
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
    renderWordList();
    renderLearnSelection();
    renderTestState();
  });

  learnStart.addEventListener('click', startLearnSession);
  learnCheck.addEventListener('click', processLearnCheck);
  learnKnown.addEventListener('click', processLearnKnown);
  learnToggle.addEventListener('click', processLearnToggle);

  testModeSpeaking.addEventListener('click', () => setSelectedTestMode('speaking'));
  testModeDictation.addEventListener('click', () => setSelectedTestMode('dictation'));
  testStart.addEventListener('click', startTestSession);
  testListen.addEventListener('click', processTestListening);
  testRecord.addEventListener('click', processTestRecording);
  testSubmit.addEventListener('click', processTestSubmission);
  testNext.addEventListener('click', proceedToNextTestQuestion);
  testRestart.addEventListener('click', () => {
    resetTestSession();
    testFeedback.textContent = 'Bạn có thể bắt đầu lại test bất cứ lúc nào.';
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
  renderWordList();
  renderLearnSelection();
  renderTestState();
  bindEvents();
  setSelectedTestMode('');
  showPage('add');
}

initializeApp();
