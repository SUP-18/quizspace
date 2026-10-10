/* =========================================================
   script.js — QuizSpace Application Logic
   Coordinates routing, sidebar, quick quiz, exam events,
   dashboard stats, achievements, goals, and settings.
   ========================================================= */

/* ─── Theme ──────────────────────────────────────────── */
function applyTheme(isDark) {
  const btn = document.getElementById('theme-toggle');
  if (isDark) {
    document.body.classList.remove('light-mode');
    if (btn) { btn.textContent = '☀️'; btn.title = 'Switch to Light Mode'; }
  } else {
    document.body.classList.add('light-mode');
    if (btn) { btn.textContent = '🌙'; btn.title = 'Switch to Dark Mode'; }
  }
  localStorage.setItem('quizspace_theme', isDark ? 'dark' : 'light');
}

/* ─── App Router ─────────────────────────────────────── */
const app = {
  navigate(screenId) {
    document.querySelectorAll('.public-screen').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');
  },

  navigateProtected(screenId) {
    document.querySelectorAll('.protected-screen').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');

    // Sync sidebar active state
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.target === screenId);
    });

    // Close sidebar on mobile
    if (window.innerWidth <= 768) closeSidebar();

    // Trigger page-specific renders
    const userId = Auth.currentUser?.id;
    if (screenId === 'analytics-screen') Analytics.render(userId);
    if (screenId === 'exam-history-screen') refreshHistory();
    if (screenId === 'achievements-screen') renderAchievements();
    if (screenId === 'dashboard-screen') refreshDashboard();
    if (screenId === 'settings-screen') populateSettings();
    if (screenId === 'exam-setup-screen') ExamEngine.updateDurationPreview();
  },

  showLayout(layoutId) {
    document.querySelectorAll('.layout-container').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(layoutId);
    if (target) target.classList.add('active');
  }
};

/* ─── Sidebar ────────────────────────────────────────── */
function openSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.add('open');
  if (overlay) overlay.classList.add('visible');
}
function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('visible');
}
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar && sidebar.classList.contains('open')) closeSidebar();
  else openSidebar();
}

/* ─── Auth Handlers ──────────────────────────────────── */
const authHandlers = {
  togglePassword(inputId) {
    const input = document.getElementById(inputId);
    if (input) input.type = input.type === 'password' ? 'text' : 'password';
  },
  async handleLogin() {
    const email = document.getElementById('login-email')?.value;
    const pass  = document.getElementById('login-password')?.value;
    const errorEl = document.getElementById('login-error');
    try {
      if (errorEl) errorEl.textContent = 'Signing in...';
      await Auth.login(email, pass);
    } catch (err) {
      if (errorEl) errorEl.textContent = err.message;
    }
  },
  async handleSignup() {
    const name     = document.getElementById('signup-name')?.value;
    const username = document.getElementById('signup-username')?.value;
    const email    = document.getElementById('signup-email')?.value;
    const pass     = document.getElementById('signup-password')?.value;
    const confirm  = document.getElementById('signup-confirm')?.value;
    const errorEl  = document.getElementById('signup-error');
    if (pass !== confirm) {
      if (errorEl) errorEl.textContent = 'Passwords do not match.';
      return;
    }
    try {
      if (errorEl) errorEl.textContent = 'Creating account...';
      await Auth.signup(email, pass, username, name);
    } catch (err) {
      if (errorEl) errorEl.textContent = err.message;
    }
  },
  async handleLogout() {
    await Auth.logout();
    app.showLayout('public-layout');
    app.navigate('landing-screen');
  },
  async handleReset() {
    const email = document.getElementById('reset-email')?.value;
    const msgEl = document.getElementById('reset-message');
    try {
      const msg = await Auth.resetPassword(email);
      if (msgEl) { msgEl.textContent = msg; msgEl.style.color = 'var(--accent-correct)'; }
    } catch (err) {
      if (msgEl) { msgEl.textContent = err.message; msgEl.style.color = 'var(--accent-incorrect)'; }
    }
  }
};

/* Called by auth.js after login/signup without re-binding listeners */
function onLoginSuccess(user) {
  app.showLayout('protected-layout');
  app.navigateProtected('dashboard-screen');
  document.getElementById('nav-greeting').textContent = `Hello, ${user.name}!`;
  document.getElementById('dashboard-welcome').textContent = `Welcome back, ${user.name}!`;
  refreshDashboard();
  // Check for active exam to restore
  if (ExamEngine.hasActiveExam()) {
    if (confirm('You have an unfinished exam. Continue?')) {
      ExamEngine.tryRestoreExam();
    } else {
      localStorage.removeItem('qs_active_exam');
    }
  }
}

/* ─── App Init ───────────────────────────────────────── */
function initApp() {
  Auth.init(user => {
    if (user) {
      app.showLayout('protected-layout');
      app.navigateProtected('dashboard-screen');
      const greetEl = document.getElementById('nav-greeting');
      const welcomeEl = document.getElementById('dashboard-welcome');
      if (greetEl) greetEl.textContent = `Hello, ${user.name}!`;
      if (welcomeEl) welcomeEl.textContent = `Welcome back, ${user.name}!`;
      refreshDashboard();
    } else {
      app.showLayout('public-layout');
      app.navigate('landing-screen');
    }
  });

  // Sidebar nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => app.navigateProtected(item.dataset.target));
  });

  // Sidebar toggle & close
  const menuBtn = document.getElementById('menu-toggle');
  const closeBtn = document.getElementById('sidebar-close-btn');
  const overlay  = document.getElementById('sidebar-overlay');
  if (menuBtn) menuBtn.addEventListener('click', toggleSidebar);
  if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
  if (overlay) overlay.addEventListener('click', closeSidebar);

  // Theme toggle
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      applyTheme(document.body.classList.contains('light-mode'));
    });
  }
  // Restore saved theme
  const savedTheme = localStorage.getItem('quizspace_theme');
  applyTheme(savedTheme === 'dark');

  // Exam setup duration preview
  ExamEngine.updateDurationPreview();
}

/* ─── Dashboard ──────────────────────────────────────── */
function refreshDashboard() {
  updateDashboardStats();
  renderRecentActivity();
}

function updateDashboardStats() {
  const userId = Auth.currentUser?.id;
  const data = DB.computeAnalytics(userId);
  if (!data) {
    ['stat-total-quizzes','stat-avg-score','stat-streak','stat-best-score']
      .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = id.includes('score') || id.includes('avg') ? '—' : '0'; });
    return;
  }
  const s = id => document.getElementById(id);
  if (s('stat-total-quizzes')) s('stat-total-quizzes').textContent = data.totalAttempts;
  if (s('stat-avg-score'))     s('stat-avg-score').textContent     = data.avgScore + '%';
  if (s('stat-streak'))        s('stat-streak').textContent        = data.streak + ' 🔥';
  if (s('stat-best-score'))    s('stat-best-score').textContent    = data.highestScore + '%';

  // Streak banner
  const banner = document.getElementById('streak-banner');
  const streakText = document.getElementById('streak-text');
  if (banner && data.streak >= 2) {
    banner.style.display = 'flex';
    if (streakText) streakText.textContent = `${data.streak}-day streak! Keep going! 🔥`;
  } else if (banner) {
    banner.style.display = 'none';
  }
}

function renderRecentActivity() {
  const userId = Auth.currentUser?.id;
  const attempts = DB.getAttempts(userId)
    .filter(a => a.status === 'completed')
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
    .slice(0, 5);
  const container = document.getElementById('dashboard-recent');
  if (!container) return;
  if (attempts.length === 0) {
    container.innerHTML = `<div class="empty-state small"><p>No exams yet. <a href="#" onclick="app.navigateProtected('exam-setup-screen')">Start one!</a></p></div>`;
    return;
  }
  container.innerHTML = attempts.map(a => {
    const pctClass = a.percentage >= 75 ? 'high' : a.percentage >= 50 ? 'mid' : 'low';
    const d = new Date(a.submittedAt);
    return `<div class="activity-row">
      <span class="activity-cat">${a.config.category}</span>
      <span class="exam-badge diff-${a.config.difficulty.toLowerCase()}">${a.config.difficulty}</span>
      <span class="activity-date">${d.toLocaleDateString()}</span>
      <span class="history-score ${pctClass}">${a.percentage}%</span>
      <button class="btn btn-sm btn-secondary" onclick="ExamEngine.viewResult('${a.id}')">View</button>
    </div>`;
  }).join('');
}

/* ─── Exam Setup Handler ─────────────────────────────── */
function handleStartExam() {
  const category = document.getElementById('exam-setup-category')?.value || 'All';
  const difficulty = document.getElementById('exam-setup-difficulty')?.value || 'Medium';
  const numQ = parseInt(document.getElementById('exam-setup-numq')?.value || 10);
  const negativeMarking = document.getElementById('exam-negative-marking')?.checked || false;

  const config = {
    category,
    difficulty: difficulty === 'All' ? 'Medium' : difficulty,
    numQuestions: numQ,
    negativeMarking,
    title: `${category} — ${difficulty}`
  };

  ExamEngine.startExam(config);
}

/* ─── Results page handlers ──────────────────────────── */
function handleReviewClick(btn) {
  const attemptId = btn.getAttribute('data-attempt');
  if (attemptId) ExamEngine.renderReview(attemptId);
}
function handleRetakeClick(btn) {
  try {
    const config = JSON.parse(btn.getAttribute('data-config'));
    ExamEngine.retakeExam(config);
  } catch { app.navigateProtected('exam-setup-screen'); }
}

/* ─── History ────────────────────────────────────────── */
function refreshHistory() {
  const userId = Auth.currentUser?.id;
  ExamEngine.renderHistory(userId, {
    category: document.getElementById('history-cat-filter')?.value || 'All',
    difficulty: document.getElementById('history-diff-filter')?.value || 'All',
    sort: document.getElementById('history-sort')?.value || 'newest',
    search: document.getElementById('history-search')?.value || ''
  });
}

/* ─── Achievements ───────────────────────────────────── */
function renderAchievements() {
  const userId = Auth.currentUser?.id;
  const attempts = DB.getAttempts(userId).filter(a => a.status === 'completed');
  const data = DB.computeAnalytics(userId);

  const badges = [
    { id:'first',   icon:'🎯', name:'First Exam',       desc:'Complete your first exam.',          unlocked: attempts.length >= 1 },
    { id:'five',    icon:'📝', name:'5 Exams',           desc:'Complete 5 exams.',                  unlocked: attempts.length >= 5 },
    { id:'ten',     icon:'🏅', name:'10 Exams',          desc:'Complete 10 exams.',                 unlocked: attempts.length >= 10 },
    { id:'perfect', icon:'💯', name:'Perfect Score',     desc:'Score 100% on any exam.',            unlocked: attempts.some(a => a.percentage === 100) },
    { id:'ace',     icon:'🌟', name:'Ace',               desc:'Score 90%+ on any exam.',            unlocked: attempts.some(a => a.percentage >= 90) },
    { id:'streak3', icon:'🔥', name:'3-Day Streak',      desc:'Maintain a 3-day study streak.',     unlocked: (data?.streak || 0) >= 3 },
    { id:'streak7', icon:'⚡', name:'7-Day Streak',      desc:'Maintain a 7-day study streak.',     unlocked: (data?.streak || 0) >= 7 },
    { id:'allcat',  icon:'🗂️', name:'Category Explorer', desc:'Complete exams in 3+ categories.',   unlocked: new Set(attempts.map(a => a.config.category)).size >= 3 },
    { id:'hard',    icon:'💪', name:'Hard Mode',         desc:'Complete a Hard difficulty exam.',   unlocked: attempts.some(a => a.config.difficulty === 'Hard') },
    { id:'speed',   icon:'⚡', name:'Speed Runner',      desc:'Complete an exam in under 5 mins.',  unlocked: attempts.some(a => a.timeTaken < 300) },
  ];

  const grid = document.getElementById('achievements-grid');
  if (!grid) return;
  grid.innerHTML = badges.map(b => `
    <div class="achievement-card ${b.unlocked ? 'unlocked' : 'locked'}">
      <div class="ach-icon">${b.icon}</div>
      <div class="ach-name">${b.name}</div>
      <div class="ach-desc">${b.desc}</div>
      ${b.unlocked ? '<div class="ach-badge">✅ Unlocked</div>' : '<div class="ach-badge locked-badge">🔒 Locked</div>'}
    </div>
  `).join('');
}

/* ─── Goal Editor ────────────────────────────────────── */
function showGoalEditor() {
  const userId = Auth.currentUser?.id;
  const goals = DB.getGoals(userId);
  const dailyInput = document.getElementById('goal-daily-input');
  const weeklyInput = document.getElementById('goal-weekly-input');
  const scoreInput = document.getElementById('goal-score-input');
  if (dailyInput) dailyInput.value = goals.dailyQuestions;
  if (weeklyInput) weeklyInput.value = goals.weeklyExams;
  if (scoreInput) scoreInput.value = goals.targetScore;
  const modal = document.getElementById('goal-editor-modal');
  if (modal) modal.classList.add('visible');
}
function closeGoalEditor() {
  const modal = document.getElementById('goal-editor-modal');
  if (modal) modal.classList.remove('visible');
}
function saveGoals() {
  const userId = Auth.currentUser?.id;
  DB.saveGoals(userId, {
    dailyQuestions: parseInt(document.getElementById('goal-daily-input')?.value || 10),
    weeklyExams: parseInt(document.getElementById('goal-weekly-input')?.value || 3),
    targetScore: parseInt(document.getElementById('goal-score-input')?.value || 80)
  });
  closeGoalEditor();
  Analytics.render(userId);
}

/* ─── Settings ───────────────────────────────────────── */
function populateSettings() {
  const user = Auth.currentUser;
  if (!user) return;
  const nameEl = document.getElementById('settings-name');
  const userEl = document.getElementById('settings-username');
  const emailEl = document.getElementById('settings-email');
  if (nameEl) nameEl.value = user.name || '';
  if (userEl) userEl.value = user.username || '';
  if (emailEl) emailEl.value = user.email || '';
}
function saveProfileSettings() {
  if (!Auth.currentUser) return;
  const newName = document.getElementById('settings-name')?.value;
  if (newName) {
    Auth.currentUser.name = newName;
    localStorage.setItem('quizspace_session', JSON.stringify(Auth.currentUser));
    document.getElementById('nav-greeting').textContent = `Hello, ${newName}!`;
    document.getElementById('dashboard-welcome').textContent = `Welcome back, ${newName}!`;
    alert('Profile updated!');
  }
}

/* ─── Analytics Goal Bars (wired into DB) ────────────── */
// Override the Analytics.renderGoalProgress to use named element IDs
(function patchGoalProgress() {
  const orig = Analytics.renderGoalProgress.bind(Analytics);
  Analytics.renderGoalProgress = function(userId) {
    const gp = DB.getGoalProgress(userId);
    // Goal text labels
    const dLabel = document.getElementById('goal-daily-text');
    const wLabel = document.getElementById('goal-weekly-text');
    const sLabel = document.getElementById('goal-score-text');
    if (dLabel) dLabel.textContent = `${gp.todayQ}/${gp.goals.dailyQuestions}`;
    if (wLabel) wLabel.textContent = `${gp.weekExams}/${gp.goals.weeklyExams}`;
    if (sLabel) sLabel.textContent = `${gp.avgScore}%/${gp.goals.targetScore}%`;

    const dBar = document.getElementById('goal-daily-bar');
    const wBar = document.getElementById('goal-weekly-bar');
    const sBar = document.getElementById('goal-score-bar');
    if (dBar) dBar.style.width = gp.dailyProgress + '%';
    if (wBar) wBar.style.width = gp.weeklyProgress + '%';
    if (sBar) sBar.style.width = gp.scoreProgress + '%';

    const dT2 = document.getElementById('goal-daily-text2');
    const wT2 = document.getElementById('goal-weekly-text2');
    const sT2 = document.getElementById('goal-score-text2');
    if (dT2) dT2.textContent = `${gp.dailyProgress}% of daily goal`;
    if (wT2) wT2.textContent = `${gp.weeklyProgress}% of weekly goal`;
    if (sT2) sT2.textContent = `${gp.scoreProgress}% of score target`;
  };
})();


/* =========================================================
   QUICK QUIZ ENGINE (preserved)
   ========================================================= */
const QUICK_QUESTIONS = questions; // uses full bank
let TOTAL_QUESTIONS = QUICK_QUESTIONS.length;
const TIMER_DURATION = 600;

let currentIndex = 0;
let score = 0;
let timeLeft = TIMER_DURATION;
let timerInterval = null;
let userAnswers = new Array(TOTAL_QUESTIONS).fill(-1);
let answeredCorrectly = new Array(TOTAL_QUESTIONS).fill(false);
let hintUsed = new Array(TOTAL_QUESTIONS).fill(false);

// Element references (grabbed safely after DOM ready)
let startBtn, restartBtn, timerDisplay, timerBox, questionCounter,
    progressBar, progressLabel, questionNumber, questionText,
    hintBtn, hintTextEl, optionsGrid, feedbackEl, feedbackMsgEl,
    solutionTextEl, prevBtn, nextBtn, trophyEl, scorePointsEl,
    scorePercentEl, correctCountEl, incorrectCountEl, hintsCountEl,
    gradeMessageEl, scoreCircleEl;

function initQuickQuizElements() {
  startBtn       = document.getElementById('start-btn');
  restartBtn     = document.getElementById('restart-btn');
  timerDisplay   = document.getElementById('timer-display');
  timerBox       = document.getElementById('timer-box');
  questionCounter= document.getElementById('question-counter');
  progressBar    = document.getElementById('progress-bar');
  progressLabel  = document.getElementById('progress-label');
  questionNumber = document.getElementById('question-number');
  questionText   = document.getElementById('question-text');
  hintBtn        = document.getElementById('hint-btn');
  hintTextEl     = document.getElementById('hint-text');
  optionsGrid    = document.getElementById('options-grid');
  feedbackEl     = document.getElementById('feedback');
  feedbackMsgEl  = document.getElementById('feedback-message');
  solutionTextEl = document.getElementById('solution-text');
  prevBtn        = document.getElementById('prev-btn');
  nextBtn        = document.getElementById('next-btn');
  trophyEl       = document.getElementById('trophy');
  scorePointsEl  = document.getElementById('score-points');
  scorePercentEl = document.getElementById('score-percent');
  correctCountEl = document.getElementById('correct-count');
  incorrectCountEl= document.getElementById('incorrect-count');
  hintsCountEl   = document.getElementById('hints-count');
  gradeMessageEl = document.getElementById('grade-message');
  scoreCircleEl  = document.getElementById('score-circle');

  if (startBtn) startBtn.addEventListener('click', startQuickQuiz);
  if (restartBtn) restartBtn.addEventListener('click', () => app.navigateProtected('dashboard-screen'));
  if (hintBtn) hintBtn.addEventListener('click', () => {
    if (!hintTextEl) return;
    hintTextEl.textContent = '💡 Hint: ' + QUICK_QUESTIONS[currentIndex].hint;
    hintTextEl.style.display = 'block';
    hintBtn.disabled = true;
    hintUsed[currentIndex] = true;
  });
  if (nextBtn) nextBtn.addEventListener('click', () => {
    if (currentIndex < TOTAL_QUESTIONS - 1) { currentIndex++; if (nextBtn) nextBtn.textContent = 'Next ➡'; renderQuickQuestion(); }
    else { showQuickResults(); }
  });
  if (prevBtn) prevBtn.addEventListener('click', () => {
    if (currentIndex > 0) { currentIndex--; if (nextBtn) nextBtn.textContent = 'Next ➡'; if (nextBtn) nextBtn.disabled = userAnswers[currentIndex] === -1; renderQuickQuestion(); }
  });
}

function startQuickTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    updateQuickTimerDisplay();
    if (timerBox) { timerBox.classList.remove('warning','danger'); }
    if (timeLeft <= 30 && timerBox) timerBox.classList.add('danger');
    else if (timeLeft <= 120 && timerBox) timerBox.classList.add('warning');
    if (timeLeft <= 0) { clearInterval(timerInterval); showQuickResults(); }
  }, 1000);
}
function stopQuickTimer() { clearInterval(timerInterval); }
function updateQuickTimerDisplay() {
  if (!timerDisplay) return;
  const m = String(Math.floor(timeLeft/60)).padStart(2,'0');
  const s = String(timeLeft%60).padStart(2,'0');
  timerDisplay.textContent = `${m}:${s}`;
}
function updateQuickProgress() {
  const answered = userAnswers.filter(a => a !== -1).length;
  const pct = Math.round((answered/TOTAL_QUESTIONS)*100);
  if (progressBar) progressBar.style.width = pct+'%';
  if (progressLabel) progressLabel.textContent = pct+'% Complete';
}
function renderQuickQuestion() {
  const q = QUICK_QUESTIONS[currentIndex];
  if (questionNumber) questionNumber.textContent = `Q${currentIndex+1}`;
  if (questionText) questionText.textContent = q.question;
  if (questionCounter) questionCounter.textContent = `Question ${currentIndex+1} / ${TOTAL_QUESTIONS}`;
  if (!optionsGrid) return;
  optionsGrid.innerHTML = '';
  if (feedbackEl) feedbackEl.className = 'feedback';
  if (feedbackMsgEl) feedbackMsgEl.textContent = '';
  if (solutionTextEl) solutionTextEl.textContent = '';
  if (hintTextEl) hintTextEl.style.display = 'none';
  if (hintBtn) hintBtn.disabled = false;

  if (hintUsed[currentIndex]) {
    if (hintTextEl) { hintTextEl.textContent = '💡 Hint: '+q.hint; hintTextEl.style.display='block'; }
    if (hintBtn) hintBtn.disabled = true;
  }

  const letters = ['A','B','C','D'];
  const prev = userAnswers[currentIndex];
  q.options.forEach((optText, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = `${letters[i]}) ${optText}`;
    if (prev !== -1) {
      btn.disabled = true;
      if (i === q.answer) btn.classList.add('correct');
      if (i === prev && prev !== q.answer) btn.classList.add('incorrect');
      if (i === prev) btn.classList.add('selected');
      if (hintBtn) hintBtn.disabled = true;
      showQuickFeedback(prev === q.answer);
    }
    btn.addEventListener('click', () => handleQuickOption(i));
    optionsGrid.appendChild(btn);
  });
  if (prevBtn) prevBtn.disabled = currentIndex === 0;
  if (nextBtn) nextBtn.disabled = userAnswers[currentIndex] === -1;
  updateQuickProgress();
}
function handleQuickOption(selected) {
  const q = QUICK_QUESTIONS[currentIndex];
  userAnswers[currentIndex] = selected;
  if (selected === q.answer && !answeredCorrectly[currentIndex]) { score++; answeredCorrectly[currentIndex]=true; }
  else if (selected !== q.answer && answeredCorrectly[currentIndex]) { score--; answeredCorrectly[currentIndex]=false; }
  optionsGrid.querySelectorAll('.option-btn').forEach((btn,i) => {
    btn.disabled = true;
    if (i===q.answer) btn.classList.add('correct');
    if (i===selected && selected!==q.answer) btn.classList.add('incorrect');
    if (i===selected) btn.classList.add('selected');
  });
  if (hintBtn) hintBtn.disabled = true;
  showQuickFeedback(selected===q.answer);
  if (nextBtn) nextBtn.disabled = false;
  updateQuickProgress();
  if (currentIndex===TOTAL_QUESTIONS-1 && nextBtn) nextBtn.textContent='Finish Quiz 🎉';
}
function showQuickFeedback(isCorrect) {
  const q = QUICK_QUESTIONS[currentIndex];
  if (!feedbackEl || !feedbackMsgEl) return;
  if (isCorrect) {
    feedbackMsgEl.textContent = '✅ Correct! Well done.';
    feedbackEl.className = 'feedback correct';
  } else {
    feedbackMsgEl.textContent = `❌ Incorrect. Correct: ${['A','B','C','D'][q.answer]}) ${q.options[q.answer]}`;
    feedbackEl.className = 'feedback incorrect';
  }
  if (solutionTextEl) solutionTextEl.textContent = 'Solution: '+q.solution;
}
function showQuickResults() {
  stopQuickTimer();
  const totalAnswered = userAnswers.filter(a => a !== -1).length;
  const correct = score;
  const incorrect = totalAnswered - correct;
  const pct = Math.round((correct/TOTAL_QUESTIONS)*100);
  const totalHints = hintUsed.filter(Boolean).length;

  if (scorePointsEl) scorePointsEl.textContent = `${correct}/${TOTAL_QUESTIONS}`;
  if (scorePercentEl) scorePercentEl.textContent = pct+'%';
  if (correctCountEl) correctCountEl.textContent = correct;
  if (incorrectCountEl) incorrectCountEl.textContent = incorrect;
  if (hintsCountEl) hintsCountEl.textContent = totalHints;
  if (scoreCircleEl) scoreCircleEl.style.background = `conic-gradient(#6c63ff ${pct}%, rgba(255,255,255,0.05) ${pct}%)`;

  if (pct===100) { if(trophyEl) trophyEl.textContent='🏆'; if(gradeMessageEl) gradeMessageEl.textContent='Perfect score! You\'re a programming genius!'; }
  else if (pct>=80) { if(trophyEl) trophyEl.textContent='🌟'; if(gradeMessageEl) gradeMessageEl.textContent='Excellent work!'; }
  else if (pct>=60) { if(trophyEl) trophyEl.textContent='👍'; if(gradeMessageEl) gradeMessageEl.textContent='Good job! Keep practicing.'; }
  else { if(trophyEl) trophyEl.textContent='📚'; if(gradeMessageEl) gradeMessageEl.textContent='Keep going! Review and try again.'; }

  app.navigateProtected('results-screen');
}
function startQuickQuiz() {
  currentIndex=0; score=0; timeLeft=TIMER_DURATION;
  userAnswers=new Array(TOTAL_QUESTIONS).fill(-1);
  answeredCorrectly=new Array(TOTAL_QUESTIONS).fill(false);
  hintUsed=new Array(TOTAL_QUESTIONS).fill(false);
  if (timerBox) timerBox.classList.remove('warning','danger');
  updateQuickTimerDisplay();
  if (nextBtn) nextBtn.textContent='Next ➡';
  renderQuickQuestion();
  app.navigateProtected('quiz-screen');
  startQuickTimer();
}

/* ─── START ──────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  initQuickQuizElements();
});
