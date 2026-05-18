// ══ REFRESH ══
window.refreshAll=function(){
  window.renderStats(); window.renderTeachersTable(); populateTeacherSelect();
  populateAlarmTeacherSelect();
  renderClassesTable(); window.renderAlarmsList(); renderNoticesList(); renderRoutinesList();
  renderTeacherRoutinesList(); renderResultsList(); renderSheetsList();
  window.renderStudentsTable(); window.renderPendingList();
  if(curRole==='student') renderStudent();
  if(curRole==='teacher'){
    const activeScreen=document.querySelector('.screen.active');
    if(activeScreen&&activeScreen.id==='s-manager'){
      // Re-render whichever manager tab is visible
      ['dashboard','teachers','students','attendance','teacher-att','homework','finance'].forEach(name=>{
        const tab=$('mgr-tab-'+name);
        if(tab&&tab.style.display!=='none'){
          if(name==='teachers')renderMgrTeachers();
          else if(name==='students')renderMgrStudents();
          else if(name==='attendance')renderMgrAttendance();
          else if(name==='teacher-att')renderMgrTeacherAtt();
          else if(name==='homework')renderMgrHomework();
          else if(name==='finance')renderMgrFinance();
          else if(name==='dashboard')window.renderDashboard?.('dash-mgr','manager');
        }
      });
    } else {
      renderTeacher();
    }
  }
  renderHomeworkAdmin();
  renderExamAdmin(); renderLeadersAdmin(); renderDuesAdmin(); renderAdminFinance();
  renderHolidayList();
  window._refreshDashboard?.();
  // Attendance renders only when the user selects class+month filters — not auto-called here
};

// ══ ADMIN TABS ══
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
  if(name==='dashboard') window.renderDashboard?.('dash-admin','admin');
}

// ══ STATS ══
window.renderStats = function renderStats(){
  $('st-t').textContent=window.appData.teachers.length;
  $('st-s').textContent=window.appData.students.length;
  $('st-c').textContent=window.appData.classes.length;
  $('st-n').textContent=window.appData.notices.length;
  // Online students count from presence data (10-minute window)
  const fiveMinAgo = Date.now() - 10*60*1000;
  const presence = window.appData.presence||[];
  const onlineS = presence.filter(p=>p.role==='student'&&p.online&&p.lastSeen>fiveMinAgo).length;
  const stOS=$('st-online-s');
  if(stOS) stOS.textContent=onlineS;
}

// ══ TEACHERS ══
async function addTeacher(){
  const name=$('ft-name').value.trim(),
        phone=$('ft-phone').value.trim(),
        subject=$('ft-subject').value.trim();
  if(!name){showToast('Teacher name দিন!');return;}

  const btn=document.querySelector('#ap-teachers .badd');
  if(btn){btn.disabled=true;btn.textContent='⏳ Saving...';}

  try{
    const {collection,addDoc}=window._fb;
    // Check duplicate in local data
    const exists=window.appData.teachers.find(t=>t.name.toLowerCase()===name.toLowerCase());
    if(exists){showToast('এই নামে teacher আগেই আছে!');return;}
    // Save to Firestore without serverTimestamp (avoid index issues)
    const role=$('ft-role')?.value||'teacher';
    await addDoc(collection(window._db,'teachers'),{
      name, phone, subject, role, createdAt: Date.now()
    });
    ['ft-name','ft-phone','ft-subject'].forEach(id=>$(id).value='');
    if($('ft-role')) $('ft-role').value='teacher';
    showToast('✅ '+name+' added!');
  }catch(e){
    console.error('addTeacher error:',e);
    showToast('❌ Error: '+e.message);
  }finally{
    if(btn){btn.disabled=false;btn.textContent='+ Add Teacher';}
  }
}

window.renderTeachersTable = function renderTeachersTable(){
  const tbody=$('teachers-tbody'); if(!tbody)return;
  const fiveMinAgo = Date.now() - 10*60*1000;
  const presence = window.appData.presence||[];
  tbody.innerHTML=window.appData.teachers.map((t,i)=>{
    const p = presence.find(pr=>pr.userId===t.name&&pr.role==='teacher');
    const isOnline = p && p.online && p.lastSeen > fiveMinAgo;
    const lastSeen = p ? fmtLastSeen(p.lastSeen) : 'Never';
    const dot = isOnline
      ? '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#00c896;box-shadow:0 0 6px #00c896;margin-right:5px;vertical-align:middle"></span>'
      : '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#ccc;margin-right:5px;vertical-align:middle"></span>';
    const role=t.role||'teacher';
    const roleLabel=role==='chairman'?'👑 Chairman':role==='manager'?'🏢 Manager':'👨‍🏫 Teacher';
    return`<tr>
      <td>${i+1}</td>
      <td><strong>${t.name}</strong></td>
      <td>${t.phone||'—'}</td>
      <td>${t.subject||'—'}</td>
      <td>
        <span class="role-tag ${role}">${roleLabel}</span>
        <button onclick="adminSetTeacherRole('${t.id}','${role}')"
          style="margin-left:4px;padding:2px 7px;border:1px solid var(--border);border-radius:7px;
          background:none;color:var(--muted);font-size:10px;cursor:pointer;"
          title="Change role">✏️</button>
      </td>
      <td>${dot}<span style="font-size:11px;color:${isOnline?'#00c896':'var(--muted)'}">${isOnline?'Online':lastSeen}</span></td>
      <td style="display:flex;gap:6px;align-items:center">
        <button class="bdel" onclick="delDoc('teachers','${t.id}')" title="Delete teacher">✕</button>
        <button onclick="adminResetPin('${t.id}','${t.name}')"
          style="padding:4px 9px;border:1.5px solid var(--y);border-radius:7px;background:rgba(255,179,0,.1);
          color:var(--y);font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap"
          title="Reset this teacher's PIN">🔑 Reset PIN</button>
      </td>
    </tr>`;
  }).join('')||'<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:20px">No teachers yet.</td></tr>';
}

// ══ SET TEACHER ROLE ══
async function adminSetTeacherRole(teacherId, currentRole){
  const roles=['teacher','manager','chairman'];
  const labels={teacher:'👨‍🏫 Teacher',manager:'🏢 Manager',chairman:'👑 Chairman'};
  const nextRole=roles[(roles.indexOf(currentRole)+1)%roles.length];
  try{
    const {doc,updateDoc}=window._fb;
    await updateDoc(doc(window._db,'teachers',teacherId),{role:nextRole});
    showToast(`✅ Role changed to ${labels[nextRole]}`);
  }catch(e){showToast('❌ '+e.message);}
}

// Populate teacher dropdown in Classes panel from teachers collection
function populateTeacherSelect(){
  const sel=$('fc-teacher'); if(!sel)return;
  const cur=sel.value;
  sel.innerHTML='<option value="">-- Select Teacher --</option>';
  window.appData.teachers.forEach(t=>{
    const o=document.createElement('option');
    o.value=t.name; o.textContent=`${t.name}${t.subject?' ('+t.subject+')':''}`;
    sel.appendChild(o);
  });
  if(cur) sel.value=cur;
}

// ══ CLASSES ══
async function addClass(){
  const teacher=$('fc-teacher').value, subject=$('fc-subject').value.trim(),
        day=$('fc-day').value, time=$('fc-time').value,
        cls=$('fc-class').value.trim(), room=$('fc-room').value.trim();
  if(!teacher||!subject||!time){showToast('Teacher, Subject & Time দিন!');return;}
  const {collection,addDoc,serverTimestamp}=window._fb;
  await addDoc(collection(window._db,'classes'),{teacher,subject,day,time,class:cls,room,createdAt:serverTimestamp()});
  ['fc-subject','fc-time','fc-class','fc-room'].forEach(id=>$(id).value='');
  showToast('✅ Class যোগ হয়েছে!');
}

function renderClassesTable(){
  const tbody=$('classes-tbody'); if(!tbody)return;
  const ord=['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday'];
  const sorted=[...window.appData.classes].sort((a,b)=>ord.indexOf(a.day)-ord.indexOf(b.day)||a.time.localeCompare(b.time));
  tbody.innerHTML=sorted.map(c=>`
    <tr>
      <td><strong>${c.teacher}</strong></td><td>${c.subject}</td>
      <td><span class="badge">${c.class||'—'}</span></td>
      <td>${c.day}</td><td><strong>${fmt(c.time)}</strong></td>
      <td style="color:var(--muted)">${c.room||'—'}</td>
      <td><button class="bdel" onclick="delDoc('classes','${c.id}')">✕</button></td>
    </tr>`).join('')||'<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:20px">No classes yet.</td></tr>';
}

// ══ NOTICES ══
async function postNotice(){
  const title=$('fn-title').value.trim(), body=$('fn-body').value.trim(), cls=$('fn-class').value;
  if(!title||!body){showToast('Title ও Message দিন!');return;}
  const linkType=$('fn-link-type')?.value||'';
  const linkedId=$('fn-link-id')?.value||'';
  const {collection,addDoc,serverTimestamp}=window._fb;
  const data={title,body,class:cls,createdAt:serverTimestamp()};
  if(linkType && linkedId){ data.linkType=linkType; data.linkedId=linkedId; }
  // Upload attached image if any
  const imgFile=$('fn-image')?.files?.[0];
  if(imgFile){
    try{const imgUrl=await uploadFile(imgFile,'Notices','rp-notice-img');if(imgUrl)data.imageUrl=imgUrl;}
    catch(e){showToast('⚠️ Image upload failed: '+e.message);}
  }
  await addDoc(collection(window._db,'notices'),data);

  // WhatsApp send
  const sendStudents=$('wa-send-students')?.checked;
  const sendTeachers=$('wa-send-teachers')?.checked;
  if(sendStudents||sendTeachers){
    await sendWhatsApp(title, body, sendStudents, sendTeachers);
  }

  // Reset form
  $('fn-title').value='';$('fn-body').value='';
  if($('fn-image')) $('fn-image').value='';
  if($('fn-link-type')) $('fn-link-type').value='';
  if($('wa-send-students')) $('wa-send-students').checked=false;
  if($('wa-send-teachers')) $('wa-send-teachers').checked=false;
  onNoticeLinkTypeChange();

  await sendPush('🔔 নতুন Notice — Master Academic', title+': '+body.substring(0,60), 'notice', cls, '/');
  showToast('✅ Notice পোস্ট হয়েছে!');
}

function renderNoticesList(){
  const el=$('notices-list'); if(!el)return;
  el.innerHTML=window.appData.notices.map(n=>`
    <div class="li">
      <div class="li-info"><div class="li-title">${n.title}</div>
        <div class="li-sub">${n.body.substring(0,70)} • ${n.class} • ${fmtDate(n.createdAt)}</div></div>
      <button class="bdel" onclick="delDoc('notices','${n.id}')">✕</button>
    </div>`).join('')||'<div class="empty"><div class="ei">📭</div><p>No notices.</p></div>';
}

// ══ UPLOAD ══
async function uploadFile(file,folder,progId){
  const pb=$(progId), pbb=$(progId.replace('rp-','rpb-'));
  if(pb){pb.style.display='block';pbb.style.width='15%';}
  const base64=await new Promise((res,rej)=>{
    const r=new FileReader();r.onload=()=>res(r.result.split(',')[1]);r.onerror=rej;r.readAsDataURL(file);
  });
  if(pbb)pbb.style.width='50%';
  const resp=await fetch(DRIVE_API_URL,{
    method:'POST',headers:{'Content-Type':'text/plain'},
    body:JSON.stringify({action:'upload',file:base64,fileName:Date.now()+'_'+file.name,mimeType:file.type||'application/octet-stream',folder})
  });
  const result=await resp.json();
  if(pbb)pbb.style.width='100%';
  setTimeout(()=>{if(pb)pb.style.display='none';pbb.style.width='0%';},1200);
  if(!result.success) throw new Error(result.error||'Upload failed');
  return result.url;
}

// ══ ROUTINES ══
async function uploadRoutine(){
  const cls=$('fr-class').value, file=$('fr-file').files[0];
  if(!file){showToast('Image বেছে নিন!');return;}
  const btn=$('btn-routine'); btn.disabled=true; btn.textContent='⏳ Uploading...';
  try{
    const url=await uploadFile(file,'Routines','rp-routine');
    const {collection,addDoc,serverTimestamp}=window._fb;
    await addDoc(collection(window._db,'routines'),{class:cls,url,fileName:file.name,createdAt:serverTimestamp()});
    $('fr-file').value=''; showToast('✅ Routine save হয়েছে!');
  }catch(e){showToast('❌ '+e.message);}
  finally{btn.disabled=false;btn.textContent='📤 Upload Routine';}
}

function renderRoutinesList(){
  const el=$('routines-list'); if(!el)return;
  el.innerHTML=window.appData.routines.map(r=>`
    <div class="li">
      <img class="ithumb" src="${dThumb(r.url)}" onclick="openLB('${dImg(r.url)}')" style="cursor:pointer" onerror="this.style.display='none'"/>
      <div class="li-info"><div class="li-title">${r.class}</div>
        <div class="li-sub">${fmtDate(r.createdAt)}</div></div>
      <a href="${r.url}" target="_blank" style="color:var(--b);font-size:11px;font-weight:700;margin-right:6px">View</a>
      <button class="bdel" onclick="delDoc('routines','${r.id}')">✕</button>
    </div>`).join('')||'<div class="empty"><div class="ei">📅</div><p>No routines.</p></div>';
}

// ══ TEACHER ROUTINES ══
async function uploadTeacherRoutine(){
  const title=$('ftr-title').value.trim(), file=$('ftr-file').files[0];
  if(!file||!title){showToast('Title ও Image দিন!');return;}
  const btn=$('btn-troutine'); btn.disabled=true; btn.textContent='⏳ Uploading...';
  try{
    const url=await uploadFile(file,'TeacherRoutines','rp-troutine');
    const {collection,addDoc,serverTimestamp}=window._fb;
    await addDoc(collection(window._db,'teacherRoutines'),{title,url,fileName:file.name,createdAt:serverTimestamp()});
    $('ftr-title').value='';$('ftr-file').value='';
    showToast('✅ Teacher Routine save হয়েছে!');
  }catch(e){showToast('❌ '+e.message);}
  finally{btn.disabled=false;btn.textContent='📤 Upload Teacher Routine';}
}

function renderTeacherRoutinesList(){
  const el=$('troutines-list'); if(!el)return;
  el.innerHTML=window.appData.teacherRoutines.map(r=>`
    <div class="li">
      <img class="ithumb" src="${dThumb(r.url)}" onclick="openLB('${dImg(r.url)}')" style="cursor:pointer" onerror="this.style.display='none'"/>
      <div class="li-info"><div class="li-title">${r.title}</div>
        <div class="li-sub">${fmtDate(r.createdAt)}</div></div>
      <a href="${r.url}" target="_blank" style="color:var(--b);font-size:11px;font-weight:700;margin-right:6px">View</a>
      <button class="bdel" onclick="delDoc('teacherRoutines','${r.id}')">✕</button>
    </div>`).join('')||'<div class="empty"><div class="ei">📋</div><p>No teacher routines.</p></div>';
}

// ══ RESULTS ══
async function uploadResult(){
  const cls=$('fres-class').value, month=$('fres-month').value,
        week=$('fres-week').value, file=$('fres-file').files[0];
  if(!file){showToast('Image বেছে নিন!');return;}
  const btn=$('btn-result'); btn.disabled=true; btn.textContent='⏳ Uploading...';
  try{
    const url=await uploadFile(file,'Results','rp-result');
    const {collection,addDoc,serverTimestamp}=window._fb;
    await addDoc(collection(window._db,'results'),{class:cls,month,week,url,fileName:file.name,createdAt:serverTimestamp()});
    $('fres-file').value='';
    await sendPush('📊 নতুন Result — Master Academic', `${cls} এর ${month} ${week} result!`, 'result', cls, '/');
    showToast('✅ Result save হয়েছে!');
  }catch(e){showToast('❌ '+e.message);}
  finally{btn.disabled=false;btn.textContent='📤 Upload Result';}
}

function renderResultsList(){
  const el=$('results-list'); if(!el)return;
  el.innerHTML=window.appData.results.map(r=>`
    <div class="li">
      <img class="ithumb" src="${dThumb(r.url)}" onclick="openLB('${dImg(r.url)}')" style="cursor:pointer" onerror="this.style.display='none'"/>
      <div class="li-info"><div class="li-title">${r.class} — ${r.month} ${r.week}</div>
        <div class="li-sub">${fmtDate(r.createdAt)}</div></div>
      <a href="${r.url}" target="_blank" style="color:var(--b);font-size:11px;font-weight:700;margin-right:6px">View</a>
      <button class="bdel" onclick="delDoc('results','${r.id}')">✕</button>
    </div>`).join('')||'<div class="empty"><div class="ei">📊</div><p>No results.</p></div>';
}

// ══ SHEETS ══
function toggleGrp(v){
  const needs=['Class 9','Class 10'].includes(v);
  $('fsh-grpwrap').style.display=needs?'block':'none';
  if(!needs && $('fsh-group')) $('fsh-group').value='';
}

async function uploadSheet(){
  const cls=$('fsh-class').value, subject=$('fsh-subject').value.trim(),
        group=$('fsh-group')?$('fsh-group').value:'', title=$('fsh-title').value.trim(), file=$('fsh-file').files[0];
  if(!file||!subject||!title){showToast('সব তথ্য দিন!');return;}
  const btn=$('btn-sheet'); btn.disabled=true; btn.textContent='⏳ Uploading...';
  const isPdf=file.type==='application/pdf';
  try{
    const url=await uploadFile(file,'Sheets','rp-sheet');
    const {collection,addDoc,serverTimestamp}=window._fb;
    await addDoc(collection(window._db,'sheets'),{class:cls,subject,group,title,url,isPdf,fileName:file.name,createdAt:serverTimestamp()});
    ['fsh-subject','fsh-title'].forEach(id=>$(id).value='');$('fsh-file').value='';
    showToast('✅ Sheet save হয়েছে!');
  }catch(e){showToast('❌ '+e.message);}
  finally{btn.disabled=false;btn.textContent='📤 Upload Sheet';}
}

function renderSheetsList(){
  const el=$('sheets-list'); if(!el)return;
  el.innerHTML=window.appData.sheets.map(s=>`
    <div class="li">
      ${s.isPdf?`<div class="pdfic">📄</div>`:`<img class="ithumb" src="${dThumb(s.url)}" onclick="openLB('${dImg(s.url)}')" style="cursor:pointer" onerror="this.style.display='none'"/>`}
      <div class="li-info"><div class="li-title">${s.title}</div>
        <div class="li-sub">${s.class} • ${s.subject}${s.group?' • '+s.group:''}</div></div>
      <a href="${s.url}" target="_blank" style="color:var(--g);font-size:12px;font-weight:700;margin-right:5px">Open</a>
      <button class="bdel" onclick="delDoc('sheets','${s.id}')">✕</button>
    </div>`).join('')||'<div class="empty"><div class="ei">📄</div><p>No sheets.</p></div>';
}

// ══ STUDENTS ══
window.renderStudentsTable = function renderStudentsTable(){
  const tbody=$('students-tbody'); if(!tbody)return;
  const fiveMinAgo = Date.now() - 10*60*1000;
  const presence = window.appData.presence||[];

  // Search + filter
  const q=($('stu-search')?.value||'').trim().toLowerCase();
  const clsF=$('stu-cls-filter')?.value||'';
  const classOrder=['Class 2','Class 3','Class 4','Class 5','Class 6','Class 7','Class 8','Class 9','Class 10'];

  let list=[...window.appData.students];
  if(q) list=list.filter(s=>s.name.toLowerCase().includes(q)||s.phone.includes(q));
  if(clsF) list=list.filter(s=>s.class===clsF);
  // Sort by class order, then by name
  list.sort((a,b)=>{
    const ci=classOrder.indexOf(a.class)-classOrder.indexOf(b.class);
    return ci!==0?ci:a.name.localeCompare(b.name);
  });

  const lbl=$('stu-count-label');
  if(lbl) lbl.textContent=`Showing ${list.length} of ${window.appData.students.length} students`;

  const now=new Date(), curMonthName=ATT_MONTHS[now.getMonth()], curYear=now.getFullYear();
  tbody.innerHTML=list.map((s,i)=>{
    const p = presence.find(pr=>pr.userId===s.phone&&pr.role==='student');
    const isOnline = p && p.online && p.lastSeen > fiveMinAgo;
    const lastSeen = p ? fmtLastSeen(p.lastSeen) : 'Never';
    const dot = isOnline
      ? '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#1a73e8;box-shadow:0 0 6px #1a73e8;margin-right:5px;vertical-align:middle"></span>'
      : '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#ccc;margin-right:5px;vertical-align:middle"></span>';
    // Highlight matched search term
    const hl=(txt,q)=>{
      if(!q)return txt;
      const idx=txt.toLowerCase().indexOf(q);
      if(idx<0)return txt;
      return txt.slice(0,idx)+`<mark style="background:#fff3cd;border-radius:3px">`+txt.slice(idx,idx+q.length)+`</mark>`+txt.slice(idx+q.length);
    };
    const paid=isFeesPaid(s.id||s.phone,curMonthName,curYear);
    const rowBg=paid?'rgba(0,200,120,.10)':'rgba(232,64,64,.08)';
    const rowBorder=paid?'2px solid rgba(0,200,120,.30)':'2px solid rgba(232,64,64,.25)';
    return`<tr style="background:${rowBg};border-left:${rowBorder};"><td>${i+1}</td>
      <td><strong>${hl(s.name,q)}</strong></td>
      <td>${hl(s.phone,q)}</td>
      <td><span class="badge">${s.class}</span></td>
      <td>${s.group||'—'}</td>
      <td>${dot}<span style="font-size:11px;color:${isOnline?'#1a73e8':'var(--muted)'}">${isOnline?'Online':lastSeen}</span></td>
      <td style="color:var(--muted)">${fmtDate(s.createdAt)}</td>
      <td><button class="bdel" onclick="delDoc('students','${s.id}')">✕</button></td>
    </tr>`;
  }).join('')||`<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:20px">${q||clsF?'No matching students.':'No students yet.'}</td></tr>`;
}

// ══ DELETE ══
async function delDoc(col,id){
  try{
    // Find the doc to get Drive URL before deleting
    const item = window.appData[col==='routines'?'routines'
      :col==='results'?'results'
      :col==='sheets'?'sheets'
      :col==='teacherRoutines'?'teacherRoutines':null]
      ?.find(d=>d.id===id);

    const {doc,deleteDoc}=window._fb;
    await deleteDoc(doc(window._db,col,id));

    // Also delete from Google Drive if has URL
    if(item?.url && DRIVE_API_URL && !DRIVE_API_URL.includes('PASTE')){
      const fileId = getFileId(item.url);
      if(fileId){
        fetch(DRIVE_API_URL,{
          method:'POST',
          headers:{'Content-Type':'text/plain'},
          body:JSON.stringify({action:'deleteFile',fileId})
        }).then(()=>console.log('Drive file deleted:',fileId))
          .catch(e=>console.log('Drive delete error:',e));
      }
    }
    showToast('🗑️ Deleted!');
  }catch(e){
    showToast('❌ Delete error: '+e.message);
  }
}

// ══ TEACHER PANEL ══
function renderTeacher(){
  const today=dayName(), now=new Date();
  // Get only THIS teacher's classes for today
  const my=window.appData.classes
    .filter(c=>c.teacher===curTeacher && c.day===today)
    .sort((a,b)=>a.time.localeCompare(b.time));

  const nextCls=my.find(c=>cdT(c.time)>now)||null;

  if(!my.length){
    $('t-next').style.display='none';
    $('t-nocls').style.display='block';
    $('t-list').innerHTML='';
  } else {
    $('t-nocls').style.display='none';
    if(nextCls){
      $('t-next').style.display='block';
      $('t-subj').textContent=nextCls.subject;
      $('t-time').textContent=`⏰ ${fmt(nextCls.time)}${nextCls.room?' · '+nextCls.room:''}${nextCls.class?' · '+nextCls.class:''}`;
      updateCD(nextCls);
      if(!cdInt) cdInt=setInterval(()=>{if(nextCls)updateCD(nextCls);},1000);
    } else {
      $('t-next').style.display='none';
    }
    $('t-list').innerHTML=my.map(c=>{
      const done=cdT(c.time)<now, isNext=nextCls&&c.id===nextCls.id;
      return`<div class="crow ${done?'done':''}">
        <div class="dot ${isNext?'act':done?'':'up'}"></div>
        <div class="cri">
          <div class="crs">${c.subject}${c.class?' <span style="font-size:11px;opacity:.6">· '+c.class+'</span>':''}</div>
          <div class="crt">${fmt(c.time)}${c.room?' · '+c.room:''}</div>
        </div>
        <span class="crb ${done?'done':isNext?'next':'up'}">${done?'Done ✓':isNext?'Next ⏳':'Upcoming'}</span>
      </div>`;
    }).join('');
  }

  // Show teacher routines
  const tr=$('t-routines'); if(tr){
    tr.innerHTML=window.appData.teacherRoutines.map(r=>`
      <div class="trout-card" onclick="openLB('${dImg(r.url)}')">
        <img src="${dImg(r.url)}" alt="${r.title}" onerror="this.src='https://via.placeholder.com/400x200?text=Tap+to+View'"/>
        <div class="trout-info">
          <div><div class="trout-title">${r.title}</div><div class="trout-date">${fmtDate(r.createdAt)}</div></div>
          <a href="${r.url}" target="_blank" style="color:var(--g);font-size:12px;font-weight:700">Open</a>
        </div>
      </div>`).join('')||'<div style="text-align:center;padding:20px;color:rgba(255,255,255,.3);font-size:13px">No routine uploaded yet.</div>';
  }
}

function updateCD(cls){
  const diff=cdT(cls.time)-new Date(), el=$('t-cd'); if(!el)return;
  if(diff<=0){el.textContent='Starting!';return;}
  const h=Math.floor(diff/3600000),m=Math.floor((diff%3600000)/60000),s=Math.floor((diff%60000)/1000);
  el.textContent=h>0?`${h}h ${m}m`:`${m}m ${s}s`;
}

function scheduleReminders(){
  remTimers.forEach(clearTimeout);remTimers=[];
  const today=dayName(), now=new Date();
  window.appData.classes.filter(c=>c.teacher===curTeacher&&c.day===today).forEach(c=>{
    const ct=cdT(c.time);
    const d1=new Date(ct-40*60*1000)-now, d2=ct-now;
    const d5=new Date(ct-5*60*1000)-now; // 5-minute pre-class alarm
    if(d1>0) remTimers.push(setTimeout(()=>showRem(c,false),d1));
    // 5-minute countdown banner + alarm sound
    if(d5>0&&d5<86400000) remTimers.push(setTimeout(()=>show5MinAlarm(c),d5));
    if(d2>0&&d2<86400000) remTimers.push(setTimeout(()=>showRem(c,true),d2));
  });
}

// ── 5-minute pre-class countdown banner ──
let _5minCountdownTimer=null;
function show5MinAlarm(cls){
  // Brief vibration + alarm sound
  if('vibrate' in navigator) navigator.vibrate([300,100,300,100,300]);
  playAlarmSound(2000);

  // Show a countdown banner at the top of the teacher screen
  let existing=$('pre-alarm-banner');
  if(!existing){
    existing=document.createElement('div');
    existing.id='pre-alarm-banner';
    existing.style.cssText='position:fixed;top:0;left:0;right:0;z-index:9997;background:linear-gradient(135deg,#e65100,#f57c00);padding:12px 18px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 4px 20px rgba(0,0,0,.4);animation:slideDownBanner .35s ease;';
    document.body.appendChild(existing);
  }

  const endTime=cdT(cls.time);
  function updateBanner(){
    const remaining=Math.max(0,endTime-new Date());
    const m=Math.floor(remaining/60000), s=Math.floor((remaining%60000)/1000);
    existing.innerHTML=`
      <div style="flex:1">
        <div style="font-family:'Baloo 2',sans-serif;font-size:13px;font-weight:800;color:#fff;">
          ⏰ ${cls.subject} শুরু হতে ${m}m ${s}s বাকি!
        </div>
        <div style="font-size:11px;color:rgba(255,255,255,.7);">${cls.class||''} ${cls.room?'• '+cls.room:''} — ${fmt(cls.time)}</div>
      </div>
      <button onclick="document.getElementById('pre-alarm-banner').remove();if(window._5minCountdownTimer)clearInterval(window._5minCountdownTimer);"
        style="background:rgba(255,255,255,.2);border:none;color:#fff;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">✕</button>`;
    if(remaining<=0){
      clearInterval(window._5minCountdownTimer);
      existing.remove();
    }
  }
  updateBanner();
  if(window._5minCountdownTimer) clearInterval(window._5minCountdownTimer);
  window._5minCountdownTimer=setInterval(updateBanner,1000);
  remTimers.push(window._5minCountdownTimer);
}

// ══ STUDENT PANEL ══
function renderStudent(){
  if(!curStudent)return;
  const cls=curStudent.class;
  renderStuNotices(cls); renderStuRoutines(cls); renderStuResults(); renderStuSheets(cls);
  renderStuAttendance(cls); renderStuHomework(cls);
  renderStuExam(cls); renderStuLeaderboard(cls); renderStuDue(); renderStuExamWidget(cls);
}

function renderStuNotices(cls){
  const el=$('stu-notices'); if(!el)return;
  const ns=window.appData.notices
    .filter(n=>n.class==='All'||n.class===cls)
    .sort((a,b)=>(b.createdAt?.toMillis?b.createdAt.toMillis():b.createdAt||0)-(a.createdAt?.toMillis?a.createdAt.toMillis():a.createdAt||0));
  // Store notices BEFORE rendering so onclick index lookup always works
  window._stuNotices = ns;
  el.innerHTML=ns.map((n,i)=>`
    <div class="ncard" onclick="openNoticeModal(${i},'stu')">
      ${n.imageUrl?`<img src="${dThumb(n.imageUrl)}" style="width:100%;border-radius:8px;max-height:160px;object-fit:cover;margin-bottom:8px" onerror="this.style.display='none'" alt=""/>`:''}
      <div class="nt">🔔 ${n.title}</div>
      <div class="nb">${n.body.length>100?n.body.substring(0,100)+'…':n.body}</div>
      <div class="nd">${fmtDate(n.createdAt)} • ${n.class==='All'?'সবার জন্য':n.class}
        <span style="float:right;color:var(--g);font-size:11px;font-weight:700;">পড়ুন →</span>
      </div>
    </div>`).join('')||'<div class="empty"><div class="ei">📭</div><p>কোনো notice নেই।</p></div>';
}

// ── Notice link type handler (admin form) ──
function onNoticeLinkTypeChange(){
  const type=$('fn-link-type')?.value||'';
  const wrap=$('fn-link-wrap');
  const sel=$('fn-link-id');
  const preview=$('fn-link-preview');
  const previewTxt=$('fn-link-preview-text');
  if(!wrap||!sel) return;
  if(!type){ wrap.style.display='none'; return; }
  wrap.style.display='block';
  // Populate selector
  sel.innerHTML='<option value="">— Select item —</option>';
  if(type==='result'){
    const items=window.appData.results||[];
    if(!items.length){ sel.innerHTML='<option value="">No results uploaded yet</option>'; preview.style.display='none'; return; }
    items.forEach(r=>{
      const o=document.createElement('option');
      o.value=r.id;
      o.textContent=`${r.class} • ${r.month} ${r.week}`;
      sel.appendChild(o);
    });
  } else {
    const items=window.appData.sheets||[];
    if(!items.length){ sel.innerHTML='<option value="">No sheets uploaded yet</option>'; preview.style.display='none'; return; }
    items.forEach(s=>{
      const o=document.createElement('option');
      o.value=s.id;
      o.textContent=`${s.class} • ${s.subject} — ${s.title}${s.group?' ('+s.group+')':''}`;
      sel.appendChild(o);
    });
  }
  // Show preview on selection
  sel.onchange=()=>{
    const id=sel.value;
    if(!id){ preview.style.display='none'; return; }
    if(type==='result'){
      const r=(window.appData.results||[]).find(x=>x.id===id);
      if(r){ preview.style.display='block'; previewTxt.textContent=`Result: ${r.class} • ${r.month} ${r.week}`; }
    } else {
      const s=(window.appData.sheets||[]).find(x=>x.id===id);
      if(s){ preview.style.display='block'; previewTxt.textContent=`Sheet: ${s.title} — ${s.subject} (${s.class}${s.group?' / '+s.group:''})`; }
    }
  };
}

function openNoticeModal(idx, src, clsArg){
  const notices = src==='stu' ? window._stuNotices : window._tchNotices;
  if(!notices||!notices[idx]) return;
  const n = notices[idx];
  $('nmodal-title').textContent = n.title;
  $('nmodal-body').textContent = n.body;
  $('nmodal-date').textContent = '📅 ' + (fmtDate(n.createdAt)||'');
  $('nmodal-cls').textContent = '👥 ' + (n.class==='All'?'সবার জন্য':n.class==='Teachers'?'Teachers':n.class);

  // Attached image
  const imgSlot=$('nmodal-img-slot');
  if(imgSlot){
    imgSlot.innerHTML=n.imageUrl
      ?`<img class="notice-img" src="${dImg(n.imageUrl)}" onclick="openLB('${dImg(n.imageUrl)}')" onerror="this.style.display='none'" alt="Notice Image"/>`
      :'';
  }

  // Linked result/sheet button
  const slot=$('nmodal-link-slot');
  if(slot){
    slot.innerHTML='';
    if(n.linkType && n.linkedId){
      const label = n.linkType==='result' ? '📊 View Result' : '📄 View Sheet';
      const btn=document.createElement('button');
      btn.className='nmodal-link-btn';
      btn.textContent=label;
      btn.onclick=()=>{
        closeNoticeModal({target:$('notice-modal')});
        if(n.linkType==='result'){
          // Switch to result tab and open the result
          stuTab('result', document.querySelector('.dni:nth-child(3)'));
          setTimeout(()=>{
            const item=(window.appData.results||[]).find(r=>r.id===n.linkedId);
            if(item) openLB(dImg(item.url));
          },300);
        } else {
          // Switch to sheet tab and highlight
          stuTab('sheet', document.querySelector('.dni:nth-child(4)'));
          setTimeout(()=>{
            const item=(window.appData.sheets||[]).find(s=>s.id===n.linkedId);
            if(item){
              if(item.isPdf) viewPDF(item.url);
              else openLB(dImg(item.url));
            }
          },300);
        }
      };
      slot.appendChild(btn);
    }
  }

  $('notice-modal').classList.add('open');
  document.body.style.overflow='hidden';
}

function closeNoticeModal(e){
  // Called from button (no event) or from backdrop click
  if(e && e.target && e.target!=$('notice-modal') && !e.target.classList.contains('nmodal-close')) return;
  $('notice-modal').classList.remove('open');
  document.body.style.overflow='';
}
// Also close on Escape
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeNoticeModal({target:$('notice-modal')});});

function renderStuRoutines(cls){
  const el=$('stu-routines'); if(!el)return;
  const rs=window.appData.routines.filter(r=>r.class===cls);
  el.innerHTML=rs.map(r=>`
    <div class="rcard" onclick="openLB('${dImg(r.url)}')">
      <img src="${dImg(r.url)}" alt="Routine" onerror="this.src='https://via.placeholder.com/400x100?text=Tap+to+Open'"/>
      <div class="rcinfo"><div class="rcclass">${r.class} Routine</div>
        <div class="rcdate">${fmtDate(r.createdAt)} • <a href="${r.url}" target="_blank" style="color:var(--g)" onclick="event.stopPropagation()">Drive-এ খুলুন</a></div>
      </div>
    </div>`).join('')||'<div class="empty"><div class="ei">📅</div><p>এখনো routine আসেনি।</p></div>';
}

function renderStuResults(){
  const el=$('stu-results'); if(!el)return;
  const cls=curStudent.class;
  const rs=window.appData.results.filter(r=>r.class==='All'||r.class===cls);
  const byMonth={};
  rs.forEach(r=>{if(!byMonth[r.month])byMonth[r.month]=[];byMonth[r.month].push(r);});
  el.innerHTML=Object.entries(byMonth).map(([month,items])=>`
    <div class="mgrp">
      <div class="mtitle" onclick="toggleMonth(this)">${month} <span>▼</span></div>
      <div class="mbody">
        ${items.map(r=>`
          <div class="witem" onclick="openLB('${dImg(r.url)}')">
            <img class="wicon" src="${dThumb(r.url)}" onerror="this.style.display='none'"/>
            <div class="winfo"><div class="wtitle">${r.week}</div>
              <div class="wsub">${r.class} • ${fmtDate(r.createdAt)}</div></div>
            <span style="color:var(--muted);font-size:18px">›</span>
          </div>`).join('')}
      </div>
    </div>`).join('')||'<div class="empty"><div class="ei">📊</div><p>এখনো result আসেনি।</p></div>';
}

function toggleMonth(el){const b=el.nextElementSibling;b.style.display=b.style.display==='none'?'block':'none';}

function renderStuSheets(cls){
  const el=$('stu-sheets'), filt=$('sh-filt'); if(!el)return;
  let sheets=window.appData.sheets.filter(s=>s.class===cls);
  const subjects=[...new Set(sheets.map(s=>s.subject))];
  if(filt){
    filt.innerHTML=`<button class="sfb active" onclick="filtSheets(this,'')">All</button>`+
      subjects.map(s=>`<button class="sfb" onclick="filtSheets(this,'${s}')">${s}</button>`).join('');
  }
  renderSheetCards(sheets);
}

function filtSheets(el,subj){
  document.querySelectorAll('.sfb').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  let sheets=window.appData.sheets.filter(s=>s.class===curStudent.class);
  if(subj) sheets=sheets.filter(s=>s.subject===subj);
  renderSheetCards(sheets);
}

function renderSheetCards(sheets){
  const el=$('stu-sheets'); if(!el)return;
  el.innerHTML=sheets.map(s=>`
    <div class="shcard" onclick="${s.isPdf?`viewPDF('${s.url}')`:`openLB('${dImg(s.url)}')`}">
      ${s.isPdf?`<div class="shpdf">📄</div>`:`<img class="shtmb" src="${dThumb(s.url)}" onerror="this.style.display='none'"/>`}
      <div class="shi"><div class="sht">${s.title}</div>
        <div class="shs">${s.subject}${s.group?' • '+s.group:''}</div></div>
      <div class="sho">${s.isPdf?'👁️ View':'View ›'}</div>
    </div>`).join('')||'<div class="empty"><div class="ei">📄</div><p>এখনো sheet আসেনি।</p></div>';
}

// ══ STUDENT TABS ══
function stuTab(name,el){
  document.querySelectorAll('.dni').forEach(d=>d.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('.spanel').forEach(p=>p.classList.remove('active'));
  $(`sp-${name}`).classList.add('active');
}

// ══ LIGHTBOX ══
function openLB(url){$('lb-img').src=url;$('lb').classList.add('open');}
function closeLB(){$('lb').classList.remove('open');$('lb-img').src='';}

// ══ REMINDER ══
function showRem(cls,now){
  $('r-subj').textContent=cls.subject;
  $('r-time').textContent=now?'⚠️ এখনই শুরু হচ্ছে!':`শুরু হবে ${fmt(cls.time)}-এ`;
  $('r-msg').innerHTML=now?`<strong>${cls.subject}</strong> ক্লাস এখনই! 🏃`:`ক্লাস শুরুর <strong>৪০ মিনিট</strong> বাকি।<br>প্রস্তুত হন! ✅`;
  $('rem').classList.add('open');
  try{const a=new AudioContext(),o=a.createOscillator();o.connect(a.destination);o.frequency.value=520;o.start();setTimeout(()=>o.stop(),600);}catch(e){}
}
function dismissRem(){$('rem').classList.remove('open');}

// ══ WHATSAPP SEND ══
async function sendWhatsApp(title, body, toStudents, toTeachers){
  const statusEl=$('wa-send-status');
  const iconEl=$('wa-send-icon');
  const msgEl=$('wa-send-msg');

  // Check config
  if(!WA_API_URL || !WA_API_KEY){
    if(statusEl){
      statusEl.style.display='flex';
      statusEl.className='wa-status error';
      iconEl.textContent='⚠️';
      msgEl.textContent='WhatsApp API not configured yet.';
      setTimeout(()=>{statusEl.style.display='none';},4000);
    }
    return;
  }

  // Show sending state
  if(statusEl){
    statusEl.style.display='flex';
    statusEl.className='wa-status sending';
    iconEl.textContent='⏳';
    msgEl.textContent='Sending to WhatsApp...';
  }

  // Format message — clean plain text for WhatsApp
  const waMessage=`*🔔 ${title}*\n\n${body}\n\n_— Master Academic & Admission Care_`;

  const groups=[];
  if(toStudents && WA_STUDENT_GROUP) groups.push({groupId:WA_STUDENT_GROUP, label:'Student Group'});
  if(toTeachers && WA_TEACHER_GROUP) groups.push({groupId:WA_TEACHER_GROUP, label:'Teacher Group'});

  if(!groups.length){
    if(statusEl){ statusEl.style.display='none'; }
    return;
  }

  // Send directly to Fonnte API for each group
  const results=[];
  for(const g of groups){
    try{
      const formData = new FormData();
      formData.append('target', g.groupId);
      formData.append('message', waMessage);
      formData.append('countryCode', '880');

      const res = await fetch(WA_API_URL, {
        method: 'POST',
        headers: { 'Authorization': WA_API_KEY },
        body: formData
      });
      const json = await res.json().catch(()=>({}));
      // Fonnte returns {status: true/false, detail: ...}
      const ok = json.status === true || json.status === 'true' || res.ok;
      results.push({label: g.label, ok, detail: json.detail||json.reason||''});
    }catch(err){
      results.push({label: g.label, ok: false, err: err.message});
    }
  }

  // Update status UI
  if(statusEl){
    const allOk=results.every(r=>r.ok);
    const anyOk=results.some(r=>r.ok);
    statusEl.className='wa-status '+(allOk?'success':'error');
    iconEl.textContent=allOk?'✅':anyOk?'⚠️':'❌';
    const sent=results.filter(r=>r.ok).map(r=>r.label).join(', ');
    const failed=results.filter(r=>!r.ok).map(r=>r.label).join(', ');
    msgEl.textContent=allOk
      ? `Sent to: ${sent}`
      : anyOk
        ? `Sent: ${sent} | Failed: ${failed}`
        : `Failed: ${failed}`;
    setTimeout(()=>{statusEl.style.display='none';},5000);
  }
}

// ══ PUSH NOTIFICATION ══
// ══ SEND PUSH NOTIFICATION ══════════════════════════════════════════════
// Calls the Google Apps Script backend which reads fcmTokens from Firestore
// and sends via FCM HTTP v1. targetClass filters recipients (optional).
async function sendPush(title, body, type, targetClass, url){
  try{
    if(!DRIVE_API_URL || DRIVE_API_URL.includes('PASTE')) return;
    // GAS reads FCM tokens from Firestore itself using the service account.
    // We just send the notification metadata + target filter.
    // GAS field name is 'target' (not 'targetClass').
    const payload = {
      action: 'notify',
      title,
      body,
      type:   type   || 'notice',
      target: targetClass || 'All'
    };
    if(url) payload.url = url;
    const resp = await fetch(DRIVE_API_URL, {
      method:  'POST',
      headers: {'Content-Type': 'text/plain'},
      body:    JSON.stringify(payload)
    });
    const result = await resp.json().catch(()=>({}));
    console.log('[Push] Sent:', result.sent||0, 'Failed:', result.failed||0,
                'Stale removed:', result.staleRemoved||0);
  }catch(e){
    console.warn('[Push] Error:', e.message);
  }
}

// ══ IN-APP NOTIFICATION ══
let _inappTimer = null;
window.showInappNotif = function(notice){
  const role = window.curRole || curRole;
  // Only show to students/teachers who are the target
  if(role==='admin') return;
  if(role==='student'){
    const cls = curStudent?.class;
    if(!cls) return;
    if(notice.class!=='All' && notice.class!==cls && notice.class!=='All+Teachers') return;
  }
  if(role==='teacher'){
    if(notice.class!=='Teachers'&&notice.class!=='All+Teachers'&&notice.class!=='All') return;
  }
  const el=$('inapp-notif');
  if(!el) return;
  $('inapp-title').textContent = '🔔 ' + notice.title;
  $('inapp-body').textContent = notice.body;
  el.classList.add('show');
  // Store notice for tap-to-open
  el._pendingNotice = notice;
  // Auto-dismiss after 6s
  clearTimeout(_inappTimer);
  _inappTimer = setTimeout(dismissInappNotif, 6000);
  // Browser notification too
  if(Notification.permission==='granted'){
    try{
      new Notification('🔔 ' + notice.title, {
        body: notice.body.substring(0,120),
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'notice-' + (notice.id||Date.now()),
        renotify: true
      });
    }catch(e){}
  }
};

function dismissInappNotif(){
  clearTimeout(_inappTimer);
  $('inapp-notif').classList.remove('show');
}
// Tap banner → open notice modal
document.getElementById('inapp-notif').addEventListener('click', function(){
  const n = this._pendingNotice;
  if(!n) return;
  dismissInappNotif();
  // Inject into _stuNotices temporarily and open at index 0
  if(curRole==='student'){ window._stuNotices=[n,...(window._stuNotices||[])]; openNoticeModal(0,'stu'); }
  else if(curRole==='teacher'){ window._tchNotices=[n,...(window._tchNotices||[])]; openNoticeModal(0,'tch'); }
});


function tTab(name, el){
  document.querySelectorAll('.t-dnav').forEach(b=>{
    b.style.background='rgba(255,255,255,.1)';
    b.style.color='rgba(255,255,255,.7)';
  });
  el.style.background='var(--g)';
  el.style.color='#fff';
  ['t-tab-classes','t-tab-notice','t-tab-routine','t-tab-attendance','t-tab-homework','t-tab-pin'].forEach(id=>{
    const el=$(id); if(el) el.style.display='none';
  });
  const tab=$(('t-tab-'+name));
  if(tab) tab.style.display='block';
  if(name==='notice') renderTeacherNotices();
  if(name==='routine') renderTeacherRoutinesTab();
  if(name==='attendance') renderTeacherAttendance();
  if(name==='homework'){ renderTeacherHomework(); }
}

function renderTeacherNotices(){
  const el=$('t-notices'); if(!el)return;
  const notices=window.appData.notices
    .filter(n=>n.class==='Teachers'||n.class==='All+Teachers'||n.class==='All')
    .sort((a,b)=>(b.createdAt?.toMillis?b.createdAt.toMillis():b.createdAt||0)-(a.createdAt?.toMillis?a.createdAt.toMillis():a.createdAt||0));
  window._tchNotices = notices;
  if(!notices.length){
    el.innerHTML='<div style="text-align:center;padding:24px;color:rgba(255,255,255,.3);font-size:13px">কোনো notice নেই।</div>';
    return;
  }
  el.innerHTML=notices.map((n,i)=>`
    <div onclick="openNoticeModal(${i},'tch')" style="background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);
      border-left:3px solid var(--g);border-radius:13px;padding:14px;margin-bottom:10px;cursor:pointer;transition:background .2s;">
      <div style="font-family:'Baloo 2',sans-serif;font-weight:700;font-size:15px;color:#fff;margin-bottom:5px;">🔔 ${n.title}</div>
      <div style="font-size:13px;color:rgba(255,255,255,.6);line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${n.body}</div>
      <div style="font-size:11px;color:rgba(255,255,255,.3);margin-top:8px;display:flex;justify-content:space-between;">
        <span>${fmtDate(n.createdAt)}</span>
        <span style="color:var(--g);font-weight:700;">পড়ুন →</span>
      </div>
    </div>`).join('');
}

function renderTeacherRoutinesTab(){
  const el=$('t-routines2'); if(!el)return;
  el.innerHTML=window.appData.teacherRoutines.map(r=>`
    <div class="trout-card" onclick="openLB('${dImg(r.url)}')">
      <img src="${dImg(r.url)}" alt="${r.title}" onerror="this.src='https://via.placeholder.com/400x200?text=Tap+to+View'"/>
      <div class="trout-info">
        <div><div class="trout-title">${r.title}</div><div class="trout-date">${fmtDate(r.createdAt)}</div></div>
        <a href="${r.url}" target="_blank" style="color:var(--g);font-size:12px;font-weight:700">Open</a>
      </div>
    </div>`).join('')||'<div style="text-align:center;padding:20px;color:rgba(255,255,255,.3);font-size:13px">No routine uploaded yet.</div>';
}

// ══════════════════════════════════════════════
//  ALARM SYSTEM
// ══════════════════════════════════════════════
window.appData.alarms = [];
let activeAlarmTimers = [];
let alarmAudio = null;
let alarmRingCount = 0;
let alarmInterval = null;
let currentAlarm = null;

// Alarm listener is now handled in the unified _setupListeners in the module script

// ── Add alarm from admin panel ──
async function addAlarm(){
  const teacher  = $('fa-teacher').value;
  const subject  = $('fa-subject').value.trim();
  const time     = $('fa-time').value;
  const day      = $('fa-day').value;
  const duration = parseInt($('fa-duration').value);
  const repeat   = parseInt($('fa-repeat').value);

  if(!teacher||!time||!subject){
    showToast('Teacher, Subject ও Time দিন!');return;
  }
  const btn = document.querySelector('#ap-alarms .badd');
  if(btn){btn.disabled=true;btn.textContent='⏳ Saving...';}
  try{
    const {collection,addDoc} = window._fb;
    await addDoc(collection(window._db,'alarms'),{
      teacher, subject, time, day,
      duration, repeat,
      active: true,
      createdAt: Date.now()
    });
    ['fa-subject','fa-time'].forEach(id=>$(id).value='');
    showToast(`✅ Alarm set! ${teacher} → ${fmt(time)}`);
  }catch(e){
    showToast('❌ '+e.message);
  }finally{
    if(btn){btn.disabled=false;btn.textContent='⏰ Set Alarm';}
  }
}

// ── Render alarms list in admin ──
window.renderAlarmsList = function renderAlarmsList(){
  const el = $('alarms-list'); if(!el)return;
  const ord = ['Saturday','Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Daily'];
  const sorted = [...window.appData.alarms].sort((a,b)=>
    ord.indexOf(a.day)-ord.indexOf(b.day)||a.time.localeCompare(b.time)
  );
  if(!sorted.length){
    el.innerHTML='<div class="empty"><div class="ei">⏰</div><p>No alarms set yet.</p></div>';return;
  }
  el.innerHTML = sorted.map(a=>`
    <div class="li" style="border-left:3px solid ${a.active?'var(--r)':'var(--muted)'}">
      <div style="font-size:22px;margin-right:4px;">${a.active?'🔔':'🔕'}</div>
      <div class="li-info">
        <div class="li-title">${a.teacher} — ${a.subject}</div>
        <div class="li-sub">
          ⏰ <strong>${fmt(a.time)}</strong> • 
          ${a.day} • 
          ${a.repeat===999?'Until dismissed':a.repeat+'x rings'} • 
          ${a.duration}s
        </div>
      </div>
      <button onclick="toggleAlarm('${a.id}',${!a.active})" style="padding:5px 10px;border:none;border-radius:8px;
        background:${a.active?'#e8f5e9':'#ffeaea'};color:${a.active?'#2e7d32':'var(--r)'};
        font-size:11px;font-weight:700;cursor:pointer;margin-right:5px">
        ${a.active?'ON ✅':'OFF ⛔'}
      </button>
      <button class="bdel" onclick="delDoc('alarms','${a.id}')">✕</button>
    </div>`).join('');
}

// ── Toggle alarm on/off ──
async function toggleAlarm(id, active){
  const {doc,updateDoc} = window._fb;
  await updateDoc(doc(window._db,'alarms',id),{active});
  showToast(active?'🔔 Alarm ON!':'🔕 Alarm OFF!');
}

// ── Schedule all alarms for today (called for teachers) ──
window.rescheduleAlarms = function rescheduleAlarms(){
  // Clear existing alarm timers
  activeAlarmTimers.forEach(clearTimeout);
  activeAlarmTimers = [];

  // Only schedule for teachers
  const role = window.curRole || curRole;
  const teacher = window.curTeacher || curTeacher;
  if(role !== 'teacher' || !teacher) return;

  const today = dayName();
  const now   = new Date();

  // Filter alarms for this teacher today (case-insensitive match)
  const myAlarms = window.appData.alarms.filter(a=>
    a.active &&
    a.teacher && a.teacher.trim().toLowerCase() === teacher.trim().toLowerCase() &&
    (a.day === today || a.day === 'Daily')
  );

  console.log(`⏰ rescheduleAlarms: teacher="${teacher}", today="${today}", total alarms=${window.appData.alarms.length}, my alarms=${myAlarms.length}`);
  window.appData.alarms.forEach(a=>console.log('  alarm:', a.teacher, a.day, a.time, a.active));

  myAlarms.forEach(alarm=>{
    const alarmTime = cdT(alarm.time);
    const delay     = alarmTime - now;

    if(delay > 0 && delay < 86400000){
      console.log(`⏰ Alarm scheduled: ${alarm.subject} at ${fmt(alarm.time)} (${Math.round(delay/60000)}min from now)`);
      const t = setTimeout(()=>triggerAlarm(alarm), delay);
      activeAlarmTimers.push(t);
    } else if(delay <= 0){
      console.log(`⏰ Alarm passed today: ${alarm.subject} at ${fmt(alarm.time)}`);
    }
  });

  if(myAlarms.length){
    showToast(`⏰ ${myAlarms.length} alarm(s) active for today!`);
  }
}

// ── Trigger alarm — ring + vibrate ──
function triggerAlarm(alarm){
  currentAlarm = alarm;
  alarmRingCount = 0;

  // Show full screen overlay
  $('alarm-teacher').textContent     = `👨‍🏫 ${alarm.teacher}`;
  $('alarm-subject').textContent     = `📚 ${alarm.subject}`;
  $('alarm-time-display').textContent= `⏰ Class Time: ${fmt(alarm.time)}`;
  $('alarm-overlay').style.display   = 'flex';

  // Start ringing
  ringAlarm(alarm);
}

function ringAlarm(alarm){
  const maxRings = alarm.repeat === 999 ? 999 : alarm.repeat;
  const duration = alarm.duration * 1000;

  function doRing(){
    if(alarmRingCount >= maxRings && maxRings !== 999){
      stopAlarmSound(); return;
    }
    alarmRingCount++;
    $('alarm-repeat-info').textContent =
      alarm.repeat===999 ? `🔔 Ringing until dismissed...`
      : `🔔 Ring ${alarmRingCount} of ${maxRings}`;

    // Vibrate pattern — strong, long vibration
    if('vibrate' in navigator){
      navigator.vibrate([
        500,200,500,200,500,200,
        1000,300,1000,300,1000,300,
        500,200,500,200,500
      ]);
    }

    // Play alarm sound using Web Audio API
    playAlarmSound(duration);

    // Schedule next ring
    if(alarmRingCount < maxRings || maxRings===999){
      alarmInterval = setTimeout(doRing, duration + 1000);
    }
  }

  doRing();
}

// ── Web Audio alarm sound (no file needed) ──
let audioCtx = null;

function playAlarmSound(durationMs){
  try{
    if(audioCtx) audioCtx.close();
    audioCtx = new (window.AudioContext||window.webkitAudioContext)();

    const duration = durationMs / 1000;
    const masterGain = audioCtx.createGain();
    masterGain.gain.value = 1.5;
    masterGain.connect(audioCtx.destination);

    // Play repeating beep pattern for duration
    const beepLength = 0.3;
    const beepGap    = 0.15;
    const totalBeeps = Math.floor(duration / (beepLength + beepGap));

    for(let i=0; i<totalBeeps; i++){
      const startTime = audioCtx.currentTime + i*(beepLength+beepGap);

      // High pitch beep
      const osc1 = audioCtx.createOscillator();
      const g1   = audioCtx.createGain();
      osc1.connect(g1); g1.connect(masterGain);
      osc1.frequency.value = 1200;
      osc1.type = 'square';
      g1.gain.setValueAtTime(0.8, startTime);
      g1.gain.exponentialRampToValueAtTime(0.01, startTime+beepLength);
      osc1.start(startTime);
      osc1.stop(startTime+beepLength);

      // Lower pitch beep (harmony)
      const osc2 = audioCtx.createOscillator();
      const g2   = audioCtx.createGain();
      osc2.connect(g2); g2.connect(masterGain);
      osc2.frequency.value = 900;
      osc2.type = 'square';
      g2.gain.setValueAtTime(0.4, startTime);
      g2.gain.exponentialRampToValueAtTime(0.01, startTime+beepLength);
      osc2.start(startTime+0.05);
      osc2.stop(startTime+beepLength);
    }
  }catch(e){
    console.log('Audio error:', e);
  }
}

function stopAlarmSound(){
  try{ if(audioCtx){ audioCtx.close(); audioCtx=null; } }catch(e){}
  if(alarmInterval){ clearTimeout(alarmInterval); alarmInterval=null; }
  if('vibrate' in navigator) navigator.vibrate(0);
}

function dismissAlarm(){
  stopAlarmSound();
  $('alarm-overlay').style.display='none';
  alarmRingCount = 0;
  currentAlarm   = null;
  showToast('✅ Alarm dismissed!');
}

// ── Populate teacher dropdown in alarms panel ──
function populateAlarmTeacherSelect(){
  const sel = $('fa-teacher'); if(!sel)return;
  sel.innerHTML='<option value="">-- Select Teacher --</option>';
  window.appData.teachers.forEach(t=>{
    const o=document.createElement('option');
    o.value=t.name; o.textContent=t.name;
    sel.appendChild(o);
  });
}

// ══════════════════════════════════════════════
// ══ MISC ══
document.getElementById('r-class').addEventListener('change',function(){
  const needs=['Class 6','Class 7','Class 8','Class 9','Class 10'].includes(this.value);
  $('r-group').style.display=needs?'block':'none';
});

function backToLogin(){
  showScr('s-login');
}

// ══ PDF VIEWER (view only, no download) ══

// ── Auto-open dashboard when admin panel first shows ──────────────────────
window._adminDashboardOpened = false;
window._openAdminDashboard = function(){
  if(window._adminDashboardOpened) return;
  window._adminDashboardOpened = true;
  const btn = document.getElementById('atab-dashboard');
  if(btn) { btn.click(); }
  else { setTimeout(window._openAdminDashboard, 500); }
};
