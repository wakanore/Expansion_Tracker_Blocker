// utils/storage.js

import { browserAPI } from '../lib/browser-polyfill.js';

const DEFAULT_SETTINGS = {
    blockAllTrackers: true,
    whitelist: [],
    autoBlockEnabled: true,
    learningEnabled: true,
    notificationsEnabled: true,
    statsEnabled: true
};

const MAX_STATS_ENTRIES = 2000;

export async function getSettings() {
    return new Promise((resolve) => {
        browserAPI.storage.sync.get(Object.keys(DEFAULT_SETTINGS), (result) => {
            resolve({
                ...DEFAULT_SETTINGS,
                ...result
            });
        });
    });
}

export async function saveSettings(settings) {
    return new Promise((resolve) => {
        browserAPI.storage.sync.set(settings, resolve);
    });
}

export async function addToWhitelist(domain) {
    const { whitelist } = await getSettings();
    if (!whitelist.includes(domain)) {
        await saveSettings({ whitelist: [...whitelist, domain] });
    }
}

export async function removeFromWhitelist(domain) {
    const { whitelist } = await getSettings();
    await saveSettings({ whitelist: whitelist.filter(d => d !== domain) });
}

export async function addStatEntry(entry) {
    if (!entry) return;
    
    const { statsEnabled } = await getSettings();
    if (!statsEnabled) return;
    
    return new Promise((resolve) => {
        browserAPI.storage.local.get('stats', (result) => {
            const stats = result.stats || [];
            const newStats = [entry, ...stats].slice(0, MAX_STATS_ENTRIES);
            browserAPI.storage.local.set({ stats: newStats }, resolve);
        });
    });
}

export async function getStats() {
    return new Promise((resolve) => {
        browserAPI.storage.local.get('stats', (result) => {
            resolve(result.stats || []);
        });
    });
}

export async function clearStats() {
    return new Promise((resolve) => {
        browserAPI.storage.local.set({ stats: [] }, resolve);
    });
}

export async function getAggregatedStats() {
    const stats = await getStats();
    
    const domainCount = {};
    const dailyCount = {};
    
    stats.forEach(entry => {
        if (entry.domain) {
            let domain = entry.domain;
            if (domain.startsWith('.')) domain = domain.substring(1);
            domainCount[domain] = (domainCount[domain] || 0) + 1;
        }
        
        const date = new Date(entry.timestamp).toISOString().split('T')[0];
        dailyCount[date] = (dailyCount[date] || 0) + 1;
    });
    
    const topDomains = Object.entries(domainCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    return {
        totalBlocked: stats.length,
        topDomains,
        dailyStats: Object.entries(dailyCount).slice(-30)
    };
}

export async function addObservedDomain(domain, siteUrl) {
    const { observedDomains = {} } = await browserAPI.storage.local.get('observedDomains');
    
    if (!observedDomains[domain]) {
        observedDomains[domain] = { sites: new Set(), count: 0 };
    }
    
    observedDomains[domain].sites.add(siteUrl);
    observedDomains[domain].count = observedDomains[domain].sites.size;
    
    const entries = Object.entries(observedDomains);
    if (entries.length > 500) {
        const sorted = entries.sort((a, b) => b[1].count - a[1].count);
        const trimmed = Object.fromEntries(sorted.slice(0, 500));
        await browserAPI.storage.local.set({ observedDomains: trimmed });
    } else {
        await browserAPI.storage.local.set({ observedDomains });
    }
    
    return observedDomains[domain];
}

export async function getObservedDomains() {
    const { observedDomains = {} } = await browserAPI.storage.local.get('observedDomains');
    return observedDomains;
}

export async function clearObservedDomains() {
    await browserAPI.storage.local.set({ observedDomains: {} });
}