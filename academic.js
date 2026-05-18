// ══════════════════════════════════════════════
// ══ EXAM TIMETABLE ══
// ══════════════════════════════════════════════
// Format time "16:00" → "4:00 PM"
function fmtTime(t){
  if(!t)return '';
  const [h,m]=t.split(':').map(Number);
  return`${h%12||12}:${String(m).padStart(2,'0')} ${h<12?'AM':'PM'}`;
}

// Set next-Saturday default for weekly test date
function setWeeklyTestDefaults(){
  const di=$('fe-wk-date');
  if(di&&!di.value){
    const today=new Date();
    const daysUntilSat=today.getDay()===6?7:(6-today.getDay());
    const nextSat=new Date(today);
    nextSat.setDate(today.getDate()+daysUntilSat);
    di.value=nextSat.toISOString().split('T')[0];
  }
}

// Add extra subject slot to weekly test form
function addExamSubjectSlot(){
  const cont=$('fe-wk-subjects');
  const idx=cont.querySelectorAll('.wk-subj').length+1;
  const row=document.createElement('div');
  row.style.cssText='display:flex;gap:8px;margin-bottom:8px;';
  row.innerHTML=`<input class="wk-subj" type="text" placeholder="Subject ${idx}" style="flex:1;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-family:'Hind Siliguri',sans-serif;font-size:13px;color:var(--text);outline:none"/><button onclick="this.parentElement.remove()" style="width:32px;height:40px;border:none;background:#ffeaea;color:var(--r);border-radius:9px;cursor:pointer;font-size:14px;flex-shrink:0;">✕</button>`;
  cont.appendChild(row);
}

// Add weekly test (creates one doc per subject)
async function addWeeklyTest(){
  const cls=$('fe-wk-class').value;
  const date=$('fe-wk-date').value;
  const time=$('fe-wk-time').value||'16:00';
  const subjs=[...document.querySelectorAll('#fe-wk-subjects .wk-subj')].map(el=>el.value.trim()).filter(Boolean);
  if(!date||!subjs.length){showToast('Date ও কমপক্ষে ১টি Subject দিন!');return;}
  const btn=$('btn-add-weekly'); btn.disabled=true; btn.textContent='⏳ Saving...';
  try{
    const {collection,addDoc,serverTimestamp}=window._fb;
    await Promise.all(subjs.map(subject=>addDoc(collection(window._db,'examTimetable'),{class:cls,subject,examType:'Weekly Test',date,time,createdAt:serverTimestamp()})));
    document.querySelectorAll('#fe-wk-subjects .wk-subj').forEach(el=>el.value='');
    showToast(`✅ ${subjs.length} subject(s) যোগ হয়েছে!`);
  }catch(e){showToast('❌ '+e.message);}
  finally{btn.disabled=false; btn.textContent='⚡ Add Weekly Test';}
}

// Single exam (monthly / other type)
async function addExam(){
  const cls=$('fe-class').value, subject=$('fe-subject').value.trim(),
        examType=$('fe-type').value, date=$('fe-date').value, time=$('fe-time').value;
  if(!subject||!date){showToast('Subject ও Date দিন!');return;}
  const {collection,addDoc,serverTimestamp}=window._fb;
  await addDoc(collection(window._db,'examTimetable'),{class:cls,subject,examType,date,time,createdAt:serverTimestamp()});
  $('fe-subject').value=''; $('fe-date').value=''; $('fe-time').value='';
  showToast('✅ Exam যোগ হয়েছে!');
}

function renderExamAdmin(){
  setWeeklyTestDefaults();
  const el=$('exam-admin-list'); if(!el)return;
  const data=[...window.appData.examTimetable].sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
  if(!data.length){el.innerHTML='<div class="empty"><div class="ei">📝</div><p>No exams scheduled.</p></div>';return;}
  el.innerHTML=data.map(e=>{
    const isWeekly=e.examType==='Weekly Test';
    return`<div class="li">
      <div class="li-info">
        <div class="li-title">${e.subject} <span style="font-size:11px;background:${isWeekly?'#e8f5e9':'#e8f0fe'};color:${isWeekly?'var(--gd)':'var(--b)'};padding:1px 7px;border-radius:10px;font-weight:700">${e.examType}</span></div>
        <div class="li-sub">${e.class} • ${e.date}${e.time?' • '+fmtTime(e.time):''}</div>
      </div>
      <button class="bdel" onclick="delDoc('examTimetable','${e.id}')">✕</button>
    </div>`;
  }).join('');
}

function renderStuExam(cls){
  const el=$('stu-exam'); if(!el)return;
  const today=new Date().toISOString().split('T')[0];
  const all=[...window.appData.examTimetable].filter(e=>e.class===cls).sort((a,b)=>a.date<b.date?-1:1);
  if(!all.length){el.innerHTML='<div class="empty"><div class="ei">🗓️</div><p>কোনো exam schedule নেই।</p></div>';return;}
  // Group by date + examType
  const grpMap={};
  all.forEach(e=>{
    const k=`${e.date}||${e.examType}`;
    if(!grpMap[k]) grpMap[k]={date:e.date,examType:e.examType,time:e.time,subjs:[]};
    grpMap[k].subjs.push(e.subject);
  });
  const groups=Object.values(grpMap).sort((a,b)=>a.date<b.date?-1:1);
  const upcoming=groups.filter(g=>g.date>=today);
  const past=groups.filter(g=>g.date<today);
  let html='';
  if(upcoming.length){
    html+=`<div style="font-size:11px;font-weight:700;color:var(--b);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">⏰ আসন্ন পরীক্ষা</div>`;
    html+=upcoming.map(g=>{
      const d=new Date(g.date);
      const days=['রবি','সোম','মঙ্গল','বুধ','বৃহ','শুক্র','শনি'][d.getDay()];
      const dL=Math.ceil((d-new Date(today))/(1000*60*60*24));
      const clr=dL<=2?'var(--r)':dL<=7?'#e65100':'var(--b)';
      const bg=dL<=2?'#ffeaea':dL<=7?'#fff3e0':'#e8f0fe';
      const wk=g.examType==='Weekly Test';
      return`<div class="exam-card" style="border-left-color:${clr}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div style="flex:1">
            <div class="exam-badge" style="background:${wk?'#e8f5e9':bg};color:${wk?'var(--gd)':clr}">${g.examType}</div>
            <div style="display:flex;flex-wrap:wrap;gap:5px;margin:7px 0">
              ${g.subjs.map(s=>`<span style="background:var(--card);border:1.5px solid ${clr};color:${clr};font-size:12px;font-weight:700;padding:3px 11px;border-radius:20px">${s}</span>`).join('')}
            </div>
            <div class="exam-info">${days} • ${g.date}${g.time?' • ⏰ '+fmtTime(g.time):''}</div>
          </div>
          <div style="background:${bg};color:${clr};font-family:'Baloo 2',sans-serif;font-size:13px;font-weight:800;padding:7px 13px;border-radius:20px;text-align:center;white-space:nowrap;flex-shrink:0">${dL===0?'আজকে!':dL===1?'কাল!':dL+' দিন'}</div>
        </div>
      </div>`;
    }).join('');
  } else {
    html='<div class="empty"><div class="ei">🗓️</div><p>কোনো আসন্ন পরীক্ষা নেই।</p></div>';
  }
  if(past.length){
    html+=`<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin:16px 0 8px;">✅ সম্পন্ন</div>`;
    html+=past.slice(0,6).map(g=>`
      <div class="exam-card" style="border-left-color:var(--muted);opacity:.6">
        <div class="exam-badge" style="background:#f5f5f5;color:var(--muted)">${g.examType}</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin:5px 0">${g.subjs.map(s=>`<span style="background:#f0f0f0;color:var(--muted);font-size:12px;padding:2px 9px;border-radius:15px">${s}</span>`).join('')}</div>
        <div class="exam-info">${g.date}${g.time?' • '+fmtTime(g.time):''}</div>
      </div>`).join('');
  }
  el.innerHTML=html;
}

// Exam widget on student home screen (above tabs)
function renderStuExamWidget(cls){
  const el=$('stu-exam-widget'); if(!el)return;
  const today=new Date().toISOString().split('T')[0];
  const data=[...window.appData.examTimetable].filter(e=>e.class===cls&&e.date>=today).sort((a,b)=>a.date<b.date?-1:1);
  if(!data.length){el.style.display='none';return;}
  const nearestDate=data[0].date;
  const group=data.filter(e=>e.date===nearestDate);
  const subjs=group.map(e=>e.subject);
  const examType=group[0].examType;
  const time=group[0].time||'00:00';
  const d=new Date(nearestDate+'T'+time);
  const now=new Date();
  const diffMs=d-now;
  const diffH=Math.floor(diffMs/3600000);
  const diffD=Math.floor(diffH/24);
  const hrs=diffH%24;
  let cdText='';
  if(diffMs<0) cdText='চলছে!';
  else if(diffD===0&&hrs===0) cdText='কিছুক্ষণ পরে!';
  else if(diffD===0) cdText=`আজ! ${hrs}h`;
  else if(diffD===1) cdText=`কাল! ${hrs}h`;
  else cdText=`${diffD} দিন বাকি`;
  const urgent=diffD<=1;
  el.style.display='block';
  el.style.cssText=`display:block;flex-shrink:0;padding:10px 16px;background:${urgent?'linear-gradient(135deg,#b71c1c,#c62828)':'linear-gradient(135deg,#1565c0,#0d47a1)'};`;
  el.innerHTML=`<div class="exam-widget-inner">
    <div style="flex:1;min-width:0">
      <div class="ewi-type">📝 ${examType}</div>
      <div class="ewi-subj">${subjs.join(' · ')}</div>
      <div class="ewi-date">📅 ${nearestDate}${time&&time!='00:00'?' • ⏰ '+fmtTime(time):''}</div>
    </div>
    <div class="ewi-cd${urgent?' ewi-urgent':''}">${cdText}</div>
  </div>`;
}

// ══════════════════════════════════════════════
// ══ LEADERBOARD ══
// ══════════════════════════════════════════════
// Add a mark row to a leader marks container
function addLeaderMarkRow(cId, subjectVal){
  const cont=$(cId); if(!cont)return;
  const idx=cont.querySelectorAll('.marks-row').length;
  const row=document.createElement('div');
  row.className='marks-row marks-input-row';
  row.setAttribute('data-idx',idx);
  const syncAttr=cId==='fl-marks-first'?`oninput="syncLeaderSubject(this,${idx})"` :'';
  row.innerHTML=`<input class="marks-subj" type="text" placeholder="Subject name" ${syncAttr} style="flex:2;padding:9px 11px;border:1.5px solid var(--border);border-radius:9px;font-family:'Hind Siliguri',sans-serif;font-size:13px;outline:none;color:var(--text)"/><input class="marks-val" type="number" placeholder="Marks" min="0" max="500" oninput="updateLeaderTotal('${cId}')" style="flex:1;padding:9px 11px;border:1.5px solid var(--border);border-radius:9px;font-family:'Hind Siliguri',sans-serif;font-size:13px;outline:none;color:var(--text)"/><button onclick="this.parentElement.remove();updateLeaderTotal('${cId}')" style="width:32px;height:38px;border:none;background:#ffeaea;color:var(--r);border-radius:8px;cursor:pointer;font-size:13px;flex-shrink:0">✕</button>`;
  cont.appendChild(row);
  if(subjectVal) row.querySelector('.marks-subj').value=subjectVal;
  // When adding a row to 1st, auto-add matching row to 2nd
  if(cId==='fl-marks-first'){
    const secondCont=$('fl-marks-second');
    if(secondCont && secondCont.querySelectorAll('.marks-row').length<=idx){
      addLeaderMarkRow('fl-marks-second', subjectVal||'');
    }
  }
}

function syncLeaderSubject(input, idx){
  const secondCont=$('fl-marks-second');
  if(!secondCont) return;
  const rows=[...secondCont.querySelectorAll('.marks-row')];
  if(rows[idx]) rows[idx].querySelector('.marks-subj').value=input.value;
}

function updateLeaderTotal(cId){
  const total=[...document.querySelectorAll(`#${cId} .marks-val`)].reduce((s,el)=>s+(parseInt(el.value)||0),0);
  const tEl=cId==='fl-marks-first'?$('fl-total-first'):$('fl-total-second');
  if(tEl) tEl.textContent=total;
}

function loadLeaderStudents(){
  const cls=$('fl-class').value;
  const sel1=$('fl-first'), sel2=$('fl-second');
  if(!cls||!sel1||!sel2) return;
  const students=[...window.appData.students].filter(s=>s.class===cls).sort((a,b)=>a.name.localeCompare(b.name));
  const opts='<option value="">— None —</option>'+students.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
  sel1.innerHTML=opts; sel2.innerHTML=opts;
  const ex=window.appData.leaderboard.find(l=>l.id===cls||l.class===cls);
  if(ex){
    if(ex.firstId) sel1.value=ex.firstId;
    if(ex.secondId) sel2.value=ex.secondId;
    // Pre-fill marks
    ['first','second'].forEach(pos=>{
      const marks=pos==='first'?ex.firstMarks:ex.secondMarks;
      const mCont=$(pos==='first'?'fl-marks-first':'fl-marks-second');
      if(mCont&&marks?.length){
        mCont.innerHTML='';
        marks.forEach(m=>{
          addLeaderMarkRow(pos==='first'?'fl-marks-first':'fl-marks-second');
          const r=mCont.lastChild;
          r.querySelector('.marks-subj').value=m.subj||'';
          r.querySelector('.marks-val').value=m.marks||0;
        });
        updateLeaderTotal(pos==='first'?'fl-marks-first':'fl-marks-second');
      }
    });
  }
}

async function saveLeaderboard(){
  const cls=$('fl-class').value;
  if(!cls){showToast('Class বেছে নিন!');return;}
  const firstId=$('fl-first').value, secondId=$('fl-second').value;
  const students=window.appData.students;
  const firstName=students.find(s=>s.id===firstId)?.name||'';
  const secondName=students.find(s=>s.id===secondId)?.name||'';
  function getMarks(cId){
    return[...document.querySelectorAll(`#${cId} .marks-row`)].map(r=>({
      subj:r.querySelector('.marks-subj').value.trim(),
      marks:parseInt(r.querySelector('.marks-val').value)||0
    })).filter(m=>m.subj);
  }
  const firstMarks=getMarks('fl-marks-first');
  const firstTotal=firstMarks.reduce((s,m)=>s+m.marks,0);
  const secondMarks=getMarks('fl-marks-second');
  const secondTotal=secondMarks.reduce((s,m)=>s+m.marks,0);
  const {doc,setDoc}=window._fb;
  await setDoc(doc(window._db,'leaderboard',cls),{
    class:cls,firstId,firstName,firstMarks,firstTotal,secondId,secondName,secondMarks,secondTotal,updatedAt:Date.now()
  });
  showToast('🏆 Leaderboard save হয়েছে!');
  // Clear form for next entry
  $('fl-marks-first').innerHTML='';
  $('fl-marks-second').innerHTML='';
  $('fl-first').value='';
  $('fl-second').value='';
  const t1=$('fl-total-first'), t2=$('fl-total-second');
  if(t1) t1.textContent='0';
  if(t2) t2.textContent='0';
}

function renderLeadersAdmin(){
  const el=$('leaders-admin-list'); if(!el)return;
  const data=window.appData.leaderboard;
  if(!data.length){el.innerHTML='<div class="empty"><div class="ei">🏆</div><p>No leaders set yet.</p></div>';return;}
  el.innerHTML=data.map(l=>`
    <div class="li">
      <div class="li-info">
        <div class="li-title">${l.class}</div>
        <div class="li-sub">🥇 ${l.firstName||'—'} (${l.firstTotal||0}pts) &nbsp;•&nbsp; 🥈 ${l.secondName||'—'} (${l.secondTotal||0}pts)</div>
      </div>
      <button class="bdel" onclick="delDoc('leaderboard','${l.id}')">✕</button>
    </div>`).join('');
}

function spawnConfetti(cId){
  const cont=$(cId); if(!cont)return;
  const colors=['#e53935','#f57c00','#7b1fa2','#0288d1','#2e7d32','#d81b60','#ffd600','#00897b'];
  for(let i=0;i<26;i++){
    const dot=document.createElement('div');
    dot.className='conf-bit';
    const sz=5+Math.random()*6;
    dot.style.cssText=`left:${Math.random()*100}%;background:${colors[i%colors.length]};width:${sz}px;height:${sz}px;border-radius:${Math.random()>.4?'50%':'2px'};animation-delay:${(Math.random()*1.6).toFixed(2)}s;animation-duration:${(1.8+Math.random()*1.2).toFixed(2)}s;`;
    cont.appendChild(dot);
  }
}

function renderStuLeaderboard(cls){
  const el=$('stu-leaderboard'); if(!el)return;
  const entry=window.appData.leaderboard.find(l=>l.id===cls||l.class===cls);
  if(!entry||(!entry.firstName&&!entry.secondName)){el.innerHTML='';return;}
  const myId=curStudent?.id;
  const isFirst=!!(entry.firstId&&entry.firstId===myId);
  const isSecond=!!(entry.secondId&&entry.secondId===myId);
  if(isFirst||isSecond){
    const pos=isFirst?'১ম':'২য়';
    const medal=isFirst?'🥇':'🥈';
    const myMarks=isFirst?(entry.firstMarks||[]):(entry.secondMarks||[]);
    const myTotal=isFirst?(entry.firstTotal||0):(entry.secondTotal||0);
    const confId='conf-'+Math.floor(Math.random()*99999);
    el.innerHTML=`<div class="celebrate-card">
      <div class="conf-wrap" id="${confId}"></div>
      <div style="text-align:center;font-size:50px;margin-bottom:4px">${medal}</div>
      <div class="celebrate-title">🎉 অভিনন্দন! 🎉</div>
      <div class="celebrate-sub">${cls}-এ আপনি <strong>${pos} স্থান</strong> অর্জন করেছেন!</div>
      ${myMarks.length?`<table class="marks-table">
        <tr><th>বিষয়</th><th>নম্বর</th></tr>
        ${myMarks.map(m=>`<tr><td>${m.subj}</td><td><strong>${m.marks}</strong></td></tr>`).join('')}
        <tr class="marks-total"><td>মোট নম্বর</td><td><strong>${myTotal}</strong></td></tr>
      </table>`:''}
    </div>`;
    setTimeout(()=>spawnConfetti(confId),80);
  } else {
    function marksHtml(marks,total){
      if(!marks||!marks.length) return '';
      return`<div class="leader-marks">${marks.map(m=>`<span style="background:#f5f5f5;padding:2px 9px;border-radius:12px;font-size:11px;font-weight:700;color:var(--text)">${m.subj}: ${m.marks}</span>`).join('')}</div><div class="leader-total">মোট: ${total} নম্বর</div>`;
    }
    el.innerHTML=`<div class="leader-section">
      <div class="leader-title">🏆 ${cls} — Position Holders</div>
      ${entry.firstName?`<div class="leader-row">
        <div class="leader-medal">🥇</div>
        <div style="flex:1"><div class="leader-name">${entry.firstName}</div><div class="leader-pos">১ম স্থান</div>${marksHtml(entry.firstMarks,entry.firstTotal)}</div>
      </div>`:''}
      ${entry.secondName?`<div class="leader-row">
        <div class="leader-medal">🥈</div>
        <div style="flex:1"><div class="leader-name">${entry.secondName}</div><div class="leader-pos">২য় স্থান</div>${marksHtml(entry.secondMarks,entry.secondTotal)}</div>
      </div>`:''}
    </div>`;
  }
}

// ══════════════════════════════════════════════
// ══ DUE NOTIFICATIONS ══
// ══════════════════════════════════════════════
function loadDueStudents(){
  const cls=$('fd-cls')?.value||'';
  const sel=$('fd-student'); if(!sel)return;
  let students=[...window.appData.students];
  if(cls) students=students.filter(s=>s.class===cls);
  students.sort((a,b)=>a.name.localeCompare(b.name));
  sel.innerHTML='<option value="">— Select Student —</option>'+
    students.map(s=>`<option value="${s.id}">${s.name} (${s.class})</option>`).join('');
}

async function addDueNotification(){
  const studentId=$('fd-student').value;
  const month=$('fd-month').value.trim();
  const note=$('fd-note').value.trim();
  if(!studentId||!month){showToast('Student ও Month দিন!');return;}
  const student=window.appData.students.find(s=>s.id===studentId);
  if(!student){showToast('Student not found!');return;}
  try{
    const {collection,addDoc}=window._fb;
    await addDoc(collection(window._db,'dueNotifications'),{
      studentId,studentName:student.name,studentClass:student.class,month,note,createdAt:Date.now()
    });
    $('fd-month').value=''; $('fd-note').value='';
    showToast('✅ Due notification assign হয়েছে!');
  }catch(e){showToast('❌ Error: '+e.message);}
}

function renderDuesAdmin(){
  const el=$('dues-admin-list'); if(!el)return;
  loadDueStudents();
  const data=[...window.appData.dueNotifications].sort((a,b)=>b.createdAt-a.createdAt);
  if(!data.length){el.innerHTML='<div class="empty"><div class="ei">💰</div><p>No due notifications.</p></div>';return;}
  el.innerHTML=data.map(d=>`
    <div class="li">
      <div class="li-info">
        <div class="li-title">${d.studentName} <span style="font-size:11px;color:var(--muted)">${d.studentClass}</span></div>
        <div class="li-sub">💰 ${d.month}${d.note?' — '+d.note:''}</div>
