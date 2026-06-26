import { browserAPI } from '../lib/browser-polyfill.js';
import { getSettings, saveSettings, clearStats } from '../utils/storage.js';
import { getPendingSuggestions, acceptSuggestion, rejectSuggestion } from '../utils/learner.js';

document.addEventListener('DOMContentLoaded', async () => {
    const blockAllCheckbox = document.getElementById('block-all');
    const autoBlockCheckbox = document.getElementById('auto-block');
    const learningCheckbox = document.getElementById('learning-mode');
    const notificationsCheckbox = document.getElementById('notifications');
    const whitelistInput = document.getElementById('whitelist-input');
    const saveWhitelistBtn = document.getElementById('save-whitelist');
    const saveSettingsBtn = document.getElementById('save-settings');
    const exportBtn = document.getElementById('export-settings');
    const importBtn = document.getElementById('import-settings');
    const importFile = document.getElementById('import-file');
    const clearStatsBtn = document.getElementById('clear-stats');
    const suggestionsContainer = document.getElementById('suggestions-list');
    
    const settings = await getSettings();
    blockAllCheckbox.checked = settings.blockAllTrackers;
    autoBlockCheckbox.checked = settings.autoBlockEnabled !== false;
    learningCheckbox.checked = settings.learningEnabled !== false;
    notificationsCheckbox.checked = settings.notificationsEnabled !== false;
    whitelistInput.value = (settings.whitelist || []).join('\n');
    
    await loadSuggestions();
    
    saveSettingsBtn.addEventListener('click', saveSettingsHandler);
    saveWhitelistBtn.addEventListener('click', saveWhitelist);
    exportBtn.addEventListener('click', exportSettings);
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', importSettings);
    clearStatsBtn.addEventListener('click', clearStatsHandler);
    
    async function saveSettingsHandler() {
        await saveSettings({
            blockAllTrackers: blockAllCheckbox.checked,
            autoBlockEnabled: autoBlockCheckbox.checked,
            learningEnabled: learningCheckbox.checked,
            notificationsEnabled: notificationsCheckbox.checked
        });
        
        saveSettingsBtn.textContent = '✅ Saved!';
        setTimeout(() => {
            saveSettingsBtn.textContent = '💾 Save All Settings';
        }, 2000);
        
        browserAPI.runtime.sendMessage({ action: 'settingsChanged' });
    }
    
    async function saveWhitelist() {
        const text = whitelistInput.value;
        const whitelist = text.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));
        
        await saveSettings({ whitelist });
        
        saveWhitelistBtn.textContent = '✅ Saved!';
        setTimeout(() => {
            saveWhitelistBtn.textContent = 'Save Whitelist';
        }, 2000);
    }
    
    async function exportSettings() {
        const settings = await getSettings();
        const { localTrackerDomains = [] } = await browserAPI.storage.local.get('localTrackerDomains');
        
        const exportData = {
            version: '2.0',
            exportDate: new Date().toISOString(),
            settings: settings,
            localTrackerDomains: localTrackerDomains
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tracker-blocker-settings-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    async function importSettings(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const text = await file.text();
        const data = JSON.parse(text);
        
        if (data.settings) {
            await saveSettings(data.settings);
            blockAllCheckbox.checked = data.settings.blockAllTrackers;
            autoBlockCheckbox.checked = data.settings.autoBlockEnabled;
            learningCheckbox.checked = data.settings.learningEnabled;
            notificationsCheckbox.checked = data.settings.notificationsEnabled;
            whitelistInput.value = (data.settings.whitelist || []).join('\n');
        }
        
        if (data.localTrackerDomains) {
            await browserAPI.storage.local.set({ localTrackerDomains: data.localTrackerDomains });
        }
        
        alert('Settings imported successfully!');
        importFile.value = '';
    }
    
    async function clearStatsHandler() {
        if (confirm('Are you sure you want to clear all statistics? This cannot be undone.')) {
            await clearStats();
            alert('Statistics cleared!');
        }
    }
    
    async function loadSuggestions() {
        const suggestions = await getPendingSuggestions();
        
        if (suggestions.length === 0) {
            suggestionsContainer.innerHTML = '<div class="empty-message">No pending suggestions</div>';
            return;
        }
        
        suggestionsContainer.innerHTML = '';
        for (const suggestion of suggestions) {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.innerHTML = `
                <div>
                    <div class="suggestion-domain">${escapeHtml(suggestion.domain)}</div>
                    <div class="suggestion-sites">Detected on ${suggestion.sites.length} sites</div>
                </div>
                <div class="suggestion-actions">
                    <button class="accept" data-id="${suggestion.id}">Accept</button>
                    <button class="reject" data-id="${suggestion.id}">Reject</button>
                </div>
            `;
            suggestionsContainer.appendChild(div);
        }
        
        document.querySelectorAll('.accept').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = parseInt(e.target.getAttribute('data-id'));
                await acceptSuggestion(id);
                await loadSuggestions();
            });
        });
        
        document.querySelectorAll('.reject').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = parseInt(e.target.getAttribute('data-id'));
                await rejectSuggestion(id);
                await loadSuggestions();
            });
        });
    }
    
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
});