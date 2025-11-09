if (typeof require !== 'undefined') {
    // { ManualTest, Debug } = require("./fn");
}

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
    windowFocusLost: 'window_focus_lost',
    windowFocusGained: 'window_focus_gained',
    windowRemoved: 'window_removed',
    suspend: 'suspend',
    domainChanged: 'domain_changed',
    tabDeactivated: 'tab_deactivated'
}

// event when extension is installed or initiated
chrome.runtime.onInstalled.addListener(async () => {
    await Debug.logEventInstalled();
    const raw = await Storage.getRaw();
    if (raw && Object.keys(raw).length > 0) {
        return;
    }
    await Storage.saveRaw({});
})

// event when browser starts (not just extension install/update)
// how to test:
// 1. Close all browser windows
// 2. Reopen browser
// Note: Pinned tab would be considered as tab updated not tab creation

chrome.runtime.onStartup.addListener(async () => {
    await Debug.logEventStartup();
    const windows = await chrome.windows.getAll({ populate: true });
    for (const window of windows) {
        for (const tab of window.tabs) {
            if (!Aux.isEligibleUrl(tab.url)) continue;
            const tld = Aux.getTLD(tab.url);
            await Storage.insertSession(tld, tab.id, tab.windowId, ev.startup);
            
            if (tab.active && window.focused) {
                const sessionId = await Storage.findActiveSessionId(tld, tab.windowId, tab.id);
                if (sessionId) {
                    await Storage.insertFocus(tld, sessionId);
                }
            }
        }
    }
})

// how to test
// 1. Open a new tab with the middle click so it doesnt get focus right away
// this would trigger the event but Chrome registers the URL under key `pendingUrl`
// therefore, it wont get triggered.
// After that, Chrome would trigger another event onUpdated when the URL is actually set\
// this is when the actual URL is known and we can start tracking it.
// so to conclude, no URL would get recorded on tab creation, only on tab update.
chrome.tabs.onCreated.addListener(async (tab) => {
    await Debug.logEventTabCreated({tab});
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
// A title change can trigger this event, but we only care about URL changes
// however, chrome do a two step event when a new tab is created:
// 1. onCreated with pendingUrl
// 2. onUpdated with actual URL
// Therefore, this event handle both new tab and URL changes in existing tabs
// the harder problem is that we dont know the previous URL of the tab to end its session
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (!changeInfo.url) {
        return;
    }
    await Debug.logEventTabUpdated({tabId, changeInfo, tab});
    const prevSessionId = await Storage.findActiveSessionId(null, tab.windowId, tabId);
    const newTld = Aux.getTLD(changeInfo.url);

    // Only track eligible URLs
    if (!Aux.isEligibleUrl(changeInfo.url)) {
        // If previous session exists, end it due to ineligible URL
        if (prevSessionId) {
            await Storage.endSessionById(prevSessionId, ev.domainChanged);
        }
        return;
    }

    // If previous session exists, check if TLD changed
    if (prevSessionId) {
        const prevSession = await Storage.getSessionById(prevSessionId);
        if (prevSession && prevSession.tld !== newTld) {
            // End previous session due to TLD change
            await Storage.endSessionById(prevSessionId, ev.domainChanged);
            // Start new session for new TLD
            await Storage.insertSession(newTld, tabId, tab.windowId, ev.domainChanged);
        }
    } else {
        // No previous session, create new one
        await Storage.insertSession(newTld, tabId, tab.windowId, ev.tabUpdated);
    }

    // If tab is active, handle focus
    if (tab.active) {
        const sessionId = await Storage.findActiveSessionId(newTld, tab.windowId, tabId);
        if (sessionId) {
            await Storage.endFocusAllExcept(tab.windowId, tabId, ev.tabDeactivated);
            await Storage.insertFocus(newTld, sessionId, ev.tabUpdated);
        }
    }
})

// event when a tab is deactivated (loses focus)
// When we close a tab and move to another tab, the onActivated event fires after onRemoved
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    await Debug.logEventTabActivated({activeInfo});
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
    await Debug.logEventTabRemoved({tabId, removeInfo});
    // Tab is already removed, so we need to find and end it from storage
    await Storage.findAndEndSession(tabId, removeInfo.windowId, ev.tabRemoved);
})

// event when tab is detached from a window (e.g., dragged to become new window or moved)
chrome.tabs.onDetached.addListener(async (tabId, detachInfo) => {
    await Debug.logEventTabDetached({tabId, detachInfo});
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
    await Debug.logEventTabAttached({tabId, attachInfo});
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
    await Debug.logEventTabReplaced({addedTabId, removedTabId});
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
    await Debug.logEventWindowFocusChanged({windowId});
    try {
        if (windowId === chrome.windows.WINDOW_ID_NONE) {
            // Browser lost focus (user switched to another application)
            await Storage.endAllFocusGlobally(ev.windowFocusLost);
            return;
        }
        
        // Browser gained focus on a specific window
        // End focus on tabs in other windows
        await Storage.endFocusInOtherWindows(windowId, ev.windowFocusLost);

        // Get the active tab in the focused window
        const tabs = await chrome.tabs.query({ windowId: windowId, active: true });
        if (tabs.length === 0) return;
        
        const activeTab = tabs[0];
        if (!Aux.isEligibleUrl(activeTab.url)) return;
        
        const tld = Aux.getTLD(activeTab.url);
        
        // Ensure session exists
        let sessionId = await Storage.findActiveSessionId(tld, activeTab.windowId, activeTab.id);
        if (!sessionId) {
            await Storage.insertSession(tld, activeTab.id, activeTab.windowId, ev.windowFocusGained);
            sessionId = await Storage.findActiveSessionId(tld, activeTab.windowId, activeTab.id);
        }
        
        if (sessionId) {
            await Storage.insertFocus(tld, sessionId, ev.windowFocusGained);
        }
    } catch (error) {
        console.error('Error in onFocusChanged listener:', error);
    }
})

chrome.windows.onRemoved.addListener(async (windowId) => {
    await Debug.logEventWindowRemoved({windowId});
    try {
        // Window is already removed, end all sessions in this window
        await Storage.endAllSessionsInWindow(windowId, ev.windowRemoved);
    } catch (error) {
        console.error('Error in onRemoved listener:', error);
    }
})

// event when extension is being suspended; should be consider to end all on going records
chrome.runtime.onSuspend.addListener(async () => {
    await Debug.logEventSuspend();
    // End all active sessions across all windows
    await Storage.endAllActiveSessions(ev.suspend);
})