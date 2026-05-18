// firebase-messaging-sw.js
// ═══════════════════════════════════════════════════════
//  Firebase Messaging Service Worker (Compat SDK)
//  DO NOT CHANGE THE FILENAME — FCM looks for exactly this.
// ═══════════════════════════════════════════════════════

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const CACHE_VERSION = 'v1.0.0';

firebase.initializeApp({
  apiKey:            'AIzaSyD4TiBqoT2r373fsfqMBAxQ29ua1IZlPwQ',
  authDomain:        'master-eda5d.firebaseapp.com',
  projectId:         'master-eda5d',
  storageBucket:     'master-eda5d.firebasestorage.app',
  messagingSenderId: '343735612179',
  appId:             '1:343735612179:web:2eed5a03e4d578f43d20e6'
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage(payload => {
  const title = payload.notification?.title || 'Master Academic';
  const options = {
    body:  payload.notification?.body || 'নতুন আপডেট আছে!',
    icon:  '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: '/' }
  };
  self.registration.showNotification(title, options);
});

// Handle skipWaiting from update banner
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
});