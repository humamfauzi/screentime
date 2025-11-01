// Background service worker for Screentime extension

// We'll track tabs and focus sessions in-memory and persist under `raw`.
// tabsData: { [tabId]: { domain, sessionId, sessionStart, sessionUrl, focusId, focusStart } }
const tabsData = {};
let currentFocusedTabId = null; // which tab currently has browser focus
let browserFocused = true; // whether the browser window currently has focus

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function storageSet(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
}

function generateId() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  // fallback
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function isCountableUrl(url) {
  if (!url) return false;
  const invalidPrefixes = ['chrome://', 'chrome-extension://', 'about:blank'];
  for (const p of invalidPrefixes) if (url.startsWith(p)) return false;
  try {
    const u = new URL(url);
    // ignore the builtin New Tab page which in some platforms uses chrome://newtab
    if (!u.hostname) return false;
    return true;
  } catch (e) {
    return false;
  }
}

async function createSessionForTab(tabId, url) {
  if (!isCountableUrl(url)) return;
  const domain = extractDomain(url);
  if (!domain) return;

  const sessionId = generateId();
  const now = Date.now();

  // persist under raw
  const data = await storageGet(['raw']);
  const raw = data.raw || {};
  if (!raw[domain]) raw[domain] = {};
  raw[domain][sessionId] = { tabId, url, start: now };
  await storageSet({ raw });

  tabsData[tabId] = tabsData[tabId] || {};
  tabsData[tabId].domain = domain;
  tabsData[tabId].sessionId = sessionId;
  tabsData[tabId].sessionStart = now;
  tabsData[tabId].sessionUrl = url;
  // checkpoint used to accumulate incremental time (prevents double counting)
  tabsData[tabId].lastCheckpoint = now;
}

async function endSessionForTab(tabId) {
  const td = tabsData[tabId];
  if (!td || !td.sessionId || !td.domain) return;
  const now = Date.now();

  // first end any ongoing focus
  if (td.focusId) {
    await endFocusForTab(tabId);
  }

  const data = await storageGet(['raw']);
  const raw = data.raw || {};
  const domain = td.domain;
  const sessionId = td.sessionId;
  if (raw[domain] && raw[domain][sessionId]) {
    raw[domain][sessionId].end = now;
    await storageSet({ raw });

    // add remaining session duration since last checkpoint (prevents double counting)
    const last = td.lastCheckpoint || td.sessionStart || now;
    const sessionSec = Math.floor((now - last) / 1000);
    if (sessionSec > 0) await addSecondsToActivity(domain, sessionSec);
  }

  delete tabsData[tabId];
}

async function startFocusForTab(tabId) {
  const td = tabsData[tabId];
  console.log('Starting focus for tab', tabId, td);
  if (!td || !td.sessionId || !td.domain) return;
  if (td.focusId) return; // already focused
  const focusId = generateId();
  const now = Date.now();

  const data = await storageGet(['raw']);
  const raw = data.raw || {};
  const domain = td.domain;
  const sessionId = td.sessionId;
  if (raw[domain] && raw[domain][sessionId]) {
    raw[domain][sessionId].focus = raw[domain][sessionId].focus || {};
    raw[domain][sessionId].focus[focusId] = { start: now };
    await storageSet({ raw });

    td.focusId = focusId;
    td.focusStart = now;
    currentFocusedTabId = tabId;
  }
}

async function endFocusForTab(tabId) {
  const td = tabsData[tabId];
  console.log('Ending focus for tab', tabId, td);
  if (!td || !td.focusId || !td.domain || !td.sessionId) return;
  const now = Date.now();

  const data = await storageGet(['raw']);
  const raw = data.raw || {};
  const domain = td.domain;
  const sessionId = td.sessionId;
  const focusId = td.focusId;
  if (raw[domain] && raw[domain][sessionId] && raw[domain][sessionId].focus && raw[domain][sessionId].focus[focusId]) {
    raw[domain][sessionId].focus[focusId].end = now;
    await storageSet({ raw });

    // do not add focus time to aggregated `activity` to avoid double counting.
    // focus periods are stored under `raw` only.
  }

  td.focusId = null;
  td.focusStart = null;
  if (currentFocusedTabId === tabId) currentFocusedTabId = null;
}

async function addSecondsToActivity(domain, seconds) {
  if (!domain || !seconds || seconds <= 0) return;
  const today = getTodayString();
  const data = await storageGet(['activity']);
  const activity = data.activity || {};
  if (!activity[today]) activity[today] = {};
  if (!activity[today][domain]) activity[today][domain] = 0;
  activity[today][domain] += seconds;
  await storageSet({ activity });
}

// Initialize storage on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('Screentime extension installed second version');
  
  // Initialize default settings
  chrome.storage.local.get(['settings'], (result) => {
    if (!result.settings) {
      chrome.storage.local.set({
        settings: {
          limits: {}, // { 'domain.com': { limit: 3600, days: [0,1,2,3,4,5,6] } }
          notificationThreshold: 0.9 // Notify at 90% of limit
        },
        activity: {}, // { 'YYYY-MM-DD': { 'domain.com': timeInSeconds } }
        notifiedToday: {}, // Track which sites we've notified about today
        raw: {} // like activity but the top key are the sites.
      });
    }
  });

  // Set up alarm to check every minute
  chrome.alarms.create('trackTime', { periodInMinutes: 1 });
});

// Track tab creation: start a session if a countable URL is present
chrome.tabs.onCreated.addListener(async (tab) => {
  try {
    if (tab && tab.id && isCountableUrl(tab.url)) {
      await createSessionForTab(tab.id, tab.url);
    }
  } catch (e) {
    console.error('onCreated handler error', e);
  }
});

// Track URL changes in a tab
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  try {
    if (changeInfo.url) {
      // If new URL is countable and either no session exists or domain changed -> start new session
      if (isCountableUrl(changeInfo.url)) {
        const newDomain = extractDomain(changeInfo.url);
        const td = tabsData[tabId];
        if (!td || !td.sessionId) {
          await createSessionForTab(tabId, changeInfo.url);
        } else if (td.domain !== newDomain) {
          // domain/subdomain changed -> end old session and start new one
          await endSessionForTab(tabId);
          await createSessionForTab(tabId, changeInfo.url);
        } else {
          // same domain but url changed; update sessionUrl in memory and raw
          td.sessionUrl = changeInfo.url;
          const data = await storageGet(['raw']);
          const raw = data.raw || {};
          if (raw[td.domain] && raw[td.domain][td.sessionId]) {
            raw[td.domain][td.sessionId].url = changeInfo.url;
            await storageSet({ raw });
          }
        }
      } else {
        // new URL not countable -> end any existing session for this tab
        await endSessionForTab(tabId);
      }
    }
  } catch (e) {
    console.error('onUpdated handler error', e);
  }
});

// Save time when window focus changes
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  try {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
      // Browser lost focus
      browserFocused = false;
      if (currentFocusedTabId) {
        await endFocusForTab(currentFocusedTabId);
      }
      currentFocusedTabId = null;
    } else {
      // Browser gained focus
      browserFocused = true;
      chrome.tabs.query({ active: true, windowId: windowId }, async (tabs) => {
        if (tabs && tabs[0]) {
          const tab = tabs[0];
          // ensure session exists, then start focus on this tab
          if (!tabsData[tab.id] || !tabsData[tab.id].sessionId) {
            if (isCountableUrl(tab.url)) await createSessionForTab(tab.id, tab.url);
          }
          await startFocusForTab(tab.id);
        }
      });
    }
  } catch (e) {
    console.error('onFocusChanged handler error', e);
  }
});

// Periodic check via alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'trackTime') {
    checkAndNotify();
  }
});

// Track active tab changes (activation)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    console.log("activated", activeInfo)
    // end focus for previous focused tab (if any and different)
    if (currentFocusedTabId && currentFocusedTabId !== activeInfo.tabId) {
      await endFocusForTab(currentFocusedTabId);
    }

    chrome.tabs.get(activeInfo.tabId, async (tab) => {
      if (!tab) return;
      // ensure session exists for this tab
      if (!tabsData[tab.id] || !tabsData[tab.id].sessionId) {
        if (isCountableUrl(tab.url)) await createSessionForTab(tab.id, tab.url);
      }
      // start focus only if browser window is focused
      if (browserFocused) await startFocusForTab(tab.id);
    });
  } catch (e) {
    console.error('onActivated handler error', e);
  }
});

// Tab removed -> end its session
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  try {
    await endSessionForTab(tabId);
  } catch (e) {
    console.error('onRemoved handler error', e);
  }
});

// flush incremental time for all open sessions into `activity`
async function saveCurrentTime() {
  const now = Date.now();
  const tabIds = Object.keys(tabsData);
  for (const t of tabIds) {
    const td = tabsData[t];
    if (!td || !td.domain) continue;
    const last = td.lastCheckpoint || td.sessionStart || now;
    const deltaMs = now - last;
    const deltaSec = Math.floor(deltaMs / 1000);
    if (deltaSec > 0) {
      await addSecondsToActivity(td.domain, deltaSec);
      td.lastCheckpoint = now;
    }
  }
}

function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return null;
  }
}

function getTodayString() {
  const now = new Date();
  return now.toISOString().split('T')[0]; // YYYY-MM-DD
}

function getDayOfWeek() {
  return new Date().getDay(); // 0 = Sunday, 6 = Saturday
}

async function checkAndNotify() {
  await saveCurrentTime();
  
  chrome.storage.local.get(['settings', 'activity', 'notifiedToday'], (result) => {
    if (!result) return;
    const settings = result.settings || { limits: {}, notificationThreshold: 0.9 };
    const activity = result.activity || {};
    const notifiedToday = result.notifiedToday || {};
    const today = getTodayString();
    const dayOfWeek = getDayOfWeek();
    const todayActivity = activity[today] || {};

    // Clean old notifications (from previous days)
    if (Object.keys(notifiedToday).length > 0 && Object.keys(notifiedToday)[0] !== today) {
      chrome.storage.local.set({ notifiedToday: {} });
    }

    for (const [domain, limitData] of Object.entries(settings.limits)) {
      // Check if limit applies to today
      if (!limitData.days || !limitData.days.includes(dayOfWeek)) {
        continue;
      }

      const timeSpent = todayActivity[domain] || 0;
      const limit = limitData.limit;
      const threshold = limit * settings.notificationThreshold;

      // Notify if approaching limit and haven't notified yet today
      if (timeSpent >= threshold && timeSpent < limit && !notifiedToday[domain]) {
        const minutesRemaining = Math.floor((limit - timeSpent) / 60);
        
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: 'Screentime Alert',
          message: `You have ${minutesRemaining} minutes remaining on ${domain}`,
          priority: 2
        });

        notifiedToday[domain] = true;
        chrome.storage.local.set({ notifiedToday });
      }

      // Notify if limit exceeded
      if (timeSpent >= limit && notifiedToday[domain] !== 'exceeded') {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: 'Screentime Limit Reached',
          message: `You've reached your daily limit for ${domain}`,
          priority: 2
        });

        notifiedToday[domain] = 'exceeded';
        chrome.storage.local.set({ notifiedToday });
      }
    }
  });
}

// Save time before service worker stops
chrome.runtime.onSuspend.addListener(async () => {
  try {
    await saveCurrentTime();
    // close all remaining sessions
    const tabIds = Object.keys(tabsData);
    for (const t of tabIds) {
      try { await endSessionForTab(t); } catch (e) { /* continue */ }
    }
  } catch (e) {
    console.error('onSuspend handler error', e);
  }
});
