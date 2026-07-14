# Test Verification Plan - Speaking Test/Dictation Test/Typing Test

## 🔍 Test Setup

### Chuẩn bị
1. Mở ứng dụng VocabularyTrainer trên PC/Android
2. Tải danh sách từ vựng
3. Chọn ít nhất 50 từ trong cùng một topic

---

## 📱 Test 1: PC - Speaking Test (Critical)

### Objective: Verify speech recognition doesn't die after 2-3 words

**Steps:**
1. Go to **Test** section
2. Select **Speaking Test** mode
3. Choose **vocabulary** option (hoặc **example**)
4. Click **Start Test**
5. Select 50+ words (hoặc more)

**For Each Question (Repeat 50+ times):**
- [ ] Click "🔊 Listen" button → Phải nghe được âm thanh
- [ ] Click "🎤 Record" button → Bắt đầu ghi âm
- [ ] Speak the word → Ghi âm giọng nói
- [ ] Result appears → Kiểm tra kết quả
- [ ] If correct: Auto-advance ✓
- [ ] If wrong: Click "Retry" or "Skip"

**Critical Checks:**
- [ ] Question 1-10: Recording works ✓
- [ ] Question 11-25: Recording still works ✓
- [ ] Question 26-40: Recording still works ✓
- [ ] Question 41-50: Recording still works ✓
- [ ] **NO** error "not listening" after question 2-3
- [ ] **NO** "dead" recognition state
- [ ] Can complete entire sequence without hanging

**Result:** ✅ PASS if 50+ words work without error

---

## 📱 Test 2: PC - Case Sensitivity (Speaking)

### Objective: Verify case-insensitive comparison

**Setup:**
- Pick a word like: "**disappointed**"
- Test mode: Speaking vocabulary

**Expected Result (All Should Pass):**
- [ ] Speak: "disappointed" → ✅ Correct
- [ ] Speak: "Disappointed" → ✅ Correct (should normalize)
- [ ] Speak: "DISAPPOINTED" → ✅ Correct (should normalize)
- [ ] Speak: "dIsApPoInTeD" → ✅ Correct (should normalize)
- [ ] Speak: " disappointed " → ✅ Correct (should trim)

**Check Message:**
- If all pass: ✅ "Correct" message for all variations
- If any fail: ❌ "Incorrect" message (indicates bug)

**Result:** ✅ PASS if all variations accepted

---

## 📱 Test 3: PC - Dictation Test (50+ words)

### Objective: Verify dictation works for 50+ words

**Setup:**
1. Go to **Test** section
2. Select **Dictation Test** mode
3. Choose **word** or **example**
4. Click **Start Test**

**For Each Question:**
- [ ] Click "🔊 Listen" → Nghe từ/câu
- [ ] Type your answer → Gõ câu trả lời
- [ ] Click "Submit" → Kiểm tra

**Critical Checks:**
- [ ] Works for 50+ consecutive dictations
- [ ] No errors or hanging
- [ ] Case variations accepted (see Test 2)
- [ ] Can complete full sequence

**Result:** ✅ PASS if 50+ dictations work

---

## 📱 Test 4: PC - Case Sensitivity (Dictation)

### Objective: Verify dictation is case-insensitive

**Setup:**
- Dictation Test mode
- Word: "**understand**"

**Test Inputs (Type these):**
- [ ] "understand" → ✅ Correct
- [ ] "Understand" → ✅ Correct (normalize)
- [ ] "UNDERSTAND" → ✅ Correct (normalize)
- [ ] "UnDeRsTaNd" → ✅ Correct (normalize)
- [ ] "  understand  " → ✅ Correct (trim)
- [ ] "understand " → ✅ Correct (trim)

**Result:** ✅ PASS if all variants accepted

---

## 📱 Test 5: PC - Skip Button (After 3 Failures)

### Objective: Verify skip button works after max retries

**Setup:**
1. Speaking Test mode
2. Pick a difficult pronunciation

**Procedure:**
1. Click "🎤 Record"
2. Speak incorrectly (or gibberish) → ❌ Wrong
3. Click "Retry" → Try again
4. Speak incorrectly again → ❌ Wrong (Attempt: 2/3)
5. Click "Retry" → Try again
6. Speak incorrectly third time → ❌ Wrong (Attempt: 3/3)
7. **Now "Retry" button disappears, "Skip" button appears**

**Critical Test:**
- [ ] Can you click "Skip" button?
- [ ] Does it advance to next question?
- [ ] Does state reset for next question?
- [ ] Can you continue testing after skip?

**Expected:**
- ✅ Skip button always clickable
- ✅ Advances to next question smoothly
- ✅ No hanging or errors

**Result:** ✅ PASS if skip always works

---

## 📱 Test 6: Typing Test (Case Sensitivity)

### Objective: Verify typing test is case-insensitive

**Setup:**
1. Go to **Learn** section
2. Select **Learn - Writing** mode
3. Choose words

**For Each Word:**
- [ ] Type correctly: "word" → ✅ Correct
- [ ] Type with caps: "Word" → ✅ Correct
- [ ] Type all caps: "WORD" → ✅ Correct
- [ ] Mixed case: "WoRd" → ✅ Correct

**Result:** ✅ PASS if all cases accepted

---

## 📱 Test 7: Android/Mobile - Speaking Test (CRITICAL)

### Objective: Main bug fix verification on mobile

**Device:** Android phone/tablet

**Setup:**
1. Open app on mobile
2. Speaking Test mode
3. Select 50+ words

**Critical Checks:**
- [ ] **Question 1-10:** Recording works
- [ ] **Question 11-20:** Still works (was dying here before)
- [ ] **Question 21-30:** Still works
- [ ] **Question 31-40:** Still works
- [ ] **Question 41-50:** Still works
- [ ] **NO** message about "not listening"
- [ ] **NO** "dead" recognition after 2-3 words
- [ ] Can complete all 50+ without restart

**Mobile-Specific:**
- [ ] Phone keyboard auto-capitalization doesn't cause failures
- [ ] Microphone access works
- [ ] Battery usage normal (no infinite loops)

**Result:** ✅ PASS if 50+ words work on mobile

---

## 📱 Test 8: Android - Skip Button (Mobile)

### Objective: Skip button responsive on mobile

**Device:** Android phone

**Procedure:**
1. Speaking Test
2. Try to pronounce wrong 3 times (or fast click)
3. Skip button should appear after 3 failures
4. Click "Skip" button

**Checks:**
- [ ] Button responsive (not laggy)
- [ ] Advances to next question
- [ ] Can continue with more questions
- [ ] No freezing

**Result:** ✅ PASS if responsive and works

---

## 📝 Test 9: Edge Cases

### Empty/Invalid Input

**Dictation/Typing:**
- [ ] Empty input → Error message "Vui lòng nhập..."
- [ ] Only spaces "   " → Treated as empty
- [ ] Only punctuation "!!!" → Normalized to empty

### Whitespace Handling

**Input Tests (All should work):**
- [ ] " word" → Trimmed ✓
- [ ] "word " → Trimmed ✓
- [ ] " word " → Trimmed ✓
- [ ] "word  extra" → Multiple spaces normalized ✓

### Special Characters

**Dictation Test:**
- [ ] "don't" → Should be "dont" after normalization
- [ ] "café" → Should be "cafe"
- [ ] "naïve" → Should be "naive"

---

## ✅ Final Verification Checklist

### Must Pass (Critical)
- [ ] PC Speaking Test: 50+ consecutive words ✓
- [ ] PC Case Sensitivity: All variations accepted ✓
- [ ] Skip button: Always works, no hangs ✓
- [ ] Android Speaking: No dead after 2-3 words ✓
- [ ] Tests 43/43 pass ✓

### Should Pass (Important)
- [ ] PC Dictation: 50+ words ✓
- [ ] Typing Test: Case insensitive ✓
- [ ] Android Skip: Responsive ✓

### Nice to Have
- [ ] Edge cases handled ✓
- [ ] Whitespace normalization ✓
- [ ] Special characters ✓

---

## 🐛 If You Find Issues

### Issue: Speaking Recognition Dies After 2-3 Words
**Check:**
- [ ] Open console: `window.__speechDebugLog` (view logs)
- [ ] Look for "recognition-ended" or "recognition-error"
- [ ] Check if `testRecognition = null` is called

**Report:**
- Screenshot of console error
- Steps to reproduce
- Device info (PC/Android)

### Issue: Case Not Working
**Check:**
- [ ] Verify `normalizeText()` function exists
- [ ] Verify comparisons use `.trim()` after normalize
- [ ] Check browser console for errors

### Issue: Skip Not Working
**Check:**
- [ ] Can you click the button?
- [ ] Does state update?
- [ ] Check console for errors

---

## 📊 Test Report Template

```
=== TEST REPORT ===

Device: [PC / Android]
Browser: [Chrome / Firefox / Safari]
Date: [Date]

### PC Speaking Test (50+ words)
- Result: [PASS / FAIL]
- Issues: [If any]

### Case Sensitivity Tests
- Speaking: [PASS / FAIL]
- Dictation: [PASS / FAIL]
- Typing: [PASS / FAIL]

### Skip Button Test
- Result: [PASS / FAIL]
- Responsive: [Yes / No]

### Android Speaking (50+ words)
- Result: [PASS / FAIL]
- "Dead" after 2-3 words: [No / Yes]
- Issues: [If any]

### Overall
- All critical tests passed: [Yes / No]
- Ready for production: [Yes / No]
```

---

## 🎯 Success Criteria

**Test is COMPLETE when:**
1. ✅ All 43 unit tests pass
2. ✅ PC Speaking: 50+ words work
3. ✅ PC Case Sensitivity: All variations accepted
4. ✅ PC Skip Button: Always works
5. ✅ Android Speaking: 50+ words work without dying
6. ✅ Android Skip: Responsive and works
7. ✅ No errors in console
8. ✅ No crashes or hangs

**If all above pass → Changes are SAFE and READY** ✓
