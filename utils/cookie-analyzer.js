// utils/cookie-analyzer.js

import { browserAPI } from '../lib/browser-polyfill.js';

let trackerDb = null;

async function loadTrackerDatabase() {
    if (trackerDb) {
        return trackerDb;
    }
    
    const response = await fetch(browserAPI.runtime.getURL('assets/tracker-db.json'));
    trackerDb = await response.json();
    return trackerDb;
}

export async function isTrackerCookie(cookie, whitelist = []) {
    if (!cookie) return false;
    
    if (whitelist && whitelist.some(domain => cookie.domain && cookie.domain.includes(domain))) {
        return false;
    }
    
    const db = await loadTrackerDatabase();
    
    const isDomainTracker = db.domains.some(domain => {
        if (!cookie.domain) return false;
        return cookie.domain.includes(domain) || cookie.domain.endsWith('.' + domain) || cookie.domain === domain;
    });
    
    if (isDomainTracker) return true;
    
    const isNameTracker = db.patterns.some(pattern => {
        if (!cookie.name) return false;
        const regex = new RegExp(pattern, 'i');
        return regex.test(cookie.name);
    });
    
    return isNameTracker;
}

export async function getTrackerDatabase() {
    return await loadTrackerDatabase();
}