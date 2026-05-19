// ============================================
// FILE: admin-lesson-plan.js
// ============================================
// Admin / Chairman view of all teachers' lesson plans.
// Features:
//   • Filter by teacher, class, date range
//   • Subject-grouped cards with dated entries
//   • Export: Weekly plan / Monthly plan (print-ready HTML)
//
// Requires: Firebase (_db, _fb) already initialised in window.
// Usage: window.renderAdminLessonPlans('admin-lesson-plan-section');

(function () {

  // ── Helpers ───────────────────────────────────────────────────────────────

  function waitForFirebase(cb) {
    if (window._fbReady && window._db && window._fb) { cb(); return; }
    window.addEventListener('firebase-ready', cb, { once: true });
  }

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fmt12(time24) {
    if (!time24) return '';
    const [h, m] = time24.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  function todayStr() { return new Date().toISOString().split('T')[0]; }

  function weekRange() {
    const now = new Date();
    const day = now.getDay();
    const sat = new Date(now); sat.setDate(now.getDate() - ((day + 1) % 7));
    const thu = new Date(sat); thu.setDate(sat.getDate() + 5);
    return {
      from: sat.toISOString().split('T')[0],
      to:   thu.toISOString().split('T')[0]
    };
  }

  function monthRange() {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    return { from, to };
  }

  // ── Real-time listener ─────────────────────────────────────────────────────

  let _started = false;
  function startListener() {
    if (_started) return;
    _started = true;
    const { collection, onSnapshot, orderBy, query } = window._fb;
    const q = query(collection(window._db, 'lessonPlans'), orderBy('date', 'desc'));
    onSnapshot(q, snap => {
      window.appData = window.appData || {};
      window.appData.lessonPlans = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      _rerender();
    }, err => console.warn('[AdminLP] snapshot', err.message));
  }

  // ── State ─────────────────────────────────────────────────────────────────

  let _containerId = '';
  let _state = {
    teacher: '',
    class:   '',
    from:    '',
    to:      ''
  };

  function _rerender() {
    const el = document.getElementById(_containerId);
    if (!el) return;
    _renderBody(el);
  }

  // ── Filtering & grouping ──────────────────────────────────────────────────

  function _filtered() {
    return (window.appData.lessonPlans || []).filter(p => {
      if (_state.teacher && p.teacher !== _state.teacher) return false;
      if (_state.class   && !(p.class || '').toLowerCase().includes(_state.class.toLowerCase())) return false;
      if (_state.from    && p.date < _state.from) return false;
      if (_state.to      && p.date > _state.to)   return false;
      return true;
    });
  }

  // Returns: { Subject -> { date -> [plans] } }
  function _groupBySubjectDate(plans) {
    const map = {};
    plans.forEach(p => {
      const subj = p.subject || 'Unknown';
      if (!map[subj]) map[subj] = {};
      if (!map[subj][p.date]) map[subj][p.date] = [];
      map[subj][p.date].push(p);
    });
    return map;
  }

  // ── Unique values for dropdowns ───────────────────────────────────────────

  function _teachers() {
    const set = new Set((window.appData.lessonPlans || []).map(p => p.teacher).filter(Boolean));
    return [...set].sort();
  }

  function _classes() {
    const set = new Set((window.appData.lessonPlans || []).map(p => p.class).filter(Boolean));
    return [...set].sort();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const ACCENT = '#00c896';
  const CARD_BG = 'rgba(255,255,255,0.05)';
  const SUBJECT_COLORS = ['#00c896','#1a73e8','#ff9800','#e84040','#a855f7','#ec4899','#14b8a6','#f59e0b'];
  function subjectColor(subj) {
    let h = 0;
    for (let i = 0; i < subj.length; i++) h = (h * 31 + subj.charCodeAt(i)) >>> 0;
    return SUBJECT_COLORS[h % SUBJECT_COLORS.length];
  }

  function _renderBody(container) {
    const plans = _filtered();
    const grouped = _groupBySubjectDate(plans);
    const subjects = Object.keys(grouped).sort();

    // ── Stats bar
    const totalDays = new Set(plans.map(p => p.date)).size;
    const totalClasses = new Set(plans.map(p => p.class)).size;

    let html = `
      <!-- Stats -->
      <div style="display:flex; gap:10px; margin-bottom:18px; flex-wrap:wrap;">
        ${statCard('📋', plans.length, 'Total Plans')}
        ${statCard('📚', subjects.length, 'Subjects')}
        ${statCard('🏫', totalClasses, 'Classes')}
        ${statCard('📅', totalDays, 'Days Covered')}
      </div>`;

    if (!subjects.length) {
      html += `
        <div style="background:${CARD_BG}; border-radius:16px; padding:32px; text-align:center;">
          <div style="font-size:36px; margin-bottom:10px;">📭</div>
          <div style="font-weight:800; font-size:15px;">No lesson plans found</div>
          <div style="font-size:12px; opacity:0.5; margin-top:4px;">Adjust the filters above</div>
        </div>`;
    } else {
      subjects.forEach(subj => {
        const color = subjectColor(subj);
        const dateMap = grouped[subj];
        const dates = Object.keys(dateMap).sort((a,b) => b.localeCompare(a));
        const totalEntries = dates.reduce((s, d) => s + dateMap[d].length, 0);

        html += `
          <div style="margin-bottom:20px;">
            <!-- Subject header -->
            <div style="
              display:flex; align-items:center; gap:10px; margin-bottom:10px;
              padding:12px 16px; border-radius:14px;
              background:${color}18; border-left:5px solid ${color};
            ">
              <div style="flex:1;">
                <div style="font-weight:800; font-size:16px; color:${color};">${escHtml(subj)}</div>
                <div style="font-size:11px; opacity:0.6; margin-top:2px;">
                  ${totalEntries} session${totalEntries !== 1 ? 's' : ''} across ${dates.length} day${dates.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            <!-- Date rows -->
            <div style="padding-left:6px;">`;

        dates.forEach(date => {
          const dayPlans = dateMap[date];
          const dayLabel = dayPlans[0].day || '';
          html += `
              <div style="margin-bottom:10px;">
                <div style="font-size:10px; font-weight:700; opacity:0.4; letter-spacing:1px; margin-bottom:6px;">
                  ${dayLabel.toUpperCase()} ${date}
                </div>`;

          dayPlans.forEach(plan => {
            html += `
                <div style="
                  background:${CARD_BG}; border-radius:12px; padding:12px 14px;
                  margin-bottom:8px; border-left:3px solid ${color}55;
                ">
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                    <div style="flex:1;">
                      <div style="font-size:13px; font-weight:700;">${escHtml(plan.class)}${plan.time ? ' <span style="opacity:0.5; font-weight:500;">• ' + fmt12(plan.time) + '</span>' : ''}</div>
                      <div style="font-size:13px; color:${color}; font-weight:700; margin-top:4px;">📖 ${escHtml(plan.topic)}</div>
                      ${plan.teacher ? `<div style="font-size:11px; opacity:0.5; margin-top:3px;">👤 ${escHtml(plan.teacher)}</div>` : ''}
                      ${plan.notes  ? `<div style="font-size:11px; opacity:0.55; margin-top:5px; line-height:1.5;">${escHtml(plan.notes)}</div>` : ''}
                    </div>
                  </div>
                </div>`;
          });

          html += `</div>`;
        });

        html += `</div></div>`;
      });
    }

    const listEl = document.getElementById('alp-list');
    if (listEl) listEl.innerHTML = html;
  }

  function statCard(icon, value, label) {
    return `
      <div style="
        flex:1; min-width:80px; background:${CARD_BG}; border-radius:14px;
        padding:12px; text-align:center;
      ">
        <div style="font-size:20px;">${icon}</div>
        <div style="font-size:20px; font-weight:800; margin:2px 0;">${value}</div>
        <div style="font-size:10px; opacity:0.5; font-weight:600;">${label}</div>
      </div>`;
  }

  // ── Full section render ────────────────────────────────────────────────────

  window.renderAdminLessonPlans = function (containerId) {
    _containerId = containerId;
    const container = document.getElementById(containerId);
    if (!container) return;

    const wr = weekRange();
    const mr = monthRange();

    container.innerHTML = `
      <div style="font-family:'Baloo 2',sans-serif; color:#fff;">

        <!-- Header -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; flex-wrap:wrap; gap:10px;">
          <div style="font-weight:800; font-size:18px;">📚 Lesson Plans — Overview</div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button id="alp-export-week"
              data-from="${wr.from}" data-to="${wr.to}" data-label="Weekly"
              style="${exportBtnStyle('#1a73e8')}">⬇ Weekly</button>
            <button id="alp-export-month"
              data-from="${mr.from}" data-to="${mr.to}" data-label="Monthly"
              style="${exportBtnStyle('#a855f7')}">⬇ Monthly</button>
            <button id="alp-export-custom"
              style="${exportBtnStyle('#ff9800')}">⬇ Custom Range</button>
          </div>
        </div>

        <!-- Filters -->
        <div style="
          display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px;
        ">
          <select id="alp-f-teacher" style="${selectStyle()}">
            <option value="">All Teachers</option>
          </select>
          <input id="alp-f-class" type="text" placeholder="Filter by class…" style="${inputStyle()}"/>
          <input id="alp-f-from" type="date" style="${inputStyle()}" title="From date"/>
          <input id="alp-f-to"   type="date" style="${inputStyle()}" title="To date"/>
        </div>
        <div style="display:flex; gap:8px; margin-bottom:20px; flex-wrap:wrap;">
          <button id="alp-preset-today"   style="${presetBtn()}">Today</button>
          <button id="alp-preset-week"    style="${presetBtn()}">This Week</button>
          <button id="alp-preset-month"   style="${presetBtn()}">This Month</button>
          <button id="alp-preset-clear"   style="${presetBtn()}">All Time</button>
        </div>

        <!-- List -->
        <div id="alp-list">
          <div style="text-align:center; padding:20px; opacity:0.4;">Loading…</div>
        </div>

      </div>
    `;

    _wireFilters(container, wr, mr);

    waitForFirebase(() => {
      startListener();
      _populateTeacherDrop();
      // Default: this week
      _applyPreset(wr.from, wr.to);
    });
  };

  function _populateTeacherDrop() {
    const sel = document.getElementById('alp-f-teacher');
    if (!sel) return;
    const teachers = _teachers();
    sel.innerHTML = '<option value="">All Teachers</option>' +
      teachers.map(t => `<option value="${escHtml(t)}">${escHtml(t)}</option>`).join('');
  }

  function _wireFilters(container, wr, mr) {
    const onChange = () => {
      _state.teacher = (document.getElementById('alp-f-teacher') || {}).value || '';
      _state.class   = (document.getElementById('alp-f-class')   || {}).value || '';
      _state.from    = (document.getElementById('alp-f-from')    || {}).value || '';
      _state.to      = (document.getElementById('alp-f-to')      || {}).value || '';
      _rerender();
    };

    setTimeout(() => {
      ['alp-f-teacher','alp-f-class','alp-f-from','alp-f-to'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', onChange);
      });

      const preset = (from, to) => _applyPreset(from, to);
      const t = todayStr();
      document.getElementById('alp-preset-today')  ?.addEventListener('click', () => preset(t, t));
      document.getElementById('alp-preset-week')   ?.addEventListener('click', () => preset(wr.from, wr.to));
      document.getElementById('alp-preset-month')  ?.addEventListener('click', () => preset(mr.from, mr.to));
      document.getElementById('alp-preset-clear')  ?.addEventListener('click', () => { _applyPreset('', ''); });

      document.getElementById('alp-export-week') ?.addEventListener('click', function () {
        _export(this.dataset.from, this.dataset.to, 'Weekly');
      });
      document.getElementById('alp-export-month')?.addEventListener('click', function () {
        _export(this.dataset.from, this.dataset.to, 'Monthly');
      });
      document.getElementById('alp-export-custom')?.addEventListener('click', () => {
        const f = _state.from || prompt('From date (YYYY-MM-DD):');
        const t2 = _state.to  || prompt('To date (YYYY-MM-DD):');
        if (f && t2) _export(f, t2, 'Custom');
      });
    }, 0);
  }

  function _applyPreset(from, to) {
    const fromEl = document.getElementById('alp-f-from');
    const toEl   = document.getElementById('alp-f-to');
    if (fromEl) fromEl.value = from;
    if (toEl)   toEl.value   = to;
    _state.from = from;
    _state.to   = to;
    _rerender();
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  function _export(from, to, label) {
    const plans = (window.appData.lessonPlans || []).filter(p => {
      const teacher = _state.teacher;
      const cls     = _state.class;
      if (teacher && p.teacher !== teacher) return false;
      if (cls && !(p.class || '').toLowerCase().includes(cls.toLowerCase())) return false;
      if (from && p.date < from) return false;
      if (to   && p.date > to)   return false;
      return true;
    });

    if (!plans.length) {
      alert('No lesson plans found for the selected range.');
      return;
    }

    const grouped = _groupBySubjectDate(plans);
    const subjects = Object.keys(grouped).sort();

    // All unique dates in range, sorted
    const allDates = [...new Set(plans.map(p => p.date))].sort();

    const institutionName = document.title || 'Master Academic & Admission Care';
    const rangeLabel = from && to ? `${from} to ${to}` : 'All Time';
    const teacherLabel = _state.teacher || 'All Teachers';
    const classLabel   = _state.class   || 'All Classes';

    const printDoc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${label} Lesson Plan — ${rangeLabel}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color:#1a1a2e; background:#fff; font-size:13px; }
  .page-header { background:linear-gradient(135deg,#1a1a2e,#16213e); color:#fff; padding:24px 32px; }
  .page-header h1 { font-size:22px; font-weight:800; }
  .page-header .sub { font-size:13px; opacity:0.65; margin-top:6px; }
  .meta { display:flex; gap:24px; margin-top:14px; flex-wrap:wrap; }
  .meta span { background:rgba(255,255,255,0.1); border-radius:8px; padding:5px 12px; font-size:12px; }
  .content { padding:24px 32px; }
  .subject-block { margin-bottom:28px; }
  .subject-title {
    font-size:16px; font-weight:800; padding:10px 16px;
    border-radius:10px; margin-bottom:10px;
    display:flex; align-items:center; gap:8px;
  }
  .date-label {
    font-size:10px; font-weight:700; letter-spacing:1px;
    color:#666; text-transform:uppercase; margin:10px 0 5px 2px;
  }
  table { width:100%; border-collapse:collapse; margin-bottom:8px; }
  th { background:#f0f0f5; font-size:11px; font-weight:700; padding:8px 12px; text-align:left; color:#555; }
  td { padding:9px 12px; border-bottom:1px solid #f0f0f5; vertical-align:top; font-size:12px; }
  tr:last-child td { border-bottom:none; }
  .topic-cell { font-weight:700; color:#1a1a2e; }
  .notes-cell { color:#555; font-size:11px; }
  .badge { display:inline-block; border-radius:6px; padding:2px 8px; font-size:10px; font-weight:700; }
  .footer { text-align:center; padding:16px 32px 24px; font-size:11px; color:#999; border-top:1px solid #eee; }
  @media print {
    .no-print { display:none; }
    body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  }
  .print-btn {
    position:fixed; top:16px; right:16px; background:#1a73e8; color:#fff;
    border:none; border-radius:10px; padding:10px 20px;
    font-size:14px; font-weight:700; cursor:pointer; z-index:999;
    box-shadow:0 4px 16px rgba(0,0,0,0.2);
  }
  .stat-row { display:flex; gap:16px; margin-bottom:20px; flex-wrap:wrap; }
  .stat { background:#f8f9ff; border-radius:10px; padding:12px 18px; flex:1; min-width:80px; text-align:center; }
  .stat .val { font-size:22px; font-weight:800; color:#1a1a2e; }
  .stat .lbl { font-size:10px; color:#888; margin-top:2px; font-weight:600; }
</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">🖨 Print / Save PDF</button>

<div class="page-header">
  <h1>📚 ${label} Lesson Plan</h1>
  <div class="sub">${institutionName}</div>
  <div class="meta">
    <span>📅 ${rangeLabel}</span>
    <span>👤 ${teacherLabel}</span>
    <span>🏫 ${classLabel}</span>
    <span>Generated: ${new Date().toLocaleDateString('en-BD', {day:'2-digit',month:'short',year:'numeric'})}</span>
  </div>
</div>

<div class="content">
  <div class="stat-row">
    <div class="stat"><div class="val">${plans.length}</div><div class="lbl">Total Sessions</div></div>
    <div class="stat"><div class="val">${subjects.length}</div><div class="lbl">Subjects</div></div>
    <div class="stat"><div class="val">${new Set(plans.map(p=>p.class)).size}</div><div class="lbl">Classes</div></div>
    <div class="stat"><div class="val">${allDates.length}</div><div class="lbl">Days</div></div>
  </div>

  ${subjects.map((subj, si) => {
    const dateMap = grouped[subj];
    const dates = Object.keys(dateMap).sort();
    const colors = ['#00c896','#1a73e8','#ff9800','#e84040','#a855f7','#ec4899','#14b8a6','#f59e0b'];
    const color = colors[si % colors.length];
    return `
    <div class="subject-block">
      <div class="subject-title" style="background:${color}18; border-left:5px solid ${color}; color:${color};">
        ${escHtml(subj)}
        <span style="font-size:11px; opacity:0.7; font-weight:500; margin-left:auto;">${dateMap[subj] ? '' : ''}</span>
      </div>
      ${dates.map(date => {
        const dayPlans = dateMap[date];
        const dayLbl = dayPlans[0].day || '';
        return `
        <div class="date-label">${dayLbl} — ${date}</div>
        <table>
          <thead>
            <tr>
              <th style="width:20%">Class</th>
              <th style="width:15%">Time</th>
              <th style="width:30%">Topic</th>
              <th style="width:15%">Teacher</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${dayPlans.map(p => `
            <tr>
              <td><span class="badge" style="background:${color}18; color:${color};">${escHtml(p.class)}</span></td>
              <td>${fmt12(p.time) || '—'}</td>
              <td class="topic-cell">${escHtml(p.topic)}</td>
              <td>${escHtml(p.teacher)}</td>
              <td class="notes-cell">${escHtml(p.notes) || '—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>`;
      }).join('')}
    </div>`;
  }).join('')}
</div>

<div class="footer">
  Master Academic & Admission Care — ${label} Lesson Plan Report &nbsp;|&nbsp; ${rangeLabel}
</div>
</body>
</html>`;

    const blob = new Blob([printDoc], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const win  = window.open(url, '_blank');
    if (!win) alert('Please allow popups to open the export.');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // ── Style helpers ──────────────────────────────────────────────────────────

  function selectStyle() {
    return `
      width:100%; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.12);
      color:#fff; border-radius:12px; padding:10px 14px; font-size:13px;
      font-family:'Baloo 2',sans-serif; outline:none; cursor:pointer;
    `;
  }

  function inputStyle() {
    return `
      width:100%; background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.12);
      color:#fff; border-radius:12px; padding:10px 14px; font-size:13px;
      font-family:'Baloo 2',sans-serif; outline:none; box-sizing:border-box;
    `;
  }

  function exportBtnStyle(color) {
    return `
      background:${color}22; border:1px solid ${color}55; color:${color};
      border-radius:10px; padding:8px 14px; font-family:'Baloo 2',sans-serif;
      font-weight:800; font-size:12px; cursor:pointer; white-space:nowrap;
    `;
  }

  function presetBtn() {
    return `
      background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1);
      color:rgba(255,255,255,0.7); border-radius:8px; padding:6px 12px;
      font-family:'Baloo 2',sans-serif; font-weight:700; font-size:12px;
      cursor:pointer; white-space:nowrap;
    `;
  }

})();
