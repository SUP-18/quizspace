/* =========================================================
   exam.js — QuizSpace Exam Engine
   Handles: Setup → Exam → Submission → Results → Review
   ========================================================= */

const ExamEngine = (() => {

  /* ─── State ──────────────────────────────────────────── */
  let state = null; // active exam state
  let timerHandle = null;
  let submitted = false;
  const STORAGE_KEY = 'qs_active_exam';

  const DURATIONS = { // seconds per question
    Easy: 60, Medium: 75, Hard: 90
  };
  const MARKS = {
    Easy: { correct: 1, wrong: -0.25 },
    Medium: { correct: 2, wrong: -0.5 },
    Hard: { correct: 3, wrong: -1 }
  };

  /* ─── DOM Helpers ────────────────────────────────────── */
  const el = id => document.getElementById(id);
  const setText = (id, txt) => { if (el(id)) el(id).textContent = txt; };
  const setHTML = (id, html) => { if (el(id)) el(id).innerHTML = html; };

  /* ─── Question Filtering ─────────────────────────────── */
  function filterQuestions(category, difficulty, num) {
    let pool = questions;
    if (category !== 'All') pool = pool.filter(q => q.topic === category);
    if (difficulty !== 'All') pool = pool.filter(q => q.difficulty === difficulty);
    if (pool.length < num) return null; // not enough questions
    // Shuffle
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, num);
  }

  /* ─── Setup Screen ───────────────────────────────────── */
  function renderSetup() {
    app.navigateProtected('exam-setup-screen');
  }

  /* ─── Initialize Exam ────────────────────────────────── */
  function startExam(config) {
    submitted = false;
    const qs = filterQuestions(config.category, config.difficulty, config.numQuestions);
    if (!qs) {
      alert(`Not enough questions for: ${config.category} / ${config.difficulty}. Try 'All' or a different combination.`);
      return;
    }
    const duration = config.duration || (config.numQuestions * (DURATIONS[config.difficulty] || 60));
    const deadline = Date.now() + duration * 1000;

    state = {
      id: 'exam_' + Date.now(),
      userId: Auth.currentUser?.id || 'guest',
      config,
      questions: qs,
      answers: new Array(qs.length).fill(-1),   // -1 = not answered
      markedForReview: new Array(qs.length).fill(false),
      visited: new Array(qs.length).fill(false),
      currentIndex: 0,
      deadline,
      startedAt: new Date().toISOString(),
      status: 'active'
    };
    state.visited[0] = true;

    // Persist so refresh doesn't lose it
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}

    renderExamInterface();
    startTimer();
  }

  /* ─── Restore exam after refresh ────────────────────── */
  function tryRestoreExam() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved || saved.status !== 'active') return false;
      if (Date.now() >= saved.deadline) {
        // Time already expired
        localStorage.removeItem(STORAGE_KEY);
        return false;
      }
      state = saved;
      submitted = false;
      renderExamInterface();
      startTimer();
      return true;
    } catch { return false; }
  }

  /* ─── Timer ──────────────────────────────────────────── */
  function startTimer() {
    clearInterval(timerHandle);
    timerHandle = setInterval(() => {
      const remaining = Math.max(0, Math.floor((state.deadline - Date.now()) / 1000));
      updateTimerUI(remaining);
      if (remaining === 300) showTimerWarning('⚠️ 5 minutes remaining!', 'warning');
      if (remaining === 60)  showTimerWarning('🚨 1 minute remaining!', 'danger');
      if (remaining <= 0) {
        clearInterval(timerHandle);
        autoSubmit();
      }
    }, 1000);
  }

  function stopTimer() { clearInterval(timerHandle); }

  function updateTimerUI(secs) {
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    const display = el('exam-timer-display');
    const box = el('exam-timer-box');
    if (!display) return;
    display.textContent = `${m}:${s}`;
    if (box) {
      box.className = 'exam-timer-box';
      if (secs <= 60) box.classList.add('danger');
      else if (secs <= 300) box.classList.add('warning');
    }
  }

  function showTimerWarning(msg, type) {
    const banner = el('exam-warning-banner');
    if (!banner) return;
    banner.textContent = msg;
    banner.className = `exam-warning-banner ${type} visible`;
    setTimeout(() => { if (banner) banner.className = 'exam-warning-banner'; }, 4000);
  }

  /* ─── Render Exam Interface ──────────────────────────── */
  function renderExamInterface() {
    // Switch to exam screen
    app.navigateProtected('exam-screen');

    const cfg = state.config;
    setText('exam-title', `${cfg.category} — ${cfg.difficulty}`);
    setText('exam-total-qs', state.questions.length);

    renderPalette();
    renderCurrentQuestion();
    renderStatusCounts();
  }

  function renderCurrentQuestion() {
    const idx = state.currentIndex;
    const q = state.questions[idx];

    // Mark visited
    state.visited[idx] = true;
    syncState();

    setText('exam-q-num', `Question ${idx + 1} of ${state.questions.length}`);

    // Question text
    const qtEl = el('exam-question-text');
    if (qtEl) qtEl.textContent = q.question;

    // Badge
    const badgeEl = el('exam-q-badge');
    if (badgeEl) {
      badgeEl.textContent = `${q.topic} · ${q.difficulty}`;
      badgeEl.className = `exam-badge diff-${q.difficulty.toLowerCase()}`;
    }

    // Options
    const optGrid = el('exam-options-grid');
    if (!optGrid) return;
    optGrid.innerHTML = '';
    const letters = ['A', 'B', 'C', 'D'];
    q.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'exam-option-btn';
      btn.setAttribute('data-index', i);
      btn.innerHTML = `<span class="opt-letter">${letters[i]}</span><span class="opt-text">${opt}</span>`;
      if (state.answers[idx] === i) btn.classList.add('selected');
      btn.addEventListener('click', () => selectAnswer(i));
      optGrid.appendChild(btn);
    });

    // Progress bar
    const answered = state.answers.filter(a => a !== -1).length;
    const pct = Math.round((answered / state.questions.length) * 100);
    const pb = el('exam-progress-bar');
    const pl = el('exam-progress-label');
    if (pb) pb.style.width = pct + '%';
    if (pl) pl.textContent = `${answered}/${state.questions.length} answered`;

    // Nav buttons
    const prevBtn = el('exam-prev-btn');
    const nextBtn = el('exam-next-btn');
    if (prevBtn) prevBtn.disabled = idx === 0;
    if (nextBtn) nextBtn.textContent = idx === state.questions.length - 1 ? 'Review →' : 'Next →';

    // Review indicator
    const reviewBtn = el('exam-mark-review-btn');
    if (reviewBtn) {
      reviewBtn.textContent = state.markedForReview[idx] ? '🟣 Marked' : '🔖 Mark for Review';
      reviewBtn.classList.toggle('active', state.markedForReview[idx]);
    }

    renderPalette();
    renderStatusCounts();
  }

  function selectAnswer(optionIndex) {
    const idx = state.currentIndex;
    state.answers[idx] = optionIndex;
    syncState();
    renderCurrentQuestion();
  }

  function clearAnswer() {
    const idx = state.currentIndex;
    state.answers[idx] = -1;
    syncState();
    renderCurrentQuestion();
  }

  function toggleMarkForReview() {
    const idx = state.currentIndex;
    state.markedForReview[idx] = !state.markedForReview[idx];
    syncState();
    renderCurrentQuestion();
  }

  function goToQuestion(idx) {
    state.currentIndex = idx;
    renderCurrentQuestion();
  }

  function prevQuestion() {
    if (state.currentIndex > 0) {
      state.currentIndex--;
      renderCurrentQuestion();
    }
  }

  function nextQuestion() {
    if (state.currentIndex < state.questions.length - 1) {
      state.currentIndex++;
      state.visited[state.currentIndex] = true;
      renderCurrentQuestion();
    }
  }

  /* ─── Palette ────────────────────────────────────────── */
  function renderPalette() {
    const palette = el('exam-palette');
    if (!palette) return;
    palette.innerHTML = '';
    state.questions.forEach((_, i) => {
      const btn = document.createElement('button');
      btn.className = 'palette-btn';
      btn.textContent = i + 1;
      const ans = state.answers[i];
      const marked = state.markedForReview[i];
      if (i === state.currentIndex)   btn.classList.add('current');
      else if (marked && ans !== -1)  btn.classList.add('answered-marked');
      else if (marked)                btn.classList.add('marked');
      else if (ans !== -1)            btn.classList.add('answered');
      else if (state.visited[i])      btn.classList.add('visited');
      btn.addEventListener('click', () => goToQuestion(i));
      palette.appendChild(btn);
    });
  }

  function renderStatusCounts() {
    const total = state.questions.length;
    const answered = state.answers.filter(a => a !== -1).length;
    const marked = state.markedForReview.filter(Boolean).length;
    const notVisited = state.visited.filter(v => !v).length;
    const notAnswered = total - answered - notVisited;

    setText('count-answered', answered);
    setText('count-not-answered', Math.max(0, notAnswered));
    setText('count-marked', marked);
    setText('count-not-visited', notVisited);
  }

  /* ─── Submission ─────────────────────────────────────── */
  function attemptSubmit() {
    if (submitted) return;
    const unanswered = state.answers.filter(a => a === -1).length;
    const modal = el('submit-confirm-modal');
    if (modal) {
      setText('submit-unanswered-count', unanswered);
      modal.classList.add('visible');
    }
  }

  function cancelSubmit() {
    const modal = el('submit-confirm-modal');
    if (modal) modal.classList.remove('visible');
  }

  function confirmSubmit() {
    const modal = el('submit-confirm-modal');
    if (modal) modal.classList.remove('visible');
    doSubmit();
  }

  function autoSubmit() {
    if (submitted) return;
    doSubmit();
  }

  function doSubmit() {
    if (submitted) return;
    submitted = true;
    stopTimer();
    state.status = 'completed';

    // Scoring
    const marksPerCorrect = MARKS[state.config.difficulty]?.correct || 1;
    const marksPerWrong   = state.config.negativeMarking ? (MARKS[state.config.difficulty]?.wrong || 0) : 0;
    const maxMarks = state.questions.length * marksPerCorrect;

    let correct = 0, incorrect = 0, unanswered = 0, marksObtained = 0;
    const questionResults = state.questions.map((q, i) => {
      const selected = state.answers[i];
      let result;
      if (selected === -1) {
        unanswered++;
        result = 'unanswered';
        marksObtained += 0;
      } else if (selected === q.answer) {
        correct++;
        result = 'correct';
        marksObtained += marksPerCorrect;
      } else {
        incorrect++;
        result = 'incorrect';
        marksObtained += marksPerWrong; // will be negative if enabled
      }
      return {
        questionId: q.id,
        question: q.question,
        options: q.options,
        correctAnswer: q.answer,
        selectedAnswer: selected,
        topic: q.topic,
        difficulty: q.difficulty,
        hint: q.hint,
        solution: q.solution,
        result,
        marks: result === 'correct' ? marksPerCorrect : result === 'incorrect' ? marksPerWrong : 0,
        markedForReview: state.markedForReview[i]
      };
    });

    marksObtained = Math.max(0, marksObtained); // don't go below 0
    const percentage = Math.round((marksObtained / maxMarks) * 100);
    const timeTaken = Math.round((Date.now() - new Date(state.startedAt).getTime()) / 1000);

    const attempt = {
      id: state.id,
      userId: state.userId,
      config: state.config,
      questionResults,
      correct, incorrect, unanswered,
      marksObtained,
      maxMarks,
      percentage,
      timeTaken,
      startedAt: state.startedAt,
      submittedAt: new Date().toISOString(),
      status: 'completed'
    };

    DB.saveAttempt(attempt);
    localStorage.removeItem(STORAGE_KEY);

    // Update dashboard stats
    if (typeof updateDashboardStats === 'function') updateDashboardStats();

    // Render results
    renderResults(attempt);
  }

  /* ─── Results Page ───────────────────────────────────── */
  function renderResults(attempt) {
    app.navigateProtected('exam-results-screen');

    const cfg = attempt.config;
    setText('res-title', `${cfg.category} — ${cfg.difficulty}`);
    setText('res-date', new Date(attempt.submittedAt).toLocaleString());
    setText('res-marks', `${attempt.marksObtained} / ${attempt.maxMarks}`);
    setText('res-correct', attempt.correct);
    setText('res-incorrect', attempt.incorrect);
    setText('res-unanswered', attempt.unanswered);
    setText('res-accuracy', attempt.correct > 0
      ? Math.round((attempt.correct / (attempt.correct + attempt.incorrect)) * 100) + '%'
      : '0%');
    const mm = Math.floor(attempt.timeTaken / 60);
    const ss = attempt.timeTaken % 60;
    setText('res-time', `${mm}m ${ss}s`);

    // Score circle
    const pct = attempt.percentage;
    const circle = el('res-score-circle');
    if (circle) {
      circle.style.background = `conic-gradient(var(--accent-primary) ${pct}%, rgba(0,0,0,0.05) ${pct}%)`;
    }
    setText('res-score-pct', pct + '%');
    setText('res-score-fraction', `${attempt.marksObtained}/${attempt.maxMarks}`);

    // Performance label
    let label = '', labelClass = '';
    if (pct >= 90) { label = '🏆 Outstanding!'; labelClass = 'outstanding'; }
    else if (pct >= 75) { label = '🌟 Excellent!'; labelClass = 'excellent'; }
    else if (pct >= 60) { label = '👍 Good Job!'; labelClass = 'good'; }
    else if (pct >= 40) { label = '📚 Keep Practicing'; labelClass = 'average'; }
    else { label = '💪 Don\'t Give Up!'; labelClass = 'poor'; }
    const labelEl = el('res-performance-label');
    if (labelEl) { labelEl.textContent = label; labelEl.className = `perf-label ${labelClass}`; }

    // Celebration for high scores
    if (pct >= 75) triggerCelebration();

    // Store attempt ID for review
    const reviewBtn = el('res-review-btn');
    if (reviewBtn) reviewBtn.setAttribute('data-attempt', attempt.id);
    const retakeBtn = el('res-retake-btn');
    if (retakeBtn) retakeBtn.setAttribute('data-config', JSON.stringify(attempt.config));
  }

  function triggerCelebration() {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const container = el('celebration-container');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < 40; i++) {
      const c = document.createElement('div');
      c.className = 'confetti-piece';
      c.style.cssText = `left:${Math.random()*100}%;animation-delay:${Math.random()*2}s;background:${['#6c63ff','#3ecfcf','#f06292','#ffb347','#98fb98'][Math.floor(Math.random()*5)]}`;
      container.appendChild(c);
    }
    setTimeout(() => { if (container) container.innerHTML = ''; }, 4000);
  }

  /* ─── Answer Review ──────────────────────────────────── */
  function renderReview(attemptId, filter = 'all') {
    const attempt = DB.getAttempt(attemptId);
    if (!attempt) { app.navigateProtected('exam-history-screen'); return; }

    app.navigateProtected('exam-review-screen');
    setText('review-title', `Review: ${attempt.config.category} — ${attempt.config.difficulty}`);
    setText('review-date', new Date(attempt.submittedAt).toLocaleString());

    // Filter tabs
    document.querySelectorAll('.review-filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
      btn.onclick = () => renderReview(attemptId, btn.dataset.filter);
    });

    let qs = attempt.questionResults;
    if (filter === 'correct') qs = qs.filter(q => q.result === 'correct');
    else if (filter === 'incorrect') qs = qs.filter(q => q.result === 'incorrect');
    else if (filter === 'unanswered') qs = qs.filter(q => q.result === 'unanswered');
    else if (filter === 'marked') qs = qs.filter(q => q.markedForReview);

    const container = el('review-questions-container');
    if (!container) return;

    if (qs.length === 0) {
      container.innerHTML = `<div class="empty-state"><p>No questions match this filter.</p></div>`;
      return;
    }

    const letters = ['A', 'B', 'C', 'D'];
    container.innerHTML = qs.map((q, i) => {
      const resultClass = q.result;
      const icon = q.result === 'correct' ? '✅' : q.result === 'incorrect' ? '❌' : '⬜';
      return `
        <div class="review-card ${resultClass}">
          <div class="review-card-header">
            <span class="review-q-num">${icon} Q${attempt.questionResults.indexOf(q) + 1}</span>
            <span class="exam-badge diff-${q.difficulty.toLowerCase()}">${q.topic} · ${q.difficulty}</span>
            <span class="review-marks ${q.result}">${q.marks >= 0 ? '+' : ''}${q.marks} marks</span>
          </div>
          <p class="review-question">${q.question}</p>
          <div class="review-options">
            ${q.options.map((opt, oi) => {
              let cls = '';
              if (oi === q.correctAnswer) cls = 'correct';
              if (oi === q.selectedAnswer && oi !== q.correctAnswer) cls = 'incorrect';
              if (oi === q.selectedAnswer && oi === q.correctAnswer) cls = 'correct selected';
              return `<div class="review-option ${cls}">
                <span class="opt-letter">${letters[oi]}</span>
                <span>${opt}</span>
                ${oi === q.correctAnswer ? '<span class="opt-tag correct-tag">✓ Correct</span>' : ''}
                ${oi === q.selectedAnswer && oi !== q.correctAnswer ? '<span class="opt-tag wrong-tag">✗ Your answer</span>' : ''}
              </div>`;
            }).join('')}
          </div>
          <div class="review-explanation">
            <strong>💡 Explanation:</strong> ${q.solution}
          </div>
          ${q.markedForReview ? '<span class="marked-badge">🟣 Marked for Review</span>' : ''}
        </div>
      `;
    }).join('');
  }

  /* ─── History ────────────────────────────────────────── */
  function renderHistory(userId, filters = {}) {
    app.navigateProtected('exam-history-screen');
    let attempts = DB.getAttempts(userId).filter(a => a.status === 'completed');

    // Apply filters
    if (filters.category && filters.category !== 'All')
      attempts = attempts.filter(a => a.config.category === filters.category);
    if (filters.difficulty && filters.difficulty !== 'All')
      attempts = attempts.filter(a => a.config.difficulty === filters.difficulty);
    if (filters.search)
      attempts = attempts.filter(a =>
        a.config.category.toLowerCase().includes(filters.search.toLowerCase()));

    // Sort
    const sort = filters.sort || 'newest';
    if (sort === 'newest') attempts.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    else if (sort === 'oldest') attempts.sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
    else if (sort === 'highest') attempts.sort((a, b) => b.percentage - a.percentage);

    const container = el('history-list-container');
    if (!container) return;

    if (attempts.length === 0) {
      container.innerHTML = `<div class="empty-state">
        <div class="empty-icon">📋</div>
        <h3>No exam history yet</h3>
        <p>Complete an exam to see your history here.</p>
        <button class="btn btn-primary" onclick="app.navigateProtected('exam-setup-screen')">Start an Exam</button>
      </div>`;
      return;
    }

    container.innerHTML = attempts.map(a => {
      const d = new Date(a.submittedAt);
      const mm = Math.floor(a.timeTaken / 60), ss = a.timeTaken % 60;
      const pctClass = a.percentage >= 75 ? 'high' : a.percentage >= 50 ? 'mid' : 'low';
      return `
        <div class="history-card">
          <div class="history-card-left">
            <span class="history-category">${a.config.category}</span>
            <span class="exam-badge diff-${a.config.difficulty.toLowerCase()}">${a.config.difficulty}</span>
          </div>
          <div class="history-card-center">
            <div class="history-meta">${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>
            <div class="history-stats">${a.config.numQuestions} Qs · ${mm}m ${ss}s · ✅${a.correct} ❌${a.incorrect}</div>
          </div>
          <div class="history-card-right">
            <span class="history-score ${pctClass}">${a.percentage}%</span>
            <div class="history-actions">
              <button class="btn btn-sm btn-secondary" onclick="ExamEngine.viewResult('${a.id}')">View</button>
              <button class="btn btn-sm btn-primary" onclick="ExamEngine.retakeExam(${JSON.stringify(a.config).replace(/"/g,'&quot;')})">Retake</button>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  function viewResult(attemptId) {
    const attempt = DB.getAttempt(attemptId);
    if (attempt) renderResults(attempt);
  }

  function retakeExam(config) {
    app.navigateProtected('exam-setup-screen');
    // Pre-fill form
    const catSel = el('exam-setup-category');
    const diffSel = el('exam-setup-difficulty');
    const numSel = el('exam-setup-numq');
    if (catSel) catSel.value = config.category;
    if (diffSel) diffSel.value = config.difficulty;
    if (numSel) numSel.value = config.numQuestions;
    updateDurationPreview();
  }

  /* ─── Duration preview ───────────────────────────────── */
  function updateDurationPreview() {
    const cat = el('exam-setup-category')?.value || 'All';
    const diff = el('exam-setup-difficulty')?.value || 'Medium';
    const num = parseInt(el('exam-setup-numq')?.value || 10);
    const secs = num * (DURATIONS[diff] || 60);
    setText('exam-duration-preview', `${Math.floor(secs/60)} minutes`);
    setText('exam-marks-preview', `${num * (MARKS[diff]?.correct || 1)} marks`);

    // Availability check
    let pool = questions;
    if (cat !== 'All') pool = pool.filter(q => q.topic === cat);
    if (diff !== 'All') pool = pool.filter(q => q.difficulty === diff);
    const avail = el('exam-available-count');
    if (avail) {
      avail.textContent = `${pool.length} questions available`;
      avail.className = pool.length >= num ? 'avail-ok' : 'avail-warn';
    }
  }

  /* ─── Sync State to localStorage ────────────────────── */
  function syncState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }

  /* ─── Public API ─────────────────────────────────────── */
  return {
    renderSetup,
    startExam,
    tryRestoreExam,
    selectAnswer,
    clearAnswer,
    toggleMarkForReview,
    goToQuestion,
    prevQuestion,
    nextQuestion,
    attemptSubmit,
    cancelSubmit,
    confirmSubmit,
    renderReview,
    renderHistory,
    viewResult,
    retakeExam,
    updateDurationPreview,
    getState: () => state,
    hasActiveExam: () => !!localStorage.getItem(STORAGE_KEY)
  };
})();
