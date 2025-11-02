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
    static async getListMostVisitedURLs(start, end, limit = 5) {
        const sorted = await this.getMostVisitedURLs(start, end, limit);
        return sorted.map(entry => entry.url);
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

    static async generateBlockHourData(url) {
        // Set startDay to the start of today (midnight), endDay to the start of tomorrow
        const now = new Date();
        const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const endDay = startDay + 24 * 60 * 60 * 1000; // 24 hours in ms

        const raw = await this.getRaw();
        let hourData = Array.from({ length: 24 }, () => ({ strength: 0, number: 0 }));
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
                        const hour = focusStart.getHours();
                        hourData[hour].strength += focus.total / 3600000; // convert to hours for strength
                    }
                }
            }
        }
        for (const sessionId in sessions) {
            const session = sessions[sessionId];
            // Only consider sessions that overlap with today
            if (session.start < endDay && (!session.end || session.end > startDay)) {
                // Calculate the start and end hour indices for this session within today
                const sessionStart = Math.max(session.start, startDay);
                const sessionEnd = Math.min(session.end || endDay, endDay - 1);
                const startHour = new Date(sessionStart).getHours();
                const endHour = new Date(sessionEnd).getHours();

                // For each hour the session is active, increment the count
                for (let h = startHour; h <= endHour; h++) {
                    hourData[h].number += 1;
                }
            }
        }
        return hourData;
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
            const strength = Math.max(0, Math.min(1, blockData.strength || 0));
            const displayNumber = blockData.number !== undefined ? blockData.number : '';

            const block = document.createElement('div');
            block.className = 'hour-block';
            block.dataset.hour = i;
            
            // Add quarter-day markers (after hours 6, 12, 18)
            const hasMarker = i === 6 || i === 12 || i === 18;
            
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
            numberSpan.textContent = displayNumber;
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

class BlockDayDiagram {}

class Span {}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Aux, Storage, BlockHourDiagram };
}