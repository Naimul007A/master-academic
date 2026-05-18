// ══ FCM NOTIFICATION SETUP ══════════════════════════════════════════════════
// Uses Firebase compat SDK via importScripts in firebase-messaging-sw.js.
// The compat SDK is the only approach that works reliably on Android Chrome
// for background push — ES module dynamic import does NOT work in SW context.

// Internal: load FCM compat SDK once and cache the messaging instance
window._fcmMessaging = null;
async function _getFCMMessaging(){
  if(window._fcmMessaging) return window._fcmMessaging;
  // Load firebase compat scripts into the page context
  // These are CDN-hosted, always available, no cost
  await _loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
  await _loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');
  // Init compat app only if not already done
  if(!firebase.apps.length){
    firebase.initializeApp({
      apiKey:            'AIzaSyD4TiBqoT2r373fsfqMBAxQ29ua1IZlPwQ',
      authDomain:        'master-eda5d.firebaseapp.com',
      projectId:         'master-eda5d',
      storageBucket:     'master-eda5d.firebasestorage.app',
      messagingSenderId: '343735612179',
      appId:             '1:343735612179:web:2eed5a03e4d578f43d20e6'
    });
  }
  window._fcmMessaging = firebase.messaging();
  return window._fcmMessaging;
}

function _loadScript(src){
  return new Promise((resolve, reject) => {
    if(document.querySelector(`script[src="${src}"]`)){ resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load: ' + src));
    document.head.appendChild(s);
  });
}

async function registerFCMToken(){
  // Guard: needs HTTPS + SW + Push support
  if(!('serviceWorker' in navigator) || !('PushManager' in window)){
    console.log('[FCM] Push not supported'); return;
  }
  if(!('Notification' in window)){
    console.log('[FCM] Notification API unavailable'); return;
  }

  // ── Step 1: Notification permission ──────────────────────────────────────
  let permission = Notification.permission;
  if(permission === 'denied'){
    showToast('🔕 Notification blocked! Browser Settings → Site Settings → Notifications → Allow করুন।');
    return;
  }
  if(permission !== 'granted'){
    try{
      permission = await Notification.requestPermission();
    }catch(e){
      permission = await new Promise(r => Notification.requestPermission(r));
    }
  }
  if(permission !== 'granted'){
    showToast('⚠️ Notification allow করুন!');
    return;
  }

  // ── Step 2: Ensure firebase-messaging-sw.js is registered ────────────────
  // This MUST be registered separately from sw.js.
  // FCM looks for it specifically by name to handle background push.
  let messagingSWReg = null;
  try{
    const regs = await navigator.serviceWorker.getRegistrations();
    messagingSWReg = regs.find(r => r.active?.scriptURL?.includes('firebase-messaging-sw.js'));
    if(!messagingSWReg){
      messagingSWReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {scope: '/'});
      console.log('[FCM] firebase-messaging-sw.js registered');
    }
    // Wait for it to be active
    await new Promise(resolve => {
      if(messagingSWReg.active){ resolve(); return; }
      messagingSWReg.addEventListener('updatefound', () => {
        const sw = messagingSWReg.installing;
        sw.addEventListener('statechange', () => {
          if(sw.state === 'activated') resolve();
        });
      });
      setTimeout(resolve, 5000); // safety timeout
    });
  }catch(err){
    console.error('[FCM] Could not register firebase-messaging-sw.js:', err.message);
  }

  // ── Step 3: Persistent storage (Android battery saver prevention) ─────────
  if(navigator.storage?.persist){
    try{ await navigator.storage.persist(); }catch(e){}
  }

  // ── Step 4: Get FCM token using compat SDK + messaging SW ─────────────────
  try{
    const messaging = await _getFCMMessaging();

    // Check if we already have a valid saved token for this device
    // (avoids re-writing to Firestore on every login)
    const cachedToken = localStorage.getItem('maac_fcm_token');

    let token = null;
    for(let attempt = 1; attempt <= 3; attempt++){
      try{
        token = await messaging.getToken({
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: messagingSWReg
        });
        if(token) break;
      }catch(err){
        console.warn(`[FCM] getToken attempt ${attempt}/3:`, err.message);
        if(attempt < 3) await new Promise(r => setTimeout(r, attempt * 2000));
      }
    }

    if(!token){
      showToast('❌ Notification token পাওয়া যায়নি। Internet check করুন ও reload করুন।');
      return;
    }

    // Only write to Firestore if token changed (saves reads/writes)
    if(token !== cachedToken){
      const {doc, setDoc} = window._fb;
      await setDoc(doc(window._db, 'fcmTokens', token), {
        token,
        phone:     curStudent?.phone || curTeacher || 'unknown',
        name:      curStudent?.name  || curTeacher || 'unknown',
        class:     curStudent?.class || 'teacher',
        role:      curStudent ? 'student' : 'teacher',
        platform:  /Android/i.test(navigator.userAgent) ? 'android'
                 : /iPhone|iPad/i.test(navigator.userAgent) ? 'ios' : 'web',
        userAgent: navigator.userAgent.substring(0, 120),
        updatedAt: Date.now()
      }, {merge: true});
      localStorage.setItem('maac_fcm_token', token);
      console.log('[FCM] ✅ Token saved:', token.substring(0,24)+'...');
      showToast('✅ Notifications চালু হয়েছে!');
    } else {
      console.log('[FCM] Token unchanged — skipping Firestore write');
    }

    // ── Step 5: Handle foreground messages ────────────────────────────────
    // (background is handled entirely by firebase-messaging-sw.js)
    messaging.onMessage(payload => {
      const n = payload.notification || payload.data || {};
      const title = n.title || 'Master Academic';
      const body  = n.body  || 'নতুন আপডেট আছে!';
      // Show in-app toast — the SW won't show a system notification when app is open
      showToast('🔔 ' + title + ': ' + body);
    });

    // ── Step 6: Wake Lock ─────────────────────────────────────────────────
    if('wakeLock' in navigator){
      try{
        window._wakeLock = await navigator.wakeLock.request('screen');
        document.addEventListener('visibilitychange', async() => {
          if(document.visibilityState === 'visible'){
            try{ window._wakeLock = await navigator.wakeLock.request('screen'); }catch(e){}
          }
        }, {passive: true});
      }catch(e){ console.log('[FCM] WakeLock:', e.message); }
    }

  }catch(e){
    console.error('[FCM] Registration failed:', e.message);
    showToast('⚠️ Notification setup error: ' + e.message);
  }
}

function showScr(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  $(id).classList.add('active');
}

