/* =========================================================
   analytics.js — QuizSpace Analytics Dashboard
   Renders charts and KPIs from real exam data.
   Uses vanilla JS canvas-based charts (no external libs).
   ========================================================= */

const Analytics = (() => {

  const el = id => document.getElementById(id);
  const setText = (id, txt) => { if (el(id)) el(id).textContent = txt; };
  const fmt = n => isNaN(n) ? '—' : n;

  /* ─── Main Render ────────────────────────────────────── */
  function render(userId) {
    const data = DB.computeAnalytics(userId);
    renderKPIs(data);
    renderGoalProgress(userId);
    renderInsights(data);
    if (data) {
      renderScoreTrendChart(data.scoreHistory);
      renderCategoryChart(data.categoryBreakdown);
      renderDifficultyChart(data.difficultyBreakdown);
      renderAnswerDonut(data);
    }
  }

  /* ─── KPI Cards ──────────────────────────────────────── */
  function renderKPIs(data) {
    if (!data) {
      ['kpi-total','kpi-avg','kpi-highest','kpi-lowest','kpi-accuracy','kpi-totalq','kpi-time','kpi-streak']
        .forEach(id => setText(id, '—'));
      return;
    }
    setText('kpi-total', data.totalAttempts);
    setText('kpi-avg', data.avgScore + '%');
    setText('kpi-highest', data.highestScore + '%');
    setText('kpi-lowest', data.lowestScore + '%');
    setText('kpi-accuracy', data.accuracy + '%');
    setText('kpi-totalq', data.totalQuestions);
    const h = Math.floor(data.totalTime / 3600);
    const m = Math.floor((data.totalTime % 3600) / 60);
    setText('kpi-time', h > 0 ? `${h}h ${m}m` : `${m}m`);
    setText('kpi-streak', data.streak + ' days');
  }

  /* ─── Goal Progress ──────────────────────────────────── */
  function renderGoalProgress(userId) {
    const gp = DB.getGoalProgress(userId);
    setProgress('goal-daily', gp.dailyProgress, `${gp.todayQ}/${gp.goals.dailyQuestions} questions`);
    setProgress('goal-weekly', gp.weeklyProgress, `${gp.weekExams}/${gp.goals.weeklyExams} exams`);
    setProgress('goal-score', gp.scoreProgress, `${gp.avgScore}%/${gp.goals.targetScore}%`);
  }

  function setProgress(id, pct, label) {
    const bar = el(id + '-bar');
    const txt = el(id + '-text');
    if (bar) bar.style.width = pct + '%';
    if (txt) txt.textContent = label;
  }

  /* ─── Personalized Insights ──────────────────────────── */
  function renderInsights(data) {
    const container = el('insights-container');
    if (!container) return;
    if (!data || data.totalAttempts < 1) {
      container.innerHTML = `<div class="insight-card neutral">
        <span>🎯</span> Complete your first exam to get personalized insights!
      </div>`;
      return;
    }

    const insights = [];
    const cb = data.categoryBreakdown;

    // Best/worst category
    const cats = Object.entries(cb).filter(([, v]) => v.attempts >= 2);
    if (cats.length >= 2) {
      const avgFn = scores => scores.reduce((a, b) => a + b, 0) / scores.length;
      const sorted = cats.sort((a, b) => avgFn(b[1].scores) - avgFn(a[1].scores));
      insights.push({ icon: '🌟', text: `You perform best in <strong>${sorted[0][0]}</strong> with an average of ${Math.round(avgFn(sorted[0][1].scores))}%.`, type: 'positive' });
      insights.push({ icon: '📚', text: `Consider more practice in <strong>${sorted[sorted.length-1][0]}</strong> (avg: ${Math.round(avgFn(sorted[sorted.length-1][1].scores))}%).`, type: 'tip' });
    }

    // Trend insight (last 3 attempts)
    if (data.scoreHistory.length >= 3) {
      const recent = data.scoreHistory.slice(-3).map(h => h.score);
      if (recent[2] > recent[0]) insights.push({ icon: '📈', text: 'Your scores are <strong>improving</strong> over recent attempts. Keep it up!', type: 'positive' });
      else if (recent[2] < recent[0]) insights.push({ icon: '📉', text: 'Your recent scores have dipped slightly. Try reviewing weaker topics.', type: 'tip' });
    }

    // Streak insight
    if (data.streak >= 3) insights.push({ icon: '🔥', text: `You have a <strong>${data.streak}-day streak</strong>! Great consistency!`, type: 'positive' });
    else if (data.streak === 0) insights.push({ icon: '⚠️', text: 'You have not attempted a quiz recently. Start one today!', type: 'warning' });

    // Accuracy insight
    if (data.accuracy >= 80) insights.push({ icon: '🎯', text: `Excellent accuracy at <strong>${data.accuracy}%</strong>. You know your material!`, type: 'positive' });
    else if (data.accuracy < 50) insights.push({ icon: '💡', text: `Your accuracy is ${data.accuracy}%. Focus on understanding explanations after each question.`, type: 'tip' });

    if (insights.length === 0)
      insights.push({ icon: '✨', text: 'Complete more exams to unlock detailed insights!', type: 'neutral' });

    container.innerHTML = insights.map(i =>
      `<div class="insight-card ${i.type}"><span class="insight-icon">${i.icon}</span><span>${i.text}</span></div>`
    ).join('');
  }

  /* ─── Charts (Pure Canvas) ───────────────────────────── */

  function getChartColors() {
    const isDark = !document.body.classList.contains('light-mode');
    return {
      text: isDark ? '#a7a9be' : '#5a6c7d',
      grid: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
      bg: isDark ? '#1a1a2e' : '#ffffff'
    };
  }

  // Line chart — score trend
  function renderScoreTrendChart(history) {
    const canvas = el('score-trend-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const colors = getChartColors();

    if (!history || history.length === 0) {
      drawEmptyState(ctx, canvas, 'No exam history yet');
      return;
    }

    const W = canvas.width = canvas.offsetWidth * devicePixelRatio || 600;
    const H = canvas.height = 220 * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    const w = canvas.offsetWidth, h = 220;
    const pad = { top: 20, right: 20, bottom: 40, left: 45 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;

    ctx.clearRect(0, 0, w, h);

    const scores = history.map(d => d.score);
    const labels = history.map(d => {
      const dt = new Date(d.date);
      return `${dt.getDate()}/${dt.getMonth()+1}`;
    });

    const maxY = 100, minY = 0;
    const xStep = chartW / Math.max(scores.length - 1, 1);

    // Grid lines
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (chartH / 4) * i;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + chartW, y); ctx.stroke();
      ctx.fillStyle = colors.text;
      ctx.font = `${11 * devicePixelRatio}px Inter, sans-serif`;
      ctx.fillText(100 - i * 25 + '%', 0, y + 4);
    }

    if (scores.length === 1) {
      // Single dot
      const x = pad.left + chartW / 2;
      const y = pad.top + chartH * (1 - scores[0] / 100);
      ctx.fillStyle = '#6c63ff';
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = colors.text;
      ctx.fillText(labels[0], x - 10, h - 10);
      return;
    }

    // Area fill
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
    grad.addColorStop(0, 'rgba(108,99,255,0.3)');
    grad.addColorStop(1, 'rgba(108,99,255,0)');
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top + chartH * (1 - scores[0] / 100));
    scores.forEach((s, i) => {
      ctx.lineTo(pad.left + i * xStep, pad.top + chartH * (1 - s / 100));
    });
    ctx.lineTo(pad.left + (scores.length - 1) * xStep, pad.top + chartH);
    ctx.lineTo(pad.left, pad.top + chartH);
    ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = '#6c63ff';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    scores.forEach((s, i) => {
      const x = pad.left + i * xStep;
      const y = pad.top + chartH * (1 - s / 100);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Dots & labels
    scores.forEach((s, i) => {
      const x = pad.left + i * xStep;
      const y = pad.top + chartH * (1 - s / 100);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#6c63ff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI*2); ctx.stroke();
      // Label
      ctx.fillStyle = colors.text;
      ctx.font = `${10 * devicePixelRatio}px Inter`;
      ctx.textAlign = 'center';
      ctx.fillText(labels[i], x, h - 8);
    });
  }

  // Bar chart — category performance
  function renderCategoryChart(breakdown) {
    const canvas = el('category-chart-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const colors = getChartColors();

    const cats = Object.keys(breakdown);
    if (cats.length === 0) { drawEmptyState(ctx, canvas, 'No category data yet'); return; }

    const W = canvas.width = canvas.offsetWidth * devicePixelRatio || 600;
    const H = canvas.height = 220 * devicePixelRatio;
    const w = canvas.offsetWidth, h = 220;
    const pad = { top: 20, right: 20, bottom: 50, left: 45 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;

    ctx.clearRect(0, 0, w, h);
    const avgFn = arr => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : 0;

    const barW = chartW / cats.length * 0.6;
    const gap   = chartW / cats.length;
    const catColors = ['#6c63ff','#3ecfcf','#f06292','#ffb347','#98fb98','#87ceeb','#dda0dd'];

    // Grid
    ctx.strokeStyle = colors.grid; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (chartH/4)*i;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left+chartW, y); ctx.stroke();
      ctx.fillStyle = colors.text; ctx.font = `${10*devicePixelRatio}px Inter`;
      ctx.textAlign = 'right';
      ctx.fillText(100 - i*25 + '%', pad.left - 5, y + 4);
    }

    cats.forEach((cat, i) => {
      const avg = avgFn(breakdown[cat].scores);
      const barH = (avg / 100) * chartH;
      const x = pad.left + gap * i + (gap - barW) / 2;
      const y = pad.top + chartH - barH;

      ctx.fillStyle = catColors[i % catColors.length];
      ctx.beginPath();
      roundRect(ctx, x, y, barW, barH, 4);
      ctx.fill();

      // Value label on top
      ctx.fillStyle = colors.text; ctx.font = `bold ${10*devicePixelRatio}px Inter`;
      ctx.textAlign = 'center';
      ctx.fillText(avg + '%', x + barW/2, y - 5);

      // Category label
      ctx.font = `${9*devicePixelRatio}px Inter`;
      ctx.fillText(cat.length > 6 ? cat.slice(0,5)+'.' : cat, x + barW/2, pad.top + chartH + 16);
      ctx.fillStyle = colors.text + '88';
      ctx.fillText(breakdown[cat].attempts + 'x', x + barW/2, pad.top + chartH + 30);
    });
  }

  // Bar chart — difficulty
  function renderDifficultyChart(breakdown) {
    const canvas = el('difficulty-chart-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const colors = getChartColors();

    const diffs = ['Easy','Medium','Hard'].filter(d => breakdown[d]);
    if (diffs.length === 0) { drawEmptyState(ctx, canvas, 'No difficulty data yet'); return; }

    const w = canvas.offsetWidth, h = 200;
    canvas.width = w * devicePixelRatio; canvas.height = h * devicePixelRatio;
    const pad = { top:20, right:20, bottom:45, left:45 };
    const chartW = w - pad.left - pad.right, chartH = h - pad.top - pad.bottom;
    ctx.clearRect(0,0,w,h);

    const diffColors = { Easy:'#2ecc71', Medium:'#f39c12', Hard:'#e74c3c' };
    const barW = chartW / diffs.length * 0.55;
    const gap = chartW / diffs.length;
    const avgFn = arr => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : 0;

    for (let i=0;i<=4;i++) {
      const y = pad.top + (chartH/4)*i;
      ctx.strokeStyle = colors.grid; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(pad.left+chartW,y); ctx.stroke();
      ctx.fillStyle=colors.text; ctx.font=`${10*devicePixelRatio}px Inter`; ctx.textAlign='right';
      ctx.fillText(100-i*25+'%', pad.left-5, y+4);
    }

    diffs.forEach((d, i) => {
      const avg = avgFn(breakdown[d].scores);
      const barH = (avg/100)*chartH;
      const x = pad.left + gap*i + (gap-barW)/2;
      const y = pad.top + chartH - barH;
      ctx.fillStyle = diffColors[d];
      ctx.beginPath(); roundRect(ctx, x, y, barW, barH, 4); ctx.fill();
      ctx.fillStyle=colors.text; ctx.font=`bold ${10*devicePixelRatio}px Inter`; ctx.textAlign='center';
      ctx.fillText(avg+'%', x+barW/2, y-5);
      ctx.font=`${10*devicePixelRatio}px Inter`;
      ctx.fillText(d, x+barW/2, pad.top+chartH+16);
      ctx.fillStyle=colors.text+'88';
      ctx.fillText(breakdown[d].attempts+'x', x+barW/2, pad.top+chartH+30);
    });
  }

  // Donut chart — answer breakdown
  function renderAnswerDonut(data) {
    const canvas = el('answer-donut-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const correct = data.totalCorrect;
    const incorrect = data.totalQuestions - data.totalCorrect;
    const total = correct + incorrect;
    if (total === 0) { drawEmptyState(ctx, canvas, 'No data'); return; }

    const w = canvas.offsetWidth || 200, h = 200;
    canvas.width = w * devicePixelRatio; canvas.height = h * devicePixelRatio;
    const cx = w/2, cy = h/2, r = Math.min(w,h)/2 - 20, inner = r*0.55;

    const segments = [
      { label:'Correct', value:correct, color:'#2ecc71' },
      { label:'Incorrect', value:incorrect, color:'#e74c3c' }
    ];
    let startAngle = -Math.PI/2;
    segments.forEach(seg => {
      const slice = (seg.value/total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, startAngle+slice);
      ctx.closePath();
      ctx.fillStyle = seg.color; ctx.fill();
      startAngle += slice;
    });
    // Inner circle
    ctx.beginPath(); ctx.arc(cx,cy,inner,0,Math.PI*2);
    ctx.fillStyle = document.body.classList.contains('light-mode') ? '#fff' : '#1a1a2e';
    ctx.fill();
    // Center text
    const colors = getChartColors();
    ctx.fillStyle = colors.text; ctx.textAlign='center';
    ctx.font = `bold ${14*devicePixelRatio}px Inter`;
    ctx.fillText(Math.round((correct/total)*100)+'%', cx, cy+2);
    ctx.font = `${10*devicePixelRatio}px Inter`;
    ctx.fillText('accuracy', cx, cy+16);

    // Legend
    const legend = el('donut-legend');
    if (legend) {
      legend.innerHTML = segments.map(s =>
        `<span class="legend-dot" style="background:${s.color}"></span>${s.label}: ${s.value}`
      ).join('&nbsp;&nbsp;');
    }
  }

  function drawEmptyState(ctx, canvas, msg) {
    const colors = getChartColors();
    canvas.width = canvas.offsetWidth * devicePixelRatio;
    canvas.height = 180 * devicePixelRatio;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = colors.text;
    ctx.font = `${13*devicePixelRatio}px Inter`;
    ctx.textAlign = 'center';
    ctx.fillText(msg, canvas.offsetWidth/2, 90);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x+r, y);
    ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w, y, x+w, y+r);
    ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
    ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r);
    ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y);
    ctx.closePath();
  }

  /* ─── Public API ─────────────────────────────────────── */
  return { render, renderInsights, renderGoalProgress };
})();
