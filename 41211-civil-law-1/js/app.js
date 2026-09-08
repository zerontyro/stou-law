/**
 * STOU 41211 Civil Law 1: Application Controller
 * Handles 15-Unit Study Summaries, 120-Q Mock Exam, 3-Q Subjective Essay Workshop, and Unit Analytics.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Global Application State
  const state = {
    theme: localStorage.getItem('stou41211_theme') || 'light',
    currentTab: 'overview',
    
    // Exam 120 Questions State
    exam: {
      status: 'idle', // 'idle' | 'running' | 'submitted'
      currentIndex: 0,
      answers: {}, // { [questionId]: optionIndex }
      flagged: new Set(),
      timeLeft: 180 * 60, // 180 minutes in seconds
      timerInterval: null
    },
    
    // Essay State (3 Questions)
    essay: {
      currentIndex: 0,
      drafts: JSON.parse(localStorage.getItem('stou41211_essay_drafts') || '{}'),
      rubricScores: JSON.parse(localStorage.getItem('stou41211_essay_rubrics') || '{}'),
      revealedAnswers: {}
    },
    
    // Practice Mode State
    practice: {
      currentUnit: 'all',
      searchQuery: '',
      revealed: {},
      userAnswers: {},
      bookmarked: new Set(JSON.parse(localStorage.getItem('stou41211_bookmarks') || '[]'))
    },

    // Summary Filter State
    summary: {
      currentUnit: 'all',
      searchQuery: ''
    }
  };

  // --------------------------------------------------------------------------
  // Theme Management
  // --------------------------------------------------------------------------
  function initTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    updateThemeIcon();
    
    const themeBtn = document.getElementById('btnThemeToggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        state.theme = state.theme === 'light' ? 'dark' : 'light';
        localStorage.setItem('stou41211_theme', state.theme);
        document.documentElement.setAttribute('data-theme', state.theme);
        updateThemeIcon();
      });
    }
  }

  function updateThemeIcon() {
    const icon = document.querySelector('#btnThemeToggle i');
    if (icon) {
      icon.className = state.theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    }
  }

  // --------------------------------------------------------------------------
  // Course Switcher Dropdown
  // --------------------------------------------------------------------------
  function initCourseSwitcher() {
    const btn = document.getElementById('btnCourseSwitcher');
    const menu = document.getElementById('switcherDropdown');
    if (btn && menu) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('show');
      });
      document.addEventListener('click', () => {
        menu.classList.remove('show');
      });
    }
  }

  // --------------------------------------------------------------------------
  // Navigation Tabs
  // --------------------------------------------------------------------------
  function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        switchTab(targetTab);
      });
    });
  }

  function switchTab(tabId) {
    state.currentTab = tabId;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `tab-${tabId}`);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (tabId === 'summary') renderSummaries();
    if (tabId === 'practice') renderPractice();
    if (tabId === 'essay') renderEssay();
  }

  // --------------------------------------------------------------------------
  // Unit Summaries View
  // --------------------------------------------------------------------------
  function initSummaryControls() {
    const unitSelect = document.getElementById('summaryUnitFilter');
    const searchInput = document.getElementById('summarySearchInput');
    const expandAllBtn = document.getElementById('btnExpandAllSummaries');
    const collapseAllBtn = document.getElementById('btnCollapseAllSummaries');

    if (unitSelect) {
      unitSelect.addEventListener('change', (e) => {
        state.summary.currentUnit = e.target.value;
        renderSummaries();
      });
    }
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.summary.searchQuery = e.target.value.trim().toLowerCase();
        renderSummaries();
      });
    }
    if (expandAllBtn) {
      expandAllBtn.addEventListener('click', () => {
        document.querySelectorAll('.unit-card').forEach(card => card.classList.add('expanded'));
      });
    }
    if (collapseAllBtn) {
      collapseAllBtn.addEventListener('click', () => {
        document.querySelectorAll('.unit-card').forEach(card => card.classList.remove('expanded'));
      });
    }
  }

  function renderSummaries() {
    const container = document.getElementById('summariesContainer');
    if (!container || typeof SUMMARY_DATA === 'undefined') return;

    const { currentUnit, searchQuery } = state.summary;
    let filtered = SUMMARY_DATA;

    if (currentUnit !== 'all') {
      filtered = filtered.filter(u => u.unit === parseInt(currentUnit, 10));
    }

    if (searchQuery) {
      filtered = filtered.filter(u => {
        const inTitle = u.title.toLowerCase().includes(searchQuery);
        const inTopics = u.keyTopics.some(t => 
          t.topic.toLowerCase().includes(searchQuery) || 
          t.details.toLowerCase().includes(searchQuery)
        );
        const inTips = u.examTips.some(tip => tip.toLowerCase().includes(searchQuery));
        return inTitle || inTopics || inTips;
      });
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 3rem;">
          <i class="fas fa-search" style="font-size: 2.5rem; color: var(--text-subtle); margin-bottom: 1rem;"></i>
          <p style="color: var(--text-muted); font-size: 1.1rem;">ไม่พบหัวข้อสรุปที่ตรงกับคำค้นหา</p>
        </div>`;
      return;
    }

    container.innerHTML = filtered.map(unit => `
      <div class="unit-card ${currentUnit !== 'all' || searchQuery ? 'expanded' : ''}" data-unit="${unit.unit}">
        <div class="unit-card-header" onclick="this.parentElement.classList.toggle('expanded')">
          <div class="unit-card-title">
            <span class="unit-badge">หน่วยที่ ${unit.unit}</span>
            <h3 style="font-size: 1.15rem;">${unit.title}</h3>
          </div>
          <i class="fas fa-chevron-down toggle-icon" style="color: var(--text-subtle); transition: transform 0.2s;"></i>
        </div>
        <div class="unit-sections-wrap">
          ${unit.keyTopics.map(topic => `
            <div class="topic-block">
              <div class="topic-title">
                <i class="fas fa-bookmark" style="color: var(--secondary); margin-right: 0.4rem; font-size: 0.9rem;"></i>
                ${topic.topic}
              </div>
              <div class="topic-content">${escapeHtml(topic.details)}</div>
            </div>
          `).join('')}

          ${unit.examTips && unit.examTips.length > 0 ? `
            <div class="exam-tip-box">
              <strong style="display: block; margin-bottom: 0.4rem;">
                <i class="fas fa-lightbulb" style="margin-right: 0.4rem;"></i> จุดเน้นออกสอบบ่อย (High-Yield Tips):
              </strong>
              <ul style="margin-left: 1.25rem; font-size: 0.95rem;">
                ${unit.examTips.map(tip => `<li>${escapeHtml(tip)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      </div>
    `).join('');
  }

  // --------------------------------------------------------------------------
  // 120-Question Multiple Choice Exam System
  // --------------------------------------------------------------------------
  function initExam() {
    const startBtn = document.getElementById('btnStartExam');
    const submitBtn = document.getElementById('btnSubmitExam');
    const prevBtn = document.getElementById('btnPrevExamQ');
    const nextBtn = document.getElementById('btnNextExamQ');
    const flagBtn = document.getElementById('btnFlagExamQ');

    if (startBtn) startBtn.addEventListener('click', startExam);
    if (submitBtn) submitBtn.addEventListener('click', confirmSubmitExam);
    if (prevBtn) prevBtn.addEventListener('click', () => navigateExamQ(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => navigateExamQ(1));
    if (flagBtn) flagBtn.addEventListener('click', toggleFlagCurrentQuestion);

    renderExamNavGrid();
  }

  function startExam() {
    state.exam.status = 'running';
    state.exam.currentIndex = 0;
    state.exam.answers = {};
    state.exam.flagged.clear();
    state.exam.timeLeft = 180 * 60; // 3 hours

    document.getElementById('examWelcomeBox').classList.add('hidden');
    document.getElementById('examActiveBox').classList.remove('hidden');

    if (state.exam.timerInterval) clearInterval(state.exam.timerInterval);
    state.exam.timerInterval = setInterval(updateExamTimer, 1000);
    updateExamTimer();

    renderExamCurrentQuestion();
    renderExamNavGrid();
  }

  function updateExamTimer() {
    if (state.exam.timeLeft <= 0) {
      clearInterval(state.exam.timerInterval);
      alert('หมดเวลาทำการสอบ 180 นาที! ระบบจะทำการประมวลผลข้อสอบโดยอัตโนมัติ');
      finishExam();
      return;
    }
    state.exam.timeLeft--;

    const hours = Math.floor(state.exam.timeLeft / 3600);
    const minutes = Math.floor((state.exam.timeLeft % 3600) / 60);
    const seconds = state.exam.timeLeft % 60;

    const formatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    const timerElem = document.getElementById('examTimerDisplay');
    if (timerElem) timerElem.textContent = formatted;
  }

  function renderExamCurrentQuestion() {
    const container = document.getElementById('examQuestionContainer');
    if (!container || typeof QUESTIONS_DATA === 'undefined') return;

    const q = QUESTIONS_DATA[state.exam.currentIndex];
    const qIndex = state.exam.currentIndex;
    const selected = state.exam.answers[q.id];

    container.innerHTML = `
      <div class="question-meta">
        <span><strong style="color: var(--primary);">ข้อที่ ${qIndex + 1} / 120</strong> (${q.unitTitle})</span>
        <span>
          <button id="btnFlagInside" class="btn-secondary" style="padding: 0.3rem 0.75rem; font-size: 0.85rem; ${state.exam.flagged.has(q.id) ? 'background-color: var(--secondary-light); color: var(--secondary); border-color: var(--secondary);' : ''}">
            <i class="fas fa-flag"></i> ${state.exam.flagged.has(q.id) ? 'ติดธงไว้แล้ว' : 'ติดธงทบทวน'}
          </button>
        </span>
      </div>
      <div class="question-text">${escapeHtml(q.question)}</div>
      <div class="options-list">
        ${q.options.map((opt, idx) => `
          <div class="option-item ${selected === idx ? 'selected' : ''}" data-idx="${idx}">
            <input type="radio" class="option-radio" name="exam_opt_${q.id}" ${selected === idx ? 'checked' : ''}>
            <span>${escapeHtml(opt)}</span>
          </div>
        `).join('')}
      </div>
    `;

    // Bind option click
    container.querySelectorAll('.option-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.getAttribute('data-idx'), 10);
        selectExamAnswer(q.id, idx);
      });
    });

    const innerFlag = document.getElementById('btnFlagInside');
    if (innerFlag) {
      innerFlag.addEventListener('click', toggleFlagCurrentQuestion);
    }

    // Update nav button states
    const prevBtn = document.getElementById('btnPrevExamQ');
    const nextBtn = document.getElementById('btnNextExamQ');
    if (prevBtn) prevBtn.disabled = qIndex === 0;
    if (nextBtn) nextBtn.disabled = qIndex === QUESTIONS_DATA.length - 1;

    updateExamProgress();
    renderExamNavGrid();
  }

  function selectExamAnswer(qid, optIdx) {
    state.exam.answers[qid] = optIdx;
    renderExamCurrentQuestion();
    renderExamNavGrid();
  }

  function toggleFlagCurrentQuestion() {
    const q = QUESTIONS_DATA[state.exam.currentIndex];
    if (state.exam.flagged.has(q.id)) {
      state.exam.flagged.delete(q.id);
    } else {
      state.exam.flagged.add(q.id);
    }
    renderExamCurrentQuestion();
    renderExamNavGrid();
  }

  function navigateExamQ(direction) {
    const newIdx = state.exam.currentIndex + direction;
    if (newIdx >= 0 && newIdx < QUESTIONS_DATA.length) {
      state.exam.currentIndex = newIdx;
      renderExamCurrentQuestion();
    }
  }

  function renderExamNavGrid() {
    const grid = document.getElementById('examNavGrid');
    if (!grid || typeof QUESTIONS_DATA === 'undefined') return;

    grid.innerHTML = QUESTIONS_DATA.map((q, idx) => {
      const isAnswered = state.exam.answers[q.id] !== undefined;
      const isCurrent = state.exam.currentIndex === idx;
      const isFlagged = state.exam.flagged.has(q.id);
      
      let classes = ['q-nav-btn'];
      if (isAnswered) classes.push('answered');
      if (isCurrent) classes.push('current');
      if (isFlagged) classes.push('flagged');

      return `
        <button class="${classes.join(' ')}" onclick="window.jumpToExamQ(${idx})" title="ข้อ ${idx + 1}">
          ${idx + 1}
        </button>
      `;
    }).join('');
  }

  window.jumpToExamQ = function(idx) {
    state.exam.currentIndex = idx;
    renderExamCurrentQuestion();
  };

  function updateExamProgress() {
    const answeredCount = Object.keys(state.exam.answers).length;
    const progressFill = document.getElementById('examProgressFill');
    const countText = document.getElementById('examAnsweredCount');
    
    if (progressFill) {
      const percent = (answeredCount / 120) * 100;
      progressFill.style.width = `${percent}%`;
    }
    if (countText) {
      countText.textContent = `${answeredCount} / 120 ข้อ`;
    }
  }

  function confirmSubmitExam() {
    const answered = Object.keys(state.exam.answers).length;
    const unanswered = 120 - answered;
    let msg = `คุณได้ตอบข้อสอบไปแล้ว ${answered} ข้อ จากทั้งหมด 120 ข้อ`;
    if (unanswered > 0) {
      msg += `\n(ยังไม่ได้ตอบอีก ${unanswered} ข้อ)`;
    }
    msg += '\n\nคุณแน่ใจหรือไม่ว่าต้องการส่งข้อสอบและดูผลการประเมินคะแนนทันที?';

    if (confirm(msg)) {
      finishExam();
    }
  }

  function finishExam() {
    if (state.exam.timerInterval) clearInterval(state.exam.timerInterval);
    state.exam.status = 'submitted';

    // Calculate score
    let correctCount = 0;
    const unitBreakdown = {};

    for (let u = 1; u <= 15; u++) {
      unitBreakdown[u] = { total: 0, correct: 0 };
    }

    QUESTIONS_DATA.forEach(q => {
      unitBreakdown[q.unit].total++;
      if (state.exam.answers[q.id] === q.answer) {
        correctCount++;
        unitBreakdown[q.unit].correct++;
      }
    });

    renderResults(correctCount, unitBreakdown);
    switchTab('results');
  }

  function renderResults(correctCount, unitBreakdown) {
    const percentage = Math.round((correctCount / 120) * 100);
    
    // STOU Grade Criteria: H (>= 76%), S (60-75%), U (< 60%)
    let grade = 'U';
    let gradeClass = 'grade-U';
    let gradeLabel = 'ไม่ผ่าน (U - Unsatisfactory)';
    let gradeDesc = 'คะแนนยังไม่ถึงเกณฑ์ขั้นต่ำ 60% แนะนำให้กลับไปทบทวนสรุปเนื้อหา 15 หน่วย และฝึกทำข้อสอบซ้ำอีกครั้ง';

    if (percentage >= 76) {
      grade = 'H';
      gradeClass = 'grade-H';
      gradeLabel = 'ผ่านระดับดีเด่น (H - Honor)';
      gradeDesc = 'ยอดเยี่ยมมาก! คุณมีความรู้ความเข้าใจหลักกฎหมายแพ่ง 1 ในเกณฑ์สูงมาก พร้อมสำหรับสนามสอบจริง';
    } else if (percentage >= 60) {
      grade = 'S';
      gradeClass = 'grade-S';
      gradeLabel = 'ผ่านระดับน่าพอใจ (S - Satisfactory)';
      gradeDesc = 'ยินดีด้วย! คุณสอบผ่านเกณฑ์มาตรฐานของ มสธ. หากต้องการได้ระดับ H ควรเน้นเจาะหน่วยที่ได้คะแนนน้อย';
    }

    const summaryBox = document.getElementById('resultsSummaryBox');
    if (summaryBox) {
      summaryBox.innerHTML = `
        <div class="score-summary-card">
          <h2 style="font-size: 1.5rem; color: var(--text-muted);">ผลการประเมินจำลองการสอบ 120 ข้อ</h2>
          <div class="grade-badge-huge ${gradeClass}">${grade}</div>
          <h3 style="font-size: 1.35rem; margin-bottom: 0.5rem;">${gradeLabel}</h3>
          <p style="font-size: 1.1rem; margin-bottom: 1rem; color: var(--text-main);">
            ได้คะแนน: <strong style="font-size: 1.4rem; color: var(--primary);">${correctCount}</strong> / 120 คะแนน (${percentage}%)
          </p>
          <p style="max-width: 600px; margin: 0 auto; color: var(--text-muted); font-size: 0.95rem;">${gradeDesc}</p>
          <div style="margin-top: 1.5rem; display: flex; gap: 1rem; justify-content: center;">
            <button class="btn-primary" onclick="window.switchTab('exam'); window.startExam();">
              <i class="fas fa-redo"></i> ทำข้อสอบใหม่อีกครั้ง
            </button>
            <button class="btn-secondary" onclick="window.switchTab('practice');">
              <i class="fas fa-book-open"></i> ตรวจดูเฉลยละเอียดรายข้อ
            </button>
          </div>
        </div>
      `;
    }

    // Render Unit Breakdown Grid
    const analysisGrid = document.getElementById('resultsUnitAnalysisGrid');
    if (analysisGrid) {
      analysisGrid.innerHTML = Object.keys(unitBreakdown).map(u => {
        const data = unitBreakdown[u];
        const uPercent = Math.round((data.correct / data.total) * 100);
        let barColor = 'var(--danger)';
        if (uPercent >= 75) barColor = 'var(--success)';
        else if (uPercent >= 50) barColor = 'var(--warning)';

        return `
          <div class="unit-score-item">
            <div class="unit-score-header">
              <span>หน่วยที่ ${u}</span>
              <span>${data.correct}/${data.total} (${uPercent}%)</span>
            </div>
            <div class="unit-bar-bg">
              <div class="unit-bar-val" style="width: ${uPercent}%; background-color: ${barColor};"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // --------------------------------------------------------------------------
  // Subjective Essay View (3 Practical Problem Questions)
  // --------------------------------------------------------------------------
  function initEssay() {
    const tabContainer = document.getElementById('essayQuestionTabs');
    if (tabContainer && typeof ESSAY_DATA !== 'undefined') {
      tabContainer.innerHTML = ESSAY_DATA.map((q, idx) => `
        <button class="essay-tab-btn ${idx === state.essay.currentIndex ? 'active' : ''}" data-idx="${idx}">
          <i class="fas fa-pen-fancy"></i> ข้อที่ ${q.id}: ${q.title.split(' ')[0]}
        </button>
      `).join('');

      tabContainer.querySelectorAll('.essay-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-idx'), 10);
          state.essay.currentIndex = idx;
          tabContainer.querySelectorAll('.essay-tab-btn').forEach((b, i) => b.classList.toggle('active', i === idx));
          renderEssay();
        });
      });
    }
  }

  function renderEssay() {
    const container = document.getElementById('essayActiveContainer');
    if (!container || typeof ESSAY_DATA === 'undefined') return;

    const q = ESSAY_DATA[state.essay.currentIndex];
    const currentDraft = state.essay.drafts[q.id] || '';
    const isRevealed = !!state.essay.revealedAnswers[q.id];
    const savedRubrics = state.essay.rubricScores[q.id] || {};

    container.innerHTML = `
      <div class="essay-split-layout">
        <!-- Left: Facts & Question -->
        <div class="essay-fact-box">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <span class="unit-badge">ข้อสอบอัตนัย 20 คะแนน (${q.unit})</span>
            <span style="font-size: 0.85rem; color: var(--secondary); font-weight: 700;">เกณฑ์ มสธ. ข้อละ 20 คะแนน</span>
          </div>
          <h3 style="margin-bottom: 1rem; font-size: 1.25rem;">ข้อที่ ${q.id}: ${escapeHtml(q.title)}</h3>
          <div class="essay-fact-text">
            <strong>คำถามตุ๊กตาข้อเท็จจริง:</strong><br><br>
            ${escapeHtml(q.factPattern)}
          </div>
          <div class="essay-prompt-box">
            <i class="fas fa-question-circle" style="margin-right: 0.5rem;"></i>
            <strong>ประเด็นที่ต้องวินิจฉัย:</strong> ${escapeHtml(q.prompt)}
          </div>
          <div class="essay-tips-box">
            <strong style="color: var(--secondary); display: block; margin-bottom: 0.4rem;">
              <i class="fas fa-lightbulb"></i> คำแนะนำและแนวทางการตอบ:
            </strong>
            <ul style="margin-left: 1.25rem; font-size: 0.9rem; color: var(--text-muted);">
              ${q.examTips.map(tip => `<li>${escapeHtml(tip)}</li>`).join('')}
            </ul>
          </div>
        </div>

        <!-- Right: Essay Pad & Tools -->
        <div class="essay-editor-box">
          <div class="essay-editor-toolbar">
            <span><i class="fas fa-keyboard"></i> พื้นที่พิมพ์ร่างคำตอบ (บันทึกอัตโนมัติ)</span>
            <span id="essayWordCount">0 ตัวอักษร</span>
          </div>
          <textarea id="essayEditorText" class="essay-textarea" placeholder="พิมพ์คำตอบตามโครงสร้าง มสธ. (1. ข้อกฎหมายที่เกี่ยวข้อง 2. วินิจฉัยปรับข้อเท็จจริงเข้ากับข้อกฎหมาย 3. สรุปคำวินิจฉัย)...">${escapeHtml(currentDraft)}</textarea>
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
            <button id="btnSaveEssayDraft" class="btn-secondary">
              <i class="fas fa-save"></i> บันทึกร่างคำตอบ
            </button>
            <button id="btnToggleModelAnswer" class="btn-primary" style="background-color: var(--secondary);">
              <i class="fas fa-eye"></i> ${isRevealed ? 'ซ่อนธงคำตอบ' : 'ตรวจคำตอบ & ดูธงคำตอบ 3 สเต็ป'}
            </button>
          </div>
        </div>
      </div>

      <!-- Model Answer Section -->
      <div id="modelAnswerSection" class="model-answer-section ${isRevealed ? 'revealed' : ''}">
        <div style="border-bottom: 2px solid var(--border-color); padding-bottom: 0.75rem; margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center;">
          <h4 style="font-size: 1.25rem; color: var(--secondary);">
            <i class="fas fa-balance-scale"></i> ธงคำตอบมาตรฐาน มสธ. (3 สเต็ป: หลักกฎหมาย - วินิจฉัย - สรุป)
          </h4>
          <span style="font-size: 0.85rem; color: var(--text-muted);">คะแนนเต็ม 20 คะแนน</span>
        </div>

        <!-- Step 1: Legal Principles -->
        <div class="model-step-card">
          <h5><i class="fas fa-book"></i> 1. หลักกฎหมายที่เกี่ยวข้อง (Statutory Provisions)</h5>
          <div class="model-step-content">${escapeHtml(q.modelAnswer.legalPrinciples)}</div>
        </div>

        <!-- Step 2: Subsumption / Analysis -->
        <div class="model-step-card">
          <h5><i class="fas fa-gavel"></i> 2. การปรับใช้กฎหมายกับข้อเท็จจริง (วินิจฉัย)</h5>
          <div class="model-step-content">${escapeHtml(q.modelAnswer.analysis)}</div>
        </div>

        <!-- Step 3: Conclusion -->
        <div class="model-step-card">
          <h5><i class="fas fa-check-circle"></i> 3. สรุปคำตอบ (Conclusion)</h5>
          <div class="model-step-content">${escapeHtml(q.modelAnswer.conclusion)}</div>
        </div>

        <!-- Self Scoring Rubric Checklist -->
        <div class="rubric-table-box">
          <div style="background-color: var(--bg-subtle); padding: 0.85rem 1.25rem; font-weight: 700; display: flex; justify-content: space-between;">
            <span>เกณฑ์การให้คะแนนและการประเมินตนเอง (Rubrics)</span>
            <span id="rubricTotalDisplay">คะแนนที่ได้: 0 / 20 คะแนน</span>
          </div>
          ${q.rubric.map((r, rIdx) => {
            const isChecked = !!savedRubrics[rIdx];
            return `
              <div class="rubric-item">
                <label class="rubric-check-label">
                  <input type="checkbox" class="rubric-cb" data-idx="${rIdx}" data-score="${r.maxScore}" ${isChecked ? 'checked' : ''}>
                  <span>${escapeHtml(r.criteria)}</span>
                </label>
                <span class="rubric-score-tag">+${r.maxScore} คะแนน</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Bind Essay Editor Text
    const textarea = document.getElementById('essayEditorText');
    const wordCount = document.getElementById('essayWordCount');
    if (textarea && wordCount) {
      const updateCount = () => {
        wordCount.textContent = `${textarea.value.length} ตัวอักษร`;
      };
      updateCount();
      textarea.addEventListener('input', () => {
        updateCount();
        state.essay.drafts[q.id] = textarea.value;
        localStorage.setItem('stou41211_essay_drafts', JSON.stringify(state.essay.drafts));
      });
    }

    // Bind Draft Save Button
    const saveBtn = document.getElementById('btnSaveEssayDraft');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        localStorage.setItem('stou41211_essay_drafts', JSON.stringify(state.essay.drafts));
        alert('บันทึกร่างคำตอบอัตนัยข้อ ' + q.id + ' เรียบร้อยแล้ว!');
      });
    }

    // Bind Toggle Model Answer
    const toggleModelBtn = document.getElementById('btnToggleModelAnswer');
    if (toggleModelBtn) {
      toggleModelBtn.addEventListener('click', () => {
        state.essay.revealedAnswers[q.id] = !state.essay.revealedAnswers[q.id];
        renderEssay();
      });
    }

    // Bind Rubric Checkboxes
    const rubricCbs = container.querySelectorAll('.rubric-cb');
    const updateRubricScore = () => {
      let total = 0;
      if (!state.essay.rubricScores[q.id]) state.essay.rubricScores[q.id] = {};
      rubricCbs.forEach(cb => {
        const rIdx = cb.getAttribute('data-idx');
        const score = parseInt(cb.getAttribute('data-score'), 10);
        if (cb.checked) {
          total += score;
          state.essay.rubricScores[q.id][rIdx] = true;
        } else {
          delete state.essay.rubricScores[q.id][rIdx];
        }
      });
      localStorage.setItem('stou41211_essay_rubrics', JSON.stringify(state.essay.rubricScores));
      const totalDisplay = document.getElementById('rubricTotalDisplay');
      if (totalDisplay) {
        totalDisplay.textContent = `คะแนนที่ได้: ${total} / 20 คะแนน`;
      }
    };

    rubricCbs.forEach(cb => {
      cb.addEventListener('change', updateRubricScore);
    });
    updateRubricScore();
  }

  // --------------------------------------------------------------------------
  // Practice Mode (120 Questions Immediate Feedback)
  // --------------------------------------------------------------------------
  function initPractice() {
    const unitSelect = document.getElementById('practiceUnitFilter');
    const searchInput = document.getElementById('practiceSearchInput');
    const bookmarkOnlyCb = document.getElementById('practiceBookmarkFilter');

    if (unitSelect) {
      unitSelect.addEventListener('change', (e) => {
        state.practice.currentUnit = e.target.value;
        renderPractice();
      });
    }
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.practice.searchQuery = e.target.value.trim().toLowerCase();
        renderPractice();
      });
    }
    if (bookmarkOnlyCb) {
      bookmarkOnlyCb.addEventListener('change', () => {
        renderPractice();
      });
    }
  }

  function renderPractice() {
    const container = document.getElementById('practiceQuestionsContainer');
    if (!container || typeof QUESTIONS_DATA === 'undefined') return;

    const { currentUnit, searchQuery, bookmarked } = state.practice;
    const bookmarkOnly = document.getElementById('practiceBookmarkFilter')?.checked;

    let filtered = QUESTIONS_DATA;

    if (currentUnit !== 'all') {
      filtered = filtered.filter(q => q.unit === parseInt(currentUnit, 10));
    }

    if (searchQuery) {
      filtered = filtered.filter(q => 
        q.question.toLowerCase().includes(searchQuery) ||
        q.explanation.toLowerCase().includes(searchQuery) ||
        q.options.some(o => o.toLowerCase().includes(searchQuery))
      );
    }

    if (bookmarkOnly) {
      filtered = filtered.filter(q => bookmarked.has(q.id));
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 3rem;">
          <i class="fas fa-search" style="font-size: 2.5rem; color: var(--text-subtle); margin-bottom: 1rem;"></i>
          <p style="color: var(--text-muted); font-size: 1.1rem;">ไม่พบข้อสอบที่ตรงกับเงื่อนไขการค้นหา</p>
        </div>`;
      return;
    }

    container.innerHTML = filtered.map(q => {
      const selected = state.practice.userAnswers[q.id];
      const isRevealed = state.practice.revealed[q.id] || selected !== undefined;
      const isBookmarked = bookmarked.has(q.id);

      return `
        <div class="question-card" id="pq_${q.id}">
          <div class="question-meta">
            <span><strong style="color: var(--primary);">ข้อที่ ${q.id}</strong> (${q.unitTitle})</span>
            <div>
              <button class="btn-icon" onclick="window.toggleBookmark(${q.id})" title="บันทึกข้อนี้" style="width: 34px; height: 34px; ${isBookmarked ? 'color: var(--secondary); border-color: var(--secondary);' : ''}">
                <i class="${isBookmarked ? 'fas' : 'far'} fa-star"></i>
              </button>
            </div>
          </div>
          <div class="question-text">${escapeHtml(q.question)}</div>
          <div class="options-list">
            ${q.options.map((opt, idx) => {
              let optClass = 'option-item';
              if (isRevealed) {
                if (idx === q.answer) optClass += ' correct';
                else if (selected === idx) optClass += ' wrong';
              } else if (selected === idx) {
                optClass += ' selected';
              }
              return `
                <div class="${optClass}" onclick="window.handlePracticeSelect(${q.id}, ${idx})">
                  <input type="radio" class="option-radio" name="practice_opt_${q.id}" ${selected === idx ? 'checked' : ''} ${isRevealed ? 'disabled' : ''}>
                  <span>${escapeHtml(opt)}</span>
                </div>
              `;
            }).join('')}
          </div>

          ${isRevealed ? `
            <div class="explanation-box">
              <strong style="display: block; margin-bottom: 0.35rem;">
                <i class="fas fa-check-circle text-success"></i> คำอธิบายเฉลยละเอียด:
              </strong>
              <div>${escapeHtml(q.explanation)}</div>
            </div>
          ` : `
            <div style="margin-top: 1rem; text-align: right;">
              <button class="btn-secondary" style="font-size: 0.85rem;" onclick="window.revealPracticeAnswer(${q.id})">
                <i class="fas fa-lightbulb"></i> ดูเฉลยข้อนี้
              </button>
            </div>
          `}
        </div>
      `;
    }).join('');
  }

  window.handlePracticeSelect = function(qid, optIdx) {
    state.practice.userAnswers[qid] = optIdx;
    state.practice.revealed[qid] = true;
    renderPractice();
  };

  window.revealPracticeAnswer = function(qid) {
    state.practice.revealed[qid] = true;
    renderPractice();
  };

  window.toggleBookmark = function(qid) {
    if (state.practice.bookmarked.has(qid)) {
      state.practice.bookmarked.delete(qid);
    } else {
      state.practice.bookmarked.add(qid);
    }
    localStorage.setItem('stou41211_bookmarks', JSON.stringify(Array.from(state.practice.bookmarked)));
    renderPractice();
  };

  // Helper function for HTML escaping
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Expose tab switcher to window
  window.switchTab = switchTab;
  window.startExam = startExam;

  // Initialize all components
  initTheme();
  initCourseSwitcher();
  initTabs();
  initSummaryControls();
  initExam();
  initEssay();
  initPractice();

  // Initial render
  renderSummaries();
});
