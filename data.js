/* =========================================================
   data.js — QuizSpace Data Layer
   Centralised localStorage storage and retrieval.
   All data operations go through this module.
   PROTOTYPE NOTE: localStorage is not tamper-proof.
   Results here are client-side only.
   ========================================================= */

const DB = {
  KEYS: {
    ATTEMPTS : 'qs_attempts',
    GOALS    : 'qs_goals',
    SETTINGS : 'qs_settings',
  },

  /* ── Helpers ─────────────────────────────────────── */
  _get(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
  },
  _getObj(key, def = {}) {
    try { return JSON.parse(localStorage.getItem(key)) || def; }
    catch { return def; }
  },
  _set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch { console.error('DB write failed', key); return false; }
  },

  /* ── Attempts ────────────────────────────────────── */
  getAttempts(userId) {
    const all = this._get(this.KEYS.ATTEMPTS);
    if (!userId) return all;
    if (userId === 'guest') {
      return all.filter(a => !a.userId || a.userId === 'guest');
    }
    // For logged-in user: match their userId.
    // Also claim any unassigned or guest attempts so previous progress is preserved.
    let migrated = false;
    all.forEach(a => {
      if (!a.userId || a.userId === 'guest') {
        a.userId = userId;
        migrated = true;
      }
    });
    if (migrated) {
      this._set(this.KEYS.ATTEMPTS, all);
    }
    return all.filter(a => a.userId === userId);
  },

  saveAttempt(attempt) {
    if (!attempt || !attempt.id) return false;
    const all = this._get(this.KEYS.ATTEMPTS);
    const existingIndex = all.findIndex(a => a.id === attempt.id);
    if (existingIndex >= 0) {
      all[existingIndex] = attempt;
    } else {
      all.push(attempt);
    }
    return this._set(this.KEYS.ATTEMPTS, all);
  },

  getAttempt(attemptId) {
    return this._get(this.KEYS.ATTEMPTS).find(a => a.id === attemptId) || null;
  },

  /* ── Goals ───────────────────────────────────────── */
  getGoals(userId) {
    const all = this._getObj(this.KEYS.GOALS, {});
    return all[userId] || { dailyQuestions: 10, weeklyExams: 3, targetScore: 80 };
  },

  saveGoals(userId, goals) {
    const all = this._getObj(this.KEYS.GOALS, {});
    all[userId] = goals;
    return this._set(this.KEYS.GOALS, all);
  },

  /* ── Analytics helpers ───────────────────────────── */
  computeAnalytics(userId) {
    const attempts = this.getAttempts(userId).filter(a => a.status === 'completed');
    if (attempts.length === 0) return null;

    const scores = attempts.map(a => a.percentage);
    const totalQ = attempts.reduce((s, a) => s + (a.config?.numQuestions || 0), 0);
    const totalCorrect = attempts.reduce((s, a) => s + a.correct, 0);
    const totalTime = attempts.reduce((s, a) => s + (a.timeTaken || 0), 0);

    // Category breakdown
    const catMap = {};
    attempts.forEach(a => {
      const cat = a.config?.category || 'General';
      if (!catMap[cat]) catMap[cat] = { attempts: 0, scores: [], correct: 0, total: 0 };
      catMap[cat].attempts++;
      catMap[cat].scores.push(a.percentage);
      catMap[cat].correct += a.correct;
      catMap[cat].total += (a.config?.numQuestions || 0);
    });

    // Difficulty breakdown
    const diffMap = {};
    attempts.forEach(a => {
      const d = a.config?.difficulty || 'Mixed';
      if (!diffMap[d]) diffMap[d] = { attempts: 0, scores: [], correct: 0, total: 0 };
      diffMap[d].attempts++;
      diffMap[d].scores.push(a.percentage);
      diffMap[d].correct += a.correct;
      diffMap[d].total += (a.config?.numQuestions || 0);
    });

    // Streak calculation
    const daySet = new Set(
      attempts.map(a => new Date(a.submittedAt).toDateString())
    );
    const days = [...daySet].map(d => new Date(d)).sort((a, b) => b - a);
    let streak = 0;
    let cur = new Date(); cur.setHours(0,0,0,0);
    for (const d of days) {
      const dd = new Date(d); dd.setHours(0,0,0,0);
      if (Math.round((cur - dd) / 86400000) <= 1) { streak++; cur = dd; }
      else break;
    }

    // Today's activity
    const todayStr = new Date().toDateString();
    const todayAttempts = attempts.filter(a => new Date(a.submittedAt).toDateString() === todayStr);
    const todayQ = todayAttempts.reduce((s, a) => s + (a.config?.numQuestions || 0), 0);

    return {
      totalAttempts: attempts.length,
      avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      highestScore: Math.max(...scores),
      lowestScore: Math.min(...scores),
      accuracy: totalQ > 0 ? Math.round((totalCorrect / totalQ) * 100) : 0,
      totalQuestions: totalQ,
      totalCorrect,
      totalTime,
      streak,
      todayExams: todayAttempts.length,
      todayQuestions: todayQ,
      categoryBreakdown: catMap,
      difficultyBreakdown: diffMap,
      scoreHistory: attempts
        .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt))
        .map(a => ({
          date: a.submittedAt,
          score: a.percentage,
          category: a.config?.category,
          attemptId: a.id
        })),
      recentAttempts: attempts.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)).slice(0, 5)
    };
  },

  /* ── Goal progress ───────────────────────────────── */
  getGoalProgress(userId) {
    const goals = this.getGoals(userId);
    const attempts = this.getAttempts(userId).filter(a => a.status === 'completed');
    const todayStr = new Date().toDateString();
    const weekAgo = Date.now() - 7 * 86400000;

    const todayQ = attempts
      .filter(a => new Date(a.submittedAt).toDateString() === todayStr)
      .reduce((s, a) => s + (a.config?.numQuestions || 0), 0);

    const weekExams = attempts
      .filter(a => new Date(a.submittedAt).getTime() >= weekAgo)
      .length;

    const scores = attempts.map(a => a.percentage);
    const avgScore = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;

    return {
      goals,
      dailyProgress: Math.min(100, Math.round((todayQ / goals.dailyQuestions) * 100)),
      weeklyProgress: Math.min(100, Math.round((weekExams / goals.weeklyExams) * 100)),
      scoreProgress: Math.min(100, Math.round((avgScore / goals.targetScore) * 100)),
      todayQ, weekExams, avgScore
    };
  }
};
