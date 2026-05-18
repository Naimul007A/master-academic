// ══ HOMEWORK NON-SUBMISSION REPORT SYSTEM ══

// temp state for marking defaulters
window._hwDefaulters = new Set();
window._hwStudentsLoaded = [];

function loadHwStudents(){
  const cls = $('thw-class')?.value;
  if(!cls){ showToast('Class বেছে নিন!'); return; }
  const students = window.appData.students.filter(s=>s.class===cls);
  if(!students.length){ showToast('এই class-এ কোনো student নেই!'); return; }
  window._hwStudentsLoaded = students;
  window._hwDefaulters = new Set();
  const panel = $('thw-student-panel');
  if(panel) panel.style.display='block';
  const list = $('thw-student-list');
  if(!list) return;
  // Show students as toggle buttons — click to mark as defaulter (phone hidden)
  list.innerHTML = students.map((s,i)=>`
    <div id="thw-s-${i}" onclick="toggleHwDefaulter(${i},'${s.phone}')"
      style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;
      border-radius:10px;margin-bottom:7px;cursor:pointer;transition:all .2s;
      background:rgba(255,255,255,.06);border:1.5px solid rgba(255,255,255,.1);">
      <div style="font-weight:700;font-size:13px;color:#fff;">👤 ${s.name}</div>
      <div id="thw-badge-${i}" style="font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;
        background:rgba(0,200,150,.15);color:var(--g);">✅ Done</div>
    </div>`).join('');
}

function toggleHwDefaulter(idx, phone){
  const row = $('thw-s-'+idx);
  const badge = $('thw-badge-'+idx);
  if(!row||!badge) return;
  if(window._hwDefaulters.has(phone)){
    window._hwDefaulters.delete(phone);
    row.style.background='rgba(255,255,255,.06)';
    row.style.borderColor='rgba(255,255,255,.1)';
    badge.style.background='rgba(0,200,150,.15)';
    badge.style.color='var(--g)';
    badge.textContent='✅ Done';
  } else {
    window._hwDefaulters.add(phone);
    row.style.background='rgba(232,64,64,.15)';
    row.style.borderColor='rgba(232,64,64,.4)';
    badge.style.background='rgba(232,64,64,.2)';
    badge.style.color='#e84040';
    badge.textContent='❌ Not Done';
  }
}

async function submitHwReport(){
  const cls = $('thw-class')?.value;
  const subject = $('thw-subject')?.value.trim();
  const date = $('thw-date')?.value;
  if(!cls||!subject){ showToast('Class ও Subject দিন!'); return; }
  if(!window._hwDefaulters.size){ showToast('কোনো defaulter mark করা হয়নি!'); return; }

  // Store names only (no phone numbers) for privacy
  const defaulterNames = [...window._hwDefaulters].map(phone=>{
    const s = window._hwStudentsLoaded.find(st=>st.phone===phone);
    return s ? s.name : '—';
  });

  const {collection,addDoc} = window._fb;
  await addDoc(collection(window._db,'homework'),{
    class: cls,
    subject,
    date: date||new Date().toISOString().split('T')[0],
    teacher: curTeacher,
    defaulterNames,   // names only — no phone numbers stored
    defaulterCount: defaulterNames.length,
    createdAt: Date.now()
  });

  showToast(`✅ Report saved! ${defaulterNames.length} defaulter(s).`);
  // Reset
  window._hwDefaulters = new Set();
  window._hwStudentsLoaded = [];
  $('thw-student-panel').style.display='none';
  $('thw-subject').value='';
  $('thw-date').value='';
  renderTeacherHomework();
  renderHomeworkAdmin();
}

function fmtDue(dateStr){
  if(!dateStr)return'';
  const d=new Date(dateStr+'T00:00:00');
  return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
}

// Admin: view all non-submission reports
function renderHomeworkAdmin(){
  const el=$('hw-admin-list'); if(!el)return;
  let data=[...window.appData.homework].sort((a,b)=>b.createdAt-a.createdAt);
  const clsf=$('hwview-cls')?.value;
  const subjf=$('hwview-subject')?.value;
  if(clsf) data=data.filter(h=>h.class===clsf);
  if(subjf) data=data.filter(h=>h.subject===subjf);

  // Populate subject filter
  const subjects=[...new Set(window.appData.homework.map(h=>h.subject).filter(Boolean))];
  const sel=$('hwview-subject');
  if(sel){
    const cur=sel.value;
    sel.innerHTML='<option value="">All Subjects</option>'+subjects.map(s=>`<option>${s}</option>`).join('');
    if(cur) sel.value=cur;
  }

  if(!data.length){el.innerHTML='<div class="empty"><div class="ei">📝</div><p>No reports yet.</p></div>';return;}
  el.innerHTML=data.map(h=>`
    <div class="hw-card" style="border-left-color:var(--r)">
      <div class="hw-card-head">
        <div class="hw-subj" style="color:var(--r)">❌ ${h.subject}</div>
        <button class="bdel" onclick="delDoc('homework','${h.id}')">✕</button>
      </div>
      <div class="hw-meta">${h.class} • ${h.teacher||'Teacher'} • ${fmtDue(h.date)||fmtDate(h.createdAt)}</div>
      <div style="font-size:12px;font-weight:700;color:var(--r);margin:5px 0 4px;">
        ${h.defaulterCount||0} student(s) did not submit:
      </div>
      <div class="hw-body" style="font-size:12px;color:var(--text);">
        ${(h.defaulterNames||[]).join(' • ')||'—'}
      </div>
    </div>`).join('');
}

// Teacher: view their own submitted reports
function renderTeacherHomework(){
  const el=$('t-hw-list'); if(!el||!curTeacher)return;
  const data=[...window.appData.homework]
    .filter(h=>h.teacher===curTeacher)
    .sort((a,b)=>b.createdAt-a.createdAt);
  if(!data.length){
    el.innerHTML='<div style="text-align:center;padding:24px;color:rgba(255,255,255,.3);font-size:13px">এখনো কোনো report submit করা হয়নি।</div>';return;
  }
  el.innerHTML=data.map(h=>`
    <div class="t-hw-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
        <div class="t-hw-subj" style="color:#e84040;">❌ ${h.subject}</div>
        <button onclick="delDoc('homework','${h.id}')" style="background:rgba(232,64,64,.2);border:none;color:#e84040;padding:4px 10px;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer;">✕</button>
      </div>
      <div class="t-hw-meta">${h.class} • ${fmtDue(h.date)||fmtDate(h.createdAt)}</div>
      <div style="font-size:12px;color:rgba(255,255,255,.5);margin-bottom:5px;">
        ${h.defaulterCount||0} did not submit:
      </div>
      <div class="t-hw-body" style="font-size:12px;">
        ${(h.defaulterNames||[]).join(' • ')||'—'}
      </div>
    </div>`).join('');
}

// Student: see if they are on any non-submission report (by name match)
function renderStuHomework(cls){
  const el=$('stu-homework'); if(!el||!curStudent)return;
  const myName=curStudent.name;
  const data=[...window.appData.homework]
    .filter(h=>h.class===cls)
    .sort((a,b)=>b.createdAt-a.createdAt);
  if(!data.length){
    el.innerHTML='<div class="empty"><div class="ei">📝</div><p>কোনো homework নেই।</p></div>';return;
  }
  const pending=data.filter(h=>(h.defaulterNames||[]).includes(myName));
  const done=data.filter(h=>!(h.defaulterNames||[]).includes(myName));
  let html=`<div style="display:flex;gap:9px;margin-bottom:14px;">
    <div style="flex:1;background:#ffeaea;border-radius:11px;padding:12px 14px;border-left:3px solid var(--r);text-align:center">
      <div style="font-family:'Baloo 2',sans-serif;font-size:24px;font-weight:800;color:var(--r)">${pending.length}</div>
      <div style="font-size:11px;color:#c62828;font-weight:700">Pending ⚠️</div>
    </div>
    <div style="flex:1;background:#e8f5e9;border-radius:11px;padding:12px 14px;border-left:3px solid var(--g);text-align:center">
      <div style="font-family:'Baloo 2',sans-serif;font-size:24px;font-weight:800;color:var(--gd)">${done.length}</div>
      <div style="font-size:11px;color:var(--gd);font-weight:700">Submitted ✅</div>
    </div>
    <div style="flex:1;background:#f0f4ff;border-radius:11px;padding:12px 14px;border-left:3px solid var(--b);text-align:center">
      <div style="font-family:'Baloo 2',sans-serif;font-size:24px;font-weight:800;color:var(--b)">${data.length}</div>
      <div style="font-size:11px;color:var(--b);font-weight:700">Total 📝</div>
    </div>
  </div>`;
  html+=data.map(h=>{
    const iDefaulter=(h.defaulterNames||[]).includes(myName);
    return`<div class="hw-card" style="border-left-color:${iDefaulter?'var(--r)':'var(--g)'}">
      <div class="hw-card-head">
        <div class="hw-subj" style="color:${iDefaulter?'var(--r)':'var(--gd)'}">${iDefaulter?'❌':'✅'} ${h.subject}</div>
        <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:${iDefaulter?'#ffeaea':'#e8f5e9'};color:${iDefaulter?'var(--r)':'var(--gd)'}">${iDefaulter?'Pending':'Done'}</span>
      </div>
      <div class="hw-meta">${h.teacher||'Teacher'} • ${fmtDue(h.date)||fmtDate(h.createdAt)}</div>
      <div style="font-size:13px;color:${iDefaulter?'var(--r)':'var(--gd)'};font-weight:700;margin-top:4px">${iDefaulter?'⚠️ আপনি জমা দেননি!':'✅ আপনি জমা দিয়েছেন'}</div>
    </div>`;
  }).join('');
  el.innerHTML=html;
}


function exportExcel(){
  const students=window.appData.students;
  if(!students.length){showToast('No students to export!');return;}

  // Build CSV content
  const headers=['#','Name','Phone','Class','Group','Joined'];
  const rows=students.map((s,i)=>[
    i+1, s.name, s.phone, s.class, s.group||'', fmtDate(s.createdAt)
  ]);

  const csv=[headers,...rows].map(r=>r.map(c=>`"${c}"`).join(',')).join('\n');
  const bom='\uFEFF'; // UTF-8 BOM for Excel Bengali support
  const blob=new Blob([bom+csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=`Master_Academic_Students_${new Date().toLocaleDateString('en-GB').replace(/\//g,'-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📥 Excel export হয়েছে!');
}

// ══════════════════════════════════════════════
