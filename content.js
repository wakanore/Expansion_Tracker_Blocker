console.log('[Tracker Blocker] Content script loaded');

function detectTrackerScripts() {
    const trackerScripts = [
        { pattern: /google-analytics\.com\/analytics\.js/, name: 'Google Analytics' },
        { pattern: /googletagmanager\.com\/gtm\.js/, name: 'Google Tag Manager' },
        { pattern: /connect\.facebook\.net\/.*\/fbevents\.js/, name: 'Facebook Pixel' },
        { pattern: /mc\.yandex\.ru\/metrika\/tag\.js/, name: 'Yandex Metrica' },
        { pattern: /static\.hotjar\.com\/c\/hotjar-/, name: 'Hotjar' },
        { pattern: /cdn\.taboola\.com/, name: 'Taboola' },
        { pattern: /widget\.outbrain\.com/, name: 'Outbrain' }
    ];
    
    const scripts = document.querySelectorAll('script[src]');
    const foundTrackers = [];
    
    scripts.forEach(script => {
        const src = script.src;
        for (const tracker of trackerScripts) {
            if (tracker.pattern.test(src)) {
                foundTrackers.push({ name: tracker.name, url: src });
                break;
            }
        }
    });
    
    if (foundTrackers.length > 0) {
        console.log('[Tracker Blocker] Found tracker scripts:', foundTrackers);
    }
    
    return foundTrackers;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', detectTrackerScripts);
} else {
    detectTrackerScripts();
}

const observer = new MutationObserver((mutations) => {
    let shouldCheck = false;
    mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length) {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeName === 'SCRIPT' && node.src) {
                    shouldCheck = true;
                }
            });
        }
    });
    if (shouldCheck) {
        setTimeout(detectTrackerScripts, 100);
    }
});

observer.observe(document.documentElement, {
    childList: true,
    subtree: true
});