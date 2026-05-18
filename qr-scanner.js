// ══════════════════════════════════════════════════════════════════════════════
// ══  FEATURE 1: QR CODE SCANNER — Continuous + Auto-Absent 7 PM  ════════════
// ══════════════════════════════════════════════════════════════════════════════

(function(){
  let _stream          = null;
  let _rafId           = null;
  let _lastScannedCode = null;   // raw QR string of last card scanned
  let _lastScannedAt   = 0;      // timestamp so same card needs 5s gap
  let _scannedPerson   = null;   // person detected, pending auto-save
  let _lastSavedPerson = null;   // last auto-saved person (for override)
  let _scanLog         = [];     // [{person,status,time}] for today's session
  let _autoAbsentTimer = null;   // setTimeout handle for 7 PM trigger
  let _countdownTimer  = null;   // setInterval for countdown display
  let _flashTimer      = null;   // auto-hide timer for result card
  let _dateInfoTimer   = null;   // setInterval to refresh date/time line
  let _saving          = false;  // lock: true while markScanAtt is awaiting Firestore
  const AUTO_ABSENT_HOUR = 19;   // 7 PM (24h)

  // ── helpers ────────────────────────────────────────────────────────────────
  function _getNow(){
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
    const month   = ['January','February','March','April','May','June','July',
                     'August','September','October','November','December'][now.getMonth()];
    const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][now.getDay()];
    return {dateStr, timeStr, month, dayName, year:now.getFullYear(), dow:now.getDay()};
  }

  // Reuse a single AudioContext — browsers cap concurrent contexts (~6).
  let _audioCtx = null;
  function _beep(freq, dur){
    try{
      if(!_audioCtx) _audioCtx = new (window.AudioContext||window.webkitAudioContext)();
      if(_audioCtx.state === 'suspended') _audioCtx.resume();
      const osc = _audioCtx.createOscillator();
      const g   = _audioCtx.createGain();
      osc.connect(g); g.connect(_audioCtx.destination);
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.35, _audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, _audioCtx.currentTime + dur);
      osc.start(); osc.stop(_audioCtx.currentTime + dur);
    }catch(e){}
  }

  function _setStatus(msg){ const el=document.getElementById('scan-camera-status'); if(el) el.textContent=msg; }

  function _updateDateInfo(){
    const el = document.getElementById('scan-date-info'); if(!el) return;
    const t  = _getNow();
    el.textContent = `📅 ${t.dateStr}  ⏰ ${t.timeStr}  📆 ${t.dayName}, ${t.month} ${t.year}`;
  }

  function _updateCount(){
    const el = document.getElementById('scan-count-today'); if(!el) return;
    el.textContent = _scanLog.length;
  }

  // ── countdown to 7 PM ─────────────────────────────────────────────────────
  function _msUntilAutoAbsent(){
    const now    = new Date();
    const target = new Date(now);
    target.setHours(AUTO_ABSENT_HOUR, 0, 0, 0);
    if(now >= target) target.setDate(target.getDate() + 1);
    return target - now;
  }

  function _startCountdown(){
    if(_countdownTimer) clearInterval(_countdownTimer);
    function tick(){
      const ms = _msUntilAutoAbsent();
      const h  = Math.floor(ms/3600000);
      const m  = Math.floor((ms%3600000)/60000);
      const s  = Math.floor((ms%60000)/1000);
      const el = document.getElementById('scan-countdown'); if(!el) return;
      if(h > 0) el.textContent = `${h}h ${m}m`;
      else       el.textContent = `${m}m ${s}s`;
      // Warn colour when <30 minutes left
      el.style.color = h===0 && m < 30 ? '#ff9800' : 'rgba(100,180,255,.95)';
    }
    tick();
    _countdownTimer = setInterval(tick, 1000);
  }

  // ── camera ────────────────────────────────────────────────────────────────
  window.startQrScanner = async function(silent){
    const video  = document.getElementById('qr-video');
    const canvas = document.getElementById('qr-canvas');
    if(!video || !canvas){ showToast('Scanner elements not found!'); return; }
    if(!navigator.mediaDevices?.getUserMedia){ showToast('Camera not supported on this browser!'); return; }
    // Stop any existing stream + loop before starting fresh
    if(_stream){ _stream.getTracks().forEach(t=>t.stop()); _stream=null; }
    if(_rafId) { cancelAnimationFrame(_rafId); _rafId=null; }
    try{
      _stream = await navigator.mediaDevices.getUserMedia({
        video:{ facingMode:'environment', width:{ideal:1280}, height:{ideal:720} }
      });
      video.srcObject = _stream;
      await video.play();
      _updateDateInfo();
      if(_dateInfoTimer) clearInterval(_dateInfoTimer);
      _dateInfoTimer = setInterval(_updateDateInfo, 30000);
      _startCountdown();
      _scheduleAutoAbsent();
      _setStatus("🟢 Camera active — point at a QR card");
      _scanLoop(video, canvas);
      if(!silent) showToast('📷 Camera started — scanning continuously!');
    }catch(e){
      showToast('❌ Camera error: '+e.message);
      _setStatus('❌ Camera error: '+e.message);
    }
  };

  window.stopQrScanner = function(silent){
    if(_stream){ _stream.getTracks().forEach(t=>t.stop()); _stream=null; }
    if(_rafId) { cancelAnimationFrame(_rafId); _rafId=null; }
    const video = document.getElementById('qr-video');
    if(video) video.srcObject = null;
    const res = document.getElementById('scan-result');
    if(res) res.style.display = 'none';
    _scannedPerson = null; _saving = false;
    _setStatus('Camera off');
    if(!silent) showToast('⏹ Camera stopped.');
  };

  // ── scan loop (requestAnimationFrame-based) ────────────────────────────────
  function _scanLoop(video, canvas){
    const ctx = canvas.getContext('2d',{willReadFrequently:true});
    // Offscreen canvas for downscaled processing — jsQR is faster + more accurate at 640px
    const offscreen = document.createElement('canvas');
    const offCtx    = offscreen.getContext('2d',{willReadFrequently:true});
    const SCAN_W    = 640;
    function tick(){
      if(!_stream){ return; }
      // Skip frame work entirely while a save is in progress — keeps loop alive
      // but prevents updating _lastScannedCode with cards we can't process yet,
      // so the very next card after save completes is detected fresh.
      if(_saving){
        _rafId = requestAnimationFrame(tick);
        return;
      }
      if(video.readyState === video.HAVE_ENOUGH_DATA){
        // Scale down to SCAN_W for faster jsQR processing
        const scale = SCAN_W / video.videoWidth;
        const sw    = SCAN_W;
        const sh    = Math.round(video.videoHeight * scale);
        if(offscreen.width !== sw)  offscreen.width  = sw;
        if(offscreen.height !== sh) offscreen.height = sh;
        offCtx.drawImage(video, 0, 0, sw, sh);
        const img  = offCtx.getImageData(0, 0, sw, sh);
        const code = typeof jsQR !== 'undefined'
          ? jsQR(img.data, img.width, img.height, {inversionAttempts:'attemptBoth'})
          : null;
        if(code && code.data){
          const now = Date.now();
          // Same-card cooldown: re-accept the same QR only after 4s.
          // Different QR is always accepted immediately.
          if(code.data !== _lastScannedCode || now - _lastScannedAt > 4000){
            _lastScannedCode = code.data;
            _lastScannedAt   = now;
            // Mirror scaled frame to visible canvas only when a code is detected
            if(canvas.width !== video.videoWidth)  canvas.width  = video.videoWidth;
            if(canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            _onQrDetected(code.data);
          }
        }
      }
      _rafId = requestAnimationFrame(tick);
    }
    tick();
  }

  // ── QR detected — auto-marks Present immediately, camera keeps running ──────
  function _onQrDetected(raw){
    if(_saving) return;                          // save already in progress — ignore until done

    let data;
    try{ data = JSON.parse(raw); }
    catch(e){
      // QR detected but not valid JSON — could be a non-MAAC QR or corrupted read
      console.warn('[QR] Non-JSON QR detected:', raw.substring(0,80));
      return;
    }
    if(!data.type || !data.name){
      // JSON but missing required fields
      console.warn('[QR] Missing type/name fields:', JSON.stringify(data).substring(0,80));
      return;
    }

    // Cancel any pending hide-timer immediately so it can't hide the result mid-save
    if(_flashTimer){ clearTimeout(_flashTimer); _flashTimer = null; }

    _scannedPerson = data;

    const nameEl    = document.getElementById('scan-name');
    const metaEl    = document.getElementById('scan-meta');
    const resEl     = document.getElementById('scan-result');
    const flashEl   = document.getElementById('scan-result-flash');
    const overrideRow = document.getElementById('scan-override-row');
    const btnA      = document.getElementById('scan-btn-a');

    // Show name/meta first (flash will replace it after save)
    if(flashEl) flashEl.style.display = 'none';
    if(nameEl){ nameEl.textContent = data.name; nameEl.style.display = ''; }
    if(metaEl){ metaEl.textContent = data.type === 'student'
      ? `🎓 Student • ${data.class||''}${data.phone?' • '+data.phone:''}`
      : `👨‍🏫 Teacher${data.subject?' • '+data.subject:''}`;
      metaEl.style.display = ''; }
    if(btnA){ btnA.disabled=false; }
    if(overrideRow) overrideRow.style.display = 'none';
    if(resEl){ resEl.style.display='block'; resEl.scrollIntoView({behavior:'smooth',block:'nearest'}); }

    _beep(880, 0.25);   // detection beep

    // ── Auto-mark Present immediately ──────────────────────────────────────
    window.markScanAtt('P');
  }

  // ── mark attendance (P or A) — camera stays running ───────────────────────
  window.markScanAtt = async function(status){
    // For auto-Present calls: use _scannedPerson
    // For override Absent button: use _lastSavedPerson (since _scannedPerson is already null)
    const person = _scannedPerson || _lastSavedPerson;
    if(!person){ showToast('কাউকে স্ক্যান করুন!'); return; }
    _scannedPerson = null;               // clear immediately so next scan works

    _saving = true;                      // lock scanner — prevents concurrent processing
    _setStatus('⏳ Saving attendance…');

    const btnA = document.getElementById('scan-btn-a');
    if(btnA) btnA.disabled = true;

    const t = _getNow();
    try{
      if(t.dow === 5){
        _showFlash('⛔ শুক্রবার — ছুটি!', '#e84040');
        return;
      }
      const holiday = (window.appData?.holidays||[]).find(h=>h.date===t.dateStr);
      if(holiday){
        _showFlash(`⛔ ${holiday.name}`, '#e84040');
        return;
      }

      if(person.type === 'student') await _saveStudentScanAtt(person, status, t);
      else                          await _saveTeacherScanAtt(person, status, t);

      if(status === 'P'){
        _lastSavedPerson = person;
        _addScanLog(person, status, t);
      } else {
        const existing = _scanLog.find(e => e.person.id === person.id || e.person.name === person.name);
        if(existing) existing.status = 'A';
        else _addScanLog(person, status, t);
        _lastSavedPerson = null;
        _rerenderLog();
      }

      _beep(status==='P' ? 660 : 440, 0.3);
      _showFlash(
        status==='P' ? `\u2705 ${person.name} \u2014 Present!` : `\u21a9 ${person.name} \u2014 Marked Absent`,
        status==='P' ? 'rgba(0,200,150,.95)' : '#ff8080',
        status==='P'
      );
    }catch(e){
      _showFlash('❌ Save error!', '#e84040');
      showToast('❌ '+e.message);
    }finally{
      // Unlock scanner. Keep _lastScannedCode set with a fresh timestamp so the
      // SAME card still in front of the camera doesn't immediately re-trigger,
      // but ANY different card scans through instantly.
      _lastScannedAt   = Date.now();
      _saving = false;
      _setStatus("🟢 Camera active — point at next QR card");
    }
  };

  // Show a confirmation flash, keep override row visible briefly, then auto-hide
  function _showFlash(msg, color, keepOverride){
    // Cancel any previous hide-timer FIRST — before touching the DOM
    if(_flashTimer){ clearTimeout(_flashTimer); _flashTimer = null; }

    const flashEl     = document.getElementById('scan-result-flash');
    const nameEl      = document.getElementById('scan-name');
    const metaEl      = document.getElementById('scan-meta');
    const overrideRow = document.getElementById('scan-override-row');
    const resEl       = document.getElementById('scan-result');

    // Always ensure the result container is visible (a previous timer may have hidden it)
    if(resEl) resEl.style.display = 'block';
    if(flashEl){ flashEl.textContent=msg; flashEl.style.color=color; flashEl.style.display='block'; }
    if(nameEl) nameEl.style.display = 'none';
    if(metaEl) metaEl.style.display = 'none';
    // Show override row only for auto-Present saves so manager can still tap Absent
    if(overrideRow) overrideRow.style.display = keepOverride ? 'flex' : 'none';

    _flashTimer = setTimeout(()=>{
      _flashTimer = null;
      if(resEl)         resEl.style.display = 'none';
      if(flashEl)       flashEl.style.display = 'none';
      if(nameEl)        nameEl.style.display = '';
      if(metaEl)        metaEl.style.display = '';
      if(overrideRow)   overrideRow.style.display = 'none';
      _lastSavedPerson = null;   // override window expired
      if(_stream) _setStatus("🟢 Ready — point at next QR card");
    }, 2500);
  }

  // Re-render the log list in-place (used when override changes P→A)
  function _rerenderLog(){
    const el = document.getElementById('scan-log-list'); if(!el) return;
    el.innerHTML = _scanLog.map(entry=>`
      <div class="scan-log-item ${entry.status==='P'?'present':'absent'}">
        <div class="scan-log-dot"></div>
        <div style="flex:1">
          <strong>${entry.person.name}</strong>
          <span style="font-size:11px;color:rgba(255,255,255,.45);margin-left:6px;">
            ${entry.person.type==='student'?(entry.person.class||''):'Teacher'}</span>
        </div>
        <div style="font-size:12px;font-weight:700;
          color:${entry.status==='P'?'rgba(0,200,150,.9)':'#ff8080'}">
          ${entry.status==='P'?'✅ P':'❌ A'}</div>
        <div style="font-size:11px;color:rgba(255,255,255,.3);margin-left:8px;">${entry.time}</div>
      </div>`).join('');
  }

  // ── Firestore write helpers ────────────────────────────────────────────────
  // ── timeout helper — prevents Firestore calls from hanging the scanner ──
  function _withTimeout(promise, ms){
    return Promise.race([
      promise,
      new Promise((_,reject)=>setTimeout(()=>reject(new Error('Timeout')),ms))
    ]);
  }

  async function _saveStudentScanAtt(person, status, t){
    const cls = person.class;
    if(!cls) throw new Error('No class in QR');
    const docId = `${cls.replace(/\s+/g,'_')}_${t.dateStr}`;
    const {doc, updateDoc, setDoc} = window._fb;
    const ref  = doc(window._db, 'attendance', docId);
    const key  = person.phone || person.id;
    // Fast path: updateDoc with dot-notation — NO read needed, just write one field
    try {
      await _withTimeout(updateDoc(ref, { [`records.${key}`]: status, updatedAt: Date.now() }), 6000);
    } catch(e) {
      // Doc doesn't exist yet (first scan of the day) — create it
      if(e.code === 'not-found' || (e.message && e.message.includes('not-found')) || e.message === 'Timeout') {
        await window._attQueuedWrite(ref, {
          class:cls, date:t.dateStr, month:t.month, dayName:t.dayName,
          records:{ [key]: status }, updatedAt:Date.now()
        }, 'set', docId, 'attendance');
      } else { throw e; }
    }
  }

  async function _saveTeacherScanAtt(person, status, t){
    const docId = t.dateStr;
    const {doc, updateDoc} = window._fb;
    const ref  = doc(window._db, 'teacherAttendance', docId);
    const key  = person.id || person.name;
    // Fast path: updateDoc with dot-notation — NO read needed
    try {
      await _withTimeout(updateDoc(ref, { [`records.${key}`]: status, updatedAt: Date.now() }), 6000);
    } catch(e) {
      if(e.code === 'not-found' || (e.message && e.message.includes('not-found')) || e.message === 'Timeout') {
        await window._attQueuedWrite(ref, {
          date:t.dateStr, month:t.month, dayName:t.dayName,
          records:{ [key]: status }, updatedAt:Date.now()
        }, 'set', docId, 'teacherAttendance');
      } else { throw e; }
    }
  }

  // ── scan log ──────────────────────────────────────────────────────────────
  function _addScanLog(person, status, t){
    _scanLog.unshift({person, status, time:t.timeStr});
    _updateCount();
    _rerenderLog();
  }

  // ── AUTO-ABSENT at 7 PM ───────────────────────────────────────────────────
  function _scheduleAutoAbsent(){
    if(_autoAbsentTimer) clearTimeout(_autoAbsentTimer);
    const ms = _msUntilAutoAbsent();
    _autoAbsentTimer = setTimeout(async ()=>{
      await _runAutoAbsent();
      _scheduleAutoAbsent();    // re-schedule for tomorrow 7 PM
    }, ms);
  }

  async function _runAutoAbsent(){
    const t = _getNow();
    if(t.dow === 5){
      showToast('⛔ শুক্রবার — Auto-absent skipped (holiday).');
      return;
    }
    const holiday = (window.appData?.holidays||[]).find(h=>h.date===t.dateStr);
    if(holiday){
      showToast(`⛔ ${holiday.name} — Auto-absent skipped.`);
      return;
    }
    showToast('⏰ 7 PM — Running auto-absent for unscanned students…');

    const students = window.appData?.students || [];
    const classes  = [...new Set(students.map(s=>s.class).filter(Boolean))];
    const {doc, getDoc} = window._fb;
    let totalMarked = 0;

    for(const cls of classes){
      const docId = `${cls.replace(/\s+/g,'_')}_${t.dateStr}`;
      const ref   = doc(window._db, 'attendance', docId);
      let existing = {};
      try{
        const snap = await getDoc(ref);
        existing   = snap.exists() ? (snap.data().records||{}) : {};
      }catch(e){ existing={}; }

      const classStu = students.filter(s=>s.class===cls);
      let changed    = false;
      for(const stu of classStu){
        const key = stu.phone || stu.id;
        if(!existing[key]){            // not yet marked by scanner
          existing[key] = 'A';
          changed = true;
          totalMarked++;
        }
      }
      if(changed){
        try{
          await window._attQueuedWrite(ref, {
            class:cls, date:t.dateStr, month:t.month, dayName:t.dayName,
            records:existing, updatedAt:Date.now()
          }, 'set', docId, 'attendance');
        }catch(e){ console.error('[AutoAbsent] write failed:', e.message); }
      }
    }

    showToast(`✅ Auto-absent done — ${totalMarked} student${totalMarked!==1?'s':''} marked Absent.`);
  }

  // Manual trigger button
  window.runAutoAbsentNow = async function(){
    await _runAutoAbsent();
  };

  // ── tab lifecycle ─────────────────────────────────────────────────────────
  window._scannerOnTabOpen = function(){
    _updateDateInfo();
    _startCountdown();
    _scheduleAutoAbsent();
    _updateCount();
    const logEl = document.getElementById('scan-log-list');
    if(logEl && !_scanLog.length)
      logEl.innerHTML = '<div style="text-align:center;padding:18px;color:rgba(255,255,255,.3);font-size:13px;">No scans yet. Camera starting…</div>';
    const resEl = document.getElementById('scan-result');
    if(resEl) resEl.style.display = 'none';
    // Auto-start camera silently — manager never needs to click "Start Camera"
    if(!_stream) window.startQrScanner(true);
  };
})();

// ══════════════════════════════════════════════════════════════════════════════
// ══  FEATURE 2: ADMIN QR CODE GENERATOR  ════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

(function(){
  let _qrItems = [];   // [{type,id,name,class,phone,subject}]
  let _qrCanvases = {}; // id -> dataURL

  window.generateAdminQR = async function(){
    const type  = document.getElementById('qr-type-sel')?.value || 'students';
    const cls   = document.getElementById('qr-cls-sel')?.value || '';
    const grid  = document.getElementById('qr-preview-grid');
    const stat  = document.getElementById('qr-gen-status');
    if(!grid) return;
    if(typeof QRCode === 'undefined'){ showToast('❌ QRCode unavailable. Please reload.'); return; }
    grid.innerHTML = '<div style="color:var(--muted);padding:12px;">⏳ Generating QR codes…</div>';
    if(stat) stat.textContent = '';
    await new Promise(r=>setTimeout(r,10));
    _qrItems = [];
    const students = window.appData?.students || [];
    const teachers = window.appData?.teachers || [];
    if(type === 'students' || type === 'all'){
      const list = cls ? students.filter(s=>s.class===cls) : students;
      list.forEach(s=>_qrItems.push({type:'student',id:s.id,name:s.name,class:s.class||'',phone:s.phone||''}));
    }
    if(type === 'teachers' || type === 'all'){
      teachers.forEach(t=>_qrItems.push({type:'teacher',id:t.id,name:t.name,subject:t.subject||'',class:'Teacher'}));
    }
    if(!_qrItems.length){ grid.innerHTML='<div style="color:var(--muted);padding:12px;">কোনো data নেই।</div>'; return; }
    _qrCanvases = {};
    grid.innerHTML = '';
    for(const item of _qrItems){
      const payload = JSON.stringify({
        type: item.type,
        id:   item.id,
        name: item.name,
        class: item.class||'',
        phone: item.phone||'',
        subject: item.subject||''
      });
      const cell = document.createElement('div');
      cell.style.cssText='display:flex;flex-direction:column;align-items:center;border:1px solid var(--border);border-radius:10px;padding:8px 6px;';
      const canv = document.createElement('canvas');
      cell.appendChild(canv);
      const nameDiv = document.createElement('div');
      nameDiv.style.cssText='font-size:11px;font-weight:700;text-align:center;margin-top:5px;word-break:break-word;color:var(--text);';
      nameDiv.textContent = item.name;
      cell.appendChild(nameDiv);
      const clsDiv = document.createElement('div');
      clsDiv.style.cssText='font-size:10px;color:var(--muted);text-align:center;';
      clsDiv.textContent = item.class||'Teacher';
      cell.appendChild(clsDiv);
      grid.appendChild(cell);
      try{
        await QRCode.toCanvas(canv, payload, {width:200, margin:3, errorCorrectionLevel:'M', color:{dark:'#1a2340',light:'#ffffff'}});
        _qrCanvases[item.id] = canv.toDataURL('image/png');
      }catch(e){ console.error('QR gen error:', e); }
    }
    if(stat) stat.textContent = `✅ ${_qrItems.length} QR codes generated. Click 🖨️ Print to print.`;
  };

  window.printAdminQR = function(){
    if(!_qrItems.length){ showToast('আগে ⚡ Generate করুন!'); return; }
    const PAGE_SIZE = 15; // 15 per A4
    const printEl = document.getElementById('qr-print-page'); if(!printEl) return;
    let pages = '';
    for(let p=0; p<_qrItems.length; p+=PAGE_SIZE){
      const chunk = _qrItems.slice(p, p+PAGE_SIZE);
      const cells = chunk.map(item=>{
        const src = _qrCanvases[item.id]||'';
        return `<div class="qr-cell">
          <img src="${src}" width="160" height="160" alt="${item.name}"/>
          <div class="qr-cell-name">${item.name}</div>
          <div class="qr-cell-cls">${item.class||'Teacher'}</div>
        </div>`;
      }).join('');
      const pageBreak = p+PAGE_SIZE < _qrItems.length ? 'page-break-after:always;' : '';
      pages += `<div class="qr-a4-grid" style="${pageBreak}">${cells}</div>`;
    }
    printEl.innerHTML = pages;
    setTimeout(()=>{ window.print(); printEl.innerHTML=''; }, 100);
  };
})();

// ══════════════════════════════════════════════════════════════════════════════
