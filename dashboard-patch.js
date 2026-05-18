/* ═══════════════════════════════════════════════════════════════════════════
   DASHBOARD INTEGRATION PATCH — Master Academic
   Apply these 5 targeted edits to wire dashboard.js into your app.
   ═══════════════════════════════════════════════════════════════════════════

   FILE LAYOUT AFTER PATCHING
   ───────────────────────────
   index.html  →  +<script src="dashboard.js">  +admin Dashboard tab  +mgr Dashboard tab
   admin.js    →  aTab() handles 'dashboard' + renderDashboard() call
   manager.js  →  mgrTab() handles 'dashboard' + renderDashboard() call
   window-expose.js  →  expose renderDashboard & _refreshDashboard

   ═══════════════════════════════════════════════════════════════════════════ */


/* ── PATCH 1  ── index.html ─────────────────────────────────────────────────
   Add <script src="dashboard.js"> BEFORE </body>

   FIND (near bottom of index.html, after your split-script tags):
      <script src="offline-queue.js"></script>

   ADD IMMEDIATELY AFTER:
      <script src="dashboard.js"></script>
   ─────────────────────────────────────────────────────────────────────────── */


/* ── PATCH 2  ── index.html — Admin tab button ──────────────────────────────
   FIND the admin tab bar in index.html (around line 1075):
      <button class="atab active" onclick="aTab('teachers',this)">👨‍🏫 Teachers</button>

   ADD a new button AS THE VERY FIRST tab (before Teachers):
*/

// ↓ Paste this button as the FIRST child inside the admin tab bar div:
const ADMIN_DASH_BTN = `
<button class="atab" id="atab-dashboard"
  onclick="aTab('dashboard',this);window.renderDashboard('dash-admin','admin')"
  style="background:linear-gradient(135deg,#00c896,#1a73e8);color:#fff;border:none;">
  📊 Dashboard
</button>`;

// ↓ Paste this panel div BEFORE the first <div class="apanel ..."> in the admin section:
const ADMIN_DASH_PANEL = `
<div class="apanel" id="ap-dashboard">
  <div class="card" style="padding:14px 14px 4px;">
    <!-- filter strip -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;align-items:center;">
      <button onclick="window.renderDashboard('dash-admin','admin')"
        style="padding:9px 16px;border:none;border-radius:10px;
        background:linear-gradient(135deg,#00c896,#1a73e8);
        color:#fff;font-family:'Baloo 2',sans-serif;font-size:12px;font-weight:800;cursor:pointer;">
        🔄 Refresh
      </button>
      <span style="font-size:11px;color:var(--muted);">Live data from Firestore</span>
    </div>
    <div id="dash-admin">
      <div style="text-align:center;padding:40px 20px;color:var(--muted);font-size:13px;">
        Loading dashboard…
      </div>
    </div>
  </div>
</div>`;

/* ── PATCH 3  ── index.html — Manager tab button ─────────────────────────────
   FIND the manager nav bar (around line 1740 in original, after split):
      <button class="mgr-nav" id="mgr-nav-teachers" ...>👨‍🏫 Teachers</button>

   ADD this button AS THE FIRST item inside the manager nav div:
*/

const MGR_DASH_BTN = `
<button class="mgr-nav" id="mgr-nav-dashboard"
  onclick="mgrTab('dashboard',this);window.renderDashboard('dash-mgr','manager')"
  style="flex-shrink:0;padding:8px 16px;border:none;border-radius:10px;
  font-family:'Baloo 2',sans-serif;font-size:12px;font-weight:700;cursor:pointer;
  background:linear-gradient(135deg,#00c896,#1a73e8);color:#fff;transition:all .2s;">
  📊 Dashboard
</button>`;

// ↓ Paste this div BEFORE <!-- Teachers Tab --> inside the manager tbody2:
const MGR_DASH_TAB = `
<!-- Dashboard Tab -->
<div id="mgr-tab-dashboard" style="display:none;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
    <div class="t-section-label" style="margin:0;">📊 Analytics</div>
    <button onclick="window.renderDashboard('dash-mgr','manager')"
      style="padding:7px 13px;border:none;border-radius:9px;
      background:rgba(0,200,150,.2);border:1px solid rgba(0,200,150,.3);
      color:rgba(0,220,140,.9);font-family:'Baloo 2',sans-serif;
      font-size:11px;font-weight:800;cursor:pointer;">
      🔄 Refresh
    </button>
  </div>
  <div id="dash-mgr">
    <div style="text-align:center;padding:40px 20px;color:rgba(255,255,255,.3);font-size:13px;">
      Loading dashboard…
    </div>
  </div>
</div>`;


/* ── PATCH 4  ── admin.js — aTab() function ──────────────────────────────────
   FIND the aTab function in admin.js:

      function aTab(name,el){
        document.querySelectorAll('.atab').forEach(t=>t.classList.remove('active'));
        el.classList.add('active');
        document.querySelectorAll('.apanel').forEach(p=>p.classList.remove('active'));
        $(`ap-${name}`).classList.add('active');
        if(name==='attendance'||name==='teacher-attendance'){
          initAttYearDrops();
          renderHolidayList();
        }
        if(name==='finance') renderAdminFinance();
      }

   REPLACE WITH:
*/
function aTab_PATCHED(name,el){
  document.querySelectorAll('.atab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('.apanel').forEach(p=>p.classList.remove('active'));
  const panel = document.getElementById(`ap-${name}`);
  if(panel) panel.classList.add('active');
  if(name==='attendance'||name==='teacher-attendance'){
    initAttYearDrops();
    renderHolidayList();
  }
  if(name==='finance') renderAdminFinance();
  if(name==='dashboard') window.renderDashboard?.('dash-admin','admin');
}


/* ── PATCH 5  ── manager.js — mgrTab() function ──────────────────────────────
   FIND the mgrTab function in manager.js:

      function mgrTab(name,el){
        document.querySelectorAll('.mgr-nav').forEach(b=>{
          b.style.background='rgba(255,255,255,.1)';b.style.color='rgba(255,255,255,.7)';
        });
        if(el){el.style.background='#1a73e8';el.style.color='#fff';}
        ['mgr-tab-teachers','mgr-tab-students','mgr-tab-attendance',
         'mgr-tab-teacher-att','mgr-tab-homework','mgr-tab-finance','mgr-tab-scanner']
          .forEach(id=>{ const t=$(id);if(t)t.style.display='none'; });
        const tab=$('mgr-tab-'+name);if(tab)tab.style.display='block';
        if(name==='scanner'){ window._scannerOnTabOpen&&window._scannerOnTabOpen(); }
        else { window.stopQrScanner&&window.stopQrScanner(true); }
        if(name==='teachers')renderMgrTeachers();
        else if(name==='students')renderMgrStudents();
        else if(name==='attendance'){mgrInitAttDrops();renderMgrAttendance();}
        else if(name==='teacher-att')renderMgrTeacherAtt();
        else if(name==='homework')renderMgrHomework();
        else if(name==='finance')renderMgrFinance();
      }

   REPLACE WITH:
*/
function mgrTab_PATCHED(name,el){
  document.querySelectorAll('.mgr-nav').forEach(b=>{
    b.style.background='rgba(255,255,255,.1)';b.style.color='rgba(255,255,255,.7)';
  });
  if(el){
    el.style.background='linear-gradient(135deg,#00c896,#1a73e8)';
    el.style.color='#fff';
  }
  ['mgr-tab-dashboard','mgr-tab-teachers','mgr-tab-students','mgr-tab-attendance',
   'mgr-tab-teacher-att','mgr-tab-homework','mgr-tab-finance','mgr-tab-scanner']
    .forEach(id=>{ const t=document.getElementById(id);if(t)t.style.display='none'; });
  const tab=document.getElementById('mgr-tab-'+name);
  if(tab)tab.style.display='block';
  if(name==='scanner'){ window._scannerOnTabOpen?.(); }
  else { window.stopQrScanner?.(true); }
  if(name==='teachers')renderMgrTeachers();
  else if(name==='students')renderMgrStudents();
  else if(name==='attendance'){mgrInitAttDrops();renderMgrAttendance();}
  else if(name==='teacher-att')renderMgrTeacherAtt();
  else if(name==='homework')renderMgrHomework();
  else if(name==='finance')renderMgrFinance();
  else if(name==='dashboard')window.renderDashboard?.('dash-mgr','manager');
}


/* ── PATCH 6  ── window-expose.js ────────────────────────────────────────────
   ADD these two lines anywhere near the end of window-expose.js:

      window.renderDashboard    = window.renderDashboard;    // defined in dashboard.js
      window._refreshDashboard  = window._refreshDashboard;  // called by refreshAll

   ALSO: in your refreshAll function (if you have one), add:
      window._refreshDashboard?.();

   ─────────────────────────────────────────────────────────────────────────── */


/* ── PATCH 7  ── Auto-open Dashboard on login (optional) ─────────────────────
   In showAdmin() / showManager() (core.js or admin.js), add:

   For admin:
      setTimeout(()=>{
        const dashBtn = document.getElementById('atab-dashboard');
        if(dashBtn) dashBtn.click();
      }, 400);

   For manager:
      setTimeout(()=>{
        const dashBtn = document.getElementById('mgr-nav-dashboard');
        if(dashBtn) dashBtn.click();
      }, 400);
   ─────────────────────────────────────────────────────────────────────────── */
