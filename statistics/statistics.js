// statistics/statistics.js

import { browserAPI } from '../lib/browser-polyfill.js';
import { getStats } from '../utils/storage.js';

let dailyChart = null;
let topDomainsChart = null;

document.addEventListener('DOMContentLoaded', async () => {
    await loadStatistics();
    
    document.getElementById('refresh-stats').addEventListener('click', loadStatistics);
    document.getElementById('export-stats').addEventListener('click', exportToCSV);
});

async function loadStatistics() {
    const stats = await getStats();
    
    const totalBlocked = stats.length;
    const autoBlocked = stats.filter(s => s.type === 'auto_blocked').length;
    const today = new Date().toISOString().split('T')[0];
    const todayBlocked = stats.filter(s => {
        const date = new Date(s.timestamp).toISOString().split('T')[0];
        return date === today;
    }).length;
    
    document.getElementById('total-blocked').textContent = totalBlocked;
    document.getElementById('auto-blocked').textContent = autoBlocked;
    document.getElementById('today-blocked').textContent = todayBlocked;
    
    const dailyData = {};
    stats.forEach(stat => {
        const date = new Date(stat.timestamp).toISOString().split('T')[0];
        dailyData[date] = (dailyData[date] || 0) + 1;
    });
    
    const last30Days = getLast30Days();
    const dailyCounts = last30Days.map(date => dailyData[date] || 0);
    const maxCount = Math.max(...dailyCounts, 1);
    
    drawDailyChart(last30Days, dailyCounts, maxCount);
    
    const domainCount = {};
    stats.forEach(stat => {
        if (stat.domain) {
            let domain = stat.domain;
            if (domain.startsWith('.')) domain = domain.substring(1);
            domainCount[domain] = (domainCount[domain] || 0) + 1;
        }
    });
    
    const topDomains = Object.entries(domainCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    drawTopDomainsChart(topDomains);
    
    const recentContainer = document.getElementById('recent-blocks');
    const recentStats = stats.slice(0, 50);
    
    if (recentStats.length === 0) {
        recentContainer.innerHTML = '<div class="empty-message">No blocks recorded yet</div>';
    } else {
        recentContainer.innerHTML = '';
        recentStats.forEach(stat => {
            const date = new Date(stat.timestamp);
            const timeStr = date.toLocaleString();
            const div = document.createElement('div');
            div.className = 'recent-item';
            
            let text = '';
            if (stat.type === 'auto_blocked') {
                text = `🚫 Auto-blocked: ${stat.name || 'cookie'} on ${stat.domain || 'unknown'}`;
            } else if (stat.type === 'webrequest_blocked') {
                text = `🌐 Header blocked: ${stat.header?.substring(0, 80) || 'unknown'}...`;
            } else {
                text = `🔒 Blocked: ${stat.name || 'cookie'} on ${stat.domain || 'unknown'}`;
            }
            
            div.innerHTML = `
                <span>${escapeHtml(text)}</span>
                <span class="date">${escapeHtml(timeStr)}</span>
            `;
            recentContainer.appendChild(div);
        });
    }
}

function drawDailyChart(labels, data, maxCount) {
    const canvas = document.getElementById('daily-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.clientWidth;
    const height = canvas.height = canvas.clientHeight;
    
    ctx.clearRect(0, 0, width, height);
    
    if (!data.length || data.every(v => v === 0)) {
        ctx.fillStyle = '#888';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No data available', width / 2, height / 2);
        return;
    }
    
    const padding = { left: 50, right: 20, top: 20, bottom: 40 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;
    const barWidth = graphWidth / data.length * 0.7;
    const barSpacing = graphWidth / data.length;
    
    ctx.strokeStyle = '#2d2d44';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();
    
    for (let i = 0; i < data.length; i++) {
        const barHeight = (data[i] / maxCount) * graphHeight;
        const x = padding.left + i * barSpacing + (barSpacing - barWidth) / 2;
        const y = height - padding.bottom - barHeight;
        
        ctx.fillStyle = '#667eea';
        ctx.fillRect(x, y, barWidth, barHeight);
        
        ctx.fillStyle = '#888';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        const label = labels[i].slice(5);
        ctx.fillText(label, x + barWidth / 2, height - padding.bottom + 15);
    }
    
    ctx.fillStyle = '#667eea';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= maxCount; i++) {
        const y = height - padding.bottom - (i / maxCount) * graphHeight;
        ctx.fillText(i.toString(), padding.left - 5, y + 3);
    }
    
    ctx.fillStyle = '#eee';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Daily Blocked Trackers', width / 2, 15);
}

function drawTopDomainsChart(domains) {
    const canvas = document.getElementById('top-domains-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.clientWidth;
    const height = canvas.height = canvas.clientHeight;
    
    ctx.clearRect(0, 0, width, height);
    
    if (!domains.length) {
        ctx.fillStyle = '#888';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No data available', width / 2, height / 2);
        return;
    }
    
    const maxCount = Math.max(...domains.map(d => d[1]), 1);
    const padding = { left: 120, right: 20, top: 30, bottom: 20 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;
    const barHeight = graphHeight / domains.length * 0.7;
    const barSpacing = graphHeight / domains.length;
    
    ctx.strokeStyle = '#2d2d44';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();
    
    for (let i = 0; i < domains.length; i++) {
        const [domain, count] = domains[i];
        const barWidth = (count / maxCount) * graphWidth;
        const x = padding.left;
        const y = padding.top + i * barSpacing + (barSpacing - barHeight) / 2;
        
        ctx.fillStyle = '#f5576c';
        ctx.fillRect(x, y, barWidth, barHeight);
        
        ctx.fillStyle = '#eee';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        let shortDomain = domain.length > 25 ? domain.slice(0, 22) + '...' : domain;
        ctx.fillText(shortDomain, x - 5, y + barHeight / 2 + 3);
        
        ctx.fillStyle = '#f5576c';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(count.toString(), x + barWidth + 5, y + barHeight / 2 + 3);
    }
    
    ctx.fillStyle = '#eee';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Top Tracking Domains', width / 2, 15);
}

function getLast30Days() {
    const dates = [];
    for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
}

async function exportToCSV() {
    const stats = await getStats();
    
    const headers = ['Timestamp', 'Type', 'Name', 'Domain'];
    const rows = stats.map(stat => [
        new Date(stat.timestamp).toISOString(),
        stat.type || 'manual',
        stat.name || '',
        stat.domain || ''
    ]);
    
    const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tracker-stats-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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