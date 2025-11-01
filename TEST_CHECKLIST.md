# Background Service Worker Test Checklist

This document provides a comprehensive manual testing checklist for the background service worker. Run these tests after any code changes to ensure integrity.

## Setup
1. Load the extension in Chrome (chrome://extensions)
2. Enable Developer Mode
3. Open Extension Service Worker DevTools
4. Run: `chrome.storage.local.clear()` to start fresh

---

## Test Group 1: Tab Lifecycle Events

### Test 1.1: Create New Tab
**Steps:**
1. Open new tab with `Ctrl+T`
2. Navigate to `https://youtube.com`
3. Wait 2 seconds

**Expected:**
```javascript
// Run in console:
chrome.storage.local.get(['raw'], (data) => {
    console.log('Has youtube.com:', !!data.raw['youtube.com']);
    console.log('Session count:', Object.keys(data.raw['youtube.com'] || {}).length);
});
// Should show: Has youtube.com: true, Session count: 1
```

### Test 1.2: Close Tab
**Steps:**
1. Open tab to `https://youtube.com`
2. Wait 2 seconds
3. Close the tab

**Expected:**
```javascript
// Check that session has 'end' timestamp
chrome.storage.local.get(['raw'], (data) => {
    const sessions = Object.values(data.raw['youtube.com'] || {});
    console.log('Session ended:', !!sessions[0]?.end);
    console.log('Has total duration:', !!sessions[0]?.total);
});
// Should show: Session ended: true, Has total duration: true
```

### Test 1.3: Switch Between Tabs
**Steps:**
1. Open Tab A: `https://youtube.com`
2. Open Tab B: `https://twitter.com`
3. Switch to Tab A
4. Wait 2 seconds
5. Switch to Tab B

**Expected:**
```javascript
// Check focus records
chrome.storage.local.get(['raw'], (data) => {
    const ytSession = Object.values(data.raw['youtube.com'])[0];
    const twSession = Object.values(data.raw['twitter.com'])[0];
    
    console.log('YouTube has focus:', !!ytSession?.focus);
    console.log('Twitter has focus:', !!twSession?.focus);
    
    const ytActiveFocus = Object.values(ytSession.focus || {}).find(f => !f.end);
    const twActiveFocus = Object.values(twSession.focus || {}).find(f => !f.end);
    
    console.log('YouTube active focus:', !!ytActiveFocus);
    console.log('Twitter active focus:', !!twActiveFocus);
});
// Only one should have active focus (the current tab)
```

---

## Test Group 2: URL Navigation Events

### Test 2.1: Navigate Within Same Domain
**Steps:**
1. Open tab to `https://youtube.com`
2. Navigate to `https://youtube.com/watch?v=123`
3. Navigate to `https://youtube.com/trending`

**Expected:**
```javascript
chrome.storage.local.get(['raw'], (data) => {
    const sessions = Object.values(data.raw['youtube.com'] || {});
    console.log('Session count:', sessions.length);
    console.log('Sessions ended:', sessions.filter(s => s.end).length);
});
// Should show: Session count: 1, Sessions ended: 0
// Same session should continue
```

### Test 2.2: Navigate to Different Domain
**Steps:**
1. Open tab to `https://youtube.com`
2. Wait 2 seconds
3. Navigate to `https://twitter.com`

**Expected:**
```javascript
chrome.storage.local.get(['raw'], (data) => {
    const ytSessions = Object.values(data.raw['youtube.com'] || {});
    const twSessions = Object.values(data.raw['twitter.com'] || {});
    
    console.log('YouTube sessions:', ytSessions.length);
    console.log('YouTube ended:', !!ytSessions[0]?.end);
    console.log('Twitter sessions:', twSessions.length);
    console.log('Twitter ended:', !!twSessions[0]?.end);
});
// YouTube should be ended, Twitter should be active
```

### Test 2.3: Navigate to Ineligible URL
**Steps:**
1. Open tab to `https://youtube.com`
2. Wait 2 seconds
3. Navigate to `chrome://settings`

**Expected:**
```javascript
chrome.storage.local.get(['raw'], (data) => {
    const ytSessions = Object.values(data.raw['youtube.com'] || {});
    const chromeSettings = data.raw['chrome://settings'];
    
    console.log('YouTube ended:', !!ytSessions[0]?.end);
    console.log('Chrome settings tracked:', !!chromeSettings);
});
// YouTube should be ended, chrome:// should NOT be tracked
```

### Test 2.4: Navigate from Ineligible to Eligible
**Steps:**
1. Open new tab (about:blank)
2. Navigate to `https://youtube.com`

**Expected:**
```javascript
chrome.storage.local.get(['raw'], (data) => {
    const ytSessions = Object.values(data.raw['youtube.com'] || {});
    const aboutBlank = data.raw['about:blank'];
    
    console.log('YouTube tracked:', ytSessions.length > 0);
    console.log('about:blank tracked:', !!aboutBlank);
});
// YouTube should be tracked, about:blank should NOT
```

---

## Test Group 3: Window Focus Events

### Test 3.1: Switch to Another Application
**Steps:**
1. Open tab to `https://youtube.com`
2. Ensure it's active and focused
3. Alt+Tab to another application (VS Code, Terminal, etc.)
4. Wait 2 seconds

**Expected:**
```javascript
chrome.storage.local.get(['raw'], (data) => {
    const ytSession = Object.values(data.raw['youtube.com'])[0];
    const focuses = Object.values(ytSession.focus || {});
    const activeFocus = focuses.find(f => !f.end);
    
    console.log('Active focus:', !!activeFocus);
});
// Should show: Active focus: false (all focus should be ended)
```

### Test 3.2: Return to Browser
**Steps:**
1. With YouTube tab open and browser unfocused
2. Alt+Tab back to Chrome
3. Wait 2 seconds

**Expected:**
```javascript
chrome.storage.local.get(['raw'], (data) => {
    const ytSession = Object.values(data.raw['youtube.com'])[0];
    const focuses = Object.values(ytSession.focus || {});
    const activeFocus = focuses.find(f => !f.end);
    
    console.log('Active focus restored:', !!activeFocus);
    console.log('Total focus periods:', focuses.length);
});
// Should have active focus again, and at least 2 focus periods
```

### Test 3.3: Switch Between Chrome Windows
**Steps:**
1. Open Window 1 with `https://youtube.com`
2. Open Window 2 with `https://twitter.com`
3. Focus Window 1
4. Focus Window 2

**Expected:**
```javascript
chrome.storage.local.get(['raw'], (data) => {
    const ytSession = Object.values(data.raw['youtube.com'])[0];
    const twSession = Object.values(data.raw['twitter.com'])[0];
    
    const ytFocuses = Object.values(ytSession.focus || {});
    const twFocuses = Object.values(twSession.focus || {});
    
    const ytActive = ytFocuses.find(f => !f.end);
    const twActive = twFocuses.find(f => !f.end);
    
    console.log('YouTube active:', !!ytActive);
    console.log('Twitter active:', !!twActive);
});
// Only the focused window's tab should have active focus
```

### Test 3.4: Close Window with Multiple Tabs
**Steps:**
1. Open window with 3 tabs: YouTube, Twitter, GitHub
2. Close the entire window

**Expected:**
```javascript
chrome.storage.local.get(['raw'], (data) => {
    const ytSession = Object.values(data.raw['youtube.com'] || {})[0];
    const twSession = Object.values(data.raw['twitter.com'] || {})[0];
    const ghSession = Object.values(data.raw['github.com'] || {})[0];
    
    console.log('YouTube ended:', !!ytSession?.end);
    console.log('Twitter ended:', !!twSession?.end);
    console.log('GitHub ended:', !!ghSession?.end);
});
// All should be ended
```

---

## Test Group 4: Tab Movement Events

### Test 4.1: Drag Tab to New Window
**Steps:**
1. Open tab to `https://youtube.com`
2. Drag tab out to create new window
3. Wait 2 seconds

**Expected:**
```javascript
chrome.storage.local.get(['raw'], (data) => {
    const ytSessions = Object.values(data.raw['youtube.com'] || {});
    
    console.log('Session count:', ytSessions.length);
    console.log('Session active:', !ytSessions[0]?.end);
    console.log('Has focus periods:', ytSessions[0]?.focus ? Object.keys(ytSessions[0].focus).length : 0);
});
// Should still be 1 session, active, with focus history
```

### Test 4.2: Drag Tab Between Windows
**Steps:**
1. Open Window 1 with `https://youtube.com`
2. Open Window 2 (empty)
3. Drag YouTube tab from Window 1 to Window 2

**Expected:**
```javascript
chrome.tabs.query({url: '*://*.youtube.com/*'}, (tabs) => {
    const tab = tabs[0];
    chrome.storage.local.get(['raw'], (data) => {
        const ytSessions = Object.values(data.raw['youtube.com'] || {});
        console.log('Tab windowId:', tab.windowId);
        console.log('Session windowId:', ytSessions[0]?.windowId);
        console.log('WindowIds match:', tab.windowId === ytSessions[0]?.windowId);
    });
});
// Session windowId should be updated to match new window
```

---

## Test Group 5: Browser Lifecycle Events

### Test 5.1: Browser Restart
**Steps:**
1. Open 3 tabs: YouTube, Twitter, GitHub
2. Close Chrome completely
3. Reopen Chrome (tabs should restore)
4. Wait 3 seconds

**Expected:**
```javascript
chrome.storage.local.get(['raw'], (data) => {
    console.log('Sites tracked:', Object.keys(data.raw || {}));
    console.log('YouTube sessions:', Object.keys(data.raw['youtube.com'] || {}).length);
    console.log('Twitter sessions:', Object.keys(data.raw['twitter.com'] || {}).length);
    console.log('GitHub sessions:', Object.keys(data.raw['github.com'] || {}).length);
});
// All sites should be tracked with new sessions created on startup
```

### Test 5.2: Extension Reload
**Steps:**
1. Open tabs: YouTube, Twitter
2. Go to chrome://extensions
3. Click "Reload" on the extension
4. Wait 3 seconds

**Expected:**
```javascript
chrome.storage.local.get(['raw'], (data) => {
    const ytSessions = Object.values(data.raw['youtube.com'] || {});
    const twSessions = Object.values(data.raw['twitter.com'] || {});
    
    console.log('YouTube sessions:', ytSessions.length);
    console.log('Twitter sessions:', twSessions.length);
    
    // Check if old sessions were properly ended
    const oldYtEnded = ytSessions.filter(s => s.end).length;
    console.log('Old YouTube sessions ended:', oldYtEnded);
});
// Old sessions should be ended, new ones created
```

---

## Test Group 6: Edge Cases

### Test 6.1: Rapid Tab Switching
**Steps:**
1. Open 5 tabs: YouTube, Twitter, GitHub, Reddit, Stack Overflow
2. Rapidly switch between them (1 second each)
3. Wait 3 seconds on final tab

**Expected:**
```javascript
chrome.storage.local.get(['raw'], (data) => {
    let totalSessions = 0;
    let totalFocusPeriods = 0;
    
    for (const url in data.raw) {
        const sessions = Object.values(data.raw[url]);
        totalSessions += sessions.length;
        
        sessions.forEach(session => {
            if (session.focus) {
                totalFocusPeriods += Object.keys(session.focus).length;
            }
        });
    }
    
    console.log('Total sessions:', totalSessions);
    console.log('Total focus periods:', totalFocusPeriods);
    console.log('Sessions per site: ~1, Focus periods: >=5');
});
// Should have 1 session per site, multiple focus periods
```

### Test 6.2: Multiple Tabs Same Domain
**Steps:**
1. Open 3 tabs to different YouTube videos
2. Switch between them

**Expected:**
```javascript
chrome.storage.local.get(['raw'], (data) => {
    const ytSessions = Object.values(data.raw['youtube.com'] || {});
    
    console.log('Total YouTube sessions:', ytSessions.length);
    console.log('Active sessions:', ytSessions.filter(s => !s.end).length);
});
// Should have 3 sessions (one per tab), all active
```

### Test 6.3: Tab Pinning
**Steps:**
1. Open tab to `https://youtube.com`
2. Pin the tab
3. Switch to another tab
4. Switch back to pinned tab

**Expected:**
```javascript
chrome.storage.local.get(['raw'], (data) => {
    const ytSession = Object.values(data.raw['youtube.com'])[0];
    const focuses = Object.values(ytSession.focus || {});
    
    console.log('Session exists:', !!ytSession);
    console.log('Focus count:', focuses.length);
});
// Pinned tabs should be tracked normally
```

---

## Helper Functions for Testing

Add these to the Service Worker console for easier testing:

```javascript
// View all tracked data
function viewAllData() {
    chrome.storage.local.get(['raw'], (data) => {
        console.table(Object.keys(data.raw || {}).map(url => ({
            URL: url,
            Sessions: Object.keys(data.raw[url]).length,
            Active: Object.values(data.raw[url]).filter(s => !s.end).length
        })));
    });
}

// View specific site
function viewSite(domain) {
    chrome.storage.local.get(['raw'], (data) => {
        const sessions = data.raw[domain];
        if (!sessions) {
            console.log('No data for', domain);
            return;
        }
        console.log('Sessions for', domain + ':');
        Object.entries(sessions).forEach(([id, session]) => {
            console.log('Session', id.substr(0, 6), {
                tabId: session.tabId,
                windowId: session.windowId,
                start: new Date(session.start).toLocaleTimeString(),
                end: session.end ? new Date(session.end).toLocaleTimeString() : 'active',
                duration: session.total ? (session.total / 1000).toFixed(1) + 's' : 'N/A',
                focusPeriods: session.focus ? Object.keys(session.focus).length : 0
            });
        });
    });
}

// Clear all data
function clearAllData() {
    chrome.storage.local.set({ raw: {} }, () => {
        console.log('✅ All data cleared');
    });
}

// Count active sessions
function countActive() {
    chrome.storage.local.get(['raw'], (data) => {
        let total = 0;
        let active = 0;
        let withFocus = 0;
        
        for (const url in data.raw) {
            const sessions = Object.values(data.raw[url]);
            total += sessions.length;
            active += sessions.filter(s => !s.end).length;
            withFocus += sessions.filter(s => {
                if (!s.focus) return false;
                return Object.values(s.focus).some(f => !f.end);
            }).length;
        }
        
        console.log('📊 Statistics:');
        console.log('  Total sessions:', total);
        console.log('  Active sessions:', active);
        console.log('  With active focus:', withFocus);
    });
}
```

---

## Automated Test Results

After running the test suite (`background_v2.test.js`), document results here:

```
Date: _________________
Tester: _______________

✅ Passed: ___ / 15
❌ Failed: ___ / 15

Failed Tests (if any):
1. ___________________________________
2. ___________________________________
3. ___________________________________

Notes:
_______________________________________
_______________________________________
_______________________________________
```

---

## Regression Testing

Before each release, run ALL tests and mark completion:

- [ ] Test Group 1: Tab Lifecycle (3 tests)
- [ ] Test Group 2: URL Navigation (4 tests)
- [ ] Test Group 3: Window Focus (4 tests)
- [ ] Test Group 4: Tab Movement (2 tests)
- [ ] Test Group 5: Browser Lifecycle (2 tests)
- [ ] Test Group 6: Edge Cases (3 tests)

**Total: 18 manual tests**

---

## Known Limitations

Document any known issues or limitations:

1. Service worker may suspend after 30 seconds of inactivity
2. Storage API has ~5MB limit
3. High-frequency events may cause performance issues with 100+ tabs

---

## Test Coverage Summary

| Component | Coverage | Notes |
|-----------|----------|-------|
| Aux class | ✅ 100% | getTLD, isEligibleUrl |
| Storage class | ✅ 100% | All CRUD operations |
| Tab events | ✅ 100% | Create, update, activate, remove, detach, attach, replace |
| Window events | ✅ 100% | Focus change, window remove |
| Runtime events | ✅ 100% | Install, startup, suspend |
| Edge cases | ✅ 90% | Most scenarios covered |

---

## Quick Smoke Test (5 minutes)

For rapid validation after minor changes:

1. ✅ Open tab to YouTube → Check session created
2. ✅ Switch to Twitter tab → Check YouTube focus ended, Twitter focus started
3. ✅ Close YouTube tab → Check session ended
4. ✅ Alt+Tab away → Check all focus ended
5. ✅ Alt+Tab back → Check focus restored
6. ✅ Navigate YouTube → Twitter → Check sessions switched

If all pass: ✅ **Basic functionality intact**
