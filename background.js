const Storage = StorageV2;

if (typeof importScripts !== 'undefined') {
    importScripts('fn.js');
}

let currentFocus = null; // object {url, tabId}

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
    // StorageV2 handles its own initialization.
});

// event when browser starts (not just extension install/update)
chrome.runtime.onStartup.addListener(async () => {
    await Debug.logEventStartup();
    // Find the active tab in the focused window
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tabs.length > 0) {
        const tab = tabs[0];
        if (Aux.isEligibleUrl(tab.url)) {
            const tld = Aux.getTLD(tab.url);
            await Storage.insertFocus(tld, ev.startup);
            currentFocus = {url: tld, tabId: tab.id};
        }
    }
});

// A new tab is created. It may or may not be active.
chrome.tabs.onCreated.addListener(async (tab) => {
    await Debug.logEventTabCreated({tab});
    
    // If the new tab is not active, we don't need to do anything.
    // The focus remains on the currently active tab.
    if (!tab.active) {
        return;
    }

    // The new tab is active, so it steals focus.
    // End focus on the previously focused tab.
    if (currentFocus && currentFocus.url) {
        await Storage.endFocus(currentFocus.url, ev.tabDeactivated);
    }

    const tld = Aux.getTLD(tab.url);
    
    // Only track eligible URLs
    if (!Aux.isEligibleUrl(tab.url)) {
        currentFocus = null; // The new active tab is not trackable
        return;
    }
    
    // Start focus for the new tab
    await Storage.insertFocus(tld, ev.tabCreated);
    currentFocus = {url: tld, tabId: tab.id};
});

// The URL of a tab has changed.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // We only care about URL changes for the moment.
    if (!changeInfo.url) {
        return;
    }
    await Debug.logEventTabUpdated({tabId, changeInfo, tab});

    // If the updated tab is not the one in focus, we don't need to do anything.
    // This can happen for background tabs.
    if (!tab.active || (currentFocus && tabId !== currentFocus.tabId)) {
        return;
    }

    const newTld = Aux.getTLD(changeInfo.url);

    // If the TLD is the same, do nothing.
    if (currentFocus && newTld === currentFocus.url) {
        return;
    }

    // The URL of the focused tab has changed. End focus on the old URL.
    if (currentFocus && currentFocus.url) {
        await Storage.endFocus(currentFocus.url, ev.domainChanged);
    }

    // If the new URL is not eligible, we are done.
    if (!Aux.isEligibleUrl(changeInfo.url)) {
        currentFocus = null;
        return;
    }

    // Start focus on the new TLD.
    await Storage.insertFocus(newTld, ev.tabUpdated);
    currentFocus = {url: newTld, tabId: tab.id};
});

// The user has switched to a different tab.
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    await Debug.logEventTabActivated({activeInfo});
    try {
        // End focus on the previously focused tab.
        if (currentFocus && currentFocus.url) {
            await Storage.endFocus(currentFocus.url, ev.tabDeactivated);
        }

        // Get the newly activated tab to start a new focus session.
        const activeTab = await chrome.tabs.get(activeInfo.tabId).catch(() => null);
        if (!activeTab || !Aux.isEligibleUrl(activeTab.url)) {
            currentFocus = null; // The new tab is not trackable.
            return;
        }
        
        const activeTld = Aux.getTLD(activeTab.url);
        
        // Start focus on the new tab.
        await Storage.insertFocus(activeTld, ev.tabActivated);
        currentFocus = {url: activeTld, tabId: activeInfo.tabId};

    } catch (error) {
        console.error('Error in onActivated listener:', error);
    }
});

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
    await Debug.logEventTabRemoved({tabId, removeInfo});
    // If the removed tab was the one in focus, end the focus.
    if (currentFocus && currentFocus.tabId === tabId) {
        await Storage.endFocus(currentFocus.url, ev.tabRemoved);
        currentFocus = null;
    }
});

// A tab is detached from a window, perhaps to become a new window.
chrome.tabs.onDetached.addListener(async (tabId, detachInfo) => {
    await Debug.logEventTabDetached({tabId, detachInfo});
    // The tab is in transit. If it was the focused tab, its focus should end.
    // A new focus will start when it is attached to a new window or when a new tab becomes active.
    if (currentFocus && currentFocus.tabId === tabId) {
        await Storage.endFocus(currentFocus.url, ev.tabDetached);
        currentFocus = null;
    }
});

// A tab is attached to a window.
chrome.tabs.onAttached.addListener(async (tabId, attachInfo) => {
    await Debug.logEventTabAttached({tabId, attachInfo});
    // When a tab is attached, it might become the active tab in that window.
    // We'll rely on the onActivated event to handle the focus change.
    // No action needed here as onActivated will fire if this tab becomes active.
});

// A tab is replaced by another, e.g. due to prerendering.
chrome.tabs.onReplaced.addListener(async (addedTabId, removedTabId) => {
    await Debug.logEventTabReplaced({addedTabId, removedTabId});
    // If the replaced tab was the one in focus, update the tabId.
    if (currentFocus && currentFocus.tabId === removedTabId) {
        currentFocus.tabId = addedTabId;
    }
});

// The user has switched to a different window.
chrome.windows.onFocusChanged.addListener(async (windowId) => {
    await Debug.logEventWindowFocusChanged({windowId});
    try {
        // End focus on the previously focused tab.
        if (currentFocus && currentFocus.url) {
            await Storage.endFocus(currentFocus.url, ev.windowFocusLost);
            currentFocus = null;
        }

        // If the browser has lost focus entirely
        if (windowId === chrome.windows.WINDOW_ID_NONE) {
            return;
        }
        
        // Browser gained focus on a specific window. Start focus on its active tab.
        const tabs = await chrome.tabs.query({ windowId: windowId, active: true });
        if (tabs.length === 0) return;
        
        const activeTab = tabs[0];
        if (!Aux.isEligibleUrl(activeTab.url)) return;
        
        const tld = Aux.getTLD(activeTab.url);
        
        await Storage.insertFocus(tld, ev.windowFocusGained);
        currentFocus = {url: tld, tabId: activeTab.id};

    } catch (error) {
        console.error('Error in onFocusChanged listener:', error);
    }
});

chrome.windows.onRemoved.addListener(async (windowId) => {
    await Debug.logEventWindowRemoved({windowId});
    // If the closed window contained the focused tab, the focus ends.
    // The onRemoved event for the tab itself will handle ending the focus,
    // so no specific action is needed here for focus management.
    // We just log the event.
});

// The extension is being suspended.
chrome.runtime.onSuspend.addListener(async () => {
    await Debug.logEventSuspend();
    // End the current focus session before suspension.
    if (currentFocus && currentFocus.url) {
        await Storage.endFocus(currentFocus.url, ev.suspend);
        currentFocus = null;
    }
});