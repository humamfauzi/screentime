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

_ = {
    "version": "2.0",
    "settings": {},
    "focuses": [
        {
            "url": "subdomain.domain.com",
            "start": 1695984000000,
            "start_reason": "tab_created",
            "end": 1695987600000,
            "end_reason": "tab_closed",
            "total": 3600000,
        }
    ],
    "display": {
        "today": {
            "total_time": 7200000,
            "site_visited": 5,
            // always reorder from the most used to least used
            "websites": [
                {
                    "url": "subdomain.domain.com",
                    "total_time": 3600000,
                    "hour_block": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // seconds per hour
                },
                {
                    "url": "another.domain.com",
                    "total_time": 3600000,
                    "hour_block": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // seconds per hour
                }
            ]
        },
        // reports are now a dictionary with URL as key
        "reports": {
            "subdomain.domain.com": {
                "blocks": [
                    {
                        "unix": 1695984000000, // start of a date
                        "hour_block": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // seconds per hour
                    },

                ]
            }
        }
    }
}

class Aux {
    /**
     * Extracts the hostname (including subdomains) from a URL
     * @param {string} url - The URL to extract the hostname from (e.g., "https://docs.google.com/page")
     * @returns {string} The hostname including subdomains (e.g., "docs.google.com"), or the original URL if parsing fails
     */
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

    /**
     * Generates a random 6-character ID using uppercase letters and numbers
     * @returns {string} A 6-character random ID (e.g., "A3B9X2")
     */
    static generateId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * Checks if a URL is eligible for tracking (filters out internal browser pages)
     * @param {string} url - The URL to check
     * @returns {boolean} True if the URL is eligible for tracking, false otherwise
     */
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

    /**
     * Gets the start and end timestamps (in milliseconds) for a given day
     * @param {Date} time - The date object for which to get the day boundaries
     * @returns {Array<number>} [startOfDay, endOfDay] - Array with two timestamps in milliseconds
     */
    static currentStartAndEnd(time) {
        const startOfDay = new Date(time.getFullYear(), time.getMonth(), time.getDate()).getTime();
        const endOfDay = startOfDay + 86400000 - 1; // End of the day
        return [startOfDay, endOfDay];
    }

    /**
     * Gets the start and end timestamps (in milliseconds) for a given week (Sunday to Saturday)
     * @param {Date} time - The date object for which to get the week boundaries
     * @returns {Array<number>} [startOfWeek, endOfWeek] - Array with two timestamps in milliseconds
     */
    static currentStartAndEndWeek(time) {
        const dayOfWeek = time.getDay(); // 0 (Sun) to 6 (Sat)
        const startOfWeek = new Date(time.getFullYear(), time.getMonth(), time.getDate() - dayOfWeek).getTime();
        const endOfWeek = startOfWeek + 7 * 86400000 - 1; // End of the week
        return [startOfWeek, endOfWeek];
    }

    /**
     * Divides a focus session into 24 hourly segments (in seconds per hour)
     * @param {Date} start - The start time of the focus session
     * @param {number} total - Total duration in milliseconds
     * @returns {Array<number>} Array of 24 numbers representing seconds spent in each hour (0-23)
     */
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

    /**
     * Divides a focus session into a weekly grid (7 days x 24 hours) in seconds
     * @param {Date} start - The start time of the focus session
     * @param {number} total - Total duration in milliseconds
     * @returns {Array<Array<number>>} 7x24 array where [day][hour] represents seconds spent (day: 0=Sun to 6=Sat)
     */
    static focusDivisionWeek(start, total) {
        let remaining = Math.ceil(total / 1000); // convert ms to seconds
        let currentHour = start.getHours();
        let currentDay = start.getDay(); // 0 (Sun) to 6 (Sat)
        const divisions = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0)); // seconds per day/hour
        let unixStart = start.getTime();
        
        // Calculate offset in days from the start date
        let dayOffset = 0;
        
        while (remaining > 0 && currentDay < 7) {
            const nextUnixHour = new Date(
                start.getFullYear(), 
                start.getMonth(), 
                start.getDate() + dayOffset, 
                currentHour + 1
            ).getTime();
            const secondsToNextHour = Math.ceil((nextUnixHour - unixStart) / 1000);
            const secondsToAdd = Math.min(secondsToNextHour, remaining);
            
            divisions[currentDay][currentHour] += secondsToAdd;
            remaining -= secondsToAdd;
            currentHour++;
            
            if (currentHour >= 24) {
                currentHour = 0;
                dayOffset++;
                currentDay++;
            }
            unixStart = nextUnixHour;
        }
        return divisions;
    }
}

class ManualTest {
    /**
     * Collects all focus sessions that occurred today
     * @returns {Promise<Array<Object>>} Array of focus session objects with url, focus_id, timestamps, duration, and reasons
     */
    static async collectFocusToday() {
        const dateObj = new Date();
        const startDayUnix = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()).getTime();
        const endDayUnix = startDayUnix + 86400000 - 1; // End of the day
        return ManualTest.collectFocus(startDayUnix, endDayUnix);
    }

    /**
     * Collects all focus sessions within a specified time range
     * @param {number} start - Start timestamp in milliseconds
     * @param {number} end - End timestamp in milliseconds
     * @returns {Promise<Array<Object>>} Array of focus session objects sorted by start time
     */
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

    /**
     * Retrieves all currently active (not ended) focus sessions
     * @returns {Promise<Array<Object>>} Array of active focus session objects with url, focus_id, start timestamp, and reason
     */
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

    /**
     * Retrieves all currently active (not ended) URL sessions
     * @returns {Promise<Array<Object>>} Array of active session objects with url, session_id, start timestamp, tabId, windowId, and reason
     */
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
    
    /**
     * Retrieves all debug logs from storage
     * @returns {Promise<Array<Object>|undefined>} Array of debug log entries or undefined if no logs exist
     */
    static async get() {
        const data = await chrome.storage.local.get([this.storageKey]);
        return data[this.storageKey];
    }

    /**
     * Saves a debug log entry to storage
     * @param {Object} obj - The log object to save
     * @returns {Promise<void>}
     */
    static async save(obj) {
        this.saveLock = this.saveLock.then(async () => {
            const data = await this.get() || [];
            data.push(obj)
            await chrome.storage.local.set({ [this.storageKey]: data });
        })
        return this.saveLock;
    }

    /**
     * Logs the extension installation event
     * @returns {Promise<void>}
     */
    static async logEventInstalled() {
        const message = "Extension installed";
        await this.save({ timestamp: Date.now(), message });
    }

    /**
     * Logs the extension startup event
     * @returns {Promise<void>}
     */
    static async logEventStartup() {
        const message = "Extension started";
        await this.save({ timestamp: Date.now(), message });
    }

    /**
     * Logs a tab created event
     * @param {Object} props - Additional properties to log with the event
     * @returns {Promise<void>}
     */
    static async logEventTabCreated(props) {
        const message = "Tab created";
        await this.save({ timestamp: Date.now(), message, ...props });
    }

    /**
     * Logs a tab updated event
     * @param {Object} props - Additional properties to log with the event
     * @returns {Promise<void>}
     */
    static async logEventTabUpdated(props) {
        const message = "Tab updated";
        await this.save({ timestamp: Date.now(), message, ...props });
    }

    /**
     * Logs a tab activated event
     * @param {Object} props - Additional properties to log with the event
     * @returns {Promise<void>}
     */
    static async logEventTabActivated(props) {
        const message = "Tab activated";
        await this.save({ timestamp: Date.now(), message, ...props });
    }

    /**
     * Logs a tab removed event
     * @param {Object} props - Additional properties to log with the event
     * @returns {Promise<void>}
     */
    static async logEventTabRemoved(props) {
        const message = "Tab removed"
        await this.save({ timestamp: Date.now(), message, ...props });
    }

    /**
     * Logs a tab detached event
     * @param {Object} [props={}] - Additional properties to log with the event
     * @returns {Promise<void>}
     */
    static async logEventTabDetached(props = {}) {
        const message = "Tab detached";
        await this.save({ timestamp: Date.now(), message, ...props });
    }

    /**
     * Logs a tab attached event
     * @param {Object} [props={}] - Additional properties to log with the event
     * @returns {Promise<void>}
     */
    static async logEventTabAttached(props = {}) {
        const message = "Tab attached";
        await this.save({ timestamp: Date.now(), message, ...props });
    }

    /**
     * Logs a tab replaced event
     * @param {Object} [props={}] - Additional properties to log with the event
     * @returns {Promise<void>}
     */
    static async logEventTabReplaced(props = {}) {
        const message = "Tab replaced";
        await this.save({ timestamp: Date.now(), message, ...props });
    }

    /**
     * Logs a window focus changed event
     * @param {Object} [props={}] - Additional properties to log with the event
     * @returns {Promise<void>}
     */
    static async logEventWindowFocusChanged(props = {}) {
        const message = "Window focus changed";
        await this.save({ timestamp: Date.now(), message, ...props });
    }

    /**
     * Logs a window removed event
     * @param {Object} [props={}] - Additional properties to log with the event
     * @returns {Promise<void>}
     */
    static async logEventWindowRemoved(props = {}) {
        const message = "Window removed";
        await this.save({ timestamp: Date.now(), message, ...props });
    }

    /**
     * Logs a system suspend event
     * @param {Object} [props={}] - Additional properties to log with the event
     * @returns {Promise<void>}
     */
    static async logEventSuspend(props = {}) {
        const message = "System suspend";
        await this.save({ timestamp: Date.now(), message, ...props });
    }
}

/**
 * Writer class - storage utility (placeholder)
 */
class Writer {
    static storageKey = 'raw';
}



class Storage {
    static storageKey = 'raw';
    static saveLock = Promise.resolve();

    // ========== READ METHODS (Alphabetical) ==========

    /**
     * Finds the active session ID for a specific tab in a window
     * @param {string} url - The URL of the tab
     * @param {number} windowId - The window ID
     * @param {number} tabId - The tab ID
     * @returns {Promise<string|null>} The session ID if found, null otherwise
     */
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

    /**
     * Generates a 7-day x 24-hour grid of focus time data for a specific URL (current week)
     * @param {string} url - The URL to generate data for
     * @returns {Promise<Array<Array<number>>>} 7x24 array of seconds spent per day/hour (day: 0=Sun to 6=Sat)
     */
    static async generateBlockDayData(url) {
        // Set startDay to the start of this week (Sunday), endDay to the start of next week
        const [start, end] = Aux.currentStartAndEndWeek(new Date())
        const raw = await this.getRaw();
        const weekData = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
        if (!raw[url]) {
            return weekData; // No data for this URL
        }
        const sessions = raw[url];
        for (const sessionId in sessions) {
            const session = sessions[sessionId];
            if (session.focus) {
                for (const focusId in session.focus) {
                    const focus = session.focus[focusId];
                    if (focus.total && focus.start >= start && focus.start <= end) {
                        const focusStart = new Date(focus.start);
                        const focdiv = Aux.focusDivisionWeek(focusStart, focus.total)
                        for (let d = 0; d < 7; d++) {
                            for (let hr = 0; hr < 24; hr++) {
                                weekData[d][hr] += focdiv[d][hr];
                            }
                        }
                    }
                }
            }
        }
        return weekData;
    }

    /**
     * Generates a 24-hour array of focus time data for a specific URL (today only)
     * @param {string} url - The URL to generate data for
     * @returns {Promise<Array<Object>>} Array of 24 objects with {strength, number} for each hour
     */
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
                        for (let h = 0; h < 24; h++) {
                            hourData[h].strength += focdiv[h] 
                        }
                    }
                }
            }
        }
        return hourData;
    }

    /**
     * Calculates the average focus duration within a time range
     * @param {number} start - Start timestamp in milliseconds
     * @param {number} end - End timestamp in milliseconds
     * @returns {Promise<number>} Average focus duration in milliseconds, or 0 if no focus sessions
     */
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

    /**
     * Calculates the total focus time within a time range (all URLs combined)
     * @param {number} start - Start timestamp in milliseconds
     * @param {number} end - End timestamp in milliseconds
     * @returns {Promise<number>} Total focus time in milliseconds
     */
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
                            focusSum += focus.total; // in ms
                        }
                    }
                }
            }
        }
        return focusSum;
    }

    /**
     * Calculates the total focus time grouped by URL within a time range
     * @param {number} start - Start timestamp in milliseconds
     * @param {number} end - End timestamp in milliseconds
     * @returns {Promise<Object>} Object with URLs as keys and total focus time (in milliseconds) as values
     */
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

    /**
     * Gets a list of the most visited URLs within a time range
     * @param {number} start - Start timestamp in milliseconds
     * @param {number} end - End timestamp in milliseconds
     * @param {number} [limit=5] - Maximum number of URLs to return
     * @returns {Promise<Array<string>>} Array of URLs sorted by visit count (most visited first)
     */
    static async getListMostVisitedURLs(start, end, limit = 5) {
        const sorted = await this.getMostVisitedURLs(start, end, limit);
        return sorted.map(entry => entry.url);
    }

    /**
     * Gets the most visited URLs with their visit counts within a time range
     * @param {number} start - Start timestamp in milliseconds
     * @param {number} end - End timestamp in milliseconds
     * @param {number} [limit=1] - Maximum number of results to return
     * @returns {Promise<Array<Object>>} Array of {url, count} objects sorted by visit count (most visited first)
     */
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

    /**
     * Retrieves all raw tracking data from storage
     * @returns {Promise<Object>} The raw data object with URLs as keys and session data as values
     */
    static async getRaw() {
        const data = await chrome.storage.local.get([this.storageKey]);
        return data[this.storageKey] || {};
    }

    /**
     * Counts the total number of unique sites visited within a time range
     * @param {number} start - Start timestamp in milliseconds
     * @param {number} end - End timestamp in milliseconds
     * @returns {Promise<number>} The number of unique sites visited
     */
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

    /**
     * Ends all active sessions globally (both focus and URL sessions)
     * @param {string} [reason=""] - Reason for ending sessions
     * @returns {Promise<void>}
     */
    static async endAllActiveSessions(reason="") {
        const wl = this.writeLock(async raw => {
            const collect = [];
            for (const url in raw) {
                const sessions = raw[url];
                for (const sessionId in sessions) {
                    const session = sessions[sessionId];
                    if (!session.end) {
                        collect.push(this.endFocusModifier(url, sessionId, reason));
                        collect.push(this.endURLSessionModifier(url, sessionId, reason));
                    }
                }
            }
            for (const c of collect) {
                raw = await c(raw);
            }
            return raw;
        });
        await wl();
    }

    /**
     * Ends all active focus sessions globally (without ending URL sessions)
     * @param {string} reason - Reason for ending focus sessions
     * @returns {Promise<void>}
     */
    static async endAllFocusGlobally(reason) {
        const wl = this.writeLock(async raw => {
            const collect = [];
            for (const url in raw) {
                const sessions = raw[url];
                for (const sessionId in sessions) {
                    const session = sessions[sessionId];
                    if (!session.end && session.focus) {
                        const hasFocus = Object.values(session.focus).some(f => !f.end);
                        if (hasFocus) {
                            collect.push(this.endFocusModifier(url, sessionId, reason));
                        }
                    }
                }
            }
            for (const c of collect) {
                raw = await c(raw);
            }
            return raw;
        });
        await wl();
    }

    /**
     * Ends all active focus sessions in a specific window, optionally excluding a specific tab
     * @param {number} windowId - The window ID
     * @param {number|null} [exceptTabId=null] - Tab ID to exclude from ending focus
     * @returns {Promise<void>}
     */
    static async endAllFocusInWindow(windowId, exceptTabId = null) {
        const wl = this.writeLock(async raw => {
            const collect = [];
            for (const url in raw) {
                const sessions = raw[url];
                for (const sessionId in sessions) {
                    const session = sessions[sessionId];
                    if (session.windowId === windowId && session.tabId !== exceptTabId && !session.end) {
                        if (session.focus) {
                            const hasFocus = Object.values(session.focus).some(f => !f.end);
                            if (hasFocus) {
                                collect.push(this.endFocusModifier(url, sessionId, ""));
                            }
                        }
                    }
                }
            }
            for (const c of collect) {
                raw = await c(raw);
            }
            return raw;
        });
        await wl();
    }

    /**
     * Ends all sessions (both focus and URL) in a specific window
     * @param {number} windowId - The window ID
     * @param {string} [reason=""] - Reason for ending sessions
     * @returns {Promise<void>}
     */
    static async endAllSessionsInWindow(windowId, reason="") {
        const wl = this.writeLock(async raw => {
            const collect = [];
            for (const url in raw) {
                const sessions = raw[url];
                for (const sessionId in sessions) {
                    const session = sessions[sessionId];
                    if (session.windowId === windowId && !session.end) {
                        collect.push(this.endFocusModifier(url, sessionId, reason));
                        collect.push(this.endURLSessionModifier(url, sessionId, reason));
                    }
                }
            }
            for (const c of collect) {
                raw = await c(raw);
            }
            return raw;
        });
        await wl();
    }

    /**
     * Creates a modifier function to end the current focus in a session
     * @param {string} url - The URL of the session
     * @param {string} sessionId - The session ID
     * @param {string} reason - Reason for ending the focus
     * @returns {Promise<Function>} A modifier function that takes raw data and returns modified raw data
     */
    static async endFocusModifier(url, sessionId, reason) {
        return (raw) => {
            if (!raw[url] || Object.keys(raw[url]).length === 0) return; 
            const sessions = raw[url];
            const currentSession = sessions[sessionId];
            if (!currentSession) return; 
            const currentFocus = Object.values(currentSession.focus || {}).find(focus => !focus.end);
            if (!currentFocus) return; 
            const now = Date.now();
            currentFocus.end = now;
            currentFocus.total = currentFocus.end - currentFocus.start;
            currentFocus.endReason = reason
            return raw
        }
    }

    /**
     * Ends the current focus session for a specific URL and session
     * @param {string} url - The URL of the session
     * @param {string} sessionId - The session ID
     * @param {string} reason - Reason for ending the focus
     * @returns {Promise<void>}
     */
    static async endFocus(url, sessionId, reason) {
        if (!Aux.isEligibleUrl(url)) return; 
        const wl = this.writeLock(this.endFocusModifier(url, sessionId, reason))
        await wl()
    }

    /**
     * Ends focus for all tabs in a window except the specified tab
     * @param {number} windowId - The window ID
     * @param {number} selectedTabId - The tab ID to keep focus on
     * @param {string} [reason=""] - Reason for ending focus
     * @returns {Promise<void>}
     */
    static async endFocusAllExcept(windowId, selectedTabId, reason="") {
        // Instead of querying all tabs, we iterate through storage to find active focus sessions
        // This is more efficient and works even when tabs are being closed
        const wl = this.writeLock(async raw => {
            const collect = [];
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
                                collect.push(this.endFocusModifier(url, sessionId, reason));
                            }
                        }
                    }
                }
            }
            for (const c of collect) {
                raw = await c(raw);
            }
            return raw;
        });
        await wl();
    }

    /**
     * Ends all focus sessions in windows other than the specified window
     * @param {number} windowId - The window ID to keep focus active in
     * @param {string} [reason=""] - Reason for ending focus
     * @returns {Promise<void>}
     */
    static async endFocusInOtherWindows(windowId, reason="") {
        const wl = this.writeLock(async raw => {
            const collect = []
            for (const url in raw) {
                const sessions = raw[url];
                for (const sessionId in sessions) {
                    const session = sessions[sessionId];
                    if (session.windowId !== windowId && !session.end && session.focus) {
                        const hasFocus = Object.values(session.focus).some(f => !f.end);
                        if (hasFocus) {
                            collect.push(this.endFocusModifier(url, sessionId, reason));
                        }
                    }
                }
            }
            for (const c of collect) {
                raw = await c(raw);
            }
            return raw
        })
        await wl()
    }

    /**
     * Creates a modifier function to end a URL session
     * @param {string} url - The URL of the session
     * @param {string} sessionId - The session ID
     * @param {string} [reason=""] - Reason for ending the session
     * @returns {Promise<Function>} A modifier function that takes raw data and returns modified raw data
     */
    static async endURLSessionModifier(url, sessionId, reason="") {
        return (raw) => {
            if (!raw[url] || Object.keys(raw[url]).length === 0) return;
            const sessions = raw[url];
            const currentSession = sessions[sessionId];
            if (!currentSession || currentSession.end) return;
            currentSession.end = Date.now();
            currentSession.total = currentSession.end - currentSession.start;
            currentSession.endReason = reason
            return raw
        }
    }

    /**
     * Ends a URL session for a specific URL and session ID
     * @param {string} url - The URL of the session
     * @param {string} sessionId - The session ID
     * @param {string} [reason=""] - Reason for ending the session
     * @returns {Promise<void>}
     */
    static async endURLSession(url, sessionId, reason="") {
        if (!Aux.isEligibleUrl(url)) return; 
        const wl = this.writeLock(this.endURLSessionModifier(url, sessionId, reason))
        await wl()
    }

    /**
     * Finds and ends the session associated with a specific tab and window
     * @param {number} tabId - The tab ID
     * @param {number} windowId - The window ID
     * @param {string} [reason=""] - Reason for ending the session
     * @returns {Promise<void>}
     */
    static async findAndEndSession(tabId, windowId, reason="") {
        const wl = this.writeLock(async raw => {
            const collect = []
            for (const url in raw) {
                const sessions = raw[url];
                for (const sessionId in sessions) {
                    const session = sessions[sessionId];
                    if (session.windowId === windowId && session.tabId === tabId && !session.end) {
                        collect.push(this.endFocusModifier(url, sessionId, reason));
                        collect.push(this.endURLSessionModifier(url, sessionId, reason));
                    }
                }
            }
            for (const c of collect) {
                raw = await c(raw);
            }
            return raw
        });
        await wl();
    }

    /**
     * Inserts a new focus event into an existing session
     * @param {string} url - The URL of the session
     * @param {string} sessionId - The session ID
     * @param {string} [reason=""] - Reason for starting the focus
     * @returns {Promise<void>}
     */
    static async insertFocus(url, sessionId, reason="") {
        // A focus might get triggered when seeing chrome settings and such
        if (!Aux.isEligibleUrl(url)) return;
        const focusId = Aux.generateId();
        const wl = this.writeLock(async raw => {
            if (!raw[url] || Object.keys(raw[url]).length === 0) {
                return; // should not happen but handled as not recorded
            }
            const sessions = raw[url];
            const selected = sessions[sessionId];
            if (!selected) return;
            if (!selected.focus) selected.focus = {};
            selected.focus[focusId] = {
                start: Date.now(),
                reason: reason
            };
            return raw
        })
        await wl()
    }

    /**
     * Inserts a new session for a URL, tab, and window
     * @param {string} url - The URL to track
     * @param {number} tabId - The tab ID
     * @param {number} windowId - The window ID
     * @param {string} [reason=""] - Reason for starting the session
     * @returns {Promise<void>}
     */
    static async insertSession(url, tabId, windowId, reason="") {
        if (!Aux.isEligibleUrl(url)) return;
        const sessionId = Aux.generateId();
        const wl = this.writeLock(raw => {
            if (!raw[url]) raw[url] = {};
            raw[url][sessionId] = {
                start: Date.now(),
                tabId: tabId,
                windowId: windowId,
                reason
            };
            return raw
        })
        await wl()
    }

    /**
     * Creates a write lock to ensure atomic storage modifications
     * @param {Function} mod - Modifier function that takes raw data and returns modified raw data
     * @returns {Function} A function that executes the modification and saves to storage
     */
    static writeLock(mod) {
        return () => {
            this.saveLock = this.saveLock.then(async () => {
                const raw = await this.getRaw()
                const modifiedRaw = await mod(raw)
                await chrome.storage.local.set({ [this.storageKey]: modifiedRaw });
            })
            return this.saveLock;
        }
    }
}

class BlockHourDiagram {
    /**
     * Creates a 24-hour block diagram visualization
     * @param {Array<Object>} data - Array of 24 objects with {strength: number, number: number}
     *                       strength: 0-1 value for opacity (0 = transparent, 1 = opaque)
     *                       number: value to display in the block
     * @param {Object} [options={}] - Configuration options (width, height, baseColor, etc.)
     * @returns {HTMLElement} Container element with the diagram
     */
    static create(data, options = {}) {
        if (!Array.isArray(data) || data.length !== 24) {
            throw new Error('Data must be an array of 24 objects');
        }

        const defaults = {
            width: 'fit-content',
            height: '18px',
            blockSize: '18px',
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
            display: inline-flex;
            width: ${config.width};
            height: ${config.height};
            border: 1px solid ${config.borderColor};
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
                flex: 0 0 ${config.blockSize};
                min-width: ${config.blockSize};
                max-width: ${config.blockSize};
                width: ${config.blockSize};
                height: ${config.blockSize};
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
                box-sizing: border-box;
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
            block.title = `Hour ${i}:00 - Value: ${displayNumber}s`;

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
     * @param {string} hex - Hex color code (with or without #)
     * @param {number} alpha - Opacity value (0-1)
     * @returns {string} RGBA color string
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
     * @param {Array<Object>} data - New data array of 24 objects
     * @returns {void}
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
     * Creates sample data for testing the diagram
     * @returns {Array<Object>} Sample data array with 24 objects containing random values
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
     * @param {Array<Array<number>>} data - Array of 7 arrays, each containing 24 numbers representing seconds
     * @param {Object} [options={}] - Configuration options (width, height, baseColor, etc.)
     * @returns {HTMLElement} Container element with the diagram
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
                ${(h === 5 || h === 11 || h === 17) ? `border-right: ${config.quarterMarkWidth} solid ${config.quarterMarkColor};` : ''}
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
                const blockData = data[day][hour] || 0;
                // Normalize strength against max value of 3600
                const strength = Math.max(0, Math.min(1, blockData / 3600));
                const displayNumber = blockData

                const block = document.createElement('div');
                block.className = 'hour-block';
                block.dataset.day = day;
                block.dataset.hour = hour;
                
                // Add quarter-day markers (after hours 6, 12, 18)
                const hasMarker = hour === 5 || hour === 11 || hour === 17;
                
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
                block.title = `${dayLabels[day]} ${hour}:00 - Value: ${displayNumber}s`;

                // Add number display
                const numberSpan = document.createElement('span');
                numberSpan.textContent = "";
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
     * @param {string} hex - Hex color code (with or without #)
     * @param {number} alpha - Opacity value (0-1)
     * @returns {string} RGBA color string
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
     * @param {Array<Array<number>>} data - New data array (7 days x 24 hours)
     * @returns {void}
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
                const blockData = data[day][hour] || 0;
                // Normalize strength against max value of 3600
                const strength = Math.max(0, Math.min(1, blockData / 3600));
                const displayNumber = blockData;

                block.style.backgroundColor = this._hexToRgba(baseColor, strength);
                block.querySelector('span').textContent = "";
                
                const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
                block.title = `${dayLabels[day]} ${hour}:00 - Value: ${displayNumber}`;
            });
        });
    }

    /**
     * Creates sample data for testing the weekly diagram
     * @returns {Array<Array<Object>>} Sample data array (7 days x 24 hours)
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

class StorageV2 {
    static storageKey = 'v2';
    static saveLock = Promise.resolve();

    // ========== PRIVATE HELPER METHODS ==========

    /**
     * (Private) Retrieves the entire V2 storage object.
     * @returns {Promise<Object>} The V2 storage object.
     */
    static async _getStorage() {
        const data = await chrome.storage.local.get([this.storageKey]);
        return data[this.storageKey] || {
            version: "2.0",
            settings: {},
            focuses: [],
            display: {
                today: {},
                reports: {}
            }
        };
    }

    /**
     * (Private) Retrieves the 'focuses' array from storage.
     * @returns {Promise<Array>} The array of focus sessions.
     */
    static async _getFocuses() {
        const storage = await this._getStorage();
        return storage.focuses;
    }

    /**
     * (Private) Retrieves the 'display' object from storage.
     * @returns {Promise<Object>} The display data object.
     */
    static async _getDisplay() {
        const storage = await this._getStorage();
        return storage.display;
    }

    /**
     * (Private) Generates the 'display.today' object from focus data.
     * @param {Array} focuses - The array of focus sessions.
     * @param {Date} date - The target date for the 'today' view.
     * @returns {Object} The generated 'today' object.
     */
    static _generateDisplayToday(focuses, date) {
        const [startOfDay, endOfDay] = Aux.currentStartAndEnd(date);

        const todaysFocuses = focuses.filter(f => f.start >= startOfDay && f.start <= endOfDay && f.total);

        let totalTime = 0;
        const sites = {}; // Using an object for easier aggregation

        for (const focus of todaysFocuses) {
            totalTime += focus.total;

            if (!sites[focus.url]) {
                sites[focus.url] = {
                    url: focus.url,
                    total_time: 0,
                    hour_block: Array.from({ length: 24 }, () => 0)
                };
            }

            sites[focus.url].total_time += focus.total;
            const focusStart = new Date(focus.start);
            const divisions = Aux.focusDivision(focusStart, focus.total);
            for (let i = 0; i < 24; i++) {
                sites[focus.url].hour_block[i] += divisions[i];
            }
        }

        const websites = Object.values(sites).sort((a, b) => b.total_time - a.total_time);

        return {
            total_time: totalTime,
            site_visited: websites.length,
            websites: websites
        };
    }

    /**
     * (Private) Generates the 'display.reports' object from focus data.
     * @param {Array} focuses - The array of focus sessions.
     * @returns {Object} The generated 'reports' object.
     */
    static _generateDisplayReports(focuses) {
        const reports = {};
        const completedFocuses = focuses.filter(f => f.total);

        for (const focus of completedFocuses) {
            const url = focus.url;

            if (!reports[url]) {
                reports[url] = {
                    blocks: {} // Use a temporary object with unix timestamp as key for quick access
                };
            }

            const focusStart = new Date(focus.start);
            const startOfDay = new Date(focusStart.getFullYear(), focusStart.getMonth(), focusStart.getDate()).getTime();

            if (!reports[url].blocks[startOfDay]) {
                reports[url].blocks[startOfDay] = {
                    unix: startOfDay,
                    hour_block: Array(24).fill(0)
                };
            }

            const divisions = Aux.focusDivision(focusStart, focus.total);
            for (let i = 0; i < 24; i++) {
                reports[url].blocks[startOfDay].hour_block[i] += divisions[i];
            }
        }

        // Convert the blocks object into an array for each URL
        for (const url in reports) {
            reports[url].blocks = Object.values(reports[url].blocks);
        }

        return reports;
    }

    /**
     * (Private) A central method to update the 'focuses' array, regenerate
     * the 'display' object, and save everything to storage.
     * @param {Function} modification - A function that takes the current 'focuses' array and returns the modified version.
     * @returns {Promise<void>}
     */
    static async _updateAndSave(modification) {
        this.saveLock = this.saveLock.then(async () => {
            const storage = await this._getStorage();
            const newFocuses = modification(storage.focuses);

            const newDisplay = {
                today: this._generateDisplayToday(newFocuses, new Date()),
                reports: this._generateDisplayReports(newFocuses)
            };

            const newStorage = {
                ...storage,
                focuses: newFocuses,
                display: newDisplay
            };

            await chrome.storage.local.set({ [this.storageKey]: newStorage });
        });
        return this.saveLock;
    }

    // ========== PUBLIC READ METHODS (Alphabetical) ==========

    /**
     * Generates a 7-day x 24-hour grid of focus time data for a specific URL (current week).
     * @param {string} url - The URL to generate data for.
     * @returns {Promise<Array<Array<number>>>} 7x24 array of seconds spent per day/hour.
     */
    static async generateBlockDayData(url) {
        const display = await this._getDisplay();
        const [startOfWeek, endOfWeek] = Aux.currentStartAndEndWeek(new Date());
        const weekData = Array.from({ length: 7 }, () => Array(24).fill(0));

        if (display.reports && display.reports[url]) {
            const reportBlocks = display.reports[url].blocks;
            for (const block of reportBlocks) {
                if (block.unix >= startOfWeek && block.unix <= endOfWeek) {
                    const dayOfWeek = new Date(block.unix).getDay(); // 0 (Sun) - 6 (Sat)
                    weekData[dayOfWeek] = block.hour_block;
                }
            }
        }
        return weekData;
    }

    /**
     * Generates a 24-hour array of focus time data for a specific URL (today only).
     * @param {string} url - The URL to generate data for.
     * @returns {Promise<Array<number>>} Array of 24 numbers representing seconds per hour.
     */
    static async generateBlockHourData(url) {
        const display = await this._getDisplay();
        let hourData = Array(24).fill(0);

        if (display.today && display.today.websites) {
            const site = display.today.websites.find(w => w.url === url);
            if (site) {
                hourData = site.hour_block;
            }
        }
        return hourData;
    }

    /**
     * Calculates the average focus duration within a time range.
     * @param {number} start - Start timestamp in milliseconds.
     * @param {number} end - End timestamp in milliseconds.
     * @returns {Promise<number>} Average focus duration in milliseconds.
     */
    static async getAverageFocus(start, end) {
        const focuses = await this._getFocuses();
        const relevantFocuses = focuses.filter(f => f.total && f.start >= start && f.start <= end);

        if (relevantFocuses.length === 0) {
            return 0;
        }

        const totalDuration = relevantFocuses.reduce((sum, f) => sum + f.total, 0);
        return totalDuration / relevantFocuses.length;
    }

    /**
     * Calculates the total focus time within a time range.
     * @param {number} start - Start timestamp in milliseconds.
     * @param {number} end - End timestamp in milliseconds.
     * @returns {Promise<number>} Total focus time in milliseconds.
     */
    static async getFocusSum(start, end) {
        const [startOfDay, endOfDay] = Aux.currentStartAndEnd(new Date());
        if (start === startOfDay && end === endOfDay) {
            const display = await this._getDisplay();
            return display.today.total_time || 0;
        }

        // Fallback for custom date ranges
        const focuses = await this._getFocuses();
        return focuses
            .filter(f => f.total && f.start >= start && f.start <= end)
            .reduce((sum, f) => sum + f.total, 0);
    }

    /**
     * Calculates the total focus time grouped by URL within a time range.
     * @param {number} start - Start timestamp in milliseconds.
     * @param {number} end - End timestamp in milliseconds.
     * @returns {Promise<Object>} Object with URLs as keys and total focus time as values.
     */
    static async getFocusSumByURL(start, end) {
        const [startOfDay, endOfDay] = Aux.currentStartAndEnd(new Date());
        if (start === startOfDay && end === endOfDay) {
            const display = await this._getDisplay();
            if (!display.today || !display.today.websites) return {};
            
            return display.today.websites.reduce((acc, site) => {
                acc[site.url] = site.total_time;
                return acc;
            }, {});
        }

        // Fallback for custom date ranges
        const focuses = await this._getFocuses();
        const focusByURL = {};
        focuses
            .filter(f => f.total && f.start >= start && f.start <= end)
            .forEach(f => {
                if (!focusByURL[f.url]) {
                    focusByURL[f.url] = 0;
                }
                focusByURL[f.url] += f.total;
            });
        return focusByURL;
    }

    /**
     * Counts the total number of unique sites visited within a time range.
     * @param {number} start - Start timestamp in milliseconds.
     * @param {number} end - End timestamp in milliseconds.
     * @returns {Promise<number>} The number of unique sites visited.
     */
    static async totalSitesVisited(start, end) {
        const [startOfDay, endOfDay] = Aux.currentStartAndEnd(new Date());
        if (start === startOfDay && end === endOfDay) {
            const display = await this._getDisplay();
            return display.today.site_visited || 0;
        }

        // Fallback for custom date ranges
        const focuses = await this._getFocuses();
        const uniqueUrls = new Set(
            focuses
                .filter(f => f.start >= start && f.start <= end)
                .map(f => f.url)
        );
        return uniqueUrls.size;
    }

    // ========== PUBLIC WRITE METHODS (Alphabetical) ==========

    /**
     * Ends a focus session.
     * @param {string} url - The URL of the session.
     * @param {string} reason - Reason for ending the focus.
     * @returns {Promise<void>}
     */
    static async endFocus(url, reason) {
        if (!Aux.isEligibleUrl(url)) return;

        return this._updateAndSave(focuses => {
            // Find the last active focus for this URL
            const activeFocus = focuses.slice().reverse().find(f => f.url === url && f.end === null);

            if (activeFocus) {
                const now = Date.now();
                activeFocus.end = now;
                activeFocus.end_reason = reason;
                activeFocus.total = now - activeFocus.start;
            }

            return focuses;
        });
    }

    /**
     * Inserts a new focus session.
     * @param {string} url - The URL of the session.
     * @param {string} reason - Reason for starting the focus.
     * @returns {Promise<void>}
     */
    static async insertFocus(url, reason) {
        if (!Aux.isEligibleUrl(url)) return;

        const newFocus = {
            url: url,
            start: Date.now(),
            start_reason: reason,
            end: null,
            total: null
        };

        return this._updateAndSave(focuses => {
            focuses.push(newFocus);
            return focuses;
        });
    }
}

/**
 * Span class - UNK (no implementation provided)
 */
class Span {}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Aux, Storage, StorageV2, BlockHourDiagram, BlockDayDiagram, ManualTest, Debug };
}