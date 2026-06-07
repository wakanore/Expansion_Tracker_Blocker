// background.js

import { browserAPI } from './lib/browser-polyfill.js';
import { isTrackerCookie } from './utils/cookie-analyzer.js';
import { getSettings, addStatEntry } from './utils/storage.js';
import { observeThirdPartyCookie } from './utils/learner.js';
import { setupAutoUpdate, manualUpdate } from './utils/update-manager.js';

let currentSettings = null;
let pendingBlockedDomains = new Map();

async function init() {
    currentSettings = await getSettings();
    await setupAutoUpdate();
    setupAutoBlocking();
    console.log('[Background] Tracker Blocker Pro initialized');
}

function setupAutoBlocking() {
    browserAPI.cookies.onChanged.addListener(async (changeInfo) => {
        if (changeInfo.removed) return;
        
        const cookie = changeInfo.cookie;
        if (!cookie) return;
        
        const settings = await getSettings();
        
        if (!settings.autoBlockEnabled) return;
        if (!settings.blockAllTrackers) return;
        
        const isTracker = await isTrackerCookie(cookie, settings.whitelist);
        
        if (isTracker) {
            try {
                let url = `https://${cookie.domain}`;
                if (cookie.domain && cookie.domain.startsWith('.')) {
                    url = `https://${cookie.domain.substring(1)}`;
                }
                
                await browserAPI.cookies.remove({
                    url: url,
                    name: cookie.name,
                    storeId: cookie.storeId
                });
                
                await addStatEntry({
                    timestamp: Date.now(),
                    type: 'auto_blocked',
                    name: cookie.name,
                    domain: cookie.domain
                });
                
                const { notificationsEnabled } = await getSettings();
                if (notificationsEnabled) {
                    const key = cookie.domain;
                    if (!pendingBlockedDomains.has(key) || Date.now() - pendingBlockedDomains.get(key) > 60000) {
                        pendingBlockedDomains.set(key, Date.now());
                        browserAPI.notifications.create(`blocked-${Date.now()}`, {
                            type: 'basic',
                            iconUrl: '/assets/icons/icon128.png',
                            title: 'Трекер заблокирован',
                            message: `Блокирован ${cookie.name} от ${cookie.domain}`,
                            requireInteraction: false
                        });
                    }
                }
                
                console.log(`[AutoBlock] Blocked: ${cookie.name} (${cookie.domain})`);
                
            } catch (err) {
                console.error('[AutoBlock] Failed:', err);
            }
        }
        
        if (changeInfo.cause === 'explicit' && changeInfo.cookie) {
            try {
                const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
                if (tabs[0] && tabs[0].url) {
                    await observeThirdPartyCookie(cookie, tabs[0].url);
                }
            } catch (e) {
                // Игнорируем ошибки
            }
        }
    });
    
    console.log('[Background] Auto-blocking enabled');
}

if (browserAPI.notifications && browserAPI.notifications.onButtonClicked) {
    browserAPI.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
        if (notificationId.startsWith('tracker-suggestion-')) {
            const suggestionId = parseInt(notificationId.split('-')[2]);
            const { acceptSuggestion, rejectSuggestion } = await import('./utils/learner.js');
            
            if (buttonIndex === 0) {
                await acceptSuggestion(suggestionId);
                browserAPI.notifications.create(`accepted-${Date.now()}`, {
                    type: 'basic',
                    iconUrl: '/assets/icons/icon128.png',
                    title: 'Трекер добавлен',
                    message: 'Новый трекер будет блокироваться',
                    requireInteraction: false
                });
            } else {
                await rejectSuggestion(suggestionId);
            }
        }
    });
}

browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'manualUpdate') {
        manualUpdate().then(result => sendResponse({ success: result }));
        return true;
    }
    
    if (message.action === 'getStats') {
        import('./utils/storage.js').then(({ getAggregatedStats }) => {
            getAggregatedStats().then(sendResponse);
        });
        return true;
    }
    
    if (message.action === 'getSuggestions') {
        import('./utils/learner.js').then(({ getPendingSuggestions }) => {
            getPendingSuggestions().then(sendResponse);
        });
        return true;
    }
    
    if (message.action === 'settingsChanged') {
        getSettings().then(settings => { currentSettings = settings; });
        sendResponse({ ok: true });
        return false;
    }
});

init();