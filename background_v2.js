
const _ = {
    "raw": {
        "youtube.com": {
            // using a key because there might be multiple sessions even in same URL
            "[SESSION ID]": {
                "start": "[TIMESTAMP]",
                "end": "[TIMESTAMP]",
                "total": "[DURATION IN MS]",
                "focus": {
                    "[FOCUS ID]": {
                        "start": "[TIMESTAMP]",
                        "end": "[TIMESTAMP]",
                        "total": "[DURATION IN MS]"
                    }
                }
            }
        }
    }
}

function generateId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

class Aux {
    static getTLD(url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;
            const parts = hostname.split('.').filter(part => part !== 'www');
            if (parts.length >= 2) {
                return parts.slice(-2).join('.');
            } else {
                return hostname;
            }
        } catch (e) {
            return url;
        }
    }

    static isEligibleUrl(url) {
        if (!url) return false;
        const ineligibleSchemes = [
            'chrome://', 
            'chrome-extension://', 
            'about:', 
            'file://', 
            'edge://', 
            'moz-extension://'
        ];
        for (const scheme of ineligibleSchemes) {
            if (url.startsWith(scheme)) {
                return false;
            }
        }
        return true;
    }
}

class Storage {
    static storageKey = 'raw';
    // URL should be TLD
    static async getRaw() {
        const data = await chrome.storage.local.get([this.storageKey]);
        return data[this.storageKey] || {};
    }

    static async saveRaw(raw) {
        await chrome.storage.local.set({ [this.storageKey]: raw });
    }

    static async findActiveSessionId(url, windowId, tabId) {
        if (!Aux.isEligibleUrl(url)) { return null; }
        const raw = await this.getRaw();
        if (!raw[url]) {
            return null;
        }
        const sessions = raw[url];
        // for a 100+ tabs might get slow; please conder alternate means
        for (const sessionId in sessions) {
            const session = sessions[sessionId];
            // handling if windows ID or tab ID getting reused
            if (session.windowId === windowId && session.tabId === tabId && !session.end) {
                return sessionId;
            }
        }
        return null;
    }
    
    static async insertSession(url, tabId, windowId) {
        if (!Aux.isEligibleUrl(url)) {
            return;
        }
        const sessionId = generateId();
        const raw = await this.getRaw();
        if (!raw[url]) {
            raw[url] = {};
        }
        raw[url][sessionId] = {
            start: Date.now(),
            tabId: tabId,
            windowId: windowId,
        };
        await this.saveRaw(raw);
    }

    static async insertFocus(url, sessionId) {
        // A focus might get triggered when seeing chrome settings and such
        if (!Aux.isEligibleUrl(url)) return;
        const focusId = generateId();
        const raw = await this.getRaw();
        if (!raw[url] || raw[url].length === 0) {
            return; // should not happen but handled as not recorded
        }
        const sessions = raw[url];
        const selected = sessions[sessionId];
        if (!selected.focus) {
            selected.focus = {};
        }
        selected.focus[focusId] = {
            start: Date.now(),
        };
        await this.saveRaw(raw);
    }

    static async endURLSession(url, sessionId) {
        if (!Aux.isEligibleUrl(url)) {
            return;
        }
        const raw = await this.getRaw();
        if (!raw[url] || raw[url].length === 0) {
            return; // should not happen but handled as not recorded
        }
        const sessions = raw[url];
        const currentSession = sessions[sessionId];
        if (currentSession.end) {
            return; // already ended
        }
        currentSession.end = Date.now();
        currentSession.total = currentSession.end - currentSession.start;
        await this.saveRaw(raw);
    }

    static async endFocus(url, sessionId) {
        if (!Aux.isEligibleUrl(url)) {
            return;
        }
        const raw = await this.getRaw();
        if (!raw[url] || raw[url].length === 0) {
            return; // should not happen but handled as not recorded
        }
        const sessions = raw[url];
        const currentSession = sessions[sessionId]; // always pick the latest session
        // find the one that does not have end. if all goes well, it should be one
        const currentFocus = Object.values(currentSession.focus || {}).find(focus => !focus.end);
        currentFocus.end = now;
        currentFocus.total = currentFocus.end - currentFocus.start;
        await this.saveRaw(raw);
    }

    static async endFocusAllExcept(windowId, selectedTabId) {
        // Instead of querying all tabs, we iterate through storage to find active focus sessions
        // This is more efficient and works even when tabs are being closed
        const raw = await this.getRaw();
        
        for (const url in raw) {
            const sessions = raw[url];
            for (const sessionId in sessions) {
                const session = sessions[sessionId];
                // End focus for any session that:
                // 1. Is in the same window
                // 2. Is NOT the selected tab
                // 3. Has an active focus (has focus object with at least one entry without end)
                if (session.windowId === windowId && session.tabId !== selectedTabId && !session.end) {
                    if (session.focus) {
                        const hasFocus = Object.values(session.focus).some(f => !f.end);
                        if (hasFocus) {
                            await this.endFocus(url, sessionId);
                        }
                    }
                }
            }
        }
    }
}

// event when extension is installed or initiated
chrome.runtime.onInstalled.addListener(async () => {
    await Storage.saveRaw({});
})

chrome.tabs.onCreated.addListener(async (tab) => {
    const tabId = tab.id;
    const windowId = tab.windowId;
    const tld = Aux.getTLD(tab.url);
    await Storage.insertSession(tld, tabId, windowId);
    
    // If this tab is active, also start focus tracking
    if (tab.active) {
        const sessionId = await Storage.findActiveSessionId(tld, windowId, tabId);
        if (sessionId) {
            // End focus on other tabs in this window first
            await Storage.endFocusAllExcept(windowId, tabId);
            await Storage.insertFocus(tld, sessionId);
        }
    }
})

// event when there is change in tab properties
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    try {
        // Only process when URL actually changes
        if (!changeInfo.url) {
            return;
        }
        
        const newUrl = changeInfo.url;
        const newTld = Aux.getTLD(newUrl);
        const newUrlEligible = Aux.isEligibleUrl(newUrl);
        
        // Find if there's an existing active session for this tab
        // We need to search through all URLs since we don't know the previous URL
        const raw = await Storage.getRaw();
        let previousTld = null;
        let previousSessionId = null;
        
        for (const url in raw) {
            const sessions = raw[url];
            for (const sessionId in sessions) {
                const session = sessions[sessionId];
                if (session.windowId === tab.windowId && session.tabId === tabId && !session.end) {
                    previousTld = url;
                    previousSessionId = sessionId;
                    break;
                }
            }
            if (previousSessionId) break;
        }
        
        // Determine what to do based on previous and new states
        const hasPreviousSession = previousSessionId !== null;
        const domainChanged = previousTld !== newTld;
        
        if (hasPreviousSession && (domainChanged || !newUrlEligible)) {
            // End the previous session when:
            // 1. Domain changed (youtube.com -> twitter.com)
            // 2. Or navigating to ineligible URL (youtube.com -> chrome://settings)
            await Storage.endFocus(previousTld, previousSessionId);
            await Storage.endURLSession(previousTld, previousSessionId);
        }
        
        if (newUrlEligible) {
            if (!hasPreviousSession || domainChanged) {
                // Create new session when:
                // 1. No previous session exists (ineligible -> eligible)
                // 2. Or domain changed (youtube.com -> twitter.com)
                await Storage.insertSession(newTld, tabId, tab.windowId);
                
                // If this tab is currently active, also start focus
                if (tab.active) {
                    const newSessionId = await Storage.findActiveSessionId(newTld, tab.windowId, tabId);
                    if (newSessionId) {
                        await Storage.insertFocus(newTld, newSessionId);
                    }
                }
            }
            // If same domain (youtube.com/video1 -> youtube.com/video2), do nothing
            // The session continues tracking the same domain
        }
    } catch (error) {
        console.error('Error in onUpdated listener:', error);
    }
})

// event when a tab is deactivated (loses focus)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        // This fires when a new tab becomes active
        // We need to end focus on the previously active tab and start focus on the new one
        
        // Get the newly activated tab first to ensure it exists and is valid
        const activeTab = await chrome.tabs.get(activeInfo.tabId).catch(() => null);
        if (!activeTab || !activeTab.url) {
            return; // Tab doesn't exist or has no URL yet
        }
        
        // End focus on other tabs in this window
        await Storage.endFocusAllExcept(activeInfo.windowId, activeInfo.tabId);
        
        const activeTld = Aux.getTLD(activeTab.url);
        
        // Skip if URL is not eligible for tracking
        if (!Aux.isEligibleUrl(activeTab.url)) {
            return;
        }
        
        // Check if session exists, if not create one
        let activeSessionId = await Storage.findActiveSessionId(activeTld, activeTab.windowId, activeTab.id);
        if (!activeSessionId) {
            // No session exists, create one first
            await Storage.insertSession(activeTld, activeTab.id, activeTab.windowId);
            activeSessionId = await Storage.findActiveSessionId(activeTld, activeTab.windowId, activeTab.id);
        }
        
        if (activeSessionId) {
            await Storage.insertFocus(activeTld, activeSessionId);
        }
    } catch (error) {
        console.error('Error in onActivated listener:', error);
    }
});

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
    // Tab is already removed, so we need to find it from our storage
    // We'll iterate through all URLs to find the session with matching windowId and tabId
    const raw = await Storage.getRaw();
    
    for (const url in raw) {
        const sessions = raw[url];
        for (const sessionId in sessions) {
            const session = sessions[sessionId];
            if (session.windowId === removeInfo.windowId && session.tabId === tabId && !session.end) {
                // Found the active session for this tab
                await Storage.endFocus(url, sessionId);
                await Storage.endURLSession(url, sessionId);
                return;
            }
        }
    }
})

// event when we choose another chrome windows
chrome.windows.onFocusChanged.addListener(async (windowId) => {
    try {
        if (windowId === chrome.windows.WINDOW_ID_NONE) {
            // Browser lost focus (user switched to another application)
            // End focus on all active sessions across all windows
            const raw = await Storage.getRaw();
            for (const url in raw) {
                const sessions = raw[url];
                for (const sessionId in sessions) {
                    const session = sessions[sessionId];
                    if (!session.end && session.focus) {
                        const hasFocus = Object.values(session.focus).some(f => !f.end);
                        if (hasFocus) {
                            await Storage.endFocus(url, sessionId);
                        }
                    }
                }
            }
            return;
        }
        
        // Browser gained focus on a specific window
        // End focus on tabs in other windows, start focus on active tab in this window
        const raw = await Storage.getRaw();
        
        // End focus on all tabs NOT in this window
        for (const url in raw) {
            const sessions = raw[url];
            for (const sessionId in sessions) {
                const session = sessions[sessionId];
                if (session.windowId !== windowId && !session.end && session.focus) {
                    const hasFocus = Object.values(session.focus).some(f => !f.end);
                    if (hasFocus) {
                        await Storage.endFocus(url, sessionId);
                    }
                }
            }
        }
        
        // Get the active tab in the focused window
        const tabs = await chrome.tabs.query({ windowId: windowId, active: true });
        if (tabs.length === 0) return;
        
        const activeTab = tabs[0];
        if (!Aux.isEligibleUrl(activeTab.url)) return;
        
        const tld = Aux.getTLD(activeTab.url);
        
        // Ensure session exists
        let sessionId = await Storage.findActiveSessionId(tld, activeTab.windowId, activeTab.id);
        if (!sessionId) {
            await Storage.insertSession(tld, activeTab.id, activeTab.windowId);
            sessionId = await Storage.findActiveSessionId(tld, activeTab.windowId, activeTab.id);
        }
        
        if (sessionId) {
            await Storage.insertFocus(tld, sessionId);
        }
    } catch (error) {
        console.error('Error in onFocusChanged listener:', error);
    }
})

chrome.windows.onRemoved.addListener(async (windowId) => {
    try {
        // Window is already removed, so we can't query its tabs
        // Instead, search through storage for all sessions in this window
        const raw = await Storage.getRaw();
        
        for (const url in raw) {
            const sessions = raw[url];
            for (const sessionId in sessions) {
                const session = sessions[sessionId];
                // End all active sessions (not yet ended) in the removed window
                if (session.windowId === windowId && !session.end) {
                    await Storage.endFocus(url, sessionId);
                    await Storage.endURLSession(url, sessionId);
                }
            }
        }
    } catch (error) {
        console.error('Error in onRemoved listener:', error);
    }
})

// event when extension is being suspended; should be consider to end all on going records
chrome.runtime.onSuspend.addListener(async () => {
    const windows = await chrome.windows.getAll();
    for (const window of windows) {
        const tabs = await chrome.tabs.query({ windowId: window.id });
        for (const tab of tabs) {
            const tld = Aux.getTLD(tab.url);
            const sessionId = await Storage.findActiveSessionId(tld, tab.windowId, tab.id);
            if (sessionId) {
                await Storage.endFocus(tld, sessionId);
                await Storage.endURLSession(tld, sessionId);
            }
        }
    }
})