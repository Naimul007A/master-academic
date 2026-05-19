// ============================================
// FILE: lesson-plan.js
// ============================================
// Lesson Plan module — teachers log what they taught.
//
// Smart auto-fill:
//   • Date is ALWAYS today — set automatically, never typed
//   • Today's scheduled classes are shown as one-tap cards
//   • Selecting a card pre-fills class + subject instantly
//   • Teacher only needs to type the topic (+ optional notes)
//
// Requires: Firebase (_db, _fb) + window.appData.classes already in window.

(function () {

  // ── Helpers ───────────────────────────────────────────────────────────────

  function waitForFirebase(cb) {
    if (window._fbReady && window._db && window._fb) { cb(); return; }
    window.addEventListener('firebase-ready', cb, { once: true });
  }

  function escHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function todayStr() {
    return new Date().toISOString().split('T')[0];
  }

  function todayDayName() {
    return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
  }

  function dayNameOf(dateStr) {
    return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date(dateStr).getDay()];
  }

  function fmt12(t) {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`;
  }

  // ── Firestore ─────────────────────────────────────────────────────────────

  async function savePlan(data) {
    const { collection, addDoc, serverTimestamp } = window._fb;
    return addDoc(collection(window._db, 'lessonPlans'), { ...data, createdAt: serverTimestamp() });
  }

  async function updatePlan(id, data) {
    const { doc, updateDoc, serverTimestamp } = window._fb;
    return updateDoc(doc(window._db, 'lessonPlans', id), { ...data, updatedAt: serverTimestamp() });
  }

  async function deletePlan(id) {
    const { doc, deleteDoc } = window._fb;
    return deleteDoc(doc(window._db, 'lessonPlans', id));
  }

  // ── Real-time listener ────────────────────────────────────────────────────

  let _started = false;
  function startListener() {
    if (_started) return;
    _started = true;
    const { collection, onSnapshot, orderBy, query } = window._fb;
    const q = query(collection(window._db, 'lessonPlans'), orderBy('date', 'desc'));
    onSnapshot(q, snap => {
      window.appData = window.appData || {};
      window.appData.lessonPlans = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      _onDataUpdate();
    }, err => console.warn('[LessonPlan]', err.message));
  }

  function _onDataUpdate() {
    if (document.getElementById('lp-today-cards'))  _renderTodayCards();
    if (document.getElementById('lp-list-container')) _renderHistory();
  }

  // ── Get today's scheduled classes for this teacher ────────────────────────

  function _todaySchedule(teacherName) {
    const dayName = todayDayName();
    return (window.appData.classes || [])
      .filter(c => c.teacher === teacherName && c.day === dayName)
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  }

  // ── Modal ─────────────────────────────────────────────────────────────────

  const INP = `
    width:100%; background:rgba(255,255,255,0.07);
    border:1px solid rgba(255,255,255,0.12); color:#fff;
    border-radius:12px; padding:10px 14px; font-size:14px;
    font-family:'Baloo 2',sans-serif; box-sizing:border-box; outline:none;
  `;

  const LBL = `font-size:11px; opacity:0.85; font-weight:700;
    display:block; margin-bottom:6px; letter-spacing:0.5px;`;

  function injectModal() {
    if (document.getElementById('lp-modal')) return;
    const m = document.createElement('div');
    m.id = 'lp-modal';
    m.style.cssText = `
      display:none; position:fixed; inset:0; z-index:9999;
      background:rgba(0,0,0,0.72); backdrop-filter:blur(5px);
      align-items:center; justify-content:center; padding:16px;
    `;
    m.innerHTML = `
      <div style="
        background:#1a1a2e; border-radius:20px; padding:24px;
        width:100%; max-width:420px; max-height:92vh; overflow-y:auto;
        box-shadow:0 24px 64px rgba(0,0,0,0.55);
        border:1px solid rgba(255,255,255,0.08);
        font-family:'Baloo 2',sans-serif; color:#fff;
      ">
        <!-- Header -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <div style="font-size:17px; font-weight:800;" id="lp-modal-title">📚 Add Lesson Plan</div>
          <button id="lp-modal-close" style="
            background:rgba(255,255,255,0.08); border:none; color:#fff;
            width:32px; height:32px; border-radius:50%; cursor:pointer; font-size:15px;">✕</button>
        </div>

        <div id="lp-form-msg" style="display:none; border-radius:10px; padding:10px 14px; margin-bottom:14px; font-size:13px;"></div>

        <!-- Auto date banner -->
        <div id="lp-date-banner" style="
          background:rgba(0,200,150,0.1); border:1px solid rgba(0,200,150,0.2);
          border-radius:12px; padding:10px 14px; margin-bottom:16px;
          display:flex; align-items:center; gap:10px;
        ">
          <div style="font-size:20px;">📅</div>
          <div>
            <div style="font-weight:800; font-size:14px;" id="lp-date-display"></div>
            <div style="font-size:11px; opacity:0.75;">Date set automatically to today</div>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:14px;">

          <!-- Class selector -->
          <div>
            <label style="${LBL}">CLASS</label>
            <select id="lp-class-sel" style="${INP} cursor:pointer;">
              <option value="">— Select class —</option>
            </select>
            <!-- Fallback text input shown when no schedule found -->
            <input id="lp-class-txt" type="text" placeholder="Type class name…"
              style="${INP} display:none; margin-top:8px;"/>
          </div>

          <!-- Subject (auto-filled from schedule, editable) -->
          <div>
            <label style="${LBL}">SUBJECT</label>
            <input id="lp-subject" type="text" placeholder="Auto-filled when you pick a class…"
              style="${INP}"/>
          </div>

          <!-- Topic — the only thing teacher MUST type -->
          <div>
            <label style="${LBL}">TOPIC / CHAPTER <span style="color:#00c896;">*</span></label>
            <input id="lp-topic" type="text"
              placeholder="e.g. Quadratic Equations, Newton's 2nd Law…"
              style="${INP}" autofocus/>
          </div>

          <!-- Time (auto-filled from schedule, editable) -->
          <div>
            <label style="${LBL}">CLASS TIME (optional)</label>
            <input id="lp-time" type="time" style="${INP}"/>
          </div>

          <!-- Notes -->
          <div>
            <label style="${LBL}">NOTES (optional)</label>
            <textarea id="lp-notes" rows="2"
              placeholder="Homework assigned, page numbers, observations…"
              style="${INP} resize:vertical;"></textarea>
          </div>

          <input id="lp-edit-id"   type="hidden" value=""/>
          <input id="lp-date-val"  type="hidden" value=""/>

          <button id="lp-save-btn" style="
            background:linear-gradient(135deg,#00c896,#00a572);
            border:none; color:#fff; border-radius:14px; padding:14px;
            font-family:'Baloo 2',sans-serif; font-weight:800; font-size:15px;
            cursor:pointer; width:100%; margin-top:4px;
          ">Save Lesson Plan</button>

        </div>
      </div>
    `;
    document.body.appendChild(m);
    document.getElementById('lp-modal-close').addEventListener('click', closeLessonPlanModal);
    m.addEventListener('click', e => { if (e.target === m) closeLessonPlanModal(); });
    document.getElementById('lp-save-btn').addEventListener('click', _handleSave);

    // When class dropdown changes → auto-fill subject + time
    document.getElementById('lp-class-sel').addEventListener('change', function () {
      const val = this.value;
      if (!val) return;
      try {
        const cls = JSON.parse(decodeURIComponent(val));
        document.getElementById('lp-subject').value = cls.subject || '';
        if (cls.time) document.getElementById('lp-time').value = cls.time;
        document.getElementById('lp-topic').focus();
      } catch (_) {}
    });
  }

  function _showMsg(text, isError) {
    const el = document.getElementById('lp-form-msg');
    if (!el) return;
    el.style.display = 'block';
    el.style.background = isError ? 'rgba(232,64,64,0.15)' : 'rgba(0,200,150,0.15)';
    el.style.color      = isError ? '#ff6b6b' : '#00c896';
    el.style.border     = `1px solid ${isError ? 'rgba(232,64,64,0.3)' : 'rgba(0,200,150,0.3)'}`;
    el.textContent = text;
    if (!isError) setTimeout(() => { el.style.display = 'none'; }, 2800);
  }

  async function _handleSave() {
    const dateVal    = document.getElementById('lp-date-val').value  || todayStr();
    const selEl      = document.getElementById('lp-class-sel');
    const txtEl      = document.getElementById('lp-class-txt');
    const subjectVal = document.getElementById('lp-subject').value.trim();
    const topicVal   = document.getElementById('lp-topic').value.trim();
    const timeVal    = document.getElementById('lp-time').value.trim();
    const notesVal   = document.getElementById('lp-notes').value.trim();
    const editId     = document.getElementById('lp-edit-id').value;
    const teacher    = window._lpCurrentTeacher || '';

    // Resolve class value
    let classVal = '';
    if (selEl && selEl.style.display !== 'none' && selEl.value) {
      try { classVal = JSON.parse(decodeURIComponent(selEl.value)).class || selEl.value; } catch (_) { classVal = selEl.value; }
    } else if (txtEl) {
      classVal = txtEl.value.trim();
    }

    if (!classVal || !subjectVal || !topicVal) {
      _showMsg('Please fill in Class, Subject and Topic.', true);
      return;
    }

    const btn = document.getElementById('lp-save-btn');
    btn.textContent = 'Saving…';
    btn.disabled = true;

    try {
      const payload = {
        teacher, date: dateVal, day: dayNameOf(dateVal),
        class: classVal, subject: subjectVal,
        topic: topicVal, time: timeVal, notes: notesVal
      };
      if (editId) {
        await updatePlan(editId, payload);
        _showMsg('Updated!');
      } else {
        await savePlan(payload);
        _showMsg('Saved!');
      }
      setTimeout(closeLessonPlanModal, 1100);
    } catch (err) {
      _showMsg('Error: ' + err.message, true);
    } finally {
      btn.disabled = false;
      if (btn.textContent === 'Saving…') btn.textContent = 'Save Lesson Plan';
    }
  }

  // ── Open modal ────────────────────────────────────────────────────────────

  window.openLessonPlanModal = function (prefill) {
    injectModal();
    const modal = document.getElementById('lp-modal');
    modal.style.display = 'flex';

    // Reset
    document.getElementById('lp-form-msg').style.display = 'none';
    document.getElementById('lp-edit-id').value  = '';
    document.getElementById('lp-subject').value  = '';
    document.getElementById('lp-topic').value    = '';
    document.getElementById('lp-time').value     = '';
    document.getElementById('lp-notes').value    = '';
    document.getElementById('lp-save-btn').textContent = 'Save Lesson Plan';
    document.getElementById('lp-modal-title').textContent = '📚 Add Lesson Plan';

    // Always lock date to today
    const today = todayStr();
    document.getElementById('lp-date-val').value = today;
    const banner = document.getElementById('lp-date-display');
    if (banner) {
      const d = new Date();
      banner.textContent = `${todayDayName()}, ${d.toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' })}`;
    }

    // Populate class dropdown from today's schedule
    const schedule = _todaySchedule(window._lpCurrentTeacher || '');
    const selEl = document.getElementById('lp-class-sel');
    const txtEl = document.getElementById('lp-class-txt');

    if (schedule.length) {
      selEl.style.display = '';
      txtEl.style.display = 'none';
      selEl.innerHTML = '<option value="">— Select today\'s class —</option>' +
        schedule.map(c => {
          const val = encodeURIComponent(JSON.stringify({ class: c.class || c.className || '', subject: c.subject || '', time: c.time || '' }));
          return `<option value="${val}">${escHtml(c.subject)} — ${escHtml(c.class || c.className || '')} ${c.time ? '(' + fmt12(c.time) + ')' : ''}</option>`;
        }).join('');
    } else {
      selEl.style.display = 'none';
      txtEl.style.display = '';
      txtEl.value = '';
    }

    // If prefill provided (from card button or edit)
    if (prefill) {
      if (prefill.id) {
        document.getElementById('lp-edit-id').value = prefill.id;
        document.getElementById('lp-modal-title').textContent = '✏️ Edit Lesson Plan';
      }
      if (prefill.class) {
        // Try to match schedule entry, else use text input
        const matched = schedule.find(c =>
          (c.class || c.className || '').toLowerCase() === prefill.class.toLowerCase() &&
          (c.subject || '').toLowerCase() === (prefill.subject || '').toLowerCase()
        );
        if (matched) {
          const val = encodeURIComponent(JSON.stringify({ class: matched.class || matched.className || '', subject: matched.subject || '', time: matched.time || '' }));
          selEl.value = val;
        } else if (schedule.length === 0) {
          txtEl.value = prefill.class;
        }
      }
      if (prefill.subject) document.getElementById('lp-subject').value = prefill.subject;
      if (prefill.topic)   document.getElementById('lp-topic').value   = prefill.topic;
      if (prefill.time)    document.getElementById('lp-time').value    = prefill.time;
      if (prefill.notes)   document.getElementById('lp-notes').value   = prefill.notes;
    }

    setTimeout(() => document.getElementById('lp-topic').focus(), 120);
  };

  window.closeLessonPlanModal = function () {
    const m = document.getElementById('lp-modal');
    if (m) m.style.display = 'none';
  };

  // ── Today's class cards (quick-log section) ───────────────────────────────

  function _renderTodayCards() {
    const container = document.getElementById('lp-today-cards');
    if (!container) return;

    const teacher  = window._lpCurrentTeacher || '';
    const today    = todayStr();
    const schedule = _todaySchedule(teacher);
    const plans    = (window.appData.lessonPlans || []).filter(p => p.teacher === teacher && p.date === today);

    const dayName  = todayDayName();
    const d        = new Date();
    const dateLabel = `${dayName}, ${d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}`;

    if (!schedule.length) {
      container.innerHTML = `
        <div style="
          background:rgba(255,255,255,0.04); border-radius:14px;
          padding:20px; text-align:center;
        ">
          <div style="font-size:28px; margin-bottom:8px;">🎉</div>
          <div style="font-weight:700; font-size:14px;">No classes scheduled today</div>
          <div style="font-size:12px; opacity:0.72; margin-top:4px;">${dateLabel}</div>
          <button onclick="window.openLessonPlanModal({})"
            style="
              margin-top:14px; background:rgba(255,255,255,0.07);
              border:1px dashed rgba(255,255,255,0.2); color:rgba(255,255,255,0.6);
              border-radius:10px; padding:8px 16px; font-size:12px; font-weight:700;
              cursor:pointer; font-family:'Baloo 2',sans-serif;
            ">+ Add manual plan</button>
        </div>`;
      return;
    }

    let html = `
      <div style="
        font-size:11px; font-weight:700; opacity:0.75; letter-spacing:1px;
        margin-bottom:10px; padding-left:2px;
      ">TODAY — ${dateLabel.toUpperCase()}</div>`;

    schedule.forEach(cls => {
      const clsName = cls.class || cls.className || '';
      const plan = plans.find(p =>
        p.subject.toLowerCase() === (cls.subject || '').toLowerCase() &&
        p.class.toLowerCase() === clsName.toLowerCase()
      );

      const currentMin = new Date().getHours() * 60 + new Date().getMinutes();
      let statusDot = '';
      if (cls.time) {
        const [h, m] = cls.time.split(':').map(Number);
        const classMin = h * 60 + m;
        if (classMin < currentMin - 30)       statusDot = `<span style="color:#4caf50; font-size:10px;">✓ Done</span>`;
        else if (classMin <= currentMin)       statusDot = `<span style="color:#ff9800; font-size:10px; font-weight:800;">● Now</span>`;
        else                                   statusDot = `<span style="color:rgba(255,255,255,0.35); font-size:10px;">${fmt12(cls.time)}</span>`;
      }

      if (plan) {
        // Plan already logged — show it with edit button
        html += `
          <div style="
            background:rgba(0,200,150,0.08); border-radius:14px;
            padding:14px 16px; margin-bottom:10px;
            border:1px solid rgba(0,200,150,0.2);
          ">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <div>
                <span style="font-weight:800; font-size:14px; color:#00e8a8;">${escHtml(cls.subject)}</span>
                <span style="font-size:12px; opacity:0.55; margin-left:6px;">${escHtml(clsName)}</span>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                ${statusDot}
                <button onclick="window.openLessonPlanModal(${JSON.stringify({...plan}).replace(/</g,'\\u003c')})"
                  style="
                    background:rgba(0,200,150,0.2); border:none; color:#00c896;
                    border-radius:8px; padding:4px 10px; font-size:11px; font-weight:800;
                    cursor:pointer; font-family:'Baloo 2',sans-serif;
                  ">Edit</button>
              </div>
            </div>
            <div style="
              background:rgba(0,0,0,0.15); border-radius:8px; padding:7px 10px;
              font-size:13px; font-weight:700; color:#e0ffe8;
            ">📖 ${escHtml(plan.topic)}</div>
            ${plan.notes ? `<div style="font-size:11px; opacity:0.72; margin-top:6px;">${escHtml(plan.notes)}</div>` : ''}
          </div>`;
      } else {
        // Not yet logged — show a tap-to-log card
        const prefill = JSON.stringify({ subject: cls.subject || '', class: clsName, time: cls.time || '' }).replace(/</g,'\\u003c');
        html += `
          <div onclick="window.openLessonPlanModal(${prefill})"
            style="
              background:rgba(255,255,255,0.04); border-radius:14px;
              padding:14px 16px; margin-bottom:10px;
              border:1px dashed rgba(255,255,255,0.15); cursor:pointer;
              transition:background 0.2s;
            "
            onmouseover="this.style.background='rgba(255,255,255,0.08)'"
            onmouseout="this.style.background='rgba(255,255,255,0.04)'"
          >
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-weight:800; font-size:14px;">${escHtml(cls.subject)}</div>
                <div style="font-size:12px; opacity:0.75; margin-top:2px;">${escHtml(clsName)}</div>
              </div>
              <div style="display:flex; align-items:center; gap:10px;">
                ${statusDot}
                <div style="
                  background:rgba(0,200,150,0.15); color:#00c896;
                  border-radius:8px; padding:5px 12px; font-size:11px; font-weight:800;
                  white-space:nowrap;
                ">+ Log Plan</div>
              </div>
            </div>
          </div>`;
      }
    });

    container.innerHTML = html;
  }

  // ── History list ──────────────────────────────────────────────────────────

  function _renderHistory() {
    const container = document.getElementById('lp-list-container');
    if (!container) return;

    const teacher     = window._lpCurrentTeacher || '';
    const filterDate  = (document.getElementById('lp-filter-date')  || {}).value || '';
    const filterClass = ((document.getElementById('lp-filter-class') || {}).value || '').trim().toLowerCase();

    const plans = (window.appData.lessonPlans || [])
      .filter(p => p.teacher === teacher)
      .filter(p => {
        if (filterDate  && p.date !== filterDate)                                    return false;
        if (filterClass && !(p.class || '').toLowerCase().includes(filterClass))     return false;
        return true;
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    if (!plans.length) {
      container.innerHTML = `
        <div style="background:rgba(255,255,255,0.04); border-radius:14px; padding:24px; text-align:center;">
          <div style="font-size:28px; margin-bottom:8px;">📋</div>
          <div style="font-weight:700;">No plans in history</div>
          <div style="font-size:12px; opacity:0.72; margin-top:4px;">Log a class above to see it here</div>
        </div>`;
      return;
    }

    // Group by date
    const byDate = {};
    plans.forEach(p => { (byDate[p.date] = byDate[p.date] || []).push(p); });

    let html = '';
    Object.keys(byDate).sort((a,b) => b.localeCompare(a)).forEach(date => {
      const dayLbl = byDate[date][0].day || dayNameOf(date);
      html += `
        <div style="margin-bottom:4px;">
          <div style="font-size:10px; font-weight:700; opacity:0.75; letter-spacing:1px; margin-bottom:7px; padding-left:2px;">
            ${dayLbl.toUpperCase()} — ${date}
          </div>`;

      byDate[date].forEach(plan => {
        html += `
          <div style="
            background:rgba(255,255,255,0.05); border-radius:13px;
            padding:13px 15px; margin-bottom:9px; border-left:4px solid #00c896;
          ">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:7px;">
              <div>
                <div style="font-weight:800; font-size:14px;">${escHtml(plan.subject)}</div>
                <div style="font-size:12px; opacity:0.80; margin-top:2px;">
                  ${escHtml(plan.class)}${plan.time ? ' &bull; ' + fmt12(plan.time) : ''}
                </div>
              </div>
              <div style="display:flex; gap:7px; flex-shrink:0; margin-left:8px;">
                <button onclick="window.openLessonPlanModal(${JSON.stringify({...plan}).replace(/</g,'\\u003c')})"
                  style="
                    background:rgba(255,255,255,0.08); border:none; color:#fff;
                    padding:4px 10px; border-radius:7px; cursor:pointer;
                    font-size:11px; font-weight:700; font-family:'Baloo 2',sans-serif;">Edit</button>
                <button onclick="window._lpDelete('${plan.id}')"
                  style="
                    background:rgba(232,64,64,0.12); border:none; color:#ff6b6b;
                    padding:4px 10px; border-radius:7px; cursor:pointer;
                    font-size:11px; font-weight:700; font-family:'Baloo 2',sans-serif;">Del</button>
              </div>
            </div>
            <div style="
              background:rgba(0,200,150,0.1); border-radius:8px; padding:7px 11px;
              font-size:13px; font-weight:700; color:#00e8a8;
            ">📖 ${escHtml(plan.topic)}</div>
            ${plan.notes ? `<div style="font-size:11px; opacity:0.72; margin-top:7px; line-height:1.5;">${escHtml(plan.notes)}</div>` : ''}
          </div>`;
      });

      html += `</div>`;
    });

    container.innerHTML = html;
  }

  window._lpDelete = async function (id) {
    if (!confirm('Delete this lesson plan?')) return;
    try { await deletePlan(id); } catch (e) { alert('Error: ' + e.message); }
  };

  // ── Main section render ───────────────────────────────────────────────────

  window._lpCurrentTeacher = '';

  window.renderLessonPlanSection = function (teacherName) {
    window._lpCurrentTeacher = teacherName;
    const section = document.getElementById('lesson-plan-section');
    if (!section) return;

    section.innerHTML = `
      <div style="font-family:'Baloo 2',sans-serif; color:#fff;">

        <!-- Quick-log: today's classes -->
        <div style="font-weight:800; font-size:15px; margin-bottom:12px;">
          📋 Today's Classes
        </div>
        <div id="lp-today-cards" style="margin-bottom:22px;">
          <div style="opacity:0.4; padding:12px; font-size:13px;">Loading…</div>
        </div>

        <!-- History section -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div style="font-weight:800; font-size:15px;">📚 Plan History</div>
        </div>

        <!-- Filters -->
        <div style="display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap;">
          <input id="lp-filter-date" type="date" value="${todayStr()}"
            style="
              flex:1; min-width:120px; background:rgba(255,255,255,0.07);
              border:1px solid rgba(255,255,255,0.1); color:#fff;
              border-radius:10px; padding:8px 12px; font-size:12px;
              font-family:'Baloo 2',sans-serif; outline:none;
            "/>
          <input id="lp-filter-class" type="text" placeholder="Filter by class…"
            style="
              flex:1; min-width:100px; background:rgba(255,255,255,0.07);
              border:1px solid rgba(255,255,255,0.1); color:#fff;
              border-radius:10px; padding:8px 12px; font-size:12px;
              font-family:'Baloo 2',sans-serif; outline:none;
            "/>
          <button id="lp-filter-all"
            style="
              background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.1);
              color:#fff; border-radius:10px; padding:8px 12px;
              font-family:'Baloo 2',sans-serif; cursor:pointer; font-weight:700;
              font-size:12px; white-space:nowrap;
            ">All</button>
        </div>

        <!-- History list -->
        <div id="lp-list-container">
          <div style="opacity:0.4; padding:12px; font-size:13px;">Loading…</div>
        </div>

      </div>
    `;

    document.getElementById('lp-filter-date').addEventListener('change', _renderHistory);
    document.getElementById('lp-filter-class').addEventListener('input', _renderHistory);
    document.getElementById('lp-filter-all').addEventListener('click', () => {
      document.getElementById('lp-filter-date').value = '';
      document.getElementById('lp-filter-class').value = '';
      _renderHistory();
    });

    waitForFirebase(() => {
      startListener();
      _renderTodayCards();
      _renderHistory();
    });
  };

  // ── today-class.js integration ────────────────────────────────────────────
  // Wraps renderTodayClasses to inject "+ Log Plan" / topic badges on each card.

  const _orig = window.renderTodayClasses;
  window.renderTodayClasses = function (teacherName) {
    window._lpCurrentTeacher = teacherName;
    if (typeof _orig === 'function') _orig(teacherName);
    setTimeout(() => _patchTodayClassCards(teacherName), 60);
  };

  function _patchTodayClassCards(teacherName) {
    const container = document.getElementById('today-classes');
    if (!container) return;
    const today = todayStr();
    const plans = (window.appData.lessonPlans || []).filter(p => p.teacher === teacherName && p.date === today);

    container.querySelectorAll('div[style*="border-left"]').forEach(card => {
      const bold = card.querySelector('div[style*="font-weight: 800"]') || card.querySelector('div[style*="font-weight:800"]');
      if (!bold) return;
      const subj = bold.textContent.trim();
      const clsEl = card.querySelectorAll('div')[1];
      const cls  = clsEl ? clsEl.textContent.split('•')[0].trim() : '';
      const plan = plans.find(p => p.subject.toLowerCase() === subj.toLowerCase());

      const old = card.querySelector('.lp-badge');
      if (old) old.remove();
      const badge = document.createElement('div');
      badge.className = 'lp-badge';
      badge.style.marginTop = '10px';

      if (plan) {
        badge.innerHTML = `
          <div style="
            background:rgba(0,200,150,0.1); border-radius:9px; padding:7px 12px;
            display:flex; justify-content:space-between; align-items:center; gap:8px;
          ">
            <div style="font-size:12px; color:#00e8a8; font-weight:700; flex:1;">
              📖 ${escHtml(plan.topic)}
            </div>
            <button onclick="window.openLessonPlanModal(${JSON.stringify({...plan}).replace(/</g,'\\u003c')})"
              style="
                background:rgba(0,200,150,0.2); border:none; color:#00c896;
                border-radius:7px; padding:4px 9px; font-size:11px; font-weight:800;
                cursor:pointer; font-family:'Baloo 2',sans-serif;">Edit</button>
          </div>`;
      } else {
        const pf = JSON.stringify({ subject: subj, class: cls, date: today }).replace(/</g,'\\u003c');
        badge.innerHTML = `
          <button onclick="window.openLessonPlanModal(${pf})"
            style="
              background:rgba(255,255,255,0.05); border:1px dashed rgba(255,255,255,0.18);
              color:rgba(255,255,255,0.5); border-radius:9px; padding:7px 12px;
              font-size:11px; font-weight:700; cursor:pointer; width:100%;
              font-family:'Baloo 2',sans-serif;">
            + Log Lesson Plan
          </button>`;
      }
      card.appendChild(badge);
    });
  }

  // Start Firebase listener early
  waitForFirebase(startListener);

})();
