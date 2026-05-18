// ═══════════════════════════════════════════════════════
//  Master Academic — Service Worker
//  CACHE_VERSION: bump this on every deploy to force update
// ═══════════════════════════════════════════════════════
const CACHE_VERSION = 'v1.0.0';        // ← change this on every deploy
const CACHE_NAME    = `master-academic-${CACHE_VERSION}`;

// Files to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// ── SKIP_WAITING message from client ─────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── INSTALL: cache core files ──────────────────────────
// skipWaiting() here means the new SW activates immediately on install.
// The page will reload via controllerchange in sw-updater.js.
self.addEventListener('install', event => {
  self.skipWaiting(); // ← auto-activate, no waiting
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS).catch(err => {
        console.warn('[SW] Pre-cache partial failure:', err);
      });
    })
  );
});

// ── ACTIVATE: delete ALL old caches ───────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name.startsWith('master-academic-') && name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      // claim() triggers 'controllerchange' in the page → page reloads there.
      // No SW_UPDATED message needed — that was causing the infinite banner loop.
      return self.clients.claim();
    })
  );
});

// ── FETCH: Network-first, fall back to cache ──────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET, cross-origin requests (Firebase, FCM, etc.)
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // For navigation requests (HTML pages) — always try network first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache the fresh response
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          // Offline: serve from cache
          return caches.match(event.request)
            .then(cached => cached || caches.match('/index.html'));
        })
    );
    return;
  }

  // For static assets — cache-first with background refresh
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => null);

      return cached || fetchPromise;
    })
  );
});

// ── PUSH NOTIFICATIONS ───────────────────────────────
// Full Android notification options for reliable delivery on Chrome/WebView.
self.addEventListener('push', event => {
  let data = { title: 'Master Academic', body: 'নতুন আপডেট আছে!' };
  try {
    if (event.data) data = event.data.json();
  } catch(e) {
    // Fallback: try as plain text
    try { data.body = event.data.text(); } catch(e2) {}
  }

  const options = {
    body:              data.body        || 'নতুন আপডেট আছে!',
    icon:              data.icon        || '/icon-192.png',
    badge:             '/icon-192.png',   // Android status bar icon (must be monochrome PNG)
    image:             data.image       || undefined,
    tag:               data.tag         || 'maac-notice',
    renotify:          true,             // ring again even if same tag
    requireInteraction: false,           // don't keep notification until user taps (battery friendly)
    silent:            false,            // allow sound on Android
    vibrate:           [200, 100, 200, 100, 200], // double pulse
    timestamp:         Date.now(),
    dir:               'auto',
    lang:              'bn',
    data: {
      url:   data.url  || '/',
      type:  data.type || 'notice'
    }
  };

  // waitUntil keeps the SW alive until notification is shown
  event.waitUntil(
    self.registration.showNotification(data.title || 'Master Academic', options)
      .catch(err => console.error('[SW] showNotification failed:', err))
  );
});

// ── NOTIFICATION CLICK ────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cls => {
      // Focus existing tab if already open
      const existing = cls.find(c => {
        try { return new URL(c.url).origin === self.location.origin; } catch(e) { return false; }
      });
      if(existing){
        return existing.focus().then(()=>{
          // Navigate to the specific section if possible
          if(existing.navigate) return existing.navigate(targetUrl);
        }).catch(()=> clients.openWindow(targetUrl));
      }
      return clients.openWindow(targetUrl);
    })
  );
});

// ── NOTIFICATION CLOSE (analytics hook, optional) ─────
self.addEventListener('notificationclose', event => {
  // Fired when user dismisses without tapping — no action needed
  console.log('[SW] Notification dismissed:', event.notification.tag);
});

// ── PUSH SUBSCRIPTION CHANGE ──────────────────────────
// Fired when browser rotates push credentials — re-subscribe automatically
self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription?.options || { userVisibleOnly: true })
      .then(newSub => {
        // Notify all clients so they can re-save the token to Firestore
        return self.clients.matchAll({ type: 'window' }).then(cls => {
          cls.forEach(c => c.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED', subscription: newSub.toJSON() }));
        });
      }).catch(err => console.error('[SW] pushsubscriptionchange failed:', err))
  );
});
