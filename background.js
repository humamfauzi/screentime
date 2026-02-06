if (typeof importScripts !== 'undefined') {
    importScripts('fn.js');
}

/**
 * Polling-based screen time tracker.
 * Accumulates time in memory and writes to storage periodically to avoid quota issues.
 */

const STORAGE_KEY = 'v2';
const WRITE_INTERVAL_MS = 5000; // Write to storage every 5 seconds

// In-memory accumulator: { [url]: { seconds: number, hours: { [hour]: number } } }
let pendingUpdates = {};
let lastWriteTime = Date.now();

/**
 * Gets the currently focused tab's URL
 * @returns {Promise<string|null>} The hostname of the focused tab, or null if not eligible
 */
async function getFocusedTabUrl() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!tab || !tab.url || !Aux.isEligibleUrl(tab.url)) {
            return null;
        }
        return Aux.getTLD(tab.url);
    } catch (e) {
        return null;
    }
}

/**
 * Gets the storage with default structure
 */
async function getStorage() {
    const data = await chrome.storage.local.get([STORAGE_KEY]);
    return data[STORAGE_KEY] || {
        version: "2.0",
        settings: {},
        display: {
            today: { total_time: 0, site_visited: 0, websites: [], date_unix: 0 },
            reports: {}
        }
    };
}

/**
 * Accumulates one second for a URL in memory
 * @param {string} url - The hostname to track
 */
function accumulateSecond(url) {
    const hour = new Date().getHours();
    
    if (!pendingUpdates[url]) {
        pendingUpdates[url] = { seconds: 0, hours: {} };
    }
    
    pendingUpdates[url].seconds += 1;
    pendingUpdates[url].hours[hour] = (pendingUpdates[url].hours[hour] || 0) + 1;
}

/**
 * Flushes accumulated data to storage
 */
async function flushToStorage() {
    if (Object.keys(pendingUpdates).length === 0) {
        return;
    }

    const updates = pendingUpdates;
    pendingUpdates = {}; // Reset accumulator

    try {
        const storage = await getStorage();
        const now = new Date();
        const [startOfDay] = Aux.currentStartAndEnd(now);

        // Initialize display structure if needed
        if (!storage.display) {
            storage.display = { today: {}, reports: {} };
        }
        if (!storage.display.today) {
            storage.display.today = { total_time: 0, site_visited: 0, websites: [], date_unix: 0 };
        }
        if (!storage.display.reports) {
            storage.display.reports = {};
        }

        // Check if we need to reset today (new day started)
        if (storage.display.today.date_unix && storage.display.today.date_unix !== startOfDay) {
            storage.display.today = { 
                total_time: 0, 
                site_visited: 0, 
                websites: [],
                date_unix: startOfDay
            };
        }
        storage.display.today.date_unix = startOfDay;

        // Apply accumulated updates
        for (const url in updates) {
            const update = updates[url];
            const secondsMs = update.seconds * 1000;

            // Update display.today.total_time
            storage.display.today.total_time = (storage.display.today.total_time || 0) + secondsMs;

            // Update or create website entry in today
            let siteEntry = storage.display.today.websites.find(w => w.url === url);
            if (!siteEntry) {
                siteEntry = {
                    url: url,
                    total_time: 0,
                    hour_block: Array(24).fill(0)
                };
                storage.display.today.websites.push(siteEntry);
            }
            siteEntry.total_time += secondsMs;
            
            // Apply hour updates
            for (const hour in update.hours) {
                siteEntry.hour_block[parseInt(hour)] += update.hours[hour];
            }

            // Update display.reports
            if (!storage.display.reports[url]) {
                storage.display.reports[url] = { blocks: [] };
            }

            let dayBlock = storage.display.reports[url].blocks.find(b => b.unix === startOfDay);
            if (!dayBlock) {
                dayBlock = {
                    unix: startOfDay,
                    hour_block: Array(24).fill(0)
                };
                storage.display.reports[url].blocks.push(dayBlock);
                
                // Keep only last 30 days of reports per URL to prevent storage bloat
                if (storage.display.reports[url].blocks.length > 30) {
                    storage.display.reports[url].blocks.shift();
                }
            }
            
            // Apply hour updates to reports
            for (const hour in update.hours) {
                dayBlock.hour_block[parseInt(hour)] += update.hours[hour];
            }
        }

        // Update site_visited count
        storage.display.today.site_visited = storage.display.today.websites.length;

        // Sort websites by total_time descending
        storage.display.today.websites.sort((a, b) => b.total_time - a.total_time);

        // Save to storage
        await chrome.storage.local.set({ [STORAGE_KEY]: storage });
        lastWriteTime = Date.now();
    } catch (e) {
        console.error('Failed to flush to storage:', e);
        // Restore pending updates on failure
        for (const url in updates) {
            if (!pendingUpdates[url]) {
                pendingUpdates[url] = { seconds: 0, hours: {} };
            }
            pendingUpdates[url].seconds += updates[url].seconds;
            for (const hour in updates[url].hours) {
                pendingUpdates[url].hours[hour] = (pendingUpdates[url].hours[hour] || 0) + updates[url].hours[hour];
            }
        }
    }
}

/**
 * Main tick function - runs every second
 */
async function tick() {
    const url = await getFocusedTabUrl();
    
    if (url) {
        accumulateSecond(url);
    }

    // Flush to storage periodically
    if (Date.now() - lastWriteTime >= WRITE_INTERVAL_MS) {
        await flushToStorage();
    }
}

// Use setInterval for per-second tracking
setInterval(tick, 1000);

// Flush on suspend to prevent data loss
chrome.runtime.onSuspend.addListener(async () => {
    await flushToStorage();
});

// Log installation for debugging
chrome.runtime.onInstalled.addListener(async () => {
    console.log('Screen Time extension installed/updated');
});

// Log startup for debugging  
chrome.runtime.onStartup.addListener(async () => {
    console.log('Screen Time extension started');
});
