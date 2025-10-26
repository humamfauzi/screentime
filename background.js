// Background service worker for Screentime extension

let currentTabId = null;
let currentUrl = null;
let startTime = null;

// Initialize storage on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('Screentime extension installed');
  
  // Initialize default settings
  chrome.storage.local.get(['settings'], (result) => {
    if (!result.settings) {
      chrome.storage.local.set({
        settings: {
          limits: {}, // { 'domain.com': { limit: 3600, days: [0,1,2,3,4,5,6] } }
          notificationThreshold: 0.9 // Notify at 90% of limit
        },
        activity: {}, // { 'YYYY-MM-DD': { 'domain.com': timeInSeconds } }
        notifiedToday: {} // Track which sites we've notified about today
      });
    }
  });

  // Set up alarm to check every minute
  chrome.alarms.create('trackTime', { periodInMinutes: 1 });
});

// Track active tab changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await saveCurrentTime();
  
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab.url) {
      startTracking(activeInfo.tabId, tab.url);
    }
  });
});

// Track URL changes in current tab
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url && tabId === currentTabId) {
    await saveCurrentTime();
    startTracking(tabId, changeInfo.url);
  }
});

// Save time when window focus changes
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Browser lost focus
    await saveCurrentTime();
    currentTabId = null;
    currentUrl = null;
    startTime = null;
  } else {
    // Browser gained focus
    chrome.tabs.query({ active: true, windowId: windowId }, (tabs) => {
      if (tabs[0]) {
        startTracking(tabs[0].id, tabs[0].url);
      }
    });
  }
});

// Periodic check via alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'trackTime') {
    checkAndNotify();
  }
});

function startTracking(tabId, url) {
  if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
    return;
  }
  
  currentTabId = tabId;
  currentUrl = url;
  startTime = Date.now();
}

async function saveCurrentTime() {
  if (!currentUrl || !startTime) {
    return;
  }

  const domain = extractDomain(currentUrl);
  if (!domain) return;

  const timeSpent = Math.floor((Date.now() - startTime) / 1000); // in seconds
  const today = getTodayString();

  chrome.storage.local.get(['activity'], (result) => {
    const activity = result.activity || {};
    
    if (!activity[today]) {
      activity[today] = {};
    }
    
    if (!activity[today][domain]) {
      activity[today][domain] = 0;
    }
    
    activity[today][domain] += timeSpent;
    
    chrome.storage.local.set({ activity });
  });
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
chrome.runtime.onSuspend.addListener(() => {
  saveCurrentTime();
});
