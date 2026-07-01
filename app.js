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
const testRestart = document.getElementById('test-restart');

let vocabulary = [];
let learnQueue = [];
let currentLearnIndex = 0;
let isHiddenWord = false;
let testQueue = [];
let currentTestIndex = 0;
let testScore = 0;
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

function updateTestDisplay() {
  const currentEntry = testQueue[currentTestIndex];
  testMeaning.textContent = currentEntry.meaning;
  testExample.textContent = currentEntry.example;
  testCounter.textContent = `Câu ${currentTestIndex + 1} / ${testQueue.length}`;
  const progressPercent = Math.round(((currentTestIndex + 1) / testQueue.length) * 100);
  testProgress.style.width = `${progressPercent}%`;
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
  testAnswer.value = '';
  testMessage.textContent = '';
  testNext.classList.add('hidden');
  testSubmit.classList.remove('hidden');
  testSummary.classList.add('hidden');
  setTestSessionVisibility(false);
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

function testTimeout(callback, delay) {
  window.setTimeout(callback, delay);
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

function processTestSubmission() {
  const answer = testAnswer.value;
  if (!answer.trim()) {
    testMessage.textContent = 'Nhập từ để kiểm tra.';
    return;
  }

  const entry = testQueue[currentTestIndex];
  const correct = isTestAnswerCorrect(answer, entry);
  if (correct) {
    testScore += 1;
    testMessage.textContent = 'Chính xác!';
  } else {
    testMessage.textContent = `Sai rồi. Đáp án đúng là: ${entry.word}`;
  }

  testAnswer.value = '';
  testSubmit.classList.add('hidden');
  testNext.classList.remove('hidden');
}

function proceedToNextTestQuestion() {
  if (currentTestIndex + 1 >= testQueue.length) {
    testSummary.classList.remove('hidden');
    summaryScore.textContent = `Điểm của bạn: ${testScore} / ${testQueue.length}`;
    testSubmit.classList.add('hidden');
    testNext.classList.add('hidden');
    return;
  }

  currentTestIndex += 1;
  testAnswer.value = '';
  testMessage.textContent = '';
  testSubmit.classList.remove('hidden');
  testNext.classList.add('hidden');
  updateTestDisplay();
  testAnswer.focus();
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
  const words = loadVocabulary();
  if (!words.length) {
    testFeedback.textContent = 'Không có từ để test. Thêm từ mới trước.';
    return;
  }

  testQueue = buildTestQueue(words);
  currentTestIndex = 0;
  testScore = 0;
  testFeedback.textContent = '';
  setTestSessionVisibility(true);
  updateTestDisplay();
  testSummary.classList.add('hidden');
  testSubmit.classList.remove('hidden');
  testNext.classList.add('hidden');
  testMessage.textContent = '';
  testAnswer.value = '';
  testTimeout(() => testAnswer.focus(), 120);
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

    if (!word || !meaning || !example) {
      addFeedback.textContent = 'Vui lòng nhập đủ thông tin.';
      return;
    }

    try {
      addVocabularyEntry({ word, meaning, example });
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

  testStart.addEventListener('click', startTestSession);
  testSubmit.addEventListener('click', processTestSubmission);
  testNext.addEventListener('click', proceedToNextTestQuestion);
  testRestart.addEventListener('click', () => {
    resetTestSession();
    testFeedback.textContent = 'Bạn có thể bắt đầu lại test bất cứ lúc nào.';
  });

  document.addEventListener('keydown', (event) => {
    if (!sessionActive) {
      return;
    }
    if (event.key === 'Enter' && document.activeElement === learnAnswer) {
      event.preventDefault();
      processLearnCheck();
    }
  });
}

function initializeApp() {
  renderWordList();
  renderLearnSelection();
  renderTestState();
  bindEvents();
  showPage('add');
}

initializeApp();
