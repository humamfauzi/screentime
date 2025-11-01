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

    static generateId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
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
        const sessionId = Aux.generateId();
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
        const focusId = Aux.generateId();
        const raw = await this.getRaw();
        if (!raw[url] || Object.keys(raw[url]).length === 0) {
            return; // should not happen but handled as not recorded
        }
        const sessions = raw[url];
        const selected = sessions[sessionId];
        if (!selected) {
            return; // session doesn't exist
        }
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
        if (!raw[url] || Object.keys(raw[url]).length === 0) {
            return; // should not happen but handled as not recorded
        }
        const sessions = raw[url];
        const currentSession = sessions[sessionId];
        if (!currentSession || currentSession.end) {
            return; // session doesn't exist or already ended
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
        if (!raw[url] || Object.keys(raw[url]).length === 0) {
            return; // should not happen but handled as not recorded
        }
        const sessions = raw[url];
        const currentSession = sessions[sessionId];
        if (!currentSession) {
            return; // session doesn't exist
        }
        // find the one that does not have end. if all goes well, it should be one
        const currentFocus = Object.values(currentSession.focus || {}).find(focus => !focus.end);
        if (!currentFocus) {
            return; // no active focus to end
        }
        const now = Date.now();
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

    // Helper method: Find and end session by tabId and windowId
    static async findAndEndSession(tabId, windowId) {
        const raw = await this.getRaw();
        
        for (const url in raw) {
            const sessions = raw[url];
            for (const sessionId in sessions) {
                const session = sessions[sessionId];
                if (session.windowId === windowId && session.tabId === tabId && !session.end) {
                    await this.endFocus(url, sessionId);
                    await this.endURLSession(url, sessionId);
                    return true; // Found and ended
                }
            }
        }
        return false; // Not found
    }

    // Helper method: End all focus in a specific window (except one tab)
    static async endAllFocusInWindow(windowId, exceptTabId = null) {
        const raw = await this.getRaw();
        
        for (const url in raw) {
            const sessions = raw[url];
            for (const sessionId in sessions) {
                const session = sessions[sessionId];
                if (session.windowId === windowId && session.tabId !== exceptTabId && !session.end) {
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

    // Helper method: End all focus globally (across all windows)
    static async endAllFocusGlobally() {
        const raw = await this.getRaw();
        
        for (const url in raw) {
            const sessions = raw[url];
            for (const sessionId in sessions) {
                const session = sessions[sessionId];
                if (!session.end && session.focus) {
                    const hasFocus = Object.values(session.focus).some(f => !f.end);
                    if (hasFocus) {
                        await this.endFocus(url, sessionId);
                    }
                }
            }
        }
    }

    // Helper method: End all active sessions in a specific window
    static async endAllSessionsInWindow(windowId) {
        const raw = await this.getRaw();
        
        for (const url in raw) {
            const sessions = raw[url];
            for (const sessionId in sessions) {
                const session = sessions[sessionId];
                if (session.windowId === windowId && !session.end) {
                    await this.endFocus(url, sessionId);
                    await this.endURLSession(url, sessionId);
                }
            }
        }
    }

    // Helper method: End all active sessions globally
    static async endAllActiveSessions() {
        const raw = await this.getRaw();
        
        for (const url in raw) {
            const sessions = raw[url];
            for (const sessionId in sessions) {
                const session = sessions[sessionId];
                if (!session.end) {
                    await this.endFocus(url, sessionId);
                    await this.endURLSession(url, sessionId);
                }
            }
        }
    }

    // Helper method: End focus in all windows except one
    static async endFocusInOtherWindows(windowId) {
        const raw = await this.getRaw();
        
        for (const url in raw) {
            const sessions = raw[url];
            for (const sessionId in sessions) {
                const session = sessions[sessionId];
                if (session.windowId !== windowId && !session.end && session.focus) {
                    const hasFocus = Object.values(session.focus).some(f => !f.end);
                    if (hasFocus) {
                        await this.endFocus(url, sessionId);
                    }
                }
            }
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Aux, Storage };
}