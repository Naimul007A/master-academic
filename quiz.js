// ══════════════════════════════════════════════════════════════════════════════
// ══  MASTER ACADEMIC — AI QUIZ & EXAM SYSTEM  ════════════════════════════════
// ══  Separate module. Requires Firebase, jsQR, QRCode already loaded.        ══
// ══════════════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── Constants ────────────────────────────────────────────────────────────────
  const GEMINI_MODEL = 'gemini-2.0-flash';
  const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  // ── Hardcoded Gemini API key — no user input needed ──
  const GEMINI_API_KEY = 'AIzaSyDVImbmjRC3t9PK5jdXGawFUqgElgMgSL8'; // ← paste your key here

  // ── State ─────────────────────────────────────────────────────────────────────
  let _currentQuiz = null;
  let _quizQuestions = [];
  let _studentAnswers = {};
  let _quizTimer = null;
  let _quizTimeLeft = 0;
  let _tabSwitchCount = 0;
  let _quizStartTime = null;
  let _examMode = false;
  let _publicQuizId = null;
  let _liveLeaderboardUnsub = null;

  // ── Helpers ───────────────────────────────────────────────────────────────────
  function _toast(msg) {
    if (window.showToast) window.showToast(msg);
    else console.log('[QUIZ]', msg);
  }

  function _fb() { return window._fb || {}; }
  function _db() { return window._db; }

  function _genId() {
    return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  }

  function _now() { return Date.now(); }

  function _formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function _el(id) { return document.getElementById(id); }

  // Returns first element found among multiple candidate IDs
  function _elAny(...ids) {
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) return el;
    }
    return null;
  }

  // ── Gemini API Key Management (disabled — key is hardcoded above) ────────────
  window.quizSaveGeminiKey = function () { /* key is built-in, no action needed */ };

  // ── Gemini Quiz Generation ────────────────────────────────────────────────────
  async function generateQuizWithGemini(text, numQ) {
    if (!GEMINI_API_KEY) {
      _toast('❌ Set your Gemini API key in the Quiz settings first!');
      throw new Error('No Gemini API key');
    }
    numQ = numQ || 20;
    const prompt = `Generate ${numQ} quiz questions from the following study material.

Rules:
- Generate a mix of MCQ and True/False questions
- Each MCQ must have exactly 4 options labeled A, B, C, D
- True/False questions have exactly 2 options: ["True", "False"]
- Include the correct answer exactly as one of the options
- Medium difficulty, suitable for class test
- Return ONLY a valid JSON array, no markdown, no explanation

JSON format:
[
  {
    "question": "Question text here?",
    "type": "mcq",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "answer": "Option A",
    "marks": 1
  },
  {
    "question": "True/False question here?",
    "type": "truefalse",
    "options": ["True", "False"],
    "answer": "True",
    "marks": 1
  }
]

Study Material:
${text.substring(0, 8000)}`;

    const res = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 4096 }
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API error: ${res.status} — ${err.substring(0, 200)}`);
    }
    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    // Extract JSON array from response
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('Gemini returned no valid JSON array.');
    return JSON.parse(match[0]);
  }

  // ── OCR: Image → Text ─────────────────────────────────────────────────────────
  async function extractTextFromImage(file) {
    if (typeof Tesseract === 'undefined') {
      throw new Error('Tesseract.js not loaded. Reload the page.');
    }
    const result = await Tesseract.recognize(file, 'eng+ben', {
      logger: m => {
        if (m.status === 'recognizing text') {
          const pct = Math.round((m.progress || 0) * 100);
          const bar = _el('quiz-ocr-progress');
          if (bar) bar.textContent = `⏳ OCR: ${pct}%`;
        }
      }
    });
    return result.data.text;
  }

  // ── PDF: PDF → Text ───────────────────────────────────────────────────────────
  async function extractTextFromPDF(file) {
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('PDF.js not loaded. Reload the page.');
    }
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= Math.min(pdf.numPages, 20); i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map(item => item.str).join(' ') + '\n';
    }
    return fullText;
  }

  // ── STEP 1: Teacher uploads file ─────────────────────────────────────────────
  window.quizExtractText = async function () {
    const fileInput = _el('quiz-upload-file');
    const file = fileInput?.files?.[0];
    if (!file) { _toast('❌ Please select a file first.'); return; }

    const btn = _el('quiz-extract-btn');
    const progress = _el('quiz-ocr-progress');
    const preview = _el('quiz-text-preview');
    const step2 = _el('quiz-step2');

    if (btn) btn.disabled = true;
    if (progress) { progress.style.display = 'block'; progress.textContent = '⏳ Starting extraction...'; }
    if (preview) preview.value = '';

    try {
      let text = '';
      if (file.type === 'application/pdf') {
        if (progress) progress.textContent = '⏳ Extracting PDF text...';
        text = await extractTextFromPDF(file);
      } else {
        text = await extractTextFromImage(file);
      }

      text = text.trim();
      if (!text || text.length < 20) throw new Error('Could not extract enough text. Try a clearer image.');

      if (preview) preview.value = text;
      if (step2) step2.style.display = 'block';
      if (progress) progress.textContent = `✅ Extracted ${text.length} characters. Review and generate quiz.`;
      _toast('✅ Text extracted successfully!');
    } catch (e) {
      _toast('❌ ' + e.message);
      if (progress) progress.textContent = '❌ ' + e.message;
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  // ── STEP 2: Generate questions with Gemini ────────────────────────────────────
  window.quizGenerateAI = async function () {
    const text = (_el('quiz-text-preview') || {}).value?.trim();
    if (!text) { _toast('❌ No text to generate from. Extract text first.'); return; }

    const numQ = parseInt((_el('quiz-num-questions') || {}).value) || 20;
    const btn = _el('quiz-generate-btn');
    const status = _el('quiz-gen-status');
    const editor = _el('quiz-questions-editor');

    if (btn) btn.disabled = true;
    if (status) status.textContent = '⏳ Generating quiz with AI...';
    if (editor) editor.style.display = 'none';

    try {
      const questions = await generateQuizWithGemini(text, numQ);
      _quizQuestions = questions;
      renderQuizEditor(questions);
      if (editor) editor.style.display = 'block';
      if (status) status.textContent = `✅ ${questions.length} questions generated. Review and edit below.`;
      _toast(`✅ ${questions.length} questions ready!`);
    } catch (e) {
      _toast('❌ ' + e.message);
      if (status) status.textContent = '❌ ' + e.message;
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  // ── Quiz Question Editor ──────────────────────────────────────────────────────
  function renderQuizEditor(questions) {
    const container = _el('quiz-questions-list');
    if (!container) return;

    container.innerHTML = questions.map((q, i) => `
      <div class="quiz-q-card" id="qqc-${i}">
        <div class="quiz-q-num">Q${i + 1} <span class="quiz-q-type-badge">${q.type === 'truefalse' ? 'T/F' : 'MCQ'}</span>
          <button onclick="window.quizDeleteQuestion(${i})" class="quiz-q-del">✕</button>
        </div>
        <textarea class="quiz-q-text" id="qq-text-${i}" rows="2">${q.question}</textarea>
        <div class="quiz-opts" id="qq-opts-${i}">
          ${q.options.map((opt, j) => `
            <div class="quiz-opt-row">
              <input type="radio" name="qq-ans-${i}" value="${opt}" id="qq-r-${i}-${j}" ${q.answer === opt ? 'checked' : ''}>
              <input type="text" class="quiz-opt-inp" value="${opt}" id="qq-opt-${i}-${j}" placeholder="Option ${j + 1}">
              <label for="qq-r-${i}-${j}" class="quiz-ans-lbl">✓ Correct</label>
            </div>`).join('')}
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
          <label style="font-size:11px;font-weight:700;color:var(--muted)">MARKS:</label>
          <input type="number" value="${q.marks || 1}" min="1" max="10" id="qq-marks-${i}"
            style="width:60px;padding:5px 8px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;text-align:center;">
        </div>
      </div>`).join('');
  }

  window.quizDeleteQuestion = function (idx) {
    _quizQuestions.splice(idx, 1);
    renderQuizEditor(_quizQuestions);
    _toast('Question removed.');
  };

  window.quizAddQuestion = function () {
    _quizQuestions.push({
      question: 'New question?',
      type: 'mcq',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      answer: 'Option A',
      marks: 1
    });
    renderQuizEditor(_quizQuestions);
    const container = _el('quiz-questions-list');
    if (container) container.lastElementChild?.scrollIntoView({ behavior: 'smooth' });
  };

  function collectQuestionsFromEditor() {
    return _quizQuestions.map((q, i) => {
      const questionText = (_el(`qq-text-${i}`) || {}).value?.trim() || q.question;
      const opts = q.options.map((_, j) => (_el(`qq-opt-${i}-${j}`) || {}).value?.trim() || q.options[j]);
      const radios = document.querySelectorAll(`input[name="qq-ans-${i}"]`);
      let answer = q.answer;
      radios.forEach((r, j) => { if (r.checked) answer = opts[j]; });
      const marks = parseInt((_el(`qq-marks-${i}`) || {}).value) || 1;
      return { ...q, question: questionText, options: opts, answer, marks };
    });
  }

  // ── STEP 3: Publish Quiz ──────────────────────────────────────────────────────
  window.quizPublish = async function () {
    const title = (_el('quiz-title') || {}).value?.trim();
    const desc = (_el('quiz-desc') || {}).value?.trim();
    const timeLimit = parseInt((_el('quiz-time-limit') || {}).value) || 30;
    const targetClass = (_el('quiz-target-class') || {}).value || 'All';

    if (!title) { _toast('❌ Quiz title required.'); return; }
    if (_quizQuestions.length === 0) { _toast('❌ No questions. Generate or add questions first.'); return; }

    const questions = collectQuestionsFromEditor();
    const totalMarks = questions.reduce((s, q) => s + (q.marks || 1), 0);

    const btn = _el('quiz-publish-btn');
    if (btn) btn.disabled = true;

    try {
      const quizId = _genId();
      const { collection, doc, setDoc, serverTimestamp } = _fb();

      await setDoc(doc(_db(), 'quizzes', quizId), {
        id: quizId,
        title,
        description: desc || '',
        timeLimit,
        targetClass,
        totalMarks,
        questionCount: questions.length,
        status: 'active',
        createdBy: window.curRole || 'teacher',
        createdAt: serverTimestamp(),
        published: true
      });

      for (let i = 0; i < questions.length; i++) {
        await setDoc(doc(_db(), 'quizzes', quizId, 'questions', String(i)), {
          ...questions[i], index: i
        });
      }

      _toast(`✅ Quiz published! Sharing options below.`);
      showQuizSharePanel(quizId, title);
      _el('quiz-editor-wrap')?.classList?.add('quiz-published');
    } catch (e) {
      _toast('❌ Publish failed: ' + e.message);
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  function showQuizSharePanel(quizId, title) {
    const panel = _el('quiz-share-panel');
    if (!panel) return;
    const base = window.location.origin + window.location.pathname;
    const link = `${base}?quiz=${quizId}`;
    panel.style.display = 'block';
    const linkEl = _el('quiz-share-link');
    if (linkEl) linkEl.textContent = link;
    const qrEl = _el('quiz-qr-canvas');
    if (qrEl && typeof QRCode !== 'undefined') {
      QRCode.toCanvas(qrEl, link, { width: 180, margin: 2, color: { dark: '#1a2340', light: '#fff' } });
    }
    window._lastQuizLink = link;
    window._lastQuizId = quizId;
  }

  window.quizCopyLink = function () {
    const link = window._lastQuizLink;
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => _toast('✅ Link copied!')).catch(() => {
      const el = _el('quiz-share-link');
      if (el) { const r = document.createRange(); r.selectNode(el); window.getSelection().addRange(r); document.execCommand('copy'); }
      _toast('✅ Link copied!');
    });
  };

  window.quizWhatsApp = function () {
    const link = window._lastQuizLink;
    const title = (_el('quiz-title') || {}).value || 'Quiz';
    if (!link) return;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`📝 ${title}\n\nJoin quiz: ${link}`)}`);
  };

  window.quizTelegram = function () {
    const link = window._lastQuizLink;
    const title = (_el('quiz-title') || {}).value || 'Quiz';
    if (!link) return;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(`📝 ${title}`)}`);
  };

  // ── Load & Render Quiz List (Admin/Teacher) ───────────────────────────────────
  window.loadAdminQuizList = async function () {
    // Works for both teacher tab (#quiz-admin-list) and admin panel (#quiz-admin-list-admin)
    const container = _elAny('quiz-admin-list', 'quiz-admin-list-admin');
    if (!container) return;
    container.innerHTML = '<div style="color:var(--muted);padding:12px">⏳ Loading quizzes...</div>';

    try {
      const { collection, getDocs, orderBy, query } = _fb();
      const q = query(collection(_db(), 'quizzes'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const quizzes = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      if (!quizzes.length) {
        container.innerHTML = '<div class="empty"><div class="ei">📝</div><p>No quizzes yet. Create one above!</p></div>';
        return;
      }

      container.innerHTML = quizzes.map(qz => `
        <div class="li">
          <div style="font-size:24px">📝</div>
          <div class="li-info">
            <div class="li-title">${qz.title}</div>
            <div class="li-sub">${qz.questionCount || 0} questions · ${qz.totalMarks || 0} marks · ${qz.timeLimit || 30}min · ${qz.targetClass || 'All'}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end">
            <span class="badge" style="${qz.status === 'active' ? '' : 'background:#ffeaea;color:#e84040'}">${qz.status === 'active' ? '✅ Active' : '🔒 Closed'}</span>
            <button onclick="window.quizViewLeaderboard('${qz.id}')" style="padding:4px 10px;border:none;border-radius:7px;background:#e8f0fe;color:#1a73e8;font-size:11px;font-weight:700;cursor:pointer">🏆 Results</button>
            <button onclick="window.quizShareExisting('${qz.id}','${qz.title?.replace(/'/g,"\\'")}')" style="padding:4px 10px;border:none;border-radius:7px;background:#e8f5f0;color:var(--gd);font-size:11px;font-weight:700;cursor:pointer">🔗 Share</button>
            <button onclick="window.quizToggleStatus('${qz.id}','${qz.status}')" style="padding:4px 10px;border:none;border-radius:7px;background:#fff3e0;color:#e65100;font-size:11px;font-weight:700;cursor:pointer">${qz.status === 'active' ? '🔒 Close' : '🔓 Open'}</button>
          </div>
        </div>`).join('');
    } catch (e) {
      container.innerHTML = `<div style="color:var(--r);padding:12px">❌ ${e.message}</div>`;
    }
  };

  window.quizToggleStatus = async function (id, current) {
    try {
      const { doc, updateDoc } = _fb();
      const next = current === 'active' ? 'closed' : 'active';
      await updateDoc(doc(_db(), 'quizzes', id), { status: next });
      _toast(`Quiz ${next === 'active' ? 'opened' : 'closed'}.`);
      window.loadAdminQuizList();
    } catch (e) { _toast('❌ ' + e.message); }
  };

  window.quizShareExisting = function (id, title) {
    const base = window.location.origin + window.location.pathname;
    const link = `${base}?quiz=${id}`;
    window._lastQuizLink = link;
    window._lastQuizId = id;
    showQuizSharePanel(id, title);
    _el('quiz-share-panel')?.scrollIntoView({ behavior: 'smooth' });
    _toast('Share panel updated!');
  };

  // ── Quiz Leaderboard (Admin view) ─────────────────────────────────────────────
  window.quizViewLeaderboard = async function (quizId) {
    // Works for both teacher tab and admin panel variants
    const panel = _elAny('quiz-leaderboard-panel', 'quiz-leaderboard-panel-admin');
    const container = _elAny('quiz-leaderboard-list', 'quiz-leaderboard-list-admin');
    const titleEl = _elAny('quiz-lb-title', 'quiz-lb-title-admin');
    if (!panel || !container) return;

    if (_liveLeaderboardUnsub) { _liveLeaderboardUnsub(); _liveLeaderboardUnsub = null; }

    panel.style.display = 'block';
    container.innerHTML = '<div style="color:var(--muted);padding:12px">⏳ Loading...</div>';
    if (titleEl) titleEl.textContent = 'Loading...';

    try {
      const { collection, query, where, orderBy, onSnapshot, doc, getDoc } = _fb();
      const qzSnap = await getDoc(doc(_db(), 'quizzes', quizId));
      const qzData = qzSnap.data() || {};
      if (titleEl) titleEl.textContent = `🏆 ${qzData.title || 'Quiz'} — Results`;

      const q = query(
        collection(_db(), 'quizSubmissions'),
        where('quizId', '==', quizId),
        orderBy('score', 'desc')
      );

      _liveLeaderboardUnsub = onSnapshot(q, snap => {
        const subs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (!subs.length) {
          container.innerHTML = '<div class="empty"><div class="ei">🏆</div><p>No submissions yet.</p></div>';
          return;
        }
        const medals = ['🥇', '🥈', '🥉'];
        container.innerHTML = `
          <div style="overflow-x:auto">
          <table class="tbl">
            <thead><tr><th>#</th><th>Name</th><th>Phone</th><th>Score</th><th>%</th><th>Time</th></tr></thead>
            <tbody>${subs.map((s, i) => `
              <tr>
                <td>${medals[i] || (i + 1)}</td>
                <td style="font-weight:700">${s.name}</td>
                <td>${s.phone || '—'}</td>
                <td style="font-weight:700;color:var(--g)">${s.score}/${s.totalMarks || '?'}</td>
                <td>${s.percentage || '—'}%</td>
                <td>${s.timeTaken ? _formatTime(Math.floor(s.timeTaken / 1000)) : '—'}</td>
              </tr>`).join('')}
            </tbody>
          </table>
          </div>`;
      });
      panel.scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
      container.innerHTML = `<div style="color:var(--r);padding:12px">❌ ${e.message}</div>`;
    }
  };

  // ── Student: Public Quiz Taking ───────────────────────────────────────────────
  function checkForPublicQuiz() {
    const params = new URLSearchParams(window.location.search);
    const qId = params.get('quiz');
    if (!qId) return;
    _publicQuizId = qId;
    setTimeout(() => showPublicQuizScreen(qId), 800);
  }

  function showPublicQuizScreen(quizId) {
    // Hide all screens first, then show only quiz screen
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = _el('s-quiz');
    if (screen) screen.classList.add('active');
    loadPublicQuizInfo(quizId);
  }

  async function loadPublicQuizInfo(quizId) {
    const container = _el('quiz-public-wrap');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(255,255,255,.5)">⏳ Loading quiz...</div>';

    try {
      const { doc, getDoc, collection, getDocs } = _fb();
      const qzSnap = await getDoc(doc(_db(), 'quizzes', quizId));
      if (!qzSnap.exists()) { container.innerHTML = '<div style="text-align:center;padding:40px;color:#f87171">❌ Quiz not found.</div>'; return; }

      const qz = { id: quizId, ...qzSnap.data() };

      if (qz.status !== 'active') {
        container.innerHTML = `
          <div style="text-align:center;padding:40px">
            <div style="font-size:56px;margin-bottom:12px">🔒</div>
            <div style="font-size:18px;font-weight:800;color:#fff;margin-bottom:8px">${qz.title}</div>
            <div style="color:rgba(255,255,255,.5);font-size:14px">This quiz has been closed by the teacher.</div>
          </div>`;
        return;
      }

      _currentQuiz = qz;

      const qsSnap = await getDocs(collection(_db(), 'quizzes', quizId, 'questions'));
      const questions = qsSnap.docs.map(d => d.data()).sort((a, b) => a.index - b.index);
      _quizQuestions = shuffleArray(questions);

      renderQuizRegistration(qz);
    } catch (e) {
      container.innerHTML = `<div style="text-align:center;padding:40px;color:#f87171">❌ ${e.message}</div>`;
    }
  }

  function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function renderQuizRegistration(qz) {
    const container = _el('quiz-public-wrap');
    container.innerHTML = `
      <div class="qpz-card">
        <div style="font-size:48px;text-align:center;margin-bottom:10px">📝</div>
        <h2 class="qpz-title">${qz.title}</h2>
        ${qz.description ? `<p class="qpz-desc">${qz.description}</p>` : ''}
        <div class="qpz-meta-row">
          <span>⏱ ${qz.timeLimit} minutes</span>
          <span>❓ ${_quizQuestions.length} questions</span>
          <span>🏆 ${qz.totalMarks} marks</span>
        </div>
        <div class="qpz-form">
          <input class="qpz-inp" type="text" id="qpz-name" placeholder="Your Full Name" minlength="3"/>
          <input class="qpz-inp" type="tel" id="qpz-phone" placeholder="Phone Number (01XXXXXXXXX)" maxlength="11"/>
          <button class="qpz-start-btn" onclick="window.quizStartExam()">🚀 Start Exam</button>
        </div>
        <p style="font-size:11px;color:rgba(255,255,255,.3);text-align:center;margin-top:12px">One attempt per phone number. Switching tabs may auto-submit.</p>
      </div>`;
  }

  window.quizStartExam = async function () {
    const name = (_el('qpz-name') || {}).value?.trim();
    const phone = (_el('qpz-phone') || {}).value?.trim();

    if (!name || name.length < 3) { _toast('❌ Name must be at least 3 characters.'); return; }
    if (!phone || !/^01[3-9]\d{8}$/.test(phone)) { _toast('❌ Enter a valid Bangladesh phone number (11 digits, starts with 01).'); return; }

    const { collection, query, where, getDocs } = _fb();
    try {
      const q = query(
        collection(_db(), 'quizSubmissions'),
        where('quizId', '==', _currentQuiz.id),
        where('phone', '==', phone)
      );
      const snap = await getDocs(q);
      if (!snap.empty) { _toast('❌ This phone number has already attempted this quiz.'); return; }
    } catch (e) { }

    window._quizStudentName = name;
    window._quizStudentPhone = phone;
    startQuizExam();
  };

  function startQuizExam() {
    _studentAnswers = {};
    _tabSwitchCount = 0;
    _quizStartTime = _now();
    _quizTimeLeft = (_currentQuiz.timeLimit || 30) * 60;
    renderExamInterface();
    startTimer();
    setupAntiCheat();
    tryFullscreen();
  }

  function renderExamInterface() {
    const container = _el('quiz-public-wrap');
    container.innerHTML = `
      <div class="qexam-wrap">
        <div class="qexam-header">
          <div class="qexam-title">${_currentQuiz.title}</div>
          <div class="qexam-timer" id="qexam-timer">⏱ ${_formatTime(_quizTimeLeft)}</div>
        </div>
        <div class="qexam-progress-bar"><div class="qexam-progress-fill" id="qexam-pfill" style="width:0%"></div></div>
        <div id="qexam-tab-warn" style="display:none;background:#fff3e0;border:2px solid #ff9800;border-radius:10px;padding:10px 14px;margin-bottom:10px;font-size:13px;font-weight:700;color:#e65100;">
          ⚠️ Tab switching detected! Auto-submit after 3 switches.
        </div>
        <div id="qexam-questions"></div>
        <div class="qexam-nav">
          <button class="qexam-btn-prev" onclick="window.qexamPrev()" id="qexam-prev">← Prev</button>
          <span id="qexam-qnum" style="font-size:13px;font-weight:700">1 / ${_quizQuestions.length}</span>
          <button class="qexam-btn-next" onclick="window.qexamNext()" id="qexam-next">Next →</button>
        </div>
        <div style="margin-top:12px;text-align:center">
          <button class="qexam-submit-btn" onclick="window.quizSubmit()">✅ Submit Exam</button>
        </div>
      </div>`;
    renderQuestion(0);
    window._currentQIndex = 0;
  }

  function renderQuestion(idx) {
    const q = _quizQuestions[idx];
    if (!q) return;
    window._currentQIndex = idx;
    const container = _el('qexam-questions');
    if (!container) return;

    const saved = _studentAnswers[idx];
    container.innerHTML = `
      <div class="qexam-question-card">
        <div class="qexam-q-meta">Question ${idx + 1} of ${_quizQuestions.length} · ${q.marks || 1} mark(s)</div>
        <div class="qexam-q-text">${q.question}</div>
        <div class="qexam-opts">
          ${q.options.map((opt, j) => `
            <label class="qexam-opt ${saved === opt ? 'selected' : ''}" id="qexam-opt-${j}">
              <input type="radio" name="qexam-ans" value="${opt}" ${saved === opt ? 'checked' : ''}
                onchange="window.qexamAnswer('${opt.replace(/'/g, "\\'")}',${idx})">
              <span class="qexam-opt-letter">${'ABCD'[j] || (j + 1)}</span>
              <span>${opt}</span>
            </label>`).join('')}
        </div>
      </div>`;

    const numEl = _el('qexam-qnum');
    if (numEl) numEl.textContent = `${idx + 1} / ${_quizQuestions.length}`;
    const prev = _el('qexam-prev');
    const next = _el('qexam-next');
    if (prev) prev.disabled = idx === 0;
    if (next) next.textContent = idx === _quizQuestions.length - 1 ? 'Review ✓' : 'Next →';
    updateProgress();
  }

  window.qexamAnswer = function (val, idx) {
    _studentAnswers[idx] = val;
    document.querySelectorAll('.qexam-opt').forEach(el => el.classList.remove('selected'));
    const chosen = document.querySelector(`input[name="qexam-ans"][value="${CSS.escape(val)}"]`);
    if (chosen) chosen.closest('.qexam-opt')?.classList.add('selected');
    updateProgress();
  };

  window.qexamNext = function () {
    const next = (window._currentQIndex || 0) + 1;
    if (next < _quizQuestions.length) renderQuestion(next);
  };

  window.qexamPrev = function () {
    const prev = (window._currentQIndex || 0) - 1;
    if (prev >= 0) renderQuestion(prev);
  };

  function updateProgress() {
    const answered = Object.keys(_studentAnswers).length;
    const pct = Math.round((answered / _quizQuestions.length) * 100);
    const fill = _el('qexam-pfill');
    if (fill) fill.style.width = pct + '%';
  }

  // ── Timer ─────────────────────────────────────────────────────────────────────
  function startTimer() {
    clearInterval(_quizTimer);
    _quizTimer = setInterval(() => {
      _quizTimeLeft--;
      const el = _el('qexam-timer');
      if (el) {
        el.textContent = `⏱ ${_formatTime(_quizTimeLeft)}`;
        if (_quizTimeLeft <= 60) el.style.color = '#f87171';
        else el.style.color = '';
      }
      if (_quizTimeLeft <= 0) {
        clearInterval(_quizTimer);
        _toast('⏰ Time up! Auto-submitting...');
        window.quizSubmit(true);
      }
    }, 1000);
  }

  // ── Anti-Cheat ────────────────────────────────────────────────────────────────
  function setupAntiCheat() {
    document.addEventListener('visibilitychange', _onVisibilityChange);
    document.addEventListener('contextmenu', _blockEvent);
    document.addEventListener('copy', _blockEvent);
    document.addEventListener('cut', _blockEvent);
    document.addEventListener('paste', _blockEvent);
    document.addEventListener('selectstart', _blockExam);
    window.addEventListener('blur', _onWindowBlur);
  }

  function teardownAntiCheat() {
    document.removeEventListener('visibilitychange', _onVisibilityChange);
    document.removeEventListener('contextmenu', _blockEvent);
    document.removeEventListener('copy', _blockEvent);
    document.removeEventListener('cut', _blockEvent);
    document.removeEventListener('paste', _blockEvent);
    document.removeEventListener('selectstart', _blockExam);
    window.removeEventListener('blur', _onWindowBlur);
  }

  function _blockEvent(e) {
    if (_examMode) { e.preventDefault(); return false; }
  }

  function _blockExam(e) {
    const el = e.target;
    if (_examMode && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') {
      e.preventDefault();
    }
  }

  function _onVisibilityChange() {
    if (!_examMode || document.visibilityState !== 'hidden') return;
    _tabSwitchCount++;
    const warn = _el('qexam-tab-warn');
    if (warn) { warn.style.display = 'block'; warn.textContent = `⚠️ Tab switch #${_tabSwitchCount} detected! Auto-submit after 3 switches.`; }
    if (_tabSwitchCount >= 3) {
      _toast('🚫 Too many tab switches! Auto-submitting...');
      window.quizSubmit(true);
    }
  }

  function _onWindowBlur() {
    if (!_examMode) return;
  }

  function tryFullscreen() {
    _examMode = true;
    const el = _el('quiz-public-wrap');
    if (el?.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
  }

  // ── Submit Exam ───────────────────────────────────────────────────────────────
  window.quizSubmit = async function (autoSubmit) {
    if (!autoSubmit) {
      const answered = Object.keys(_studentAnswers).length;
      if (answered < _quizQuestions.length) {
        const ok = confirm(`You have answered ${answered} of ${_quizQuestions.length} questions. Submit anyway?`);
        if (!ok) return;
      }
    }

    clearInterval(_quizTimer);
    _examMode = false;
    teardownAntiCheat();

    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});

    const timeTaken = _now() - _quizStartTime;
    let score = 0;
    const review = _quizQuestions.map((q, i) => {
      const given = _studentAnswers[i] || null;
      const correct = given === q.answer;
      if (correct) score += (q.marks || 1);
      return { question: q.question, correct: q.answer, given, isCorrect: correct, marks: q.marks || 1 };
    });

    const totalMarks = _quizQuestions.reduce((s, q) => s + (q.marks || 1), 0);
    const percentage = Math.round((score / totalMarks) * 100);

    try {
      const { collection, addDoc, serverTimestamp } = _fb();
      await addDoc(collection(_db(), 'quizSubmissions'), {
        quizId: _currentQuiz.id,
        quizTitle: _currentQuiz.title,
        name: window._quizStudentName,
        phone: window._quizStudentPhone,
        score,
        totalMarks,
        percentage,
        timeTaken,
        tabSwitches: _tabSwitchCount,
        autoSubmitted: !!autoSubmit,
        review,
        submittedAt: serverTimestamp()
      });
    } catch (e) {
      console.warn('[QUIZ] Submission save error:', e.message);
    }

    renderResultScreen(score, totalMarks, percentage, timeTaken, review);
  };

  function renderResultScreen(score, totalMarks, percentage, timeTaken, review) {
    const container = _el('quiz-public-wrap');
    const isPerfect = percentage >= 80;
    if (container) container.innerHTML = `
      <div class="qresult-wrap">
        ${isPerfect ? `<div class="qresult-confetti" id="qresult-confetti"></div>` : ''}
        <div style="font-size:56px;text-align:center;margin-bottom:8px">${percentage >= 80 ? '🎉' : percentage >= 50 ? '👍' : '📚'}</div>
        <h2 class="qresult-title">${percentage >= 80 ? 'Excellent!' : percentage >= 50 ? 'Good Job!' : 'Keep Practicing!'}</h2>
        <div class="qresult-score">${score} / ${totalMarks}</div>
        <div class="qresult-pct" style="color:${percentage >= 80 ? 'var(--g)' : percentage >= 50 ? 'var(--y)' : 'var(--r)'}">${percentage}%</div>
        <div class="qresult-meta">⏱ Time: ${_formatTime(Math.floor(timeTaken / 1000))} · ✅ Correct: ${review.filter(r => r.isCorrect).length} · ❌ Wrong: ${review.filter(r => !r.isCorrect).length}</div>
        <div style="margin-top:16px">
          <div style="font-family:'Baloo 2',sans-serif;font-weight:800;font-size:14px;margin-bottom:10px">Review Answers:</div>
          ${review.map((r, i) => `
            <div class="qreview-card ${r.isCorrect ? 'correct' : 'wrong'}">
              <div class="qreview-q">${i + 1}. ${r.question}</div>
              <div style="font-size:12px;margin-top:6px">
                <span style="color:${r.isCorrect ? 'var(--g)' : 'var(--r)'}">Your answer: ${r.given || '(not answered)'}</span>
                ${!r.isCorrect ? `<br><span style="color:var(--g)">✓ Correct: ${r.correct}</span>` : ''}
              </div>
            </div>`).join('')}
        </div>
      </div>`;

    if (isPerfect) {
      setTimeout(() => spawnConfetti(), 200);
    }
  }

  function spawnConfetti() {
    const wrap = _el('qresult-confetti');
    if (!wrap) return;
    const colors = ['#00c896', '#1a73e8', '#ffb300', '#e84040', '#9c27b0'];
    for (let i = 0; i < 40; i++) {
      const bit = document.createElement('div');
      bit.className = 'conf-bit';
      bit.style.cssText = `left:${Math.random() * 100}%;width:8px;height:8px;background:${colors[i % colors.length]};border-radius:${Math.random() > .5 ? '50%' : '2px'};animation-delay:${Math.random() * 2}s;animation-duration:${1.5 + Math.random()}s`;
      wrap.appendChild(bit);
    }
  }

  // ── Student App: Quiz Tab ─────────────────────────────────────────────────────
  window.loadStudentQuizList = async function () {
    const container = _el('sp-quiz-list');
    if (!container) return;
    container.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px">⏳ Loading...</div>';

    try {
      const { collection, query, where, getDocs } = _fb();
      const studentClass = window.appData?.me?.class || '';
      let q;
      try {
        q = query(collection(_db(), 'quizzes'), where('status', '==', 'active'));
      } catch (e) {
        q = collection(_db(), 'quizzes');
      }
      const snap = await getDocs(q);
      const quizzes = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(qz => qz.status === 'active' && (qz.targetClass === 'All' || !studentClass || qz.targetClass === studentClass));

      if (!quizzes.length) {
        container.innerHTML = '<div class="empty"><div class="ei">📝</div><p>No active quizzes right now.</p></div>';
        return;
      }

      container.innerHTML = quizzes.map(qz => {
        const link = `${window.location.origin}${window.location.pathname}?quiz=${qz.id}`;
        return `
          <div class="ncard" style="border-left-color:var(--b)" onclick="window.open('${link}','_blank')">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
              <span class="badge" style="background:#e8f0fe;color:var(--b)">📝 Quiz</span>
              <span style="font-size:11px;color:var(--muted)">⏱ ${qz.timeLimit}min</span>
            </div>
            <div class="nt">${qz.title}</div>
            ${qz.description ? `<div class="nb" style="margin-top:4px">${qz.description}</div>` : ''}
            <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
              <span style="font-size:12px;color:var(--muted)">❓ ${qz.questionCount || '?'} Qs · 🏆 ${qz.totalMarks || '?'} marks</span>
            </div>
            <button style="margin-top:10px;width:100%;padding:10px;border:none;border-radius:10px;
              background:linear-gradient(135deg,var(--b),var(--g));color:#fff;
              font-family:'Baloo 2',sans-serif;font-size:13px;font-weight:700;cursor:pointer">
              🚀 Attend Quiz
            </button>
          </div>`;
      }).join('');
    } catch (e) {
      container.innerHTML = `<div style="color:var(--r);text-align:center;padding:20px">❌ ${e.message}</div>`;
    }
  };

  // ── Init ─────────────────────────────────────────────────────────────────────
  function init() {
    // Check for public quiz link
    checkForPublicQuiz();
  }

  // Wait for Firebase to be ready
  if (window._fbReady) {
    init();
  } else {
    window.addEventListener('firebase-ready', init);
  }

})();
