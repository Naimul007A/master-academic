// ══════════════════════════════════════════════════════════
//  MASTER ACADEMIC — SW UPDATE MANAGER  (v4 — version-gated, loop-proof)
//
//  HOW IT WORKS:
//    • On page load the ACTIVE controller is queried for its version
//      and that is stamped into localStorage (maac_sw_ver) immediately.
//      This is the critical fix — without it VER_KEY stays '' forever
//      and every waiting SW looks "new", causing infinite update loops.
//
//    • When a waiting SW is found, its version is queried and compared
//      to the stamped version. ONLY a genuinely different version shows
//      the "Update Now" banner.
//
//    • "Update Now" → _skipSent = true → skipWaiting → controllerchange
//      → single reload. That's it. ONE reload, never more.
//
//    • controllerchange reloads ONLY when _skipSent is true (we triggered
//      it). Background claim() on first install is ignored — no surprise
//      reloads, no loop.
//
//  localStorage key:
//    maac_sw_ver  — CACHE_VERSION of the currently active SW
// ══════════════════════════════════════════════════════════
(function(){
  if(!('serviceWorker' in navigator)) return;

  const VER_KEY = 'maac_sw_ver';

  let _waitingWorker = null;   // SW currently in 'waiting' state
  let _pendingVer    = null;   // version string reported by waiting SW
  let _skipSent      = false;  // true ONLY when THIS page sent SKIP_WAITING

  // ── localStorage helpers ──────────────────────────────
  const ls = {
    get: k     => { try{ return localStorage.getItem(k)||''; }catch(e){ return ''; } },
    set: (k,v) => { try{ localStorage.setItem(k,v); }catch(e){} }
  };

  // ── Query any SW for its CACHE_VERSION via private MessageChannel ──
  // Returns Promise<string|null>. Null = timeout (3 s) or no reply.
  function getWorkerVersion(worker){
    return new Promise(resolve => {
      const mc    = new MessageChannel();
      const timer = setTimeout(() => resolve(null), 3000);
      mc.port1.onmessage = e => {
        clearTimeout(timer);
        resolve((e.data && e.data.version) ? e.data.version : null);
      };
      worker.postMessage({ type: 'GET_VERSION' }, [mc.port2]);
    });
  }

  // ── Stamp the ACTIVE controller's version into localStorage ──────
  // Called once on page load. Prevents VER_KEY from being '' and
  // falsely treating every future waiting SW as a "new" version.
  async function stampActiveVersion(){
    const ctrl = navigator.serviceWorker.controller;
    if(!ctrl) return;                         // no active SW yet (very first ever install)
    const ver = await getWorkerVersion(ctrl);
    if(ver){
      ls.set(VER_KEY, ver);
      console.log('[SW-MGR] Active SW version stamped:', ver);
    }
  }

  // ── Banner UI ─────────────────────────────────────────
  function showBanner(){
    setTimeout(()=>{
      const b = document.getElementById('update-banner');
      if(b) b.classList.add('show');
    }, 1200);
  }
  function hideBanner(){
    const b = document.getElementById('update-banner');
    if(b) b.classList.remove('show');
  }

  // ── Core decision: show banner ONLY on real version change ────────
  async function handleWaiting(worker){
    _waitingWorker = worker;
    const newVer = await getWorkerVersion(worker);

    // Waiting SW didn't reply (old build without GET_VERSION) — skip silently.
    if(!newVer){
      console.log('[SW-MGR] Waiting SW did not reply to GET_VERSION — skipping update UI.');
      return;
    }

    _pendingVer = newVer;
    const knownVer = ls.get(VER_KEY);

    // Identical version → nothing to do. This is the loop-breaker.
    if(newVer === knownVer){
      console.log('[SW-MGR] SW version unchanged (' + newVer + ') — no update needed.');
      return;
    }

    // Genuinely new version → show user-facing banner.
    console.log('[SW-MGR] New SW version: ' + knownVer + ' → ' + newVer);
    showBanner();
  }

  // ── Tell waiting SW to activate ──────────────────────
  function sendSkipWaiting(){
    if(!_waitingWorker || _skipSent) return;
    _skipSent = true;
    if(_pendingVer) ls.set(VER_KEY, _pendingVer);  // stamp NEW version BEFORE skip
    _waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  }

  // ── Public: "Update Now" button ───────────────────────
  window.applyUpdate = function(){
    hideBanner();
    sendSkipWaiting();
  };

  // ── Public: "Later" button ────────────────────────────
  // Hides banner for this session; next visit will re-check cleanly.
  window.snoozeUpdate = function(){
    hideBanner();
  };

  // ── Register SWs ─────────────────────────────────────
  navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' })
    .catch(err => console.warn('[FCM-SW]', err));

  navigator.serviceWorker.register('/sw.js').then(async reg => {

    // ★ KEY FIX: stamp the active controller's version right now.
    //   Without this, VER_KEY is '' → every waiting SW looks "new" → loop.
    await stampActiveVersion();

    // Case A: a SW is already in 'waiting' when this page loads.
    if(reg.waiting) handleWaiting(reg.waiting);

    // Case B: a new SW finishes installing while this page is open.
    reg.addEventListener('updatefound', () => {
      const inst = reg.installing;
      if(!inst) return;
      inst.addEventListener('statechange', () => {
        // Only check when fully installed AND there was already an active controller.
        // If there was no prior controller this is the very first install — no banner needed.
        if(inst.state === 'installed' && navigator.serviceWorker.controller){
          handleWaiting(inst);
        }
      });
    });

    // Silent background update poll every 10 min for long-lived sessions.
    // Does NOT reload or show a banner by itself — only sets reg.waiting
    // which is then picked up by updatefound above.
    setInterval(() => reg.update(), 10 * 60 * 1000);

  }).catch(err => console.warn('[SW] Registration failed:', err));

  // ── controllerchange → reload ONLY if WE triggered skipWaiting ──────
  // SW's own clients.claim() on first install also fires controllerchange,
  // but _skipSent is false at that point → we ignore it → no surprise reload.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if(!_skipSent) return;
    window.location.reload();
  });

  // ── Handle PUSH_SUBSCRIPTION_CHANGED from SW ─────────
  navigator.serviceWorker.addEventListener('message', event => {
    if(!event.data) return;
    if(event.data.type === 'PUSH_SUBSCRIPTION_CHANGED'){
      setTimeout(() => window.registerFCMToken?.(), 1000);
    }
  });

})();
