import { browserAPI } from '../lib/browser-polyfill.js';
import { isTrackerCookie } from '../utils/cookie-analyzer.js';
import { getSettings, saveSettings, getAggregatedStats } from '../utils/storage.js';

let currentTrackers = [];

document.addEventListener('DOMContentLoaded', async () => {
    const toggle = document.getElementById('toggle-blocking');
    const statusText = document.getElementById('status-text');
    const scanBtn = document.getElementById('scan-now');
    const removeAllBtn = document.getElementById('remove-all');
    const trackerList = document.getElementById('tracker-list');
    const totalCookiesEl = document.getElementById('total-cookies');
    const trackerCookiesEl = document.getElementById('tracker-cookies');
    const blockedTodayEl = document.getElementById('blocked-today');
    const openOptions = document.getElementById('open-options');
    const openStats = document.getElementById('open-stats');
    const autoBlockStatus = document.getElementById('auto-block-status');
    const learningStatus = document.getElementById('learning-status');
    
    const settings = await getSettings();
    if (toggle) toggle.checked = settings.blockAllTrackers;
    updateStatusText(settings.blockAllTrackers);
    
    if (autoBlockStatus) {
        autoBlockStatus.textContent = settings.autoBlockEnabled ? '⚡ Auto-block: ON' : '⚡ Auto-block: OFF';
    }
    if (learningStatus) {
        learningStatus.textContent = settings.learningEnabled ? '🧠 Learning: ON' : '🧠 Learning: OFF';
    }
    
    const stats = await getAggregatedStats();
    const today = new Date().toISOString().split('T')[0];
    const todayBlocked = stats.dailyStats?.find(([date]) => date === today)?.[1] || 0;
    if (blockedTodayEl) blockedTodayEl.textContent = todayBlocked;
    
    if (toggle) {
        toggle.addEventListener('change', async (e) => {
            const isActive = e.target.checked;
            await saveSettings({ blockAllTrackers: isActive });
            updateStatusText(isActive);
            browserAPI.runtime.sendMessage({ action: 'settingsChanged' });
        });
    }
    
    if (scanBtn) scanBtn.addEventListener('click', scanCookies);
    if (removeAllBtn) removeAllBtn.addEventListener('click', removeAllTrackers);
    
    if (openOptions) {
        openOptions.addEventListener('click', () => {
            browserAPI.runtime.openOptionsPage();
        });
    }
    
    if (openStats) {
        openStats.addEventListener('click', () => {
            browserAPI.tabs.create({ url: browserAPI.runtime.getURL('statistics/statistics.html') });
        });
    }
    
    await scanCookies();
    
    function updateStatusText(isActive) {
        if (statusText) {
            statusText.textContent = isActive ? 'Active' : 'Inactive';
            statusText.style.color = isActive ? '#2ecc71' : '#e74c3c';
        }
    }
    
    async function scanCookies() {
        const cookies = await browserAPI.cookies.getAll({});
        const settings = await getSettings();
        
        const trackers = [];
        for (const cookie of cookies) {
            if (await isTrackerCookie(cookie, settings.whitelist)) {
                trackers.push(cookie);
            }
        }
        
        currentTrackers = trackers;
        
        if (totalCookiesEl) totalCookiesEl.textContent = cookies.length;
        if (trackerCookiesEl) trackerCookiesEl.textContent = trackers.length;
        
        displayTrackers(trackers);
    }
    
    function displayTrackers(trackers) {
        if (!trackerList) return;
        
        if (trackers.length === 0) {
            trackerList.innerHTML = '<div class="empty-state">✨ No trackers found. You\'re clean!</div>';
            return;
        }
        
        trackerList.innerHTML = '';
        
        trackers.forEach(tracker => {
            const item = document.createElement('div');
            item.className = 'tracker-item';
            item.innerHTML = `
                <div>
                    <div class="tracker-name">${escapeHtml(tracker.name)}</div>
                    <div class="tracker-domain">${escapeHtml(tracker.domain)}</div>
                </div>
                <button class="remove-btn" data-name="${escapeHtml(tracker.name)}" data-domain="${escapeHtml(tracker.domain)}">Remove</button>
            `;
            trackerList.appendChild(item);
        });
        
        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const name = btn.getAttribute('data-name');
                const domain = btn.getAttribute('data-domain');
                
                let url = `https://${domain}`;
                if (domain && domain.startsWith('.')) {
                    url = `https://${domain.substring(1)}`;
                }
                
                await browserAPI.cookies.remove({ url, name });
                await scanCookies();
            });
        });
    }
    
    async function removeAllTrackers() {
        for (const tracker of currentTrackers) {
            let url = `https://${tracker.domain}`;
            if (tracker.domain && tracker.domain.startsWith('.')) {
                url = `https://${tracker.domain.substring(1)}`;
            }
            
            try {
                await browserAPI.cookies.remove({ url, name: tracker.name });
            } catch (e) {
                console.error('Failed to remove cookie:', e);
            }
        }
        await scanCookies();
    }
    
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }
});