// ═══════════ UNSTUCK — Service Worker ═══════════
// Handles background notifications for Distraction Rescue

const CACHE_NAME = 'unstuck-v1';

// Install — cache core files
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

// Handle notification clicks — open/focus Unstuck and go to reveal
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Try to find an existing Unstuck tab
            for (const client of clientList) {
                if (client.url.includes('index.html') || client.url.endsWith('/')) {
                    // Focus existing tab and tell it to reveal a task
                    client.focus();
                    client.postMessage({ type: 'RESCUE_REVEAL' });
                    return;
                }
            }
            // No existing tab — open a new one with a rescue flag
            return self.clients.openWindow('./index.html?rescue=1');
        })
    );
});

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SEND_RESCUE_NOTIFICATION') {
        const messages = [
            { title: 'Hey, you still there? 👋', body: 'You\'ve been away for a bit. Want to knock something out?' },
            { title: 'Quick win waiting for you ⚡', body: 'One small task could change your whole momentum.' },
            { title: 'Doomscroll break? 🌟', body: 'Your future self will thank you. Just one task!' },
            { title: 'Gentle nudge 💜', body: 'The vault has something for you. Come check it out.' },
            { title: 'You\'ve got this 💪', body: 'Step away from the scroll. One task, that\'s all.' },
        ];

        const msg = messages[Math.floor(Math.random() * messages.length)];

        self.registration.showNotification(msg.title, {
            body: msg.body,
            icon: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="20" fill="#08081a"/><text x="48" y="62" font-size="48" text-anchor="middle" fill="#a78bfa">⚡</text></svg>'),
            badge: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#a78bfa"/></svg>'),
            tag: 'unstuck-rescue',
            renotify: true,
            requireInteraction: false,
            silent: false,
            vibrate: [100, 50, 100],
            data: { action: 'reveal' }
        });
    }
});
