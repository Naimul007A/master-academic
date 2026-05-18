// Multi-CDN loader — gstatic is sometimes blocked inside preview iframes (CSP/network).
// Falls back to esm.sh and jsdelivr so Firebase still initialises.
const FB_CDNS = [
  { app:'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js',
    fs: 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js',
    au: 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js' },
  { app:'https://esm.sh/firebase@10.12.0/app',
    fs: 'https://esm.sh/firebase@10.12.0/firestore',
    au: 'https://esm.sh/firebase@10.12.0/auth' },
  { app:'https://cdn.jsdelivr.net/npm/firebase@10.12.0/app/+esm',
    fs: 'https://cdn.jsdelivr.net/npm/firebase@10.12.0/firestore/+esm',
    au: 'https://cdn.jsdelivr.net/npm/firebase@10.12.0/auth/+esm' }
];
async function _loadFirebaseModules(){
  let lastErr;
  for(const cdn of FB_CDNS){
    try{
      const [a,f,u] = await Promise.all([import(cdn.app), import(cdn.fs), import(cdn.au)]);
      console.log('[FB] loaded via', cdn.app);
      return {a,f,u};
    }catch(e){ console.warn('[FB] CDN failed', cdn.app, e?.message||e); lastErr=e; }
  }
  throw lastErr || new Error('All Firebase CDNs failed');
}

let initializeApp, getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, query, where, orderBy,
    setDoc, getDoc, getDocs, serverTimestamp, updateDoc,
    getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, signInAnonymously;
try{
  const {a,f,u} = await _loadFirebaseModules();
  ({ initializeApp } = a);
  ({ getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, query, where, orderBy,
     setDoc, getDoc, getDocs, serverTimestamp, updateDoc } = f);
  ({ getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, signInAnonymously } = u);
}catch(e){
  console.error('[FB] all CDNs failed', e);
  window._fbFailed = true;
  try{ window.dispatchEvent(new Event('firebase-failed')); }catch(_){}
  throw e;
}

const firebaseConfig = {
  apiKey:"AIzaSyD4TiBqoT2r373fsfqMBAxQ29ua1IZlPwQ",
  authDomain:"master-eda5d.firebaseapp.com",
  projectId:"master-eda5d",
  storageBucket:"master-eda5d.firebasestorage.app",
  messagingSenderId:"343735612179",
  appId:"1:343735612179:web:2eed5a03e4d578f43d20e6"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
const auth= getAuth(app);
window._db=db; window._auth=auth; window._firebaseApp=app;
window._fb={ collection,addDoc,onSnapshot,deleteDoc,doc,query,where,orderBy,
  setDoc,getDoc,getDocs,serverTimestamp,updateDoc,
  signInWithEmailAndPassword,signOut,onAuthStateChanged,signInAnonymously };
window._fbReady = true;
try{ window.dispatchEvent(new Event('firebase-ready')); }catch(_){}

// Auth state - restore admin
onAuthStateChanged(auth, user=>{
  if(user){
    const s=localStorage.getItem('maac_role');
    if(!s||s==='admin'){
      const scr=document.querySelector('.screen.active');
      if(scr&&scr.id==='s-login') window.showAdmin&&window.showAdmin();
    }
  }
});

// Setup real-time Firestore listeners — runs ONCE, guarded by flag
let _listenersStarted = false;
window._setupListeners = ()=>{
  if(_listenersStarted) return; // prevent duplicate listeners on repeated calls
  _listenersStarted = true;

  const snap=(col,key,ord)=>{
    let q;
    try{ q=ord?query(collection(db,col),orderBy(ord,'asc')):collection(db,col); }
    catch(e){ q=collection(db,col); }
    onSnapshot(q,s=>{
      window.appData[key]=s.docs.map(d=>({id:d.id,...d.data()}));
      window.refreshAll&&window.refreshAll();
    },err=>{
      console.warn('Snapshot error for',col,err.message);
      onSnapshot(collection(db,col),s=>{
        window.appData[key]=s.docs.map(d=>({id:d.id,...d.data()}));
        window.refreshAll&&window.refreshAll();
      });
    });
  };

  // Core data collections
  snap('teachers','teachers');
  snap('classes','classes','createdAt');
  snap('routines','routines');
  snap('results','results');
  snap('sheets','sheets');
  snap('teacherRoutines','teacherRoutines');

  // ── NOTICES — single listener with in-app banner hook ──
  // (replaces the former snap('notices') + a second onSnapshot — was double-billing reads)
  let _noticeInited = false;
  onSnapshot(collection(db,'notices'), s => {
    const prev = (window.appData.notices||[]).length;
    window.appData.notices = s.docs.map(d=>({id:d.id,...d.data()}));
    // After first load, show banner only for genuinely new notices
    if(_noticeInited && window.appData.notices.length > prev){
      const newest = [...window.appData.notices]
        .sort((a,b)=>(b.createdAt?.toMillis?b.createdAt.toMillis():b.createdAt||0)
                    -(a.createdAt?.toMillis?a.createdAt.toMillis():a.createdAt||0))[0];
      if(newest) window.showInappNotif&&window.showInappNotif(newest);
    }
    _noticeInited = true;
    window.refreshAll&&window.refreshAll();
  }, err=>{
    console.warn('Notices snapshot error:',err.message);
    // Fallback without order on error
    onSnapshot(collection(db,'notices'), s=>{
      window.appData.notices = s.docs.map(d=>({id:d.id,...d.data()}));
      window.refreshAll&&window.refreshAll();
    });
  });

  // Attendance & Homework
  snap('attendance','attendance');
  snap('homework','homework');
  snap('teacherAttendance','teacherAttendance');
  snap('holidays','holidays');
  snap('examTimetable','examTimetable');
  snap('leaderboard','leaderboard');
  snap('dueNotifications','dueNotifications');
  snap('fees','fees');
  snap('expenses','expenses');

  // Students
  onSnapshot(collection(db,'students'),s=>{
    window.appData.students=s.docs.map(d=>({id:d.id,...d.data()}));
    window.refreshAll&&window.refreshAll();
  });

  // ── ALARMS ──
  onSnapshot(collection(db,'alarms'),snap=>{
    window.appData.alarms=snap.docs.map(d=>({id:d.id,...d.data()}));
    if(window.renderAlarmsList) window.renderAlarmsList();
    if(window.rescheduleAlarms && window.curRole==='teacher') window.rescheduleAlarms();
  },err=>console.warn('Alarm listener error:',err.message));

  // ── PENDING STUDENTS ──
  onSnapshot(collection(db,'pending'),snap=>{
    window.appData.pending=snap.docs.map(d=>({id:d.id,...d.data()}));
    if(window.renderPendingList) window.renderPendingList();
  });

  // ── PRESENCE (online status + live visitor count) ──
  // Replaces separate visitors collection — one listener does both jobs.
  onSnapshot(collection(db,'presence'),snap=>{
    window.appData.presence=snap.docs.map(d=>({id:d.id,...d.data()}));
    if(window.renderStats) window.renderStats();
    if(window.renderTeachersTable) window.renderTeachersTable();
    if(window.renderStudentsTable) window.renderStudentsTable();
  });

  // ── LIVE VISITORS — derived from presence, zero extra reads ──
  // Count is updated automatically whenever the presence snapshot fires.
  // The visitors Firestore collection is no longer needed.
};
window.addEventListener('load',()=>setTimeout(window.restoreSession,600));

// ── PRESENCE: update online status every 20s, remove on unload ──
window._updatePresence = async function(role, userId, extraData){
  if(!window._db) return;
  try{
    const presenceData = {
      role, userId,
      name: extraData.name||userId,
      class: extraData.class||'',
      online: true,
      lastSeen: Date.now(),
      userAgent: navigator.userAgent.substring(0,80)
    };
    await setDoc(doc(db,'presence',userId),presenceData,{merge:true});
    window._presenceId = userId;
    window._presenceRole = role;
    // Heartbeat every 20 seconds for reliable online detection
    clearInterval(window._presenceInterval);
    window._presenceInterval = setInterval(async()=>{
      try{ await updateDoc(doc(db,'presence',userId),{lastSeen:Date.now(),online:true}); }catch(e){}
    },20000);
  }catch(e){ console.warn('Presence update error:',e.message); }
};

// ── VISITOR COUNTER (removed) ──
// Live visitor count now derived from the existing presence snapshot — zero extra reads.
// The visitors Firestore collection is no longer needed and can be deleted from console.

// Mark offline on page unload
window.addEventListener('beforeunload',()=>{
  if(window._presenceId && window._db){
    // Use sendBeacon for reliable offline marking
    try{
      const {doc:d2, updateDoc:u2} = window._fb||{};
      if(u2) u2(d2(db,'presence',window._presenceId),{online:false,lastSeen:Date.now()});
    }catch(e){}
  }
  // visitors collection removed (Fix #7) — presence offline is handled above
});

// _trackVisitor load listener removed (Fix #7)
