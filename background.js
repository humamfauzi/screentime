
if (typeof importScripts !== 'undefined') {
    importScripts('fn.js');
}

const ev = {
    startup: 'startup',
    tabCreated: 'tab_created',
    tabUpdated: 'tab_updated',
    tabActivated: 'tab_activated',
    tabRemoved: 'tab_removed',
    tabDetached: 'tab_detached',
    tabAttached: 'tab_attached',
    tabReplaced: 'tab_replaced',
    windowFocusChanged: 'window_focus_changed',
    windowRemoved: 'window_removed',
    suspend: 'suspend',
    domainChanged: 'domain_changed',
    tabDeactivated: 'tab_deactivated'
}

// event when extension is installed or initiated
chrome.runtime.onInstalled.addListener(async () => {
    await Storage.saveRaw({});
})

// event when browser starts (not just extension install/update)
chrome.runtime.onStartup.addListener(async () => {
    try {
        // Browser is starting, initialize tracking for all existing tabs
        const windows = await chrome.windows.getAll({ populate: true });
        
        for (const window of windows) {
            for (const tab of window.tabs) {
                if (!Aux.isEligibleUrl(tab.url)) continue;
                
                const tld = Aux.getTLD(tab.url);
                
                // Create session for this tab
                await Storage.insertSession(tld, tab.id, tab.windowId, ev.startup);
                
                // If this tab is active and window is focused, start focus tracking
                if (tab.active && window.focused) {
                    const sessionId = await Storage.findActiveSessionId(tld, tab.windowId, tab.id);
                    if (sessionId) {
                        await Storage.insertFocus(tld, sessionId);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error in onStartup listener:', error);
    }
})

chrome.tabs.onCreated.addListener(async (tab) => {
    const tabId = tab.id;
    const windowId = tab.windowId;
    const tld = Aux.getTLD(tab.url);
    
    // Only track eligible URLs
    if (!Aux.isEligibleUrl(tab.url)) {
        return;
    }
    
    await Storage.insertSession(tld, tabId, windowId, ev.tabCreated);
    
    // If this tab is active, also start focus tracking
    if (tab.active) {
        const sessionId = await Storage.findActiveSessionId(tld, windowId, tabId);
        if (sessionId) {
            // End focus on other tabs in this window first
            await Storage.endFocusAllExcept(windowId, tabId, ev.tabCreated);
            await Storage.insertFocus(tld, sessionId, ev.tabCreated);
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
            await Storage.endFocus(previousTld, previousSessionId, ev.domainChanged);
            await Storage.endURLSession(previousTld, previousSessionId, ev.domainChanged);
        }
        
        if (newUrlEligible) {
            if (!hasPreviousSession || domainChanged) {
                // Create new session when:
                // 1. No previous session exists (ineligible -> eligible)
                // 2. Or domain changed (youtube.com -> twitter.com)
                await Storage.insertSession(newTld, tabId, tab.windowId, ev.tabUpdated);
                
                // If this tab is currently active, also start focus
                if (tab.active) {
                    const newSessionId = await Storage.findActiveSessionId(newTld, tab.windowId, tabId);
                    if (newSessionId) {
                        await Storage.insertFocus(newTld, newSessionId, ev.tabUpdated);
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
        await Storage.endFocusAllExcept(activeInfo.windowId, activeInfo.tabId, ev.tabDeactivated);

        const activeTld = Aux.getTLD(activeTab.url);
        
        // Skip if URL is not eligible for tracking
        if (!Aux.isEligibleUrl(activeTab.url)) {
            return;
        }
        
        // Check if session exists, if not create one
        let activeSessionId = await Storage.findActiveSessionId(activeTld, activeTab.windowId, activeTab.id);
        if (!activeSessionId) {
            // No session exists, create one first
            await Storage.insertSession(activeTld, activeTab.id, activeTab.windowId, ev.tabActivated);
            activeSessionId = await Storage.findActiveSessionId(activeTld, activeTab.windowId, activeTab.id);
        }
        
        if (activeSessionId) {
            await Storage.insertFocus(activeTld, activeSessionId, ev.tabActivated);
        }
    } catch (error) {
        console.error('Error in onActivated listener:', error);
    }
});

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
    // Tab is already removed, so we need to find and end it from storage
    await Storage.findAndEndSession(tabId, removeInfo.windowId, ev.tabRemoved);
})

// event when tab is detached from a window (e.g., dragged to become new window or moved)
chrome.tabs.onDetached.addListener(async (tabId, detachInfo) => {
    try {
        // Tab is being moved, end focus (it will restart when attached)
        // We keep the session alive but end focus during the transition
        const raw = await Storage.getRaw();
        for (const url in raw) {
            const sessions = raw[url];
            for (const sessionId in sessions) {
                const session = sessions[sessionId];
                if (session.tabId === tabId && session.windowId === detachInfo.oldWindowId && !session.end) {
                    // End focus during detachment
                    await Storage.endFocus(url, sessionId, ev.tabDetached);
                    break;
                }
            }
        }
    } catch (error) {
        console.error('Error in onDetached listener:', error);
    }
})

// event when tab is attached to a window (after being detached)
chrome.tabs.onAttached.addListener(async (tabId, attachInfo) => {
    try {
        // Tab has been attached to a new window, update the windowId in session
        const raw = await Storage.getRaw();
        let updated = false;
        
        for (const url in raw) {
            const sessions = raw[url];
            for (const sessionId in sessions) {
                const session = sessions[sessionId];
                if (session.tabId === tabId && !session.end) {
                    // Update the windowId for this session
                    session.windowId = attachInfo.newWindowId;
                    updated = true;
                    
                    // Get tab info to check if it's active
                    const tab = await chrome.tabs.get(tabId).catch(() => null);
                    if (tab && tab.active) {
                        // If tab is active in new window, start focus
                        await Storage.endFocusAllExcept(attachInfo.newWindowId, tabId, ev.tabDeactivated);
                        await Storage.insertFocus(url, sessionId, ev.tabActivated);
                    }
                    break;
                }
            }
            if (updated) break;
        }
        
        if (updated) {
            await Storage.saveRaw(raw);
        }
    } catch (error) {
        console.error('Error in onAttached listener:', error);
    }
})

// event when tab is replaced (rare, but can happen with prerendering or instant navigation)
chrome.tabs.onReplaced.addListener(async (addedTabId, removedTabId) => {
    try {
        // A tab has been replaced with another tab
        // Transfer the session from the old tab to the new tab
        const raw = await Storage.getRaw();
        let transferred = false;
        
        for (const url in raw) {
            const sessions = raw[url];
            for (const sessionId in sessions) {
                const session = sessions[sessionId];
                if (session.tabId === removedTabId && !session.end) {
                    // Update the tabId to the new tab
                    session.tabId = addedTabId;
                    session.reason = ev.tabReplaced;
                    transferred = true;
                    break;
                }
            }
            if (transferred) break;
        }
        
        if (transferred) {
            await Storage.saveRaw(raw);
        }
    } catch (error) {
        console.error('Error in onReplaced listener:', error);
    }
})

// event when we choose another chrome windows
chrome.windows.onFocusChanged.addListener(async (windowId) => {
    try {
        if (windowId === chrome.windows.WINDOW_ID_NONE) {
            // Browser lost focus (user switched to another application)
            await Storage.endAllFocusGlobally(ev.windowFocusChanged);
            return;
        }
        
        // Browser gained focus on a specific window
        // End focus on tabs in other windows
        await Storage.endFocusInOtherWindows(windowId, ev.windowFocusChanged);
        
        // Get the active tab in the focused window
        const tabs = await chrome.tabs.query({ windowId: windowId, active: true });
        if (tabs.length === 0) return;
        
        const activeTab = tabs[0];
        if (!Aux.isEligibleUrl(activeTab.url)) return;
        
        const tld = Aux.getTLD(activeTab.url);
        
        // Ensure session exists
        let sessionId = await Storage.findActiveSessionId(tld, activeTab.windowId, activeTab.id);
        if (!sessionId) {
            await Storage.insertSession(tld, activeTab.id, activeTab.windowId, ev.windowFocusChanged);
            sessionId = await Storage.findActiveSessionId(tld, activeTab.windowId, activeTab.id);
        }
        
        if (sessionId) {
            await Storage.insertFocus(tld, sessionId, ev.windowFocusChanged);
        }
    } catch (error) {
        console.error('Error in onFocusChanged listener:', error);
    }
})

chrome.windows.onRemoved.addListener(async (windowId) => {
    try {
        // Window is already removed, end all sessions in this window
        await Storage.endAllSessionsInWindow(windowId, ev.windowRemoved);
    } catch (error) {
        console.error('Error in onRemoved listener:', error);
    }
})

// event when extension is being suspended; should be consider to end all on going records
chrome.runtime.onSuspend.addListener(async () => {
    // End all active sessions across all windows
    await Storage.endAllActiveSessions(ev.suspend);
})