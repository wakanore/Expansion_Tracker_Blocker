// utils/learner.js

import { browserAPI } from '../lib/browser-polyfill.js';
import { getSettings, addToWhitelist, addObservedDomain } from './storage.js';
import { isTrackerCookie } from './cookie-analyzer.js';

const LEARNING_THRESHOLD = 3;

export async function observeThirdPartyCookie(cookie, currentSiteUrl) {
    const { learningEnabled, whitelist, notificationsEnabled } = await getSettings();
    if (!learningEnabled) return false;
    
    let siteDomain = '';
    try {
        const url = new URL(currentSiteUrl);
        siteDomain = url.hostname.replace(/^www\./, '');
    } catch (e) {
        return false;
    }
    
    if (cookie.domain && cookie.domain.includes(siteDomain)) return false;
    if (whitelist.some(d => cookie.domain && cookie.domain.includes(d))) return false;
    
    const observed = await addObservedDomain(cookie.domain, siteDomain);
    
    if (observed.count >= LEARNING_THRESHOLD) {
        const isKnownTracker = await isTrackerCookie(cookie, whitelist);
        if (!isKnownTracker) {
            await suggestNewTracker(cookie.domain, observed.sites);
        }
        return true;
    }
    
    return false;
}

async function suggestNewTracker(domain, sites) {
    const { pendingSuggestions = [] } = await browserAPI.storage.local.get('pendingSuggestions');
    
    if (pendingSuggestions.some(s => s.domain === domain)) return;
    
    const suggestion = {
        id: Date.now(),
        domain: domain,
        sites: Array.from(sites),
        timestamp: Date.now(),
        status: 'pending'
    };
    
    pendingSuggestions.push(suggestion);
    await browserAPI.storage.local.set({ pendingSuggestions });
    
    const { notificationsEnabled } = await getSettings();
    if (notificationsEnabled) {
        browserAPI.notifications.create(`tracker-suggestion-${suggestion.id}`, {
            type: 'basic',
            iconUrl: '/assets/icons/icon128.png',
            title: 'Обнаружен потенциальный трекер',
            message: `${domain} отслеживает вас на ${suggestion.sites.length} сайтах. Добавить в блокировку?`,
            buttons: [{ title: 'Добавить' }, { title: 'Игнорировать' }],
            requireInteraction: false
        });
    }
}

export async function getPendingSuggestions() {
    const { pendingSuggestions = [] } = await browserAPI.storage.local.get('pendingSuggestions');
    return pendingSuggestions.filter(s => s.status === 'pending');
}

export async function acceptSuggestion(suggestionId) {
    const { pendingSuggestions = [] } = await browserAPI.storage.local.get('pendingSuggestions');
    const suggestion = pendingSuggestions.find(s => s.id === suggestionId);
    
    if (suggestion) {
        const { localTrackerDomains = [] } = await browserAPI.storage.local.get('localTrackerDomains');
        if (!localTrackerDomains.includes(suggestion.domain)) {
            localTrackerDomains.push(suggestion.domain);
            await browserAPI.storage.local.set({ localTrackerDomains });
        }
        
        suggestion.status = 'accepted';
        await browserAPI.storage.local.set({ pendingSuggestions });
        
        return true;
    }
    return false;
}

export async function rejectSuggestion(suggestionId) {
    const { pendingSuggestions = [] } = await browserAPI.storage.local.get('pendingSuggestions');
    const suggestion = pendingSuggestions.find(s => s.id === suggestionId);
    
    if (suggestion) {
        suggestion.status = 'rejected';
        await browserAPI.storage.local.set({ pendingSuggestions });
        return true;
    }
    return false;
}

export async function getLocalTrackerDomains() {
    const { localTrackerDomains = [] } = await browserAPI.storage.local.get('localTrackerDomains');
    return localTrackerDomains;
}