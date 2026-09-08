// =========================================================================
// STOU 40101 Law Study & Exam Web App - Application Logic
// =========================================================================

(function() {
  'use strict';

  // State Management
  const state = {
    currentView: 'dashboard',
    theme: localStorage.getItem('stou_theme') || 'light',
    
    // Exam Simulator State
    exam: {
      inProgress: false,
      isPaused: false,
      timeLeftSeconds: 180 * 60, // 3 hours (10,800 sec)
      timerInterval: null,
      currentIndex: 0,
      answers: {}, // { qIndex: selectedOptionIndex }
      flagged: new Set(), // Set of question indices
      submitted: false,
      result: null // { score, total: 120, percentage, grade, unitScores }
    },

    // Practice Mode State
    practice: {
      filteredQuestions: [],
      currentIndex: 0,
      selectedUnit: 'all', // 'all' or unit number
      filterType: 'all', // 'all', 'bookmarked', 'wrong'
      userAnswers: {}, // { qId: selectedOptionIndex }
      bookmarked: new Set(JSON.parse(localStorage.getItem('stou_bookmarks') || '[]')),
      wrongQuestions: new Set(JSON.parse(localStorage.getItem('stou_wrong') || '[]'))
    },

    // Summary View State
    summary: {
      selectedUnit: 'all',
      searchQuery: ''
    }
  };

  // DOM Elements Cache
  const elements = {};

  function init() {
    cacheElements();
    applyTheme(state.theme);
    bindEvents();
    renderSummaryView();
    setupPracticeQuestions();
    checkExistingExamSession();
    updateDashboardStats();
    showView('dashboard');
  }

  function cacheElements() {
    // Navigation
    elements.navBtns = document.querySelectorAll('.nav-btn');
    elements.views = document.querySelectorAll('.view-section');
    elements.themeToggle = document.getElementById('themeToggle');

    // Dashboard
    elements.dashStartExamBtn = document.getElementById('dashStartExamBtn');
    elements.dashStudyBtn = document.getElementById('dashStudyBtn');
    elements.dashPracticeBtn = document.getElementById('dashPracticeBtn');
    elements.dashBookmarksCount = document.getElementById('dashBookmarksCount');
    elements.dashWrongCount = document.getElementById('dashWrongCount');
    elements.dashLastScoreBadge = document.getElementById('dashLastScoreBadge');

    // Summary
    elements.summaryFilterChips = document.getElementById('summaryFilterChips');
    elements.summarySearchInput = document.getElementById('summarySearchInput');
    elements.summaryCardsContainer = document.getElementById('summaryCardsContainer');

    // Exam Simulator
    elements.examStartPrompt = document.getElementById('examStartPrompt');
    elements.examActiveArea = document.getElementById('examActiveArea');
    elements.btnBeginExam = document.getElementById('btnBeginExam');
    elements.examTimer = document.getElementById('examTimer');
    elements.examPauseBtn = document.getElementById('examPauseBtn');
    elements.examSubmitBtn = document.getElementById('examSubmitBtn');
    elements.examProgressText = document.getElementById('examProgressText');
    elements.examProgressBar = document.getElementById('examProgressBar');
    elements.examQNum = document.getElementById('examQNum');
    elements.examUnitBadge = document.getElementById('examUnitBadge');
    elements.examFlagBtn = document.getElementById('examFlagBtn');
    elements.examQText = document.getElementById('examQText');
    elements.examOptionsContainer = document.getElementById('examOptionsContainer');
    elements.examPrevBtn = document.getElementById('examPrevBtn');
    elements.examNextBtn = document.getElementById('examNextBtn');
    elements.examGridMatrix = document.getElementById('examGridMatrix');

    // Practice Mode
    elements.practiceUnitSelect = document.getElementById('practiceUnitSelect');
    elements.practiceFilterSelect = document.getElementById('practiceFilterSelect');
    elements.practiceBookmarkBtn = document.getElementById('practiceBookmarkBtn');
    elements.practiceQNum = document.getElementById('practiceQNum');
    elements.practiceUnitBadge = document.getElementById('practiceUnitBadge');
    elements.practiceQText = document.getElementById('practiceQText');
    elements.practiceOptionsContainer = document.getElementById('practiceOptionsContainer');
    elements.practiceExplanation = document.getElementById('practiceExplanation');
    elements.practicePrevBtn = document.getElementById('practicePrevBtn');
    elements.practiceNextBtn = document.getElementById('practiceNextBtn');
    elements.practiceRandomBtn = document.getElementById('practiceRandomBtn');
    elements.practiceTotalBadge = document.getElementById('practiceTotalBadge');

    // Results View
    elements.resultsHero = document.getElementById('resultsHero');
    elements.resultsUnitBreakdown = document.getElementById('resultsUnitBreakdown');
    elements.resultsQuestionsReview = document.getElementById('resultsQuestionsReview');
    elements.resultsFilterSelect = document.getElementById('resultsFilterSelect');
    elements.btnRetakeExam = document.getElementById('btnRetakeExam');

    // Modals
    elements.confirmSubmitModal = document.getElementById('confirmSubmitModal');
    elements.modalUnansweredCount = document.getElementById('modalUnansweredCount');
    elements.btnConfirmSubmit = document.getElementById('btnConfirmSubmit');
    elements.btnCancelSubmit = document.getElementById('btnCancelSubmit');
  }

  function bindEvents() {
    // Theme Toggle
    elements.themeToggle.addEventListener('click', () => {
      const newTheme = state.theme === 'dark' ? 'light' : 'dark';
      applyTheme(newTheme);
    });

    // Navigation Tabs
    elements.navBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = btn.dataset.view;
        if (state.exam.inProgress && !state.exam.submitted && view !== 'exam') {
          if (!confirm('การสอบกำลังดำเนินอยู่ หากออกจากหน้านี้เวลาสอบจะยังคงเดินต่อ ต้องการสลับหน้าต่างใช่หรือไม่?')) {
            return;
          }
        }
        showView(view);
      });
    });

    // Dashboard Quick Actions
    if (elements.dashStartExamBtn) {
      elements.dashStartExamBtn.addEventListener('click', () => showView('exam'));
    }
    if (elements.dashStudyBtn) {
      elements.dashStudyBtn.addEventListener('click', () => showView('summary'));
    }
    if (elements.dashPracticeBtn) {
      elements.dashPracticeBtn.addEventListener('click', () => showView('practice'));
    }

    // Summary Search & Filter
    if (elements.summarySearchInput) {
      elements.summarySearchInput.addEventListener('input', (e) => {
        state.summary.searchQuery = e.target.value.trim().toLowerCase();
        renderSummaryCards();
      });
    }

    // Exam Actions
    if (elements.btnBeginExam) {
      elements.btnBeginExam.addEventListener('click', startNewExam);
    }
    if (elements.examPrevBtn) {
      elements.examPrevBtn.addEventListener('click', () => navigateExam(-1));
    }
    if (elements.examNextBtn) {
      elements.examNextBtn.addEventListener('click', () => navigateExam(1));
    }
    if (elements.examFlagBtn) {
      elements.examFlagBtn.addEventListener('click', toggleFlagCurrentExamQuestion);
    }
    if (elements.examPauseBtn) {
      elements.examPauseBtn.addEventListener('click', togglePauseExam);
    }
    if (elements.examSubmitBtn) {
      elements.examSubmitBtn.addEventListener('click', showSubmitConfirmation);
    }
    if (elements.btnConfirmSubmit) {
      elements.btnConfirmSubmit.addEventListener('click', submitExam);
    }
    if (elements.btnCancelSubmit) {
      elements.btnCancelSubmit.addEventListener('click', hideSubmitConfirmation);
    }
    if (elements.btnRetakeExam) {
      elements.btnRetakeExam.addEventListener('click', () => {
        showView('exam');
        startNewExam();
      });
    }

    // Practice Mode Actions
    if (elements.practiceUnitSelect) {
      elements.practiceUnitSelect.addEventListener('change', (e) => {
        state.practice.selectedUnit = e.target.value;
        setupPracticeQuestions();
      });
    }
    if (elements.practiceFilterSelect) {
      elements.practiceFilterSelect.addEventListener('change', (e) => {
        state.practice.filterType = e.target.value;
        setupPracticeQuestions();
      });
    }
    if (elements.practicePrevBtn) {
      elements.practicePrevBtn.addEventListener('click', () => navigatePractice(-1));
    }
    if (elements.practiceNextBtn) {
      elements.practiceNextBtn.addEventListener('click', () => navigatePractice(1));
    }
    if (elements.practiceRandomBtn) {
      elements.practiceRandomBtn.addEventListener('click', randomizePracticeQuestion);
    }
    if (elements.practiceBookmarkBtn) {
      elements.practiceBookmarkBtn.addEventListener('click', toggleBookmarkCurrentPractice);
    }

    // Results Filter
    if (elements.resultsFilterSelect) {
      elements.resultsFilterSelect.addEventListener('change', renderResultsQuestions);
    }

    // Global Keybindings for Exam navigation
    window.addEventListener('keydown', (e) => {
      if (state.currentView === 'exam' && state.exam.inProgress) {
        if (e.key === 'ArrowRight') navigateExam(1);
        else if (e.key === 'ArrowLeft') navigateExam(-1);
      }
    });
  }

  // =========================================================================
  // Theme & Navigation
  // =========================================================================
  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('stou_theme', theme);
    if (elements.themeToggle) {
      elements.themeToggle.innerHTML = theme === 'dark' ? '☀️' : '🌙';
      elements.themeToggle.title = theme === 'dark' ? 'เปลี่ยนเป็นธีมสว่าง' : 'เปลี่ยนเป็นธีมมืด';
    }
  }

  function showView(viewId) {
    state.currentView = viewId;
    elements.views.forEach(view => {
      if (view.id === `${viewId}View`) {
        view.classList.add('active');
      } else {
        view.classList.remove('active');
      }
    });

    elements.navBtns.forEach(btn => {
      if (btn.dataset.view === viewId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
    updateDashboardStats();
  }

  function updateDashboardStats() {
    if (elements.dashBookmarksCount) {
      elements.dashBookmarksCount.textContent = state.practice.bookmarked.size;
    }
    if (elements.dashWrongCount) {
      elements.dashWrongCount.textContent = state.practice.wrongQuestions.size;
    }
    const savedResult = localStorage.getItem('stou_last_result');
    if (savedResult && elements.dashLastScoreBadge) {
      const res = JSON.parse(savedResult);
      elements.dashLastScoreBadge.textContent = `${res.score}/120 (เกรด ${res.grade})`;
      elements.dashLastScoreBadge.className = `badge ${res.grade === 'H' ? 'badge-gold' : res.grade === 'S' ? 'badge-success' : 'badge-danger'}`;
    }
  }

  // =========================================================================
  // View 1: Unit Summaries (15 Units)
  // =========================================================================
  function renderSummaryView() {
    renderUnitFilterChips();
    renderSummaryCards();
  }

  function renderUnitFilterChips() {
    if (!elements.summaryFilterChips) return;
    elements.summaryFilterChips.innerHTML = '';

    const allChip = document.createElement('button');
    allChip.className = `unit-chip ${state.summary.selectedUnit === 'all' ? 'active' : ''}`;
    allChip.textContent = 'ทั้งหมด (15 หน่วย)';
    allChip.addEventListener('click', () => {
      state.summary.selectedUnit = 'all';
      updateSummaryChips();
      renderSummaryCards();
    });
    elements.summaryFilterChips.appendChild(allChip);

    SUMMARY_DATA.forEach(u => {
      const chip = document.createElement('button');
      chip.className = `unit-chip ${state.summary.selectedUnit === String(u.unit) ? 'active' : ''}`;
      chip.textContent = `หน่วยที่ ${u.unit}`;
      chip.addEventListener('click', () => {
        state.summary.selectedUnit = String(u.unit);
        updateSummaryChips();
        renderSummaryCards();
      });
      elements.summaryFilterChips.appendChild(chip);
    });
  }

  function updateSummaryChips() {
    const chips = elements.summaryFilterChips.querySelectorAll('.unit-chip');
    chips.forEach(chip => {
      if (chip.textContent.includes(`หน่วยที่ ${state.summary.selectedUnit}`)) {
        chip.classList.add('active');
      } else if (state.summary.selectedUnit === 'all' && chip.textContent.includes('ทั้งหมด')) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });
  }

  function renderSummaryCards() {
    if (!elements.summaryCardsContainer) return;
    elements.summaryCardsContainer.innerHTML = '';

    let filtered = SUMMARY_DATA;
    if (state.summary.selectedUnit !== 'all') {
      filtered = filtered.filter(u => u.unit === parseInt(state.summary.selectedUnit));
    }

    if (state.summary.searchQuery) {
      const q = state.summary.searchQuery;
      filtered = filtered.filter(u => {
        const inTitle = u.title.toLowerCase().includes(q) || u.subtitle.toLowerCase().includes(q);
        const inConcepts = u.keyConcepts.some(c => c.topic.toLowerCase().includes(q) || c.details.toLowerCase().includes(q));
        const inTips = u.examTips.some(t => t.toLowerCase().includes(q));
        return inTitle || inConcepts || inTips;
      });
    }

    if (filtered.length === 0) {
      elements.summaryCardsContainer.innerHTML = `
        <div class="card" style="text-align: center; padding: 3rem;">
          <p style="font-size: 1.1rem; color: var(--text-secondary);">ไม่พบเนื้อหาที่ตรงกับคำค้นหา กรุณาลองใช้คำค้นหาอื่น</p>
        </div>
      `;
      return;
    }

    filtered.forEach(u => {
      const card = document.createElement('div');
      card.className = 'card summary-card';

      let conceptsHtml = u.keyConcepts.map(c => `
        <div class="concept-block">
          <div class="concept-title">📌 ${escapeHtml(c.topic)}</div>
          <div class="concept-details">${escapeHtml(c.details)}</div>
        </div>
      `).join('');

      let tipsHtml = '';
      if (u.examTips && u.examTips.length > 0) {
        tipsHtml = `
          <div class="exam-tips-block">
            <div class="exam-tips-title">💡 ประเด็นเน้นย้ำชอบออกสอบ (High-Yield Exam Tips)</div>
            <ul class="exam-tips-list">
              ${u.examTips.map(tip => `<li>${escapeHtml(tip)}</li>`).join('')}
            </ul>
          </div>
        `;
      }

      card.innerHTML = `
        <div class="summary-header">
          <div>
            <span class="badge badge-unit" style="margin-bottom: 0.35rem;">หน่วยการเรียนรู้ที่ ${u.unit}</span>
            <h3 class="summary-title">${escapeHtml(u.title)}</h3>
            <p style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 0.2rem;">${escapeHtml(u.subtitle)}</p>
          </div>
          <button class="btn btn-outline btn-sm practice-unit-btn" data-unit="${u.unit}">
            ✍️ ซ้อมข้อสอบหน่วยนี้ (8 ข้อ)
          </button>
        </div>
        ${conceptsHtml}
        ${tipsHtml}
      `;

      const practiceBtn = card.querySelector('.practice-unit-btn');
      practiceBtn.addEventListener('click', () => {
        state.practice.selectedUnit = String(u.unit);
        if (elements.practiceUnitSelect) elements.practiceUnitSelect.value = String(u.unit);
        showView('practice');
        setupPracticeQuestions();
      });

      elements.summaryCardsContainer.appendChild(card);
    });
  }

  // =========================================================================
  // View 2: Mock Exam 120 Questions Simulator
  // =========================================================================
  function checkExistingExamSession() {
    const savedSession = localStorage.getItem('stou_active_exam');
    if (savedSession) {
      try {
        const data = JSON.parse(savedSession);
        if (data.inProgress && !data.submitted) {
          state.exam.inProgress = true;
          state.exam.timeLeftSeconds = data.timeLeftSeconds;
          state.exam.currentIndex = data.currentIndex || 0;
          state.exam.answers = data.answers || {};
          state.exam.flagged = new Set(data.flagged || []);
          showExamUI();
          startTimer();
          renderExamQuestion(state.exam.currentIndex);
          renderExamGrid();
          updateExamProgress();
        }
      } catch (e) {
        console.error('Failed to restore exam session', e);
      }
    }
  }

  function startNewExam() {
    state.exam.inProgress = true;
    state.exam.isPaused = false;
    state.exam.timeLeftSeconds = 180 * 60; // 3 hours
    state.exam.currentIndex = 0;
    state.exam.answers = {};
    state.exam.flagged = new Set();
    state.exam.submitted = false;
    state.exam.result = null;

    saveExamSession();
    showExamUI();
    startTimer();
    renderExamQuestion(0);
    renderExamGrid();
    updateExamProgress();
  }

  function showExamUI() {
    if (elements.examStartPrompt) elements.examStartPrompt.style.display = 'none';
    if (elements.examActiveArea) elements.examActiveArea.style.display = 'block';
  }

  function hideExamUI() {
    if (elements.examStartPrompt) elements.examStartPrompt.style.display = 'block';
    if (elements.examActiveArea) elements.examActiveArea.style.display = 'none';
  }

  function startTimer() {
    if (state.exam.timerInterval) clearInterval(state.exam.timerInterval);
    updateTimerDisplay();

    state.exam.timerInterval = setInterval(() => {
      if (!state.exam.isPaused) {
        state.exam.timeLeftSeconds--;
        updateTimerDisplay();
        saveExamSession();

        if (state.exam.timeLeftSeconds <= 0) {
          clearInterval(state.exam.timerInterval);
          alert('หมดเวลาการทำข้อสอบ 180 นาที! ระบบจะทำการส่งคำตอบและประเมินผลโดยอัตโนมัติ');
          submitExam();
        }
      }
    }, 1000);
  }

  function togglePauseExam() {
    state.exam.isPaused = !state.exam.isPaused;
    if (elements.examPauseBtn) {
      elements.examPauseBtn.innerHTML = state.exam.isPaused ? '▶️ ทำข้อสอบต่อ' : '⏸️ พักชั่วคราว';
      elements.examPauseBtn.className = state.exam.isPaused ? 'btn btn-accent btn-sm' : 'btn btn-outline btn-sm';
    }
    if (state.exam.isPaused) {
      if (elements.examOptionsContainer) elements.examOptionsContainer.style.opacity = '0.3';
    } else {
      if (elements.examOptionsContainer) elements.examOptionsContainer.style.opacity = '1';
    }
  }

  function updateTimerDisplay() {
    if (!elements.examTimer) return;
    const sec = Math.max(0, state.exam.timeLeftSeconds);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;

    const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    elements.examTimer.textContent = `⏱️ ${formatted}`;

    if (sec <= 900) { // Under 15 minutes
      elements.examTimer.classList.add('warning');
    } else {
      elements.examTimer.classList.remove('warning');
    }
  }

  function renderExamQuestion(index) {
    if (index < 0 || index >= QUESTIONS_DATA.length) return;
    state.exam.currentIndex = index;

    const q = QUESTIONS_DATA[index];
    if (elements.examQNum) {
      elements.examQNum.textContent = `ข้อที่ ${q.id} / 120`;
    }
    if (elements.examUnitBadge) {
      elements.examUnitBadge.textContent = `หน่วยที่ ${q.unit}: ${q.unitTitle}`;
    }
    if (elements.examQText) {
      elements.examQText.textContent = q.question;
    }

    // Flag toggle state
    if (elements.examFlagBtn) {
      const isFlagged = state.exam.flagged.has(index);
      elements.examFlagBtn.innerHTML = isFlagged ? '🚩 ปักหมุดแล้ว' : '🏳️ ปักหมุดทบทวน';
      elements.examFlagBtn.className = isFlagged ? 'btn btn-accent btn-sm' : 'btn btn-outline btn-sm';
    }

    // Render 5 options
    if (elements.examOptionsContainer) {
      elements.examOptionsContainer.innerHTML = '';
      const selectedAnswer = state.exam.answers[index];

      q.options.forEach((optText, optIndex) => {
        const item = document.createElement('div');
        item.className = `option-item ${selectedAnswer === optIndex ? 'selected' : ''}`;
        const prefix = ['ก', 'ข', 'ค', 'ง', 'จ'][optIndex] || '';

        // Extract option text without prefix if already included, or render cleanly
        const cleanText = optText.replace(/^[ก-จ]\.\s*/, '');

        item.innerHTML = `
          <span class="opt-prefix">${prefix}</span>
          <span class="opt-text">${escapeHtml(cleanText)}</span>
        `;

        item.addEventListener('click', () => {
          selectExamOption(index, optIndex);
        });

        elements.examOptionsContainer.appendChild(item);
      });
    }

    // Nav buttons disabled state
    if (elements.examPrevBtn) elements.examPrevBtn.disabled = (index === 0);
    if (elements.examNextBtn) elements.examNextBtn.disabled = (index === QUESTIONS_DATA.length - 1);

    updateExamGridSelection();
    saveExamSession();
  }

  function selectExamOption(qIndex, optionIndex) {
    state.exam.answers[qIndex] = optionIndex;
    renderExamQuestion(qIndex);
    updateExamProgress();
    renderExamGrid();
    saveExamSession();
  }

  function toggleFlagCurrentExamQuestion() {
    const idx = state.exam.currentIndex;
    if (state.exam.flagged.has(idx)) {
      state.exam.flagged.delete(idx);
    } else {
      state.exam.flagged.add(idx);
    }
    renderExamQuestion(idx);
    renderExamGrid();
    saveExamSession();
  }

  function navigateExam(delta) {
    const nextIdx = state.exam.currentIndex + delta;
    if (nextIdx >= 0 && nextIdx < QUESTIONS_DATA.length) {
      renderExamQuestion(nextIdx);
    }
  }

  function updateExamProgress() {
    const answeredCount = Object.keys(state.exam.answers).length;
    const total = QUESTIONS_DATA.length;
    const percent = Math.round((answeredCount / total) * 100);

    if (elements.examProgressText) {
      elements.examProgressText.textContent = `ทำแล้ว ${answeredCount} จาก ${total} ข้อ (${percent}%)`;
    }
    if (elements.examProgressBar) {
      elements.examProgressBar.style.width = `${percent}%`;
    }
  }

  function renderExamGrid() {
    if (!elements.examGridMatrix) return;
    elements.examGridMatrix.innerHTML = '';

    QUESTIONS_DATA.forEach((q, idx) => {
      const btn = document.createElement('button');
      btn.className = 'grid-btn';
      btn.textContent = q.id;

      if (idx === state.exam.currentIndex) btn.classList.add('current');
      if (state.exam.answers[idx] !== undefined) btn.classList.add('answered');
      if (state.exam.flagged.has(idx)) btn.classList.add('flagged');

      btn.addEventListener('click', () => {
        renderExamQuestion(idx);
      });

      elements.examGridMatrix.appendChild(btn);
    });
  }

  function updateExamGridSelection() {
    if (!elements.examGridMatrix) return;
    const buttons = elements.examGridMatrix.querySelectorAll('.grid-btn');
    buttons.forEach((btn, idx) => {
      if (idx === state.exam.currentIndex) {
        btn.classList.add('current');
      } else {
        btn.classList.remove('current');
      }
    });
  }

  function saveExamSession() {
    if (!state.exam.inProgress) return;
    const data = {
      inProgress: state.exam.inProgress,
      timeLeftSeconds: state.exam.timeLeftSeconds,
      currentIndex: state.exam.currentIndex,
      answers: state.exam.answers,
      flagged: Array.from(state.exam.flagged),
      submitted: state.exam.submitted
    };
    localStorage.setItem('stou_active_exam', JSON.stringify(data));
  }

  function showSubmitConfirmation() {
    const answeredCount = Object.keys(state.exam.answers).length;
    const unanswered = QUESTIONS_DATA.length - answeredCount;

    if (elements.modalUnansweredCount) {
      elements.modalUnansweredCount.textContent = unanswered;
      if (unanswered > 0) {
        elements.modalUnansweredCount.parentElement.style.display = 'block';
      } else {
        elements.modalUnansweredCount.parentElement.style.display = 'none';
      }
    }
    if (elements.confirmSubmitModal) {
      elements.confirmSubmitModal.classList.add('active');
    }
  }

  function hideSubmitConfirmation() {
    if (elements.confirmSubmitModal) {
      elements.confirmSubmitModal.classList.remove('active');
    }
  }

  function submitExam() {
    hideSubmitConfirmation();
    if (state.exam.timerInterval) clearInterval(state.exam.timerInterval);

    state.exam.inProgress = false;
    state.exam.submitted = true;
    localStorage.removeItem('stou_active_exam');

    // Calculate score
    let score = 0;
    const unitScores = {}; // unit: { correct, total: 8 }

    for (let u = 1; u <= 15; u++) {
      unitScores[u] = { correct: 0, total: 0 };
    }

    QUESTIONS_DATA.forEach((q, idx) => {
      const userAns = state.exam.answers[idx];
      unitScores[q.unit].total++;
      if (userAns !== undefined && userAns === q.answer) {
        score++;
        unitScores[q.unit].correct++;
      } else {
        // Record as wrong question for targeted review
        state.practice.wrongQuestions.add(q.id);
      }
    });

    localStorage.setItem('stou_wrong', JSON.stringify(Array.from(state.practice.wrongQuestions)));

    const percentage = ((score / QUESTIONS_DATA.length) * 100).toFixed(1);

    // STOU Grade Determination
    let grade = 'U';
    let gradeTitle = 'ไม่ผ่าน (Unsatisfactory)';
    if (percentage >= 76.0) {
      grade = 'H';
      gradeTitle = 'ยอดเยี่ยม / ดีมาก (Honor)';
    } else if (percentage >= 60.0) {
      grade = 'S';
      gradeTitle = 'ผ่าน / น่าพอใจ (Satisfactory)';
    }

    state.exam.result = {
      score,
      total: QUESTIONS_DATA.length,
      percentage,
      grade,
      gradeTitle,
      unitScores,
      answers: { ...state.exam.answers }
    };

    localStorage.setItem('stou_last_result', JSON.stringify(state.exam.result));

    renderResults();
    showView('results');
    hideExamUI();
  }

  // =========================================================================
  // View 3: Exam Results & Unit Breakdown
  // =========================================================================
  function renderResults() {
    const res = state.exam.result;
    if (!res) return;

    // Render Hero Score
    if (elements.resultsHero) {
      const gradeClass = res.grade === 'H' ? 'grade-h' : res.grade === 'S' ? 'grade-s' : 'grade-u';
      const gradeDesc = res.grade === 'H' ? '🎉 ขอแสดงความยินดีด้วย! คุณผ่านการประเมินในระดับเกียรตินิยม (Honor) มีความพร้อมสูงมากในการสอบจริง' :
                        res.grade === 'S' ? '✅ ยินดีด้วย! คุณผ่านเกณฑ์การประเมินตามมาตรฐาน มสธ. (ต้องได้ 60% ขึ้นไป) ทบทวนหน่วยที่ยังอ่อนเพิ่มอีกนิดจะมั่นใจยิ่งขึ้น' :
                        '⚠️ คะแนนยังไม่ผ่านเกณฑ์ 60% ของ มสธ. แนะนำให้อ่านสรุปเนื้อหาในหน่วยที่มีคะแนนต่ำ แล้วฝึกทำโจทย์ซ้ำอีกรอบ';

      elements.resultsHero.innerHTML = `
        <div class="result-grade-badge ${gradeClass}">เกรด ${res.grade}</div>
        <div class="result-score-large">${res.score} / ${res.total} คะแนน (${res.percentage}%)</div>
        <div style="font-family: var(--font-heading); font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem;">${escapeHtml(res.gradeTitle)}</div>
        <p class="result-verdict">${escapeHtml(gradeDesc)}</p>
        <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
          <button class="btn btn-primary" id="resRetakeBtn">🔄 ทำข้อสอบใหม่อีกครั้ง</button>
          <button class="btn btn-outline" id="resStudyWeakBtn">📖 อ่านสรุปทบทวนจุดอ่อน</button>
        </div>
      `;

      document.getElementById('resRetakeBtn').addEventListener('click', () => {
        showView('exam');
        startNewExam();
      });
      document.getElementById('resStudyWeakBtn').addEventListener('click', () => {
        showView('summary');
      });
    }

    // Render Unit Breakdown Bars
    if (elements.resultsUnitBreakdown) {
      elements.resultsUnitBreakdown.innerHTML = '';
      for (let u = 1; u <= 15; u++) {
        const uData = res.unitScores[u];
        const uInfo = SUMMARY_DATA.find(s => s.unit === u) || { title: '' };
        const uPct = Math.round((uData.correct / uData.total) * 100);

        let color = '#ef4444'; // Red < 50%
        if (uPct >= 75) color = '#10b981'; // Green
        else if (uPct >= 50) color = '#f59e0b'; // Amber

        const row = document.createElement('div');
        row.className = 'unit-score-row';
        row.innerHTML = `
          <div class="unit-score-label">
            <strong>หน่วยที่ ${u}:</strong> ${escapeHtml(uInfo.title)}
          </div>
          <div class="unit-progress-bar-wrap">
            <div class="unit-progress-fill" style="width: ${uPct}%; background-color: ${color};"></div>
          </div>
          <div class="unit-score-num" style="color: ${color};">
            ${uData.correct}/${uData.total} (${uPct}%)
          </div>
        `;
        elements.resultsUnitBreakdown.appendChild(row);
      }
    }

    // Render Detailed Questions Review
    renderResultsQuestions();
  }

  function renderResultsQuestions() {
    if (!elements.resultsQuestionsReview || !state.exam.result) return;
    elements.resultsQuestionsReview.innerHTML = '';

    const filter = elements.resultsFilterSelect ? elements.resultsFilterSelect.value : 'all';
    const userAnswers = state.exam.result.answers;

    QUESTIONS_DATA.forEach((q, idx) => {
      const userAns = userAnswers[idx];
      const isCorrect = (userAns !== undefined && userAns === q.answer);

      if (filter === 'wrong' && isCorrect) return;
      if (filter === 'correct' && !isCorrect) return;

      const card = document.createElement('div');
      card.className = 'card';
      card.style.marginBottom = '1.25rem';
      card.style.borderLeft = isCorrect ? '4px solid var(--success-green)' : '4px solid var(--error-red)';

      const statusBadge = isCorrect ?
        '<span class="badge badge-success">✓ ตอบถูกต้อง</span>' :
        '<span class="badge badge-danger">✗ ตอบผิด</span>';

      let optionsHtml = q.options.map((opt, optIdx) => {
        let optClass = '';
        let icon = '';
        if (optIdx === q.answer) {
          optClass = 'correct';
          icon = ' <span style="color: var(--success-green); font-weight: bold;">(เฉลยที่ถูกต้อง)</span>';
        }
        if (userAns === optIdx && !isCorrect) {
          optClass = 'wrong';
          icon = ' <span style="color: var(--error-red); font-weight: bold;">(คำตอบที่คุณเลือก)</span>';
        }

        const prefix = ['ก', 'ข', 'ค', 'ง', 'จ'][optIdx] || '';
        const cleanText = opt.replace(/^[ก-จ]\.\s*/, '');

        return `
          <div class="option-item ${optClass}" style="cursor: default;">
            <span class="opt-prefix">${prefix}</span>
            <span class="opt-text">${escapeHtml(cleanText)} ${icon}</span>
          </div>
        `;
      }).join('');

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <span style="font-family: var(--font-heading); font-weight: 600; color: var(--primary-navy);">
            ข้อที่ ${q.id} (หน่วยที่ ${q.unit})
          </span>
          ${statusBadge}
        </div>
        <div style="font-size: 1.05rem; font-weight: 500; margin-bottom: 1rem;">
          ${escapeHtml(q.question)}
        </div>
        <div class="options-list" style="margin-bottom: 1rem;">
          ${optionsHtml}
        </div>
        <div class="explanation-box">
          <div class="explanation-header">📖 คำอธิบายเฉลยและหลักกฎหมาย</div>
          <div class="explanation-body">${escapeHtml(q.explanation)}</div>
        </div>
      `;

      elements.resultsQuestionsReview.appendChild(card);
    });
  }

  // =========================================================================
  // View 4: Practice Mode (Instant feedback & explanations)
  // =========================================================================
  function setupPracticeQuestions() {
    let list = [...QUESTIONS_DATA];

    // Filter by unit
    if (state.practice.selectedUnit !== 'all') {
      const u = parseInt(state.practice.selectedUnit);
      list = list.filter(q => q.unit === u);
    }

    // Filter by bookmark / wrong
    if (state.practice.filterType === 'bookmarked') {
      list = list.filter(q => state.practice.bookmarked.has(q.id));
    } else if (state.practice.filterType === 'wrong') {
      list = list.filter(q => state.practice.wrongQuestions.has(q.id));
    }

    state.practice.filteredQuestions = list;
    state.practice.currentIndex = 0;

    if (elements.practiceTotalBadge) {
      elements.practiceTotalBadge.textContent = `พบ ${list.length} ข้อ`;
    }

    renderPracticeQuestion(0);
  }

  function renderPracticeQuestion(index) {
    const list = state.practice.filteredQuestions;
    if (!list || list.length === 0) {
      if (elements.practiceQText) {
        elements.practiceQText.textContent = 'ไม่พบข้อสอบในเงื่อนไขที่คุณเลือก (อาจยังไม่มีข้อที่บันทึกไว้ หรือข้อที่ตอบผิด)';
      }
      if (elements.practiceOptionsContainer) elements.practiceOptionsContainer.innerHTML = '';
      if (elements.practiceExplanation) elements.practiceExplanation.style.display = 'none';
      if (elements.practiceQNum) elements.practiceQNum.textContent = 'ข้อที่ 0 / 0';
      if (elements.practiceUnitBadge) elements.practiceUnitBadge.textContent = '';
      return;
    }

    if (index < 0) index = 0;
    if (index >= list.length) index = list.length - 1;
    state.practice.currentIndex = index;

    const q = list[index];

    if (elements.practiceQNum) {
      elements.practiceQNum.textContent = `ข้อที่ ${index + 1} จากทั้งหมด ${list.length} ข้อ (รหัสข้อ ${q.id})`;
    }
    if (elements.practiceUnitBadge) {
      elements.practiceUnitBadge.textContent = `หน่วยที่ ${q.unit}: ${q.unitTitle}`;
    }
    if (elements.practiceQText) {
      elements.practiceQText.textContent = q.question;
    }

    // Update Bookmark Button
    if (elements.practiceBookmarkBtn) {
      const isBookmarked = state.practice.bookmarked.has(q.id);
      elements.practiceBookmarkBtn.innerHTML = isBookmarked ? '⭐ บันทึกแล้ว' : '☆ บันทึกข้อนี้';
      elements.practiceBookmarkBtn.className = isBookmarked ? 'btn btn-accent btn-sm' : 'btn btn-outline btn-sm';
    }

    const answered = (state.practice.userAnswers[q.id] !== undefined);
    const selectedAns = state.practice.userAnswers[q.id];

    // Render Options
    if (elements.practiceOptionsContainer) {
      elements.practiceOptionsContainer.innerHTML = '';

      q.options.forEach((optText, optIdx) => {
        const item = document.createElement('div');
        item.className = 'option-item';

        if (answered) {
          if (optIdx === q.answer) {
            item.classList.add('correct');
          } else if (optIdx === selectedAns) {
            item.classList.add('wrong');
          }
        }

        const prefix = ['ก', 'ข', 'ค', 'ง', 'จ'][optIdx] || '';
        const cleanText = optText.replace(/^[ก-จ]\.\s*/, '');

        item.innerHTML = `
          <span class="opt-prefix">${prefix}</span>
          <span class="opt-text">${escapeHtml(cleanText)}</span>
        `;

        item.addEventListener('click', () => {
          if (!answered) {
            state.practice.userAnswers[q.id] = optIdx;
            if (optIdx !== q.answer) {
              state.practice.wrongQuestions.add(q.id);
            } else {
              // If correct now, optionally remove from wrong set
              state.practice.wrongQuestions.delete(q.id);
            }
            localStorage.setItem('stou_wrong', JSON.stringify(Array.from(state.practice.wrongQuestions)));
            renderPracticeQuestion(index);
          }
        });

        elements.practiceOptionsContainer.appendChild(item);
      });
    }

    // Render Explanation
    if (elements.practiceExplanation) {
      if (answered) {
        elements.practiceExplanation.style.display = 'block';
        const isUserCorrect = (selectedAns === q.answer);
        const correctPrefix = ['ก', 'ข', 'ค', 'ง', 'จ'][q.answer];

        elements.practiceExplanation.innerHTML = `
          <div class="explanation-header">
            ${isUserCorrect ? '✅ ถูกต้องยอดเยี่ยม!' : `❌ ตอบผิด (คำตอบที่ถูกต้องคือข้อ ${correctPrefix})`}
          </div>
          <div class="explanation-body">
            <strong>คำอธิบายละเอียด:</strong> ${escapeHtml(q.explanation)}
          </div>
        `;
      } else {
        elements.practiceExplanation.style.display = 'none';
      }
    }

    if (elements.practicePrevBtn) elements.practicePrevBtn.disabled = (index === 0);
    if (elements.practiceNextBtn) elements.practiceNextBtn.disabled = (index === list.length - 1);
  }

  function navigatePractice(delta) {
    const list = state.practice.filteredQuestions;
    if (!list || list.length === 0) return;
    renderPracticeQuestion(state.practice.currentIndex + delta);
  }

  function randomizePracticeQuestion() {
    const list = state.practice.filteredQuestions;
    if (!list || list.length <= 1) return;
    const randomIdx = Math.floor(Math.random() * list.length);
    renderPracticeQuestion(randomIdx);
  }

  function toggleBookmarkCurrentPractice() {
    const list = state.practice.filteredQuestions;
    if (!list || list.length === 0) return;
    const q = list[state.practice.currentIndex];

    if (state.practice.bookmarked.has(q.id)) {
      state.practice.bookmarked.delete(q.id);
    } else {
      state.practice.bookmarked.add(q.id);
    }

    localStorage.setItem('stou_bookmarks', JSON.stringify(Array.from(state.practice.bookmarked)));
    renderPracticeQuestion(state.practice.currentIndex);
    updateDashboardStats();
  }

  // =========================================================================
  // Utility Functions
  // =========================================================================
  function escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Kickstart Application
  document.addEventListener('DOMContentLoaded', init);

})();
