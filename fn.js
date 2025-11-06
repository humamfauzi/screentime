let _ = {
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
            // Return full hostname including subdomains (e.g. docs.google.com)
            return hostname;
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

    static currentStartAndEnd(time) {
        const startOfDay = new Date(time.getFullYear(), time.getMonth(), time.getDate()).getTime();
        const endOfDay = startOfDay + 86400000 - 1; // End of the day
        return [startOfDay, endOfDay];
    }

    static currentStartAndEndWeek(time) {
        const dayOfWeek = time.getDay(); // 0 (Sun) to 6 (Sat)
        const startOfWeek = new Date(time.getFullYear(), time.getMonth(), time.getDate() - dayOfWeek).getTime();
        const endOfWeek = startOfWeek + 7 * 86400000 - 1; // End of the week
        return [startOfWeek, endOfWeek];
    }

    static focusDivision(start, total) {
        let remaining = Math.ceil(total / 1000); // convert ms to seconds
        let currentHour = start.getHours();
        const divisions = Array.from({ length: 24 }, () => 0); // seconds per hour
        let unixStart = start.getTime();
        while (remaining > 0 && currentHour < 24) {
            const nextUnixHour = new Date(start.getFullYear(), start.getMonth(), start.getDate(), currentHour + 1).getTime();
            const secondsToNextHour = Math.ceil((nextUnixHour - unixStart) / 1000);
            divisions[currentHour] += Math.min(secondsToNextHour, remaining);
            remaining -= secondsToNextHour;
            currentHour++;
            unixStart = nextUnixHour;
        }
        return divisions;
    }
}

class ManualTest {
    static async collectFocusToday() {
        const dateObj = new Date();
        const startDayUnix = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()).getTime();
        const endDayUnix = startDayUnix + 86400000 - 1; // End of the day
        return ManualTest.collectFocus(startDayUnix, endDayUnix);
    }
    static async collectFocus(start, end) {
        const raw = await Storage.getRaw();
        const focus = []
        for (const url in raw) {
            const sessions = raw[url];
            for (const sessionId in sessions) {
                const session = sessions[sessionId];
                if (session.start >= start && session.start <= end && session.focus) {
                    for (const focusId in session.focus) {
                        const f = session.focus[focusId];
                        focus.push({
                            url: url,
                            focus_id: focusId,
                            start_unix: f.start,
                            start: new Date(f.start).toLocaleString(),
                            end: new Date(f.end).toLocaleString(),
                            total: Math.ceil(f.total / 1000),
                            start_reason: f.reason || "NO REASON",
                            end_reason: f.endReason || "NO REASON"
                        })
                    }
                }
            }
        }
        focus.sort((a, b) => a.start_unix - b.start_unix);
        return focus;
    }

    static async activeFocus() {
        const raw = await Storage.getRaw();
        const focus = []
        for (const url in raw) {
            const sessions = raw[url];
            for (const sessionId in sessions) {
                const session = sessions[sessionId];
                if (session.focus) {
                    for (const focusId in session.focus) {
                        const f = session.focus[focusId];
                        if (!f.end) {
                            focus.push({
                                url: url,
                                focus_id: focusId,
                                start_unix: f.start,
                                start: new Date(f.start).toLocaleString(),
                                reason: f.reason || "NO REASON"
                            })
                        }
                    }
                }
            }
        }
        return focus;
    }

    static async activeSession() {
        const raw = await Storage.getRaw();
        const activeSessions = [];
        for (const url in raw) {
            const sessions = raw[url];
            for (const sessionId in sessions) {
                const session = sessions[sessionId];
                if (!session.end) {
                    activeSessions.push({
                        url,
                        session_id: sessionId,
                        start_unix: session.start,
                        start: new Date(session.start).toLocaleString(),
                        tabId: session.tabId,
                        windowId: session.windowId,
                        reason: session.reason || "NO REASON"
                    });
                }
            }
        }
        return activeSessions;
    }
}

class Debug {
    static storageKey = 'debug';
    static saveLock = Promise.resolve();
    
    static async get() {
        const data = await chrome.storage.local.get([this.storageKey]);
        return data[this.storageKey];
    }
    static async save(obj) {
        this.saveLock = this.saveLock.then(async () => {
            const data = await this.get() || [];
            data.push(obj)
            await chrome.storage.local.set({ [this.storageKey]: data });
        })
        return this.saveLock;
    }
    static async logEventInstalled() {
        const message = "Extension installed";
        await this.save({ timestamp: Date.now(), message });
    }
    static async logEventStartup() {
        const message = "Extension started";
        await this.save({ timestamp: Date.now(), message });
    }
    static async logEventTabCreated(props) {
        const message = "Tab created";
        await this.save({ timestamp: Date.now(), message, ...props });
    }
    static async logEventTabUpdated(props) {
        const message = "Tab updated";
        await this.save({ timestamp: Date.now(), message, ...props });
    }
    static async logEventTabActivated(props) {
        const message = "Tab activated";
        await this.save({ timestamp: Date.now(), message, ...props });
    }
    static async logEventTabRemoved(props) {
        const message = "Tab removed"
        await this.save({ timestamp: Date.now(), message, ...props });
    }
    static async logEventTabDetached(props = {}) {
        const message = "Tab detached";
        await this.save({ timestamp: Date.now(), message, ...props });
    }
    static async logEventTabAttached(props = {}) {
        const message = "Tab attached";
        await this.save({ timestamp: Date.now(), message, ...props });
    }
    static async logEventTabReplaced(props = {}) {
        const message = "Tab replaced";
        await this.save({ timestamp: Date.now(), message, ...props });
    }
    static async logEventWindowFocusChanged(props = {}) {
        const message = "Window focus changed";
        await this.save({ timestamp: Date.now(), message, ...props });
    }
    static async logEventWindowRemoved(props = {}) {
        const message = "Window removed";
        await this.save({ timestamp: Date.now(), message, ...props });
    }
    static async logEventSuspend(props = {}) {
        const message = "System suspend";
        await this.save({ timestamp: Date.now(), message, ...props });
    }
}

class Writer {
    static storageKey = 'raw';
}



class Storage {
    static storageKey = 'raw';
    static saveLock = Promise.resolve();

    // ========== READ METHODS (Alphabetical) ==========

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

    static async generateBlockDayData(url) {
        // Set startDay to the start of this week (Sunday), endDay to the start of next week
        const [start, end] = Aux.currentStartAndEndWeek(new Date())
        const raw = await this.getRaw();
        const weekData = [];
        for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
            const dayStart = start + dayOffset * 86400000;
            const dayEnd = dayStart + 86400000 - 1;
            let hourData = Array.from({ length: 24 }, () => ({ strength: 0, number: 0 }));
            if (raw[url]) {
                const sessions = raw[url];
                for (const sessionId in sessions) {
                    const session = sessions[sessionId];
                    if (session.focus) {
                        for (const focusId in session.focus) {
                            const focus = session.focus[focusId];
                            if (focus.total && focus.start >= dayStart && focus.start <= dayEnd) {
                                const focusStart = new Date(focus.start);
                                const hour = focusStart.getHours();
                                hourData[hour].strength += focus.total / 3600000; // convert to hours for strength
                            }
                        }
                    }
                }
            }
            weekData.push(hourData);
        }
        return weekData;
    }

    static async generateBlockHourData(url) {
        // Set startDay to the start of today (midnight), endDay to the start of tomorrow
        const now = new Date();
        const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const endDay = startDay + 24 * 60 * 60 * 1000; // 24 hours in ms

        const raw = await this.getRaw();
        let hourData = Array.from({ length: 24 }, () => ({ strength: 0, number: "" }));
        if (!raw[url]) {
            return hourData; // No data for this URL
        }

        const sessions = raw[url];
        for (const sessionId in sessions) {
            const session = sessions[sessionId];
            if (session.focus) {
                for (const focusId in session.focus) {
                    const focus = session.focus[focusId];
                    if (focus.total && focus.start >= startDay && focus.start < endDay) {
                        const focusStart = new Date(focus.start);
                        const focdiv = Aux.focusDivision(focusStart, focus.total)
                        console.log(`${url}-${new Date(focus.start).toLocaleString()}-${new Date(focus.end).toLocaleString()}:`, focdiv);
                        for (let h = 0; h < 24; h++) {
                            hourData[h].strength += focdiv[h] 
                        }
                    }
                }
            }
        }
        return hourData;
    }

    static async getAverageFocus(start, end) {
        const raw = await this.getRaw();
        let focusSum = 0;
        let focusCount = 0;
        for (const url in raw) {
            const sessions = raw[url];
            for (const sessionId in sessions) {
                const session = sessions[sessionId];
                if (session.focus) {
                    for (const focusId in session.focus) {
                        const focus = session.focus[focusId];
                        if (focus.total && focus.start >= start && focus.start <= end) {
                            focusSum += focus.total;
                            focusCount += 1;
                        }
                    }
                }
            }
        }
        return focusCount === 0 ? 0 : (focusSum / focusCount);
    }

    static async getFocusSum(start, end) {
        const raw = await this.getRaw();
        let focusSum = 0;
        for (const url in raw) {
            const sessions = raw[url];
            for (const sessionId in sessions) {
                const session = sessions[sessionId];
                if (session.focus) {
                    for (const focusId in session.focus) {
                        const focus = session.focus[focusId];
                        if (focus.total && focus.start >= start && focus.start <= end) {
                            focusSum += focus.total;
                        }
                    }
                }
            }
        }
        return focusSum;
    }

    static async getFocusSumByURL(start, end) {
        const raw = await this.getRaw();
        let focusByURL = {};
        for (const url in raw) {
            const sessions = raw[url];
            for (const sessionId in sessions) {
                const session = sessions[sessionId];
                if (session.focus) {
                    for (const focusId in session.focus) {
                        const focus = session.focus[focusId];
                        if (focus.total && focus.start >= start && focus.start <= end) {
                            if (!focusByURL[url]) {
                                focusByURL[url] = 0;
                            }
                            focusByURL[url] += focus.total;
                        }
                    }
                }
            }
        }
        return focusByURL;
    }

    static async getListMostVisitedURLs(start, end, limit = 5) {
        const sorted = await this.getMostVisitedURLs(start, end, limit);
        return sorted.map(entry => entry.url);
    }

    static async getMostVisitedURLs(start, end, limit = 1) {
        const raw = await this.getRaw();
        let visitCounts = {};
        for (const url in raw) {
            const sessions = raw[url];
            for (const sessionId in sessions) {
                const session = sessions[sessionId];
                if (session.start >= start && session.start <= end) {
                    if (!visitCounts[url]) {
                        visitCounts[url] = 0;
                    }
                    visitCounts[url] += 1;
                }
            }
        }
        const sortedVisits = Object.entries(visitCounts).sort((a, b) => b[1] - a[1]);
        return sortedVisits.slice(0, limit).map(entry => ({ url: entry[0], count: entry[1] }));
    }

    static async getRaw() {
        const data = await chrome.storage.local.get([this.storageKey]);
        return data[this.storageKey] || {};
    }

    static async totalSitesVisited(start, end) {
        const raw = await this.getRaw();
        let siteCount = 0;
        for (const url in raw) {
            const sessions = raw[url];
            for (const sessionId in sessions) {
                const session = sessions[sessionId];
                if (session.start >= start && session.start <= end) {
                    siteCount += 1;
                    break; // Count each URL only once
                }
            }
        }
        return siteCount;
    }

    // ========== WRITE METHODS (Alphabetical) ==========

    static async endAllActiveSessions(reason="") {
        const raw = await this.getRaw();
        
        for (const url in raw) {
            const sessions = raw[url];
            for (const sessionId in sessions) {
                const session = sessions[sessionId];
                if (!session.end) {
                    await this.endFocus(url, sessionId, reason);
                    await this.endURLSession(url, sessionId, reason);
                }
            }
        }
    }

    static async endAllFocusGlobally(reason) {
        const raw = await this.getRaw();
        
        for (const url in raw) {
            const sessions = raw[url];
            for (const sessionId in sessions) {
                const session = sessions[sessionId];
                if (!session.end && session.focus) {
                    const hasFocus = Object.values(session.focus).some(f => !f.end);
                    if (hasFocus) {
                        await this.endFocus(url, sessionId, reason);
                    }
                }
            }
        }
    }

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

    static async endAllSessionsInWindow(windowId, reason="") {
        const raw = await this.getRaw();
        
        for (const url in raw) {
            const sessions = raw[url];
            for (const sessionId in sessions) {
                const session = sessions[sessionId];
                if (session.windowId === windowId && !session.end) {
                    await this.endFocus(url, sessionId, reason);
                    await this.endURLSession(url, sessionId, reason);
                }
            }
        }
    }

    static async endFocus(url, sessionId, reason) {
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
        currentFocus.endReason = reason
        await this.saveRaw(raw);
    }

    static async endFocusAllExcept(windowId, selectedTabId, reason="") {
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
                            await this.endFocus(url, sessionId, reason);
                        }
                    }
                }
            }
        }
    }

    static async endFocusInOtherWindows(windowId, reason="") {
        const raw = await this.getRaw();
        
        for (const url in raw) {
            const sessions = raw[url];
            for (const sessionId in sessions) {
                const session = sessions[sessionId];
                if (session.windowId !== windowId && !session.end && session.focus) {
                    const hasFocus = Object.values(session.focus).some(f => !f.end);
                    if (hasFocus) {
                        await this.endFocus(url, sessionId, reason);
                    }
                }
            }
        }
    }

    static async endURLSession(url, sessionId, reason="") {
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
        currentSession.endReason = reason
        await this.saveRaw(raw);
    }

    static async findAndEndSession(tabId, windowId, reason="") {
        const raw = await this.getRaw();
        for (const url in raw) {
            const sessions = raw[url];
            for (const sessionId in sessions) {
                const session = sessions[sessionId];
                if (session.windowId === windowId && session.tabId === tabId && !session.end) {
                    await this.endFocus(url, sessionId, reason);
                    await this.endURLSession(url, sessionId, reason);
                    return true; // Found and ended
                }
            }
        }
        return false; // Not found
    }

    static async insertFocus(url, sessionId, reason="") {
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
            reason: reason
        };
        await this.saveRaw(raw);
    }

    static async insertSession(url, tabId, windowId, reason="") {
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
            reason
        };
        await this.saveRaw(raw);
    }

    static async saveRaw(raw) {
        this.saveLock = this.saveLock.then(async () => {
            await chrome.storage.local.set({ [this.storageKey]: raw });
        });
        return this.saveLock;
    }
}

class BlockHourDiagram {
    /**
     * Creates a 24-hour block diagram
     * @param {Array} data - Array of 24 objects with {strength: number, number: number}
     *                       strength: 0-1 value for opacity (0 = transparent, 1 = opaque)
     *                       number: value to display in the block
     * @param {Object} options - Configuration options
     * @returns {HTMLElement} - Container element with the diagram
     */
    static create(data, options = {}) {
        if (!Array.isArray(data) || data.length !== 24) {
            throw new Error('Data must be an array of 24 objects');
        }

        const defaults = {
            width: '100%',
            height: '60px',
            baseColor: '#4A90E2',
            textColor: '#333',
            borderColor: '#ddd',
            quarterMarkColor: '#999',
            quarterMarkWidth: '2px'
        };

        const config = { ...defaults, ...options };

        // Create container
        const container = document.createElement('div');
        container.className = 'block-hour-diagram';
        container.style.cssText = `
            display: flex;
            width: ${config.width};
            height: ${config.height};
            border: 1px solid ${config.borderColor};
            border-radius: 4px;
            overflow: hidden;
        `;

        // Create 24 blocks
        for (let i = 0; i < 24; i++) {
            const blockData = data[i] || { strength: 0, number: 0 };
            const strength = blockData.strength / 3600;
            const displayNumber = blockData.strength !== undefined ? blockData.strength : '';

            const block = document.createElement('div');
            block.className = 'hour-block';
            block.dataset.hour = i;
            
            // Add quarter-day markers (after hours 6, 12, 18) minus one because index start from 0
            const hasMarker = i === 5 || i === 11 || i === 17;
            block.style.cssText = `
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                background-color: ${this._hexToRgba(config.baseColor, strength)};
                color: ${config.textColor};
                font-size: 11px;
                font-weight: 500;
                transition: all 0.2s;
                cursor: pointer;
                position: relative;
                ${hasMarker ? `border-right: ${config.quarterMarkWidth} solid ${config.quarterMarkColor};` : 'border-right: 1px solid rgba(0,0,0,0.05);'}
            `;

            // Add hover effect
            block.addEventListener('mouseenter', () => {
                block.style.transform = 'scale(1.05)';
                block.style.zIndex = '10';
                block.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
            });

            block.addEventListener('mouseleave', () => {
                block.style.transform = 'scale(1)';
                block.style.zIndex = '1';
                block.style.boxShadow = 'none';
            });

            // Add tooltip
            block.title = `Hour ${i}:00 - Value: ${displayNumber}`;

            // Add number display
            const numberSpan = document.createElement('span');
            numberSpan.textContent = "";
            block.appendChild(numberSpan);

            container.appendChild(block);
        }
        return container;
    }

    /**
     * Converts hex color to rgba with opacity
     * @private
     */
    static _hexToRgba(hex, alpha) {
        // Remove # if present
        hex = hex.replace('#', '');
        
        // Parse hex values
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * Updates existing diagram with new data
     * @param {HTMLElement} container - The diagram container
     * @param {Array} data - New data array
     */
    static update(container, data) {
        if (!container || !container.classList.contains('block-hour-diagram')) {
            throw new Error('Invalid container element');
        }

        if (!Array.isArray(data) || data.length !== 24) {
            throw new Error('Data must be an array of 24 objects');
        }

        const blocks = container.querySelectorAll('.hour-block');
        const baseColor = '#4A90E2'; // Default, could be extracted from options

        blocks.forEach((block, i) => {
            const blockData = data[i] || { strength: 0, number: 0 };
            const strength = Math.max(0, Math.min(1, blockData.strength || 0));
            const displayNumber = blockData.number !== undefined ? blockData.number : '';

            block.style.backgroundColor = this._hexToRgba(baseColor, strength);
            block.querySelector('span').textContent = displayNumber;
            block.title = `Hour ${i}:00 - Value: ${displayNumber}`;
        });
    }

    /**
     * Creates sample data for testing
     * @returns {Array} Sample data array
     */
    static createSampleData() {
        return Array.from({ length: 24 }, (_, i) => ({
            strength: Math.random(),
            number: Math.floor(Math.random() * 100)
        }));
    }
}

class BlockDayDiagram {
    /**
     * Creates a 7-day x 24-hour block diagram representing a week
     * @param {Array} data - Array of 7 arrays, each containing 24 objects with {strength: number, number: number}
     *                       strength: 0-1 value for opacity (0 = transparent, 1 = opaque)
     *                       number: value to display in the block
     * @param {Object} options - Configuration options
     * @returns {HTMLElement} - Container element with the diagram
     */
    static create(data, options = {}) {
        if (!Array.isArray(data) || data.length !== 7) {
            throw new Error('Data must be an array of 7 arrays (one for each day)');
        }

        for (let i = 0; i < 7; i++) {
            if (!Array.isArray(data[i]) || data[i].length !== 24) {
                throw new Error(`Day ${i} must have 24 hours of data`);
            }
        }

        const defaults = {
            width: '100%',
            height: 'auto',
            baseColor: '#4A90E2',
            textColor: '#333',
            borderColor: '#ddd',
            quarterMarkColor: '#999',
            quarterMarkWidth: '2px',
            blockHeight: '40px',
            dayLabelWidth: '30px',
            dayLabelColor: '#666',
            dayLabelFontSize: '12px'
        };

        const config = { ...defaults, ...options };

        // Day labels
        const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

        // Create main container
        const mainContainer = document.createElement('div');
        mainContainer.className = 'block-day-diagram';
        mainContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            width: ${config.width};
            border: 1px solid ${config.borderColor};
            border-radius: 4px;
            overflow: hidden;
        `;

        // Create header with hour markers
        const header = document.createElement('div');
        header.className = 'block-day-header';
        header.style.cssText = `
            display: flex;
            height: 25px;
            border-bottom: 1px solid ${config.borderColor};
            background-color: #f8f8f8;
        `;

        // Empty corner for day label column
        const cornerCell = document.createElement('div');
        cornerCell.style.cssText = `
            width: ${config.dayLabelWidth};
            flex-shrink: 0;
            border-right: 1px solid ${config.borderColor};
        `;
        header.appendChild(cornerCell);

        // Hour markers container
        const hourMarkersContainer = document.createElement('div');
        hourMarkersContainer.style.cssText = `
            flex: 1;
            display: flex;
            position: relative;
        `;

        // Add quarter markers (6, 12, 18) in the header
        for (let h = 0; h < 24; h++) {
            const hourMarker = document.createElement('div');
            hourMarker.style.cssText = `
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                color: ${config.dayLabelColor};
                position: relative;
                ${(h === 6 || h === 12 || h === 18) ? `border-right: ${config.quarterMarkWidth} solid ${config.quarterMarkColor};` : ''}
            `;
            
            // Show numbers at quarters
            if (h === 6 || h === 12 || h === 18) {
                hourMarker.textContent = h;
                hourMarker.style.fontWeight = 'bold';
            }
            
            hourMarkersContainer.appendChild(hourMarker);
        }

        header.appendChild(hourMarkersContainer);
        mainContainer.appendChild(header);

        // Create 7 rows (one for each day)
        for (let day = 0; day < 7; day++) {
            const row = document.createElement('div');
            row.className = 'block-day-row';
            row.style.cssText = `
                display: flex;
                border-bottom: 1px solid ${config.borderColor};
            `;

            // Day label
            const dayLabel = document.createElement('div');
            dayLabel.className = 'day-label';
            dayLabel.textContent = dayLabels[day];
            dayLabel.style.cssText = `
                width: ${config.dayLabelWidth};
                flex-shrink: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                font-size: ${config.dayLabelFontSize};
                color: ${config.dayLabelColor};
                background-color: #f8f8f8;
                border-right: 1px solid ${config.borderColor};
            `;
            row.appendChild(dayLabel);

            // Blocks container for this day
            const blocksContainer = document.createElement('div');
            blocksContainer.className = 'day-blocks-container';
            blocksContainer.style.cssText = `
                flex: 1;
                display: flex;
                height: ${config.blockHeight};
            `;

            // Create 24 blocks for each hour
            for (let hour = 0; hour < 24; hour++) {
                const blockData = data[day][hour] || { strength: 0, number: 0 };
                const strength = Math.max(0, Math.min(1, blockData.strength || 0));
                const displayNumber = blockData.number !== undefined ? blockData.number : '';

                const block = document.createElement('div');
                block.className = 'hour-block';
                block.dataset.day = day;
                block.dataset.hour = hour;
                
                // Add quarter-day markers (after hours 6, 12, 18)
                const hasMarker = hour === 6 || hour === 12 || hour === 18;
                
                block.style.cssText = `
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background-color: ${this._hexToRgba(config.baseColor, strength)};
                    color: ${config.textColor};
                    font-size: 10px;
                    font-weight: 500;
                    transition: all 0.2s;
                    cursor: pointer;
                    position: relative;
                    ${hasMarker ? `border-right: ${config.quarterMarkWidth} solid ${config.quarterMarkColor};` : 'border-right: 1px solid rgba(0,0,0,0.05);'}
                `;

                // Add hover effect
                block.addEventListener('mouseenter', () => {
                    block.style.transform = 'scale(1.1)';
                    block.style.zIndex = '10';
                    block.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
                });

                block.addEventListener('mouseleave', () => {
                    block.style.transform = 'scale(1)';
                    block.style.zIndex = '1';
                    block.style.boxShadow = 'none';
                });

                // Add tooltip
                block.title = `${dayLabels[day]} ${hour}:00 - Value: ${displayNumber}`;

                // Add number display
                const numberSpan = document.createElement('span');
                numberSpan.textContent = displayNumber;
                block.appendChild(numberSpan);

                blocksContainer.appendChild(block);
            }

            row.appendChild(blocksContainer);
            mainContainer.appendChild(row);
        }

        return mainContainer;
    }

    /**
     * Converts hex color to rgba with opacity
     * @private
     */
    static _hexToRgba(hex, alpha) {
        // Remove # if present
        hex = hex.replace('#', '');
        
        // Parse hex values
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * Updates existing diagram with new data
     * @param {HTMLElement} container - The diagram container
     * @param {Array} data - New data array (7 days x 24 hours)
     */
    static update(container, data) {
        if (!container || !container.classList.contains('block-day-diagram')) {
            throw new Error('Invalid container element');
        }

        if (!Array.isArray(data) || data.length !== 7) {
            throw new Error('Data must be an array of 7 arrays (one for each day)');
        }

        for (let i = 0; i < 7; i++) {
            if (!Array.isArray(data[i]) || data[i].length !== 24) {
                throw new Error(`Day ${i} must have 24 hours of data`);
            }
        }

        const baseColor = '#4A90E2'; // Default, could be extracted from options
        const rows = container.querySelectorAll('.block-day-row');

        rows.forEach((row, day) => {
            const blocks = row.querySelectorAll('.hour-block');
            blocks.forEach((block, hour) => {
                const blockData = data[day][hour] || { strength: 0, number: 0 };
                const strength = Math.max(0, Math.min(1, blockData.strength || 0));
                const displayNumber = blockData.number !== undefined ? blockData.number : '';

                block.style.backgroundColor = this._hexToRgba(baseColor, strength);
                block.querySelector('span').textContent = displayNumber;
                
                const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
                block.title = `${dayLabels[day]} ${hour}:00 - Value: ${displayNumber}`;
            });
        });
    }

    /**
     * Creates sample data for testing
     * @returns {Array} Sample data array (7 days x 24 hours)
     */
    static createSampleData() {
        return Array.from({ length: 7 }, () =>
            Array.from({ length: 24 }, () => ({
                strength: Math.random(),
                number: Math.floor(Math.random() * 100)
            }))
        );
    }
}

class Span {}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Aux, Storage, BlockHourDiagram, BlockDayDiagram, ManualTest, Debug };
}