// ══════════════════════════════════════════════════════════
//  MASTER ACADEMIC — SW UPDATE MANAGER (silent auto-update)
//
//  HOW IT WORKS:
//    • On every page load, sw.js is checked for updates.
//    • If a new SW is waiting, it is activated immediately
//      and the page reloads silently — no banner, no prompt.
//    • Users never need to clear site settings or permissions.
// ══════════════════════════════════════════════════════════
(function () {
  if (!('serviceWorker' in navigator)) return;

  // ── Immediately activate a waiting SW and reload ──────
  function activateAndReload(worker) {
    worker.postMessage({ type: 'SKIP_WAITING' });
  }

  // ── Register both service workers ────────────────────
  navigator.serviceWorker
    .register('/firebase-messaging-sw.js', { scope: '/' })
    .catch(err => console.warn('[FCM-SW]', err));

  navigator.serviceWorker.register('/sw.js').then(reg => {

    // If a new SW is already waiting when the page loads → activate now
    if (reg.waiting) {
      activateAndReload(reg.waiting);
    }

    // If a new SW installs while the page is open → activate immediately
    reg.addEventListener('updatefound', () => {
      const inst = reg.installing;
      if (!inst) return;
      inst.addEventListener('statechange', () => {
        if (inst.state === 'installed') {
          activateAndReload(inst);
        }
      });
    });

    // Poll for updates every 5 minutes for long-lived sessions
    setInterval(() => reg.update(), 5 * 60 * 1000);

  }).catch(err => console.warn('[SW] Registration failed:', err));

  // ── When SW activates (controllerchange) → reload page ──
  // This gives users the latest version automatically
  let _reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (_reloading) return;
    _reloading = true;
    window.location.reload();
  });

  // ── Handle PUSH_SUBSCRIPTION_CHANGED from SW ─────────
  navigator.serviceWorker.addEventListener('message', event => {
    if (!event.data) return;
    if (event.data.type === 'PUSH_SUBSCRIPTION_CHANGED') {
      setTimeout(() => window.registerFCMToken?.(), 1000);
    }
  });

})();
