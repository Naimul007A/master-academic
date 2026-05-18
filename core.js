// ══ CONFIG ══
const DRIVE_API_URL = 'https://script.google.com/macros/s/AKfycbzLTZSOn3VeIclwwsYBiDtoIzooMUyfO_vLBaidwbHmHhLGjrq9N6AyGRSYFZ0MohO-/exec';

// ── WHATSAPP CONFIG ─────────────────────────────────────────────────────────
// Fill these in once you provide the WhatsApp integration details.
// Leave as empty string '' until configured.
const WA_API_URL        = 'https://api.fonnte.com/send'; // Fonnte endpoint
const WA_API_KEY        = 'DgCfu9bXWfiSq6Znn7L8'; // Fonnte API Token
const WA_STUDENT_GROUP  = '120363407142025544@g.us'; // Students WhatsApp Group
const WA_TEACHER_GROUP  = '120363405917387270@g.us'; // Teachers WhatsApp Group
// ─────────────────────────────────────────────────────────────────────────────
const VAPID_KEY = 'BHJ5SWwXoMfzsL39aHTjdFeYg3QklMR2twMnA_qb4kbWnSiQ43lHMgQJShPAAJEoV_7KDa3rpo6LogDRIC2lTes';

// ══ STATE ══
window.appData={teachers:[],classes:[],notices:[],routines:[],results:[],sheets:[],students:[],teacherRoutines:[],presence:[],attendance:[],homework:[],teacherAttendance:[],holidays:[],examTimetable:[],leaderboard:[],dueNotifications:[],fees:[],expenses:[]};
let curRole='admin', curTeacher=null, curStudent=null;
// Expose curRole for module access
Object.defineProperty(window,'curRole',{get:()=>curRole,set:v=>{curRole=v;}});
let remTimers=[], cdInt=null;

// ══ HELPERS ══
const $=id=>document.getElementById(id);
const dayName=()=>['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
const fmt=t=>{const[h,m]=t.split(':').map(Number);return`${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;};
const cdT=t=>{const[h,m]=t.split(':').map(Number),d=new Date();d.setHours(h,m,0,0);return d;};
const fmtDate=ts=>{if(!ts)return'';const d=ts.toDate?ts.toDate():new Date(ts);return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});};
const fmtLastSeen=ts=>{if(!ts)return'Never';const diff=Date.now()-ts;if(diff<60000)return'Just now';if(diff<3600000)return Math.floor(diff/60000)+'m ago';if(diff<86400000)return Math.floor(diff/3600000)+'h ago';return Math.floor(diff/86400000)+'d ago';};
const showToast=msg=>{const t=$('toast');if(!t){console.warn('Toast not found:',msg);return;}t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3500);};
const startClk=id=>{const el=$(id);if(!el)return;setInterval(()=>{if($(id))$(id).textContent=new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'});},1000);};
const getFileId=url=>{const ps=[/[?&]id=([a-zA-Z0-9_-]+)/,/\/d\/([a-zA-Z0-9_-]+)/];for(const p of ps){const m=url.match(p);if(m)return m[1];}return null;};
const dThumb=url=>{const id=getFileId(url);return id?`https://drive.google.com/thumbnail?id=${id}&sz=w200`:url;};
const dImg=url=>{const id=getFileId(url);return id?`https://drive.google.com/thumbnail?id=${id}&sz=w1000`:url;};

// ══ SESSION ══
window.restoreSession=async function(){
  try{
    const role=localStorage.getItem('maac_role');
    const data=localStorage.getItem('maac_data');
    if(!role||!data)return;
    const parsed=JSON.parse(data);
    await new Promise(r=>setTimeout(r,900));
    if(role==='teacher'&&parsed.teacher){
      // If teachers not yet loaded from Firestore, fetch them now
      if(!window.appData.teachers||!window.appData.teachers.length){
        try{
          if(window._fb&&window._db){
            const {getDocs,collection}=window._fb;
            const snap=await getDocs(collection(window._db,'teachers'));
            window.appData.teachers=snap.docs.map(d=>({id:d.id,...d.data()}));
          }
        }catch(_){}
      }
      const liveTeachers=window.appData.teachers||[];
      const liveT=liveTeachers.find(t=>t.name===parsed.teacher);
      if(liveT && liveT.pinVersion && parsed.pinVersion !== liveT.pinVersion){
        localStorage.removeItem('maac_role');
        localStorage.removeItem('maac_data');
        showToast('🔑 PIN পরিবর্তন হয়েছে। অনুগ্রহ করে নতুন PIN দিয়ে লগইন করুন।');
        return;
      }
      curTeacher=parsed.teacher;
      // Use live role first, then saved role — NEVER default to 'teacher' if saved role is manager/chairman
      const teacherRole=liveT?.role||parsed.role||'teacher';
      if(teacherRole==='manager'||teacherRole==='chairman') showManager(teacherRole); else showTeacher();
    } else if(role==='student'&&parsed.student){
      curStudent=parsed.student; showStudent();
    }
  }catch(e){localStorage.removeItem('maac_role');localStorage.removeItem('maac_data');}
};

// ══ ROLE SELECT ══
function setRole(role,el){
  curRole=role;
  document.querySelectorAll('.rtab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  ['lf-admin','lf-teacher','lf-student'].forEach(id=>$(id).style.display='none');
  $(`lf-${role}`).style.display='block';
  // Update login button text based on role
  $('lbtn').textContent = role==='admin'?'প্রবেশ করুন →':role==='teacher'?'Teacher Login →':'প্রবেশ করুন →';
  if(role==='teacher') loadTeacherDrop();
}

// ── SHA-256 helper (Web Crypto, built-in, zero cost) ──
async function sha256(str){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

async function _waitForFirebase(timeoutMs){
  if(window._fb && window._db) return true;
  if(window._fbFailed) return false;
  return new Promise(resolve=>{
    let done=false;
    const cleanup=()=>{ window.removeEventListener('firebase-ready',onReady); window.removeEventListener('firebase-failed',onFail); };
    const finish=(ok)=>{ if(done) return; done=true; cleanup(); resolve(ok); };
    const onReady=()=>finish(!!(window._fb&&window._db));
    const onFail =()=>finish(false);
    window.addEventListener('firebase-ready', onReady);
    window.addEventListener('firebase-failed', onFail);
    const start=Date.now();
    (function poll(){
      if(window._fb && window._db) return finish(true);
      if(window._fbFailed) return finish(false);
      if(Date.now()-start >= timeoutMs) return finish(false);
      setTimeout(poll, 200);
    })();
  });
}

async function loadTeacherDrop(){
  const sel=$('l-teacher');
  if(!sel) return;
  sel.innerHTML='<option>⏳ Loading teachers…</option>';
  // Wait up to 30s for Firebase ES module (slow network / CDN)
  const ok = await _waitForFirebase(30000);
  if(!ok){
    sel.innerHTML='<option value="">⚠️ Network slow — tap to retry</option>';
    sel.onclick = ()=>{ sel.onclick=null; loadTeacherDrop(); };
    return;
  }
  sel.onclick = null;
  // Start real-time listeners now so appData.teachers is live for login
  window._setupListeners&&window._setupListeners();
  try{
    let teachers = (window.appData&&window.appData.teachers)||[];
    if(!teachers.length){
      const {getDocs,collection}=window._fb;
      const snap=await getDocs(collection(window._db,'teachers'));
      teachers=snap.docs.map(d=>({id:d.id,...d.data()}));
      if(window.appData) window.appData.teachers=teachers;
    }
    const sorted=[...teachers].sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    sel.innerHTML='<option value="">-- আপনার নাম বেছে নিন --</option>';
    if(!sorted.length){sel.innerHTML+='<option disabled>No teachers added yet</option>';return;}
    sorted.forEach(t=>{const o=document.createElement('option');o.value=t.name;o.textContent=t.name;sel.appendChild(o);});
    $('lf-teacher-pin').style.display='none';
    $('l-teacher-pin').value='';
  }catch(e){
    console.error('loadTeacherDrop error:',e);
    sel.innerHTML='<option value="">❌ Error loading. Tap to retry</option>';
    sel.onclick = ()=>{ sel.onclick=null; loadTeacherDrop(); };
  }
}

// Show PIN field once a teacher is selected
function onTeacherSelect(){
  const t=$('l-teacher').value;
  const pinWrap=$('lf-teacher-pin');
  if(t){
    pinWrap.style.display='block';
    $('l-teacher-pin').focus();
  } else {
    pinWrap.style.display='none';
    $('l-teacher-pin').value='';
  }
}

// ── ADMIN: Reset a teacher's PIN ──
async function adminResetPin(teacherId, teacherName){
  const pin = prompt(`Reset PIN for "${teacherName}"\n\nEnter new PIN (4–8 digits):`);
  if(pin===null) return; // cancelled
  if(!/^[0-9]{4,8}$/.test(pin)){
    showToast('❌ PIN must be 4–8 digits only!');
    return;
  }
  const confirm2 = prompt('Confirm new PIN:');
  if(confirm2!==pin){showToast('❌ PINs do not match!');return;}
  try{
    const hash = await sha256(pin);
    const {doc,updateDoc}=window._fb;
    // pinVersion timestamp ensures any active session is invalidated after reset
    await updateDoc(doc(window._db,'teachers',teacherId),{
      pinHash: hash,
      pinVersion: Date.now(),
      pinChangedAfterReset: false
    });
    showToast('✅ '+teacherName+' এর PIN reset হয়েছে! Teacher must log in with new PIN.');
  }catch(e){
    showToast('❌ Error: '+e.message);
  }
}

// ── TEACHER: Set own PIN from teacher dashboard ──
async function teacherSetPin(){
  const cur=$('t-pin-cur').value.trim();
  const nw=$('t-pin-new').value.trim();
  const cf=$('t-pin-cf').value.trim();
  if(!nw||!cf){showToast('নতুন PIN দিন!');return;}
  if(!/^[0-9]{4,8}$/.test(nw)){showToast('❌ PIN must be 4–8 digits!');return;}
  if(nw!==cf){showToast('❌ PIN match করেনি!');return;}

  const teacher = window.appData.teachers.find(x=>x.name===curTeacher);
  if(!teacher){showToast('❌ Teacher data পাওয়া যায়নি!');return;}

  // If PIN already set, verify current first
  if(teacher.pinHash){
    if(!cur){showToast('বর্তমান PIN দিন!');return;}
    const curHash = await sha256(cur);
    if(curHash!==teacher.pinHash){showToast('❌ বর্তমান PIN ভুল!');return;}
  }

  const newHash = await sha256(nw);
  const {doc,updateDoc}=window._fb;
  // Save new PIN, update pinVersion so any old reset is invalidated
  const newVersion = Date.now();
  await updateDoc(doc(window._db,'teachers',teacher.id),{
    pinHash: newHash,
    pinVersion: newVersion,
    pinChangedAfterReset: true
  });
  // Update local session with new pinVersion so session restore works
  try{
    const saved = JSON.parse(localStorage.getItem('maac_data')||'{}');
    saved.pinVersion = newVersion;
    localStorage.setItem('maac_data', JSON.stringify(saved));
  }catch(e){}
  $('t-pin-cur').value='';$('t-pin-new').value='';$('t-pin-cf').value='';
  showToast('✅ PIN সফলভাবে ' + (teacher.pinHash?'পরিবর্তন':'সেট') + ' হয়েছে!');
}

function toggleReg(show){
  $('lfs-login').style.display=show?'none':'block';
  $('lfs-reg').style.display=show?'block':'none';
  $('lbtn').textContent=show?'Register করুন →':'প্রবেশ করুন →';
}

// ══ LOGIN ══
async function doLogin(){
  const btn=$('lbtn');
  if(!btn){console.error('Login button not found');return;}
  btn.disabled=true; btn.textContent='⏳ Loading...';
  try{
    if(curRole==='admin'){
      const email=$('l-email').value.trim(), pass=$('l-pass').value;
      if(!email||!pass){showToast('Email ও Password দিন!');return;}
      await Promise.race([
        (async()=>{
          const cred=await window._fb.signInWithEmailAndPassword(window._auth,email,pass);
          if(cred&&cred.user) showAdmin();
        })(),
        new Promise((_,rej)=>setTimeout(()=>rej(new Error('Timeout — please try again!')),12000))
      ]);
    } else if(curRole==='teacher'){
      const t=$('l-teacher').value;
      if(!t){showToast('আপনার নাম বেছে নিন!');return;}
      const pin=$('l-teacher-pin').value.trim();
      if(!pin){showToast('PIN দিন!');return;}
      // Wait for teachers data if not yet loaded (e.g. fresh page load)
      let retries=0;
      while(!window.appData.teachers.length && retries<20){
        await new Promise(r=>setTimeout(r,300));
        retries++;
      }
      // Verify PIN against Firestore hash (zero-cost: single getDoc)
      const teacher = window.appData.teachers.find(x=>x.name===t);
      if(!teacher){
        // Try fetching directly from Firestore as fallback
        try{
          const {getDocs,collection}=window._fb;
          const snap=await getDocs(collection(window._db,'teachers'));
          window.appData.teachers=snap.docs.map(d=>({id:d.id,...d.data()}));
          const t2=window.appData.teachers.find(x=>x.name===t);
          if(!t2){showToast('❌ Teacher data লোড হয়নি। আবার চেষ্টা করুন।');return;}
          if(!t2.pinHash){showToast('❌ PIN সেট নেই। Admin-কে বলুন Reset PIN করতে।');return;}
          const pinHash2=await sha256(pin);
          if(pinHash2!==t2.pinHash){showToast('❌ ভুল PIN!');return;}
          curTeacher=t;
          localStorage.setItem('maac_role','teacher'); // guard before anon auth fires onAuthStateChanged
          try{await window._fb.signInAnonymously(window._auth);}catch(_){}
          if(t2.role==='manager'||t2.role==='chairman') showManager(t2.role); else showTeacher();
          return;
        }catch(fe){showToast('❌ Teacher data লোড হয়নি। আবার চেষ্টা করুন।');return;}
      }
      if(!teacher.pinHash){
        showToast('❌ PIN সেট নেই। Admin-কে বলুন Reset PIN করতে।');return;
      }
      const pinHash = await sha256(pin);
      if(pinHash !== teacher.pinHash){showToast('❌ ভুল PIN!');return;}
      curTeacher=t;
      localStorage.setItem('maac_role','teacher'); // guard before anon auth fires onAuthStateChanged
      try{await window._fb.signInAnonymously(window._auth);}catch(_){}
      if(teacher.role==='manager'||teacher.role==='chairman') showManager(teacher.role); else showTeacher();
      return;
    } else {
      if($('lfs-reg').style.display==='block') await registerStudent();
      else await loginStudent();
    }
  }catch(e){
    const m=e.code==='auth/invalid-credential'?'❌ Email বা Password ভুল!'
      :e.code==='auth/wrong-password'?'❌ Wrong password!'
      :e.code==='auth/user-not-found'?'❌ Email not found!'
      :e.code==='auth/invalid-email'?'❌ Invalid email!'
      :e.code==='auth/too-many-requests'?'❌ Too many attempts! Wait a few minutes.'
      :e.code==='auth/network-request-failed'?'❌ No internet connection!'
      :e.code==='auth/user-disabled'?'❌ This account has been disabled!'
      :'❌ '+(e.message||'Login failed');
    try{showToast(m);}catch(_){}
  }finally{btn.disabled=false;if(curRole==='teacher')btn.textContent='Teacher Login →';else if(curRole==='student'&&$("lfs-reg").style.display==='block')btn.textContent='Register করুন →';else btn.textContent='প্রবেশ করুন →';}
}

async function registerStudent(){
  const name=$('r-name').value.trim(),phone=$('r-phone').value.trim(),
        cls=$('r-class').value,grp=$('r-group').value||'';
  if(!name||!phone||!cls){showToast('সব তথ্য দিন!');return;}
  const {doc,setDoc,getDoc,collection,addDoc,query,where,getDocs}=window._fb;
  // Check if already pending (one pending per phone is fine)
  const pendSnap=await getDoc(window._fb.doc(window._db,'pending',phone));
  if(pendSnap.exists()){
    showToast('⏳ আপনার request আগেই পাঠানো হয়েছে। Admin approval এর জন্য অপেক্ষা করুন।');return;
  }
  // Save as pending (siblings allowed — phone is not unique in students)
  await setDoc(window._fb.doc(window._db,'pending',phone),{
    name,phone,class:cls,group:grp,status:'pending',createdAt:Date.now()
  });
  // Show waiting message
  showScr('s-pending');
  $('pend-name').textContent=name;
  $('pend-class').textContent=cls;
  showToast('✅ Request পাঠানো হয়েছে! Admin approval এর জন্য অপেক্ষা করুন।');
}

async function loginStudent(){
  const phone=$('l-phone').value.trim();
  if(!phone){showToast('Phone number দিন!');return;}
  const {collection,query,where,getDocs,doc,getDoc}=window._fb;
  // Query approved students by phone (allows siblings with same phone)
  const stuQ=query(collection(window._db,'students'),where('phone','==',phone));
  const stuSnap=await getDocs(stuQ);
  if(!stuSnap.empty){
    const docSnap=stuSnap.docs[0];
    curStudent={id:docSnap.id,...docSnap.data()};
    showStudent();return;
  }
  // Check pending
  const pendSnap=await getDoc(window._fb.doc(window._db,'pending',phone));
  if(pendSnap.exists()){
    const d=pendSnap.data();
    showScr('s-pending');
    $('pend-name').textContent=d.name;
    $('pend-class').textContent=d.class;
    showToast('⏳ আপনার account এখনো approve হয়নি।');return;
  }
  showToast('Account নেই! Register করুন।');toggleReg(true);
}

function doLogout(){
  remTimers.forEach(clearTimeout);remTimers=[];
  clearInterval(cdInt);cdInt=null;
  clearInterval(window._presenceInterval);
  // Mark offline before logout
  if(window._presenceId&&window._fb&&window._db){
    try{window._fb.updateDoc(window._fb.doc(window._db,'presence',window._presenceId),{online:false,lastSeen:Date.now()});}catch(e){}
  }
  localStorage.removeItem('maac_role');
  localStorage.removeItem('maac_data');
  try{window._fb.signOut(window._auth);}catch(e){}
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  $('s-login').classList.add('active');
  curTeacher=null;curStudent=null;window._presenceId=null;
}

