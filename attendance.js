function viewPDF(url){
  // Use Google Docs viewer to prevent download
  const viewerUrl = 'https://docs.google.com/viewer?url='+encodeURIComponent(url)+'&embedded=true';
  $('pdf-frame').src = viewerUrl;
  $('pdf-viewer').style.display='flex';
  $('pdf-viewer').style.flexDirection='column';
}
function closePDF(){
  $('pdf-viewer').style.display='none';
  $('pdf-frame').src='';
}

// ══ PENDING APPROVAL ══
window.appData.pending=[];

// Pending, presence, and visitor listeners are now handled in the unified _setupListeners in the module script

window.renderPendingList = function renderPendingList(){
  const el=$('pending-list'); if(!el)return;
  const pending=window.appData.pending.filter(p=>p.status==='pending');
  const countEl=$('pend-count');
  if(countEl) countEl.textContent=pending.length;
  if(!pending.length){
    el.innerHTML='<div class="empty"><div class="ei">✅</div><p>No pending requests.</p></div>';return;
  }
  el.innerHTML=pending.map(p=>`
    <div class="li" style="border-left:3px solid var(--y)">
      <div class="li-info">
        <div class="li-title">👤 ${p.name}</div>
        <div class="li-sub">📞 ${p.phone} • ${p.class}${p.group?' • '+p.group:''}</div>
      </div>
      <button onclick="approveStudent('${p.id}')" style="padding:6px 12px;border:none;border-radius:8px;
        background:#e8f5e9;color:#2e7d32;font-size:12px;font-weight:700;cursor:pointer;margin-right:5px">✅ Approve</button>
      <button onclick="rejectStudent('${p.id}')" class="bdel">✕ Reject</button>
    </div>`).join('');
}

async function approveStudent(pendingDocId){
  const {doc,addDoc,collection,deleteDoc,getDoc}=window._fb;
  const pendSnap=await getDoc(window._fb.doc(window._db,'pending',pendingDocId));
  if(!pendSnap.exists()){showToast('Not found!');return;}
  const data=pendSnap.data();
  // Add to students collection with auto-generated ID (allows siblings with same phone)
  await addDoc(collection(window._db,'students'),{
    name:data.name, phone:data.phone,
    class:data.class, group:data.group||'',
    createdAt:data.createdAt||Date.now()
  });
  // Remove from pending
  await deleteDoc(window._fb.doc(window._db,'pending',pendingDocId));
  showToast(`✅ ${data.name} approved!`);
}

async function rejectStudent(phone){
  const {doc,deleteDoc}=window._fb;
  await deleteDoc(window._fb.doc(window._db,'pending',phone));
  showToast('🗑️ Request rejected.');
}

// ══ ADD STUDENT MANUALLY (Admin) ══
async function addStudentManual(){
  const name=$('as-name').value.trim(), phone=$('as-phone').value.trim(),
        cls=$('as-class').value, grp=$('as-group').value||'';
  if(!name||!phone){showToast('Name ও Phone দিন!');return;}
  try{
    const {collection,addDoc}=window._fb;
    // Use addDoc so siblings sharing the same phone number are allowed
    await addDoc(collection(window._db,'students'),{
      name, phone, class:cls, group:grp, createdAt:Date.now()
    });
    ['as-name','as-phone'].forEach(id=>$(id).value='');
    showToast(`\u2705 ${name} added!`);
  }catch(e){showToast('❌ Error: '+e.message);}
}

// ══ ATTENDANCE SYSTEM ══

const ATT_MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const ATT_DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// Populate year dropdown with a range of years (current ± 2)
function initAttYearDrops(){
  const curYr=new Date().getFullYear();
  ['att-year','tatt-year'].forEach(id=>{
    const sel=$(id); if(!sel)return;
    sel.innerHTML='';
    for(let y=curYr-1;y<=curYr+1;y++){
      const o=document.createElement('option');
      o.value=y; o.textContent=y;
      if(y===curYr) o.selected=true;
      sel.appendChild(o);
    }
  });
  // Set current month
  const curM=new Date().getMonth();
  const am=$('att-month'), tm=$('tatt-month');
  if(am) am.value=curM;
  if(tm) tm.value=curM;
  populateAttDays();
  populateTAttDays();
}

// Get days count in a month
function daysInMonth(yr,mo){return new Date(yr,mo+1,0).getDate();}

// Populate day select for student attendance
function populateAttDays(){
  const sel=$('att-date'); if(!sel)return;
  const yr=parseInt($('att-year')?.value||new Date().getFullYear());
  const mo=parseInt($('att-month')?.value||0);
  const count=daysInMonth(yr,mo);
  const cur=parseInt(sel.value||1);
  sel.innerHTML='';
  for(let d=1;d<=count;d++){
    const date=new Date(yr,mo,d);
    const dow=date.getDay();
    const o=document.createElement('option');
    o.value=d;
    o.textContent=`${d} (${ATT_DAYS[dow]})`;
    if(dow===5) o.style.color='#e84040'; // Fridays in red
    sel.appendChild(o);
  }
  // Try to restore previous selection
  sel.value=cur>0&&cur<=count?cur:1;
  onAttDateChange();
}

// Populate day select for teacher attendance
function populateTAttDays(){
  const sel=$('tatt-date'); if(!sel)return;
  const yr=parseInt($('tatt-year')?.value||new Date().getFullYear());
  const mo=parseInt($('tatt-month')?.value||0);
  const count=daysInMonth(yr,mo);
  const cur=parseInt(sel.value||1);
  sel.innerHTML='';
  for(let d=1;d<=count;d++){
    const date=new Date(yr,mo,d);
    const dow=date.getDay();
    const o=document.createElement('option');
    o.value=d;
    o.textContent=`${d} (${ATT_DAYS[dow]})`;
    if(dow===5) o.style.color='#e84040';
    sel.appendChild(o);
  }
  sel.value=cur>0&&cur<=count?cur:1;
  onTAttDateChange();
}

// Show day-status label (Friday/Holiday warning) for student attendance
function onAttDateChange(){
  const statusEl=$('att-day-status'); if(!statusEl)return;
  const yr=parseInt($('att-year')?.value||new Date().getFullYear());
  const mo=parseInt($('att-month')?.value||0);
  const d=parseInt($('att-date')?.value||1);
  const date=new Date(yr,mo,d);
  const dow=date.getDay();
  const dateStr=`${yr}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  const holiday=(window.appData.holidays||[]).find(h=>h.date===dateStr);
  if(dow===5){statusEl.style.color='#e84040';statusEl.textContent='⛔ শুক্রবার — ছুটির দিন';}
  else if(holiday){statusEl.style.color='#ff9800';statusEl.textContent=`🏖️ ${holiday.name} — ছুটির দিন`;}
  else{statusEl.style.color='var(--gd)';statusEl.textContent=`✅ ${ATT_DAYS[dow]}`;}
}

// Show day-status for teacher attendance
function onTAttDateChange(){
  const statusEl=$('tatt-day-status'); if(!statusEl)return;
  const yr=parseInt($('tatt-year')?.value||new Date().getFullYear());
  const mo=parseInt($('tatt-month')?.value||0);
  const d=parseInt($('tatt-date')?.value||1);
  const date=new Date(yr,mo,d);
  const dow=date.getDay();
  if(dow===5){statusEl.style.color='#e84040';statusEl.textContent='⛔ শুক্রবার — ছুটির দিন';}
  else{statusEl.style.color='var(--gd)';statusEl.textContent=`✅ ${ATT_DAYS[dow]}`;}
}

// ── CUSTOM HOLIDAYS ──
async function addHoliday(){
  const dateVal=$('holiday-date')?.value;
  const nameVal=$('holiday-name')?.value?.trim();
  if(!dateVal){showToast('তারিখ বেছে নিন!');return;}
  if(!nameVal){showToast('Holiday নাম দিন!');return;}
  try{
    const {doc,setDoc}=window._fb;
    await setDoc(doc(window._db,'holidays',dateVal),{date:dateVal,name:nameVal,createdAt:Date.now()});
    if($('holiday-date'))$('holiday-date').value='';
    if($('holiday-name'))$('holiday-name').value='';
    showToast('✅ Holiday added!');
  }catch(e){showToast('❌ '+e.message);}
}

function renderHolidayList(){
  const el=$('holiday-list'); if(!el)return;
  const holidays=[...(window.appData.holidays||[])].sort((a,b)=>a.date.localeCompare(b.date));
  if(!holidays.length){el.innerHTML='<div style="font-size:12px;color:var(--muted);padding:4px 0;">কোনো holiday নেই।</div>';return;}
  el.innerHTML=holidays.map(h=>`
    <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);">
      <div style="font-size:13px;font-weight:700;">🏖️ ${h.date} — ${h.name}</div>
      <button onclick="delDoc('holidays','${h.id}')" class="bdel" style="font-size:11px">✕</button>
    </div>`).join('');
}

// Admin: load students for marking attendance
function loadAttendanceStudents(){
  const cls=$('att-cls').value;
  const yr=parseInt($('att-year')?.value||new Date().getFullYear());
  const mo=parseInt($('att-month')?.value||0);
  const d=parseInt($('att-date')?.value||1);
  const selDate=new Date(yr,mo,d);
  const dow=selDate.getDay();
  const monthName=ATT_MONTHS[mo];
  const dayName2=ATT_DAYS[dow];
  // Block Fridays
  if(dow===5){showToast('⛔ শুক্রবার ছুটি! এই দিনে attendance নেওয়া যাবে না।');return;}
  // Block custom holidays
  const dateStr=`${yr}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  const holiday=(window.appData.holidays||[]).find(h=>h.date===dateStr);
  if(holiday){showToast(`⛔ ${holiday.name} — ছুটির দিন! Attendance নেওয়া যাবে না।`);return;}
  const students=window.appData.students.filter(s=>s.class===cls);
  if(!students.length){showToast('এই class-এ কোনো student নেই!');return;}
  // Date-based doc ID (no spaces, deterministic)
  const docId=`${cls.replace(/\s+/g,'_')}_${dateStr}`;
  const existing=window.appData.attendance.find(a=>a.id===docId);
  $('att-mark-title').textContent=`📝 ${cls} — ${d} ${monthName} ${yr} (${dayName2})`;
  $('att-mark-card').style.display='block';
  const existingRec=existing?.records||{};
  window._attDateInfo={cls,date:dateStr,month:monthName,dayName:dayName2,docId};

  $('att-student-list').innerHTML=students.map((s)=>{
    const prev=existingRec[s.phone];
    return`<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border);">
      <div style="font-weight:700;font-size:13px;">👤 ${s.name}</div>
      <div style="display:flex;gap:7px;">
        <button id="att-p-${s.phone}" onclick="setAttMark('${s.phone}','P')"
          style="padding:6px 14px;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;
          background:${prev==='P'?'var(--g)':'#e8f5f0'};color:${prev==='P'?'#fff':'var(--gd)'}">✅ P</button>
        <button id="att-a-${s.phone}" onclick="setAttMark('${s.phone}','A')"
          style="padding:6px 14px;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;
          background:${prev==='A'?'var(--r)':'#ffeaea'};color:${prev==='A'?'#fff':'var(--r)'}">❌ A</button>
      </div>
    </div>`;
  }).join('');
  window._attMarks={...existingRec};
  window._attStudents=students;
}

function setAttMark(phone,mark){
  window._attMarks=window._attMarks||{};
  window._attMarks[phone]=mark;
  const pBtn=$('att-p-'+phone),aBtn=$('att-a-'+phone);
  if(pBtn){pBtn.style.background=mark==='P'?'var(--g)':'#e8f5f0';pBtn.style.color=mark==='P'?'#fff':'var(--gd)';}
  if(aBtn){aBtn.style.background=mark==='A'?'var(--r)':'#ffeaea';aBtn.style.color=mark==='A'?'#fff':'var(--r)';}
}

async function saveAttendance(){
  const info=window._attDateInfo||{};
  const records=window._attMarks||{};
  if(!info.docId){showToast('আগে student load করুন!');return;}
  // Auto-mark any student not yet marked as Absent
  const students=window._attStudents||[];
  let autoAbsent=0;
  students.forEach(s=>{
    if(!records[s.phone]){
      records[s.phone]='A';
      autoAbsent++;
      const pBtn=$('att-p-'+s.phone), aBtn=$('att-a-'+s.phone);
      if(pBtn){pBtn.style.background='#e8f5f0';pBtn.style.color='var(--gd)';}
      if(aBtn){aBtn.style.background='var(--r)';aBtn.style.color='#fff';}
    }
  });
  if(!Object.keys(records).length){showToast('কোনো student load করা হয়নি!');return;}
  const {doc,setDoc}=window._fb;
  try{
    await setDoc(doc(window._db,'attendance',info.docId),{
      class:info.cls, date:info.date, month:info.month, dayName:info.dayName,
      records, updatedAt:Date.now()
    });
    const msg=autoAbsent?`✅ Saved! (${autoAbsent} জন auto Absent)` : '✅ Attendance saved!';
    showToast(msg);
    $('att-mark-card').style.display='none';
    window._attMarks={};
    renderAttendanceAdmin();
  }catch(e){
    console.error('saveAttendance error:',e);
    showToast('❌ Error: '+e.message);
  }
}

function renderAttendanceAdmin(){
  const el=$('att-admin-list'); if(!el)return;
  const clsf=$('attview-cls')?.value, monf=$('attview-month')?.value;
  const srch=($('attview-search')?.value||'').trim().toLowerCase();

  // Require both class AND month to be selected before showing any data
  if(!srch&&(!clsf||!monf)){
    el.innerHTML='<div class="empty"><div class="ei">🔍</div><p style="font-size:13px;color:var(--muted);">Please select a <strong>Class</strong> and <strong>Month</strong> to view the attendance grid.</p></div>';
    return;
  }

  let data=[...window.appData.attendance];
  if(clsf) data=data.filter(a=>a.class===clsf);
  if(monf) data=data.filter(a=>a.month===monf);
  data.sort((a,b)=>(a.date||'').localeCompare(b.date||''));

  // ── STUDENT SEARCH MODE ──────────────────────────────────────────────────
  if(srch){
    const matchedStudents=(window.appData.students||[]).filter(s=>
      s.name.toLowerCase().includes(srch)||(s.phone||'').includes(srch)
    );
    if(!matchedStudents.length){
      el.innerHTML='<div class="empty"><div class="ei">🔍</div><p>No student found matching "<strong>'+srch+'"</strong></p></div>';
      return;
    }
    const html=matchedStudents.map(stu=>{
      const stuData=data.filter(a=>a.records&&a.records[stu.phone]!==undefined);
      if(!stuData.length) return '';
      const totalP=stuData.filter(r=>r.records[stu.phone]==='P').length;
      const totalA=stuData.filter(r=>r.records[stu.phone]==='A').length;
      const pct=stuData.length?Math.round((totalP/stuData.length)*100):0;
      return`<div style="margin-bottom:20px;border:1.5px solid var(--border);border-radius:14px;padding:14px 15px;background:#fafbff;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap;">
          <div style="font-family:'Baloo 2',sans-serif;font-weight:800;font-size:15px;color:var(--dark);">👤 ${stu.name}</div>
          <span class="badge">${stu.class}</span>
          <span style="font-size:12px;color:var(--muted);">${stu.phone}</span>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
          <span style="background:#e8f5f0;color:var(--gd);font-weight:700;font-size:12px;padding:4px 12px;border-radius:20px;">✅ Present: ${totalP}</span>
          <span style="background:#ffeaea;color:var(--r);font-weight:700;font-size:12px;padding:4px 12px;border-radius:20px;">❌ Absent: ${totalA}</span>
          <span style="background:#f0f0f0;color:var(--muted);font-weight:700;font-size:12px;padding:4px 12px;border-radius:20px;">📊 ${pct}% present</span>
        </div>
      </div>`;
    }).join('');
    el.innerHTML=html||'<div class="empty"><div class="ei">🔍</div><p>No attendance found for this student.</p></div>';
    return;
  }

  // ── P/A GRID TABLE MODE ──────────────────────────────────────────────────
  if(!data.length){
    el.innerHTML='<div class="empty"><div class="ei">📆</div><p>No attendance records for this class and month.</p></div>';
    return;
  }

  // Get all students in this class
  const students=(window.appData.students||[]).filter(s=>!clsf||s.class===clsf);
  if(!students.length){
    el.innerHTML='<div class="empty"><div class="ei">🎓</div><p>No students in this class.</p></div>';
    return;
  }

  // Determine which day numbers have records (columns)
  const dayNumbers=[...new Set(data.map(a=>{
    const d=parseInt((a.date||'').split('-')[2]||'0');
    return d||0;
  }))].filter(d=>d>0).sort((a,b)=>a-b);

  // Build a date→record map for fast lookup
  const dateMap={};
  data.forEach(a=>{ dateMap[a.date]=a; });

  // Helper: get full date string from day number using the first record's date
  function dayToDate(d){
    const sample=data[0]?.date;
    if(!sample) return '';
    const [yr,mo]=sample.split('-');
    return `${yr}-${mo}-${String(d).padStart(2,'0')}`;
  }

  // Export CSV function
  window._exportStuAttCSV=function(){
    const headers=['Student','Phone',...dayNumbers.map(d=>`Day ${d}`),'Total Absent'];
    const rows=students.map(stu=>{
      const cells=dayNumbers.map(d=>{
        const dateStr=dayToDate(d);
        const rec=dateMap[dateStr];
        return rec&&rec.records&&rec.records[stu.phone]?rec.records[stu.phone]:'—';
      });
      const absent=cells.filter(c=>c==='A').length;
      return[stu.name,stu.phone,...cells,absent];
    });
    const csv=[headers,...rows].map(r=>r.map(c=>`"${c}"`).join(',')).join('\n');
    const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=`Attendance_${clsf||'All'}_${monf||''}.csv`;
    a.click();
    showToast('📥 CSV exported!');
  };

  const tableHtml=`
    <div style="display:flex;justify-content:flex-end;margin-bottom:10px;">
      <button onclick="window._exportStuAttCSV()"
        style="padding:7px 16px;border:none;border-radius:9px;background:linear-gradient(135deg,#1a73e8,#0d47a1);
        color:#fff;font-family:'Baloo 2',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">
        📥 Export CSV
      </button>
    </div>
    <div style="overflow-x:auto;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.08);">
      <table style="border-collapse:collapse;min-width:100%;font-size:12px;background:#fff;">
        <thead>
          <tr style="background:var(--dark);color:#fff;">
            <th style="padding:9px 12px;text-align:left;white-space:nowrap;position:sticky;left:0;background:var(--dark);z-index:2;min-width:130px;">Student</th>
            ${dayNumbers.map(d=>`<th style="padding:9px 7px;text-align:center;min-width:36px;">${d}</th>`).join('')}
            <th style="padding:9px 10px;text-align:center;white-space:nowrap;background:#c62828;min-width:60px;">Absent</th>
          </tr>
        </thead>
        <tbody>
          ${students.map((stu,i)=>{
            let absentCount=0;
            const cells=dayNumbers.map(d=>{
              const dateStr=dayToDate(d);
              const rec=dateMap[dateStr];
              const mark=rec&&rec.records?rec.records[stu.phone]:'';
              if(mark==='A') absentCount++;
              const bg=mark==='P'?'#e8f5f0':mark==='A'?'#ffeaea':'#f8f8f8';
              const color=mark==='P'?'var(--gd)':mark==='A'?'var(--r)':'var(--muted)';
              const lbl=mark==='P'?'P':mark==='A'?'A':'—';
              return`<td style="padding:7px 5px;text-align:center;background:${bg};color:${color};font-weight:700;border:1px solid #eee;">${lbl}</td>`;
            }).join('');
            return`<tr style="background:${i%2===0?'#fafbff':'#fff'};">
              <td style="padding:8px 12px;font-weight:700;white-space:nowrap;position:sticky;left:0;background:${i%2===0?'#fafbff':'#fff'};border-right:2px solid var(--border);z-index:1;">
                ${stu.name}<div style="font-size:10px;color:var(--muted);font-weight:400;">${stu.phone}</div>
              </td>
              ${cells}
              <td style="padding:7px 10px;text-align:center;font-weight:800;color:${absentCount>0?'var(--r)':'var(--gd)'};background:${absentCount>0?'#ffeaea':'#e8f5f0'};border:1px solid #eee;">${absentCount}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
  el.innerHTML=tableHtml;
}

// Student: view their own attendance (date-based)
function renderStuAttendance(cls){
  const el=$('stu-attendance'); if(!el||!curStudent)return;
  const phone=curStudent.phone;
  let data=window.appData.attendance.filter(a=>a.class===cls);
  if(!data.length){
    el.innerHTML='<div class="empty"><div class="ei">📆</div><p>এখনো attendance record আসেনি।</p></div>';return;
  }
  data.sort((a,b)=>(b.date||'').localeCompare(a.date||''));

  // Group by month
  const months={};
  data.forEach(a=>{
    const key=a.month||(a.date?ATT_MONTHS[parseInt(a.date.split('-')[1])-1]:'Unknown');
    if(!months[key])months[key]=[];
    months[key].push(a);
  });

  el.innerHTML=Object.entries(months).map(([month,recs])=>{
    let present=0, total=0;
    recs.forEach(r=>{const mark=r.records&&r.records[phone];if(mark){total++;if(mark==='P')present++;}});
    const pct=total?Math.round((present/total)*100):0;
    return`<div style="margin-bottom:18px;">
      <div class="att-summary-box">
        <div>
          <div style="font-size:11px;opacity:.7;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">${month}</div>
          <div class="asn">${present}</div>
          <div class="asl">Days Present</div>
        </div>
        <div class="att-pct">${pct}%</div>
      </div>
      ${recs.map(r=>{
        const mark=r.records&&r.records[phone];
        return`<div class="att-week-card" style="border-left-color:${mark==='P'?'var(--g)':mark==='A'?'var(--r)':'var(--border)'}">
          <div class="att-week-head">
            <div class="att-week-title">📅 ${r.date||''} ${r.dayName?`(${r.dayName})`:''}</div>
            <span style="font-size:14px;font-weight:800;color:${mark==='P'?'var(--gd)':mark==='A'?'var(--r)':'var(--muted)'}">
              ${mark==='P'?'✅ Present':mark==='A'?'❌ Absent':'—'}
            </span>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }).join('');
}

// ══ TEACHER ATTENDANCE (Admin marks, Teacher views own) ══

// Admin: load teachers for marking teacher attendance
function loadTeacherAttStudents(){
  const yr=parseInt($('tatt-year')?.value||new Date().getFullYear());
  const mo=parseInt($('tatt-month')?.value||0);
  const d=parseInt($('tatt-date')?.value||1);
  const selDate=new Date(yr,mo,d);
  const dow=selDate.getDay();
  if(dow===5){showToast('⛔ শুক্রবার ছুটি!');return;}
  const dateStr=`${yr}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  const teachers=window.appData.teachers;
  if(!teachers.length){showToast('কোনো teacher নেই!');return;}
  const docId=`tatt_${dateStr}`;
  const existing=window.appData.teacherAttendance.find(a=>a.id===docId);
  const existingRec=existing?.records||{};
  $('tatt-mark-title').textContent=`📝 Teachers — ${d} ${ATT_MONTHS[mo]} ${yr} (${ATT_DAYS[dow]})`;
  $('tatt-mark-card').style.display='block';
  window._tattDateInfo={date:dateStr, month:ATT_MONTHS[mo], dayName:ATT_DAYS[dow], docId};
  window._tattMarks={...existingRec};

  $('tatt-teacher-list').innerHTML=teachers.map((t)=>{
    const prev=existingRec[t.id];
    return`<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border);">
      <div><div style="font-weight:700;font-size:13px;">👨‍🏫 ${t.name}</div>
      ${t.subject?`<div style="font-size:11px;color:var(--muted)">${t.subject}</div>`:''}
      </div>
      <div style="display:flex;gap:7px;">
        <button id="tatt-p-${t.id}" onclick="setTAttMark('${t.id}','P')"
          style="padding:6px 14px;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;
          background:${prev==='P'?'var(--g)':'#e8f5f0'};color:${prev==='P'?'#fff':'var(--gd)'}">✅ P</button>
        <button id="tatt-a-${t.id}" onclick="setTAttMark('${t.id}','A')"
          style="padding:6px 14px;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;
          background:${prev==='A'?'var(--r)':'#ffeaea'};color:${prev==='A'?'#fff':'var(--r)'}">❌ A</button>
      </div>
    </div>`;
  }).join('');
}

function setTAttMark(id,mark){
  window._tattMarks=window._tattMarks||{};
  // Toggle: clicking the already-active mark deselects it
  if(window._tattMarks[id]===mark){
    delete window._tattMarks[id];
    mark=null;
  } else {
    window._tattMarks[id]=mark;
  }
  const pBtn=$('tatt-p-'+id),aBtn=$('tatt-a-'+id);
  if(pBtn){pBtn.style.background=mark==='P'?'var(--g)':'#e8f5f0';pBtn.style.color=mark==='P'?'#fff':'var(--gd)';}
  if(aBtn){aBtn.style.background=mark==='A'?'var(--r)':'#ffeaea';aBtn.style.color=mark==='A'?'#fff':'var(--r)';}
}

async function saveTeacherAttendance(){
  const info=window._tattDateInfo||{};
  const records=window._tattMarks||{};
  if(!Object.keys(records).length){showToast('কোনো attendance mark করা হয়নি!');return;}
  if(!info.docId){showToast('আগে teacher list load করুন!');return;}
  const {doc,setDoc}=window._fb;
  try{
    await setDoc(doc(window._db,'teacherAttendance',info.docId),{
      date:info.date, month:info.month, dayName:info.dayName,
      records, updatedAt:Date.now()
    });
    showToast('✅ Teacher Attendance saved!');
    $('tatt-mark-card').style.display='none';
    window._tattMarks={};
    renderTeacherAttendanceAdmin();
  }catch(e){
    console.error('saveTeacherAttendance error:',e);
    showToast('❌ Error: '+e.message);
  }
}

function renderTeacherAttendanceAdmin(){
  const el=$('tatt-admin-list'); if(!el)return;
  const monf=$('tattview-month')?.value;

  // Require a month to be selected before showing any data
  if(!monf){
    el.innerHTML='<div class="empty"><div class="ei">🔍</div><p style="font-size:13px;color:var(--muted);">Please select a <strong>Month</strong> to view the teacher attendance grid.</p></div>';
    return;
  }

  let data=[...window.appData.teacherAttendance];
  if(monf) data=data.filter(a=>a.month===monf);
  data.sort((a,b)=>(a.date||'').localeCompare(b.date||''));

  if(!data.length){
    el.innerHTML='<div class="empty"><div class="ei">📆</div><p>No teacher attendance records for this month.</p></div>';
    return;
  }

  const teachers=window.appData.teachers;
  if(!teachers.length){
    el.innerHTML='<div class="empty"><div class="ei">👨‍🏫</div><p>No teachers found.</p></div>';
    return;
  }

  // Build day numbers (columns) from records
  const dayNumbers=[...new Set(data.map(a=>{
    const d=parseInt((a.date||'').split('-')[2]||'0');
    return d||0;
  }))].filter(d=>d>0).sort((a,b)=>a-b);

  // Build date→record map
  const dateMap={};
  data.forEach(a=>{ dateMap[a.date]=a; });

  function dayToDateT(d){
    const sample=data[0]?.date;
    if(!sample) return '';
    const [yr,mo]=sample.split('-');
    return `${yr}-${mo}-${String(d).padStart(2,'0')}`;
  }

  // Export CSV for teacher attendance
  window._exportTAttCSV=function(){
    const headers=['Teacher','Subject',...dayNumbers.map(d=>`Day ${d}`),'Total Present','Total Absent'];
    const rows=teachers.map(t=>{
      const cells=dayNumbers.map(d=>{
        const dateStr=dayToDateT(d);
        const rec=dateMap[dateStr];
        return rec&&rec.records&&rec.records[t.id]?rec.records[t.id]:'—';
      });
      const present=cells.filter(c=>c==='P').length;
      const absent=cells.filter(c=>c==='A').length;
      return[t.name,t.subject||'',...cells,present,absent];
    });
    const csv=[headers,...rows].map(r=>r.map(c=>`"${c}"`).join(',')).join('\n');
    const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=`TeacherAttendance_${monf}.csv`;
    a.click();
    showToast('📥 Teacher Attendance CSV exported!');
  };

  const tableHtml=`
    <div style="display:flex;justify-content:flex-end;margin-bottom:10px;">
      <button onclick="window._exportTAttCSV()"
        style="padding:7px 16px;border:none;border-radius:9px;background:linear-gradient(135deg,#1a73e8,#0d47a1);
        color:#fff;font-family:'Baloo 2',sans-serif;font-size:12px;font-weight:700;cursor:pointer;">
        📥 Export CSV
      </button>
    </div>
    <div style="overflow-x:auto;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.08);">
      <table style="border-collapse:collapse;min-width:100%;font-size:12px;background:#fff;">
        <thead>
          <tr style="background:var(--dark);color:#fff;">
            <th style="padding:9px 12px;text-align:left;white-space:nowrap;position:sticky;left:0;background:var(--dark);z-index:2;min-width:130px;">Teacher</th>
            ${dayNumbers.map(d=>`<th style="padding:9px 7px;text-align:center;min-width:36px;">${d}</th>`).join('')}
            <th style="padding:9px 10px;text-align:center;white-space:nowrap;background:#1565c0;min-width:80px;">Total Attended</th>
            <th style="padding:9px 10px;text-align:center;white-space:nowrap;background:#c62828;min-width:60px;">Absent</th>
          </tr>
        </thead>
        <tbody>
          ${teachers.map((t,i)=>{
            let absentCount=0; let presentCount=0;
            const cells=dayNumbers.map(d=>{
              const dateStr=dayToDateT(d);
              const rec=dateMap[dateStr];
              const mark=rec&&rec.records?rec.records[t.id]:'';
              if(mark==='A') absentCount++;
              if(mark==='P') presentCount++;
              const bg=mark==='P'?'#e8f5f0':mark==='A'?'#ffeaea':'#f8f8f8';
              const color=mark==='P'?'var(--gd)':mark==='A'?'var(--r)':'var(--muted)';
              const lbl=mark==='P'?'P':mark==='A'?'A':'—';
              return`<td style="padding:7px 5px;text-align:center;background:${bg};color:${color};font-weight:700;border:1px solid #eee;">${lbl}</td>`;
            }).join('');
            return`<tr style="background:${i%2===0?'#fafbff':'#fff'};">
              <td style="padding:8px 12px;font-weight:700;white-space:nowrap;position:sticky;left:0;background:${i%2===0?'#fafbff':'#fff'};border-right:2px solid var(--border);z-index:1;">
                ${t.name}<div style="font-size:10px;color:var(--muted);font-weight:400;">${t.subject||''}</div>
              </td>
              ${cells}
              <td style="padding:7px 10px;text-align:center;font-weight:800;color:#fff;background:#1565c0;border:1px solid #eee;">${presentCount}</td>
              <td style="padding:7px 10px;text-align:center;font-weight:800;color:${absentCount>0?'var(--r)':'var(--gd)'};background:${absentCount>0?'#ffeaea':'#e8f5f0'};border:1px solid #eee;">${absentCount}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
  el.innerHTML=tableHtml;
}

// Teacher: view OWN attendance records from teacherAttendance collection
function renderTeacherOwnAttendance(){
  const el=$('t-attendance-content'); if(!el||!curTeacher)return;
  const teacher=(window.appData.teachers||[]).find(t=>t.name===curTeacher);
  if(!teacher){el.innerHTML='<div style="text-align:center;padding:24px;color:rgba(255,255,255,.3);font-size:13px">Teacher data নেই।</div>';return;}
  const tid=teacher.id;
  let data=window.appData.teacherAttendance||[];
  const monFilter=$('t-att-filter-month')?.value;
  if(monFilter) data=data.filter(a=>a.month===monFilter);
  // Only records that include this teacher
  data=data.filter(a=>a.records&&a.records[tid]);
  data.sort((a,b)=>(b.date||'').localeCompare(a.date||''));

  // Current month summary
  const curMon=ATT_MONTHS[new Date().getMonth()];
  const curMonData=window.appData.teacherAttendance.filter(a=>a.month===curMon&&a.records&&a.records[tid]);
  const curPresent=curMonData.filter(a=>a.records[tid]==='P').length;
  const curTotal=curMonData.length;
  const summEl=$('t-att-month-summary');
  if(summEl){
    summEl.innerHTML=`<div style="background:rgba(0,200,150,.12);border:1.5px solid rgba(0,200,150,.25);border-radius:14px;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-size:11px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">${curMon} — This Month</div>
        <div style="font-size:22px;font-weight:800;color:var(--g)">${curPresent}</div>
        <div style="font-size:12px;color:rgba(255,255,255,.5)">Days Present out of ${curTotal}</div>
      </div>
      <div style="font-size:28px;font-weight:900;color:var(--g)">${curTotal?Math.round((curPresent/curTotal)*100):0}%</div>
    </div>`;
  }

  if(!data.length){el.innerHTML='<div style="text-align:center;padding:24px;color:rgba(255,255,255,.3);font-size:13px">কোনো attendance record নেই।</div>';return;}
  el.innerHTML=data.map(r=>{
    const mark=r.records[tid];
    return`<div class="t-att-week" style="border-left:3px solid ${mark==='P'?'var(--g)':'#e84040'};">
      <div class="t-att-week-head">
        <div class="t-att-week-title">📅 ${r.date} ${r.dayName?`(${r.dayName})`:''}</div>
        <span style="font-size:14px;font-weight:800;color:${mark==='P'?'var(--g)':'#e84040'}">
          ${mark==='P'?'✅ Present':'❌ Absent'}
        </span>
      </div>
    </div>`;
  }).join('');
}

// Alias: renderTeacherAttendance now shows own attendance
function renderTeacherAttendance(){renderTeacherOwnAttendance();}

