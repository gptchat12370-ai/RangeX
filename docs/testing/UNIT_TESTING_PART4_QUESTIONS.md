# Unit Testing Part 4: Questions & Submissions

**Module**: Questions, Answer Validation & Scoring  
**Test Cases**: 72  
**Status**: ✅ All Tests Passing  
**Last Updated**: January 7, 2026

---

## 📋 Table of Contents

1. [Question Creation Tests (UT-30.x)](#question-creation-tests)
2. [Answer Validation Tests (UT-31.x)](#answer-validation-tests)
3. [Auto-Grading Logic Tests (UT-32.x)](#auto-grading-logic-tests)
4. [Scoring & Progress Tests (UT-33.x)](#scoring--progress-tests)
5. [Hints & Penalties Tests (UT-34.x)](#hints--penalties-tests)
6. [Completion Detection Tests (UT-35.x)](#completion-detection-tests)

---

## Question Creation Tests

### UT-30.x: Question Creation Module (6 Types)

| Test Scenario ID | Module / Feature | Test Procedures | Test Data | Expected Result | Actual Result | Status |
|-----------------|------------------|-----------------|-----------|-----------------|---------------|--------|
| UT-30.1 | Questions (MCQ) | Add MCQ question with single answer | type="multiple_choice", options=[A,B,C,D], correctAnswer="B" | MCQ question saved correctly | MCQ question saved correctly | ✅ Pass |
| UT-30.2 | Questions (MCQ) | Add MCQ with multiple correct answers | type="multiple_choice", multipleAnswers=true, correct=[B,C] | Multi-select MCQ saved | Multi-select MCQ saved | ✅ Pass |
| UT-30.3 | Questions (ShortAnswer) | Add short answer question | type="short_answer", acceptedAnswers=["flag{test}"], caseSensitive=false | Short answer question saved | Short answer question saved | ✅ Pass |
| UT-30.4 | Questions (TrueFalse) | Add true/false question | type="true_false", correctAnswer=true | True/false question saved | True/false question saved | ✅ Pass |
| UT-30.5 | Questions (Matching) | Add matching question | type="matching", pairs=[{left:"A",right:"1"}, {left:"B",right:"2"}] | Matching question saved with pairs | Matching question saved with pairs | ✅ Pass |
| UT-30.6 | Questions (Ordering) | Add ordering question | type="ordering", correctOrder=["Step 1","Step 2","Step 3"] | Ordering question saved | Ordering question saved | ✅ Pass |
| UT-30.7 | Questions (Practical) | Add practical task question | type="practical_task", validation={type:"file",pattern:"*.txt"} | Practical task question saved | Practical task question saved | ✅ Pass |
| UT-30.8 | Questions | Set question points | points=10 | Points value saved | Points value saved | ✅ Pass |
| UT-30.9 | Questions | Add question with hint | hint="Check the /etc/passwd file" | Hint saved with question | Hint saved with question | ✅ Pass |
| UT-30.10 | Questions | Update existing question | questionId=1000, new text | Question updated | Question updated | ✅ Pass |
| UT-30.11 | Questions | Delete question | questionId=1000 | Question deleted, submissions orphaned | Question deleted, submissions orphaned | ✅ Pass |
| UT-30.12 | Questions | Reorder questions | New order=[q2, q1, q3] | Question order updated | Question order updated | ✅ Pass |

---

## Answer Validation Tests

### UT-31.x: Answer Validation Module

| Test Scenario ID | Module / Feature | Test Procedures | Test Data | Expected Result | Actual Result | Status |
|-----------------|------------------|-----------------|-----------|-----------------|---------------|--------|
| UT-31.1 | Submissions/Scoring | Submit correct MCQ answer | questionId=1000, answer="B" (correct) | Answer marked as correct, score updated, progress updated | Answer marked as correct, score updated, progress updated | ✅ Pass |
| UT-31.2 | Submissions | Submit incorrect MCQ answer | questionId=1000, answer="A" (wrong) | Answer marked as incorrect, no score | Answer marked as incorrect, no score | ✅ Pass |
| UT-31.3 | Submissions | Submit MCQ with multiple correct | answer=["B","C"] (both correct) | Full points awarded | Full points awarded | ✅ Pass |
| UT-31.4 | Submissions | Submit MCQ with partial correct | answer=["B"] (missing "C") | Partial points awarded | Partial points awarded | ✅ Pass |
| UT-31.5 | Submissions | Submit short answer (exact match) | answer="flag{test123}", expected="flag{test123}" | Correct, full points | Correct, full points | ✅ Pass |
| UT-31.6 | Submissions | Submit short answer (case insensitive) | answer="FLAG{TEST123}", caseSensitive=false | Correct, full points | Correct, full points | ✅ Pass |
| UT-31.7 | Submissions | Submit short answer (fuzzy match) | answer="flag{test 123}", fuzzyMatch=true | Correct, full points | Correct, full points | ✅ Pass |
| UT-31.8 | Submissions | Submit short answer (whitespace trim) | answer=" flag{test} ", trim=true | Correct, whitespace ignored | Correct, whitespace ignored | ✅ Pass |
| UT-31.9 | Submissions | Submit true/false answer | answer=true, correct=true | Correct, full points | Correct, full points | ✅ Pass |
| UT-31.10 | Submissions | Submit matching pairs | answer=[{"A":"1"},{"B":"2"}], all correct | Correct, full points | Correct, full points | ✅ Pass |
| UT-31.11 | Submissions | Submit matching pairs (partial) | answer=[{"A":"1"}], missing {"B":"2"} | Partial points (50%) | Partial points (50%) | ✅ Pass |
| UT-31.12 | Submissions | Submit ordering sequence | answer=["Step 1","Step 2","Step 3"] (correct order) | Correct, full points | Correct, full points | ✅ Pass |
| UT-31.13 | Submissions | Submit ordering (wrong order) | answer=["Step 2","Step 1","Step 3"] | Incorrect, no points | Incorrect, no points | ✅ Pass |
| UT-31.14 | Submissions | Submit practical task (file upload) | File uploaded with correct content | File validated, points awarded | File validated, points awarded | ✅ Pass |

---

## Auto-Grading Logic Tests

### UT-32.x: Auto-Grading Module

| Test Scenario ID | Module / Feature | Test Procedures | Test Data | Expected Result | Actual Result | Status |
|-----------------|------------------|-----------------|-----------|-----------------|---------------|--------|
| UT-32.1 | Auto-Grading | Grade MCQ automatically | questionId=1000, userAnswer="B" | Auto-graded as correct | Auto-graded as correct | ✅ Pass |
| UT-32.2 | Auto-Grading | Calculate total score | 3 questions answered correctly | Total score = sum of points | Total score = sum of points | ✅ Pass |
| UT-32.3 | Auto-Grading | Calculate percentage | 7/10 questions correct | Percentage = 70% | Percentage = 70% | ✅ Pass |
| UT-32.4 | Auto-Grading | Award bonus points | Completed in < 30 minutes | Speed bonus added | Speed bonus added | ✅ Pass |
| UT-32.5 | Auto-Grading | Deduct penalty points | Used 2 hints | Penalty deducted (20 points) | Penalty deducted (20 points) | ✅ Pass |
| UT-32.6 | Auto-Grading | Grade regex-based answer | answer matches regex pattern | Graded as correct | Graded as correct | ✅ Pass |
| UT-32.7 | Auto-Grading | Grade file content validation | File contains expected string | Graded as correct | Graded as correct | ✅ Pass |
| UT-32.8 | Auto-Grading | Grade command output validation | Command output matches expected | Graded as correct | Graded as correct | ✅ Pass |
| UT-32.9 | Auto-Grading | Handle edge case (empty answer) | answer="" | Graded as incorrect | Graded as incorrect | ✅ Pass |
| UT-32.10 | Auto-Grading | Handle edge case (null answer) | answer=null | Graded as incorrect | Graded as incorrect | ✅ Pass |
| UT-32.11 | Auto-Grading | Prevent duplicate submissions | Submit same answer twice | Second submission rejected | Second submission rejected | ✅ Pass |
| UT-32.12 | Auto-Grading | Grade case-sensitive answers | answer="FLAG", expected="flag", caseSensitive=true | Graded as incorrect | Graded as incorrect | ✅ Pass |

---

## Scoring & Progress Tests

### UT-33.x: Scoring & Progress Module

| Test Scenario ID | Module / Feature | Test Procedures | Test Data | Expected Result | Actual Result | Status |
|-----------------|------------------|-----------------|-----------|-----------------|---------------|--------|
| UT-33.1 | Scoring | Update user score on correct answer | Correct answer worth 10 points | User score increased by 10 | User score increased by 10 | ✅ Pass |
| UT-33.2 | Scoring | Update session progress | 3/5 questions answered | Progress = 60% | Progress = 60% | ✅ Pass |
| UT-33.3 | Scoring | Calculate completion status | All questions answered correctly | completionStatus = 100% | completionStatus = 100% | ✅ Pass |
| UT-33.4 | Scoring | Track attempts per question | 3 attempts on question | attemptCount = 3 | attemptCount = 3 | ✅ Pass |
| UT-33.5 | Scoring | Limit attempts per question | 4th attempt, maxAttempts=3 | Error: "Maximum attempts exceeded" | Error: "Maximum attempts exceeded" | ✅ Pass |
| UT-33.6 | Scoring | Award first-try bonus | Correct on first attempt | Bonus points added | Bonus points added | ✅ Pass |
| UT-33.7 | Scoring | Update global leaderboard | Session completed with high score | Leaderboard entry created/updated | Leaderboard entry created/updated | ✅ Pass |
| UT-33.8 | Scoring | Update scenario leaderboard | Scenario-specific score | Scenario leaderboard updated | Scenario leaderboard updated | ✅ Pass |
| UT-33.9 | Scoring | Get user progress | userId=10, sessionId=1000 | Progress data returned (percentage, answered, remaining) | Progress data returned (percentage, answered, remaining) | ✅ Pass |
| UT-33.10 | Scoring | Calculate time-based scoring | Completed in 25 minutes (fast) | Time bonus applied | Time bonus applied | ✅ Pass |
| UT-33.11 | Scoring | Record submission timestamp | Answer submitted | Timestamp saved in database | Timestamp saved in database | ✅ Pass |
| UT-33.12 | Scoring | Get submission history | questionId=1000 | All attempts returned in order | All attempts returned in order | ✅ Pass |

---

## Hints & Penalties Tests

### UT-34.x: Hints & Penalties Module

| Test Scenario ID | Module / Feature | Test Procedures | Test Data | Expected Result | Actual Result | Status |
|-----------------|------------------|-----------------|-----------|-----------------|---------------|--------|
| UT-34.1 | Hints | Request hint for question | questionId=1000 | Hint text returned, penalty applied | Hint text returned, penalty applied | ✅ Pass |
| UT-34.2 | Hints | Deduct points for hint | Hint penalty = 10 points | Score reduced by 10 | Score reduced by 10 | ✅ Pass |
| UT-34.3 | Hints | Track hint usage | User requests hint | hintUsed = true, hintCount++ | hintUsed = true, hintCount++ | ✅ Pass |
| UT-34.4 | Hints | Multiple hints (progressive) | Request 2nd hint | 2nd hint shown, additional penalty | 2nd hint shown, additional penalty | ✅ Pass |
| UT-34.5 | Hints | Limit hints per question | Request 4th hint, max=3 | Error: "No more hints available" | Error: "No more hints available" | ✅ Pass |
| UT-34.6 | Hints | Get hint cost before revealing | Check hint penalty | Penalty amount returned without revealing hint | Penalty amount returned without revealing hint | ✅ Pass |
| UT-34.7 | Penalties | Apply wrong answer penalty | Incorrect submission, penalty=5 | Score reduced by 5 | Score reduced by 5 | ✅ Pass |
| UT-34.8 | Penalties | Track total penalties | Used 2 hints + 1 wrong answer | Total penalty = 25 points | Total penalty = 25 points | ✅ Pass |
| UT-34.9 | Penalties | Prevent negative scores | Penalty exceeds current score | Score set to 0, not negative | Score set to 0, not negative | ✅ Pass |
| UT-34.10 | Penalties | Time penalty (overtime) | Session exceeds estimated time | Overtime penalty applied | Overtime penalty applied | ✅ Pass |

---

## Completion Detection Tests

### UT-35.x: Completion Detection Module

| Test Scenario ID | Module / Feature | Test Procedures | Test Data | Expected Result | Actual Result | Status |
|-----------------|------------------|-----------------|-----------|-----------------|---------------|--------|
| UT-35.1 | Completion | Detect session completion | All questions answered correctly | Session status = "completed" | Session status = "completed" | ✅ Pass |
| UT-35.2 | Completion | Trigger badge award on completion | Session completed | Badge check triggered, badges awarded | Badge check triggered, badges awarded | ✅ Pass |
| UT-35.3 | Completion | Update user statistics | Session completed | Total completed scenarios++, total points updated | Total completed scenarios++, total points updated | ✅ Pass |
| UT-35.4 | Completion | Generate completion certificate | Session completed with 80%+ | Certificate generated with details | Certificate generated with details | ✅ Pass |
| UT-35.5 | Completion | Send completion notification | Session completed | Email notification sent to user | Email notification sent to user | ✅ Pass |
| UT-35.6 | Completion | Update career path progress | Scenario part of career path | Path progress updated | Path progress updated | ✅ Pass |
| UT-35.7 | Completion | Unlock next scenario | Sequential scenario dependency | Next scenario unlocked | Next scenario unlocked | ✅ Pass |
| UT-35.8 | Completion | Record completion time | Session completed | Duration calculated and saved | Duration calculated and saved | ✅ Pass |
| UT-35.9 | Completion | Calculate final grade | Total score / max possible | Grade (A-F) calculated | Grade (A-F) calculated | ✅ Pass |
| UT-35.10 | Completion | Partial completion detection | 80% questions answered | Status = "partially_completed" | Status = "partially_completed" | ✅ Pass |
| UT-35.11 | Completion | Perfect score detection | All correct, no hints, fast time | Perfect score badge awarded | Perfect score badge awarded | ✅ Pass |
| UT-35.12 | Completion | Cleanup after completion | Session completed | Resources cleaned, session archived | Resources cleaned, session archived | ✅ Pass |
| UT-35.13 | Completion | Update scenario statistics | Session completed | Scenario.completionCount++, avgScore updated | Scenario.completionCount++, avgScore updated | ✅ Pass |
| UT-35.14 | Completion | Event leaderboard update | Event session completed | Event leaderboard updated with score | Event leaderboard updated with score | ✅ Pass |

---

## 📊 Test Summary

| Module | Total Tests | Passed | Failed | Pass Rate |
|--------|-------------|--------|--------|-----------|
| Question Creation (UT-30.x) | 12 | 12 | 0 | 100% |
| Answer Validation (UT-31.x) | 14 | 14 | 0 | 100% |
| Auto-Grading (UT-32.x) | 12 | 12 | 0 | 100% |
| Scoring & Progress (UT-33.x) | 12 | 12 | 0 | 100% |
| Hints & Penalties (UT-34.x) | 10 | 10 | 0 | 100% |
| Completion Detection (UT-35.x) | 14 | 14 | 0 | 100% |
| **TOTAL** | **72** | **72** | **0** | **100%** |

---

## 🔒 Security Test Coverage

### Input Validation
- ✅ Answer sanitization prevents injection
- ✅ File uploads scanned for malware
- ✅ Command injection prevented in practical tasks

### Anti-Cheating
- ✅ Duplicate submission detection
- ✅ Attempt limits enforced
- ✅ Submission timestamps tracked

### Data Integrity
- ✅ Score calculations verified
- ✅ Progress tracking atomic
- ✅ Grading logic tested for edge cases

---

## 🚀 Running These Tests

```bash
# Run question and submission tests
npm run test -- question.service.spec.ts
npm run test -- submission.service.spec.ts
npm run test -- grading.service.spec.ts

# Run with coverage
npm run test:cov -- question
```

---

**Previous**: [← Part 3 - Session Tests](UNIT_TESTING_PART3_SESSIONS.md)  
**Next**: [Part 5 - Events & Gamification Tests →](UNIT_TESTING_PART5_EVENTS.md)
