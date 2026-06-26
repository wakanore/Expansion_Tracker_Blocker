const browserAPI = (function() {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        return {
            cookies: chrome.cookies,
            storage: chrome.storage,
            runtime: chrome.runtime,
            alarms: chrome.alarms,
            notifications: chrome.notifications,
            webRequest: chrome.webRequest,
            tabs: chrome.tabs,
            extension: chrome.extension
        };
    } else if (typeof browser !== 'undefined') {
        return browser;
    } else {
        console.warn('No supported browser API found, using chrome fallback');
        return typeof chrome !== 'undefined' ? chrome : null;
    }
})();

export { browserAPI };