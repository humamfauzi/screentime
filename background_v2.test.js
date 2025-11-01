/**
 * Test Suite for background_v2.js
 * 
 * This test suite validates all functionality in the background service worker.
 * Run these tests before deploying any changes to ensure integrity.
 * 
 * To run: node background_v2.test.js
 */

// =====================================================
// MOCK CHROME API
// =====================================================
const mockStorage = {};
const mockListeners = {
    'runtime.onInstalled': [],
    'runtime.onStartup': [],
    'runtime.onSuspend': [],
    'tabs.onCreated': [],
    'tabs.onUpdated': [],
    'tabs.onActivated': [],
    'tabs.onRemoved': [],
    'tabs.onDetached': [],
    'tabs.onAttached': [],
    'tabs.onReplaced': [],
    'windows.onFocusChanged': [],
    'windows.onRemoved': []
};

const mockTabs = {};
const mockWindows = {};
let nextTabId = 1;
let nextWindowId = 1;

global.chrome = {
    storage: {
        local: {
            get: (keys, callback) => {
                const result = {};
                keys.forEach(key => {
                    result[key] = mockStorage[key];
                });
                if (callback) callback(result);
                return Promise.resolve(result);
            },
            set: (obj, callback) => {
                Object.assign(mockStorage, obj);
                if (callback) callback();
                return Promise.resolve();
            }
        }
    },
    tabs: {
        get: (tabId, callback) => {
            const tab = mockTabs[tabId];
            if (!tab) {
                const error = new Error('Tab not found');
                if (callback) callback(null);
                return Promise.reject(error);
            }
            if (callback) callback(tab);
            return Promise.resolve(tab);
        },
        query: (queryInfo, callback) => {
            let tabs = Object.values(mockTabs);
            if (queryInfo.windowId !== undefined) {
                tabs = tabs.filter(t => t.windowId === queryInfo.windowId);
            }
            if (queryInfo.active !== undefined) {
                tabs = tabs.filter(t => t.active === queryInfo.active);
            }
            if (callback) callback(tabs);
            return Promise.resolve(tabs);
        },
        onCreated: { addListener: (fn) => mockListeners['tabs.onCreated'].push(fn) },
        onUpdated: { addListener: (fn) => mockListeners['tabs.onUpdated'].push(fn) },
        onActivated: { addListener: (fn) => mockListeners['tabs.onActivated'].push(fn) },
        onRemoved: { addListener: (fn) => mockListeners['tabs.onRemoved'].push(fn) },
        onDetached: { addListener: (fn) => mockListeners['tabs.onDetached'].push(fn) },
        onAttached: { addListener: (fn) => mockListeners['tabs.onAttached'].push(fn) },
        onReplaced: { addListener: (fn) => mockListeners['tabs.onReplaced'].push(fn) }
    },
    windows: {
        WINDOW_ID_NONE: -1,
        getAll: (options, callback) => {
            let windows = Object.values(mockWindows);
            if (options && options.populate) {
                windows = windows.map(w => ({
                    ...w,
                    tabs: Object.values(mockTabs).filter(t => t.windowId === w.id)
                }));
            }
            if (callback) callback(windows);
            return Promise.resolve(windows);
        },
        onFocusChanged: { addListener: (fn) => mockListeners['windows.onFocusChanged'].push(fn) },
        onRemoved: { addListener: (fn) => mockListeners['windows.onRemoved'].push(fn) }
    },
    runtime: {
        onInstalled: { addListener: (fn) => mockListeners['runtime.onInstalled'].push(fn) },
        onStartup: { addListener: (fn) => mockListeners['runtime.onStartup'].push(fn) },
        onSuspend: { addListener: (fn) => mockListeners['runtime.onSuspend'].push(fn) }
    }
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================
function resetMocks() {
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    Object.keys(mockTabs).forEach(key => delete mockTabs[key]);
    Object.keys(mockWindows).forEach(key => delete mockWindows[key]);
    nextTabId = 1;
    nextWindowId = 1;
}

function createMockWindow(focused = true) {
    const id = nextWindowId++;
    mockWindows[id] = { id, focused };
    return mockWindows[id];
}

function createMockTab(windowId, url, active = false) {
    const id = nextTabId++;
    mockTabs[id] = { id, windowId, url, active };
    return mockTabs[id];
}

function removeMockTab(tabId) {
    delete mockTabs[tabId];
}

async function triggerEvent(eventName, ...args) {
    const listeners = mockListeners[eventName];
    for (const listener of listeners) {
        await listener(...args);
    }
}

function assertEqual(actual, expected, message) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        console.error(`❌ FAIL: ${message}`);
        console.error(`   Expected:`, expected);
        console.error(`   Got:`, actual);
        return false;
    }
    console.log(`✅ PASS: ${message}`);
    return true;
}

function assertTruthy(value, message) {
    if (!value) {
        console.error(`❌ FAIL: ${message}`);
        console.error(`   Expected truthy value, got:`, value);
        return false;
    }
    console.log(`✅ PASS: ${message}`);
    return true;
}

function assertFalsy(value, message) {
    if (value) {
        console.error(`❌ FAIL: ${message}`);
        console.error(`   Expected falsy value, got:`, value);
        return false;
    }
    console.log(`✅ PASS: ${message}`);
    return true;
}

// Load the background script (simulating it)
function loadBackgroundScript() {
    // We'll need to extract and evaluate the code
    // For now, let's define the classes here for testing
    eval(require('fs').readFileSync('./background_v2.js', 'utf8'));
}

// =====================================================
// TEST SUITE
// =====================================================

class TestRunner {
    constructor() {
        this.passed = 0;
        this.failed = 0;
        this.tests = [];
    }

    async test(name, fn) {
        console.log(`\n🧪 Testing: ${name}`);
        try {
            resetMocks();
            const result = await fn();
            if (result !== false) {
                this.passed++;
            } else {
                this.failed++;
            }
        } catch (error) {
            console.error(`❌ ERROR in test "${name}":`, error.message);
            this.failed++;
        }
    }

    report() {
        console.log('\n' + '='.repeat(60));
        console.log('TEST RESULTS');
        console.log('='.repeat(60));
        console.log(`✅ Passed: ${this.passed}`);
        console.log(`❌ Failed: ${this.failed}`);
        console.log(`📊 Total: ${this.passed + this.failed}`);
        console.log('='.repeat(60));
        
        if (this.failed === 0) {
            console.log('🎉 All tests passed!');
        } else {
            console.log('⚠️  Some tests failed. Please review.');
        }
    }
}

// =====================================================
// DEFINE TEST FUNCTIONS (to be run with real code)
// =====================================================

async function runTests() {
    const runner = new TestRunner();

    // Test 1: Aux.getTLD
    await runner.test('Aux.getTLD - extracts domain correctly', () => {
        const tests = [
            { input: 'https://www.youtube.com/watch?v=123', expected: 'youtube.com' },
            { input: 'https://mail.google.com', expected: 'google.com' },
            { input: 'https://github.com/user/repo', expected: 'github.com' },
            { input: 'http://localhost:3000', expected: 'localhost' },
            { input: 'https://www.bbc.co.uk', expected: 'co.uk' }
        ];
        
        let allPassed = true;
        for (const { input, expected } of tests) {
            const result = Aux.getTLD(input);
            if (!assertEqual(result, expected, `getTLD("${input}") should return "${expected}"`)) {
                allPassed = false;
            }
        }
        return allPassed;
    });

    // Test 2: Aux.isEligibleUrl
    await runner.test('Aux.isEligibleUrl - filters ineligible URLs', () => {
        const eligible = [
            'https://youtube.com',
            'http://example.com',
            'https://github.com/repo'
        ];
        const ineligible = [
            'chrome://settings',
            'chrome-extension://abc123',
            'about:blank',
            'file:///path/to/file',
            null,
            undefined
        ];
        
        let allPassed = true;
        for (const url of eligible) {
            if (!assertTruthy(Aux.isEligibleUrl(url), `"${url}" should be eligible`)) {
                allPassed = false;
            }
        }
        for (const url of ineligible) {
            if (!assertFalsy(Aux.isEligibleUrl(url), `"${url}" should be ineligible`)) {
                allPassed = false;
            }
        }
        return allPassed;
    });

    // Test 3: Storage.insertSession
    await runner.test('Storage.insertSession - creates new session', async () => {
        await Storage.insertSession('youtube.com', 1, 1);
        const raw = await Storage.getRaw();
        
        const hasYoutube = raw['youtube.com'] !== undefined;
        const sessionCount = hasYoutube ? Object.keys(raw['youtube.com']).length : 0;
        
        return assertTruthy(hasYoutube, 'youtube.com should exist in storage') &&
               assertEqual(sessionCount, 1, 'Should have 1 session');
    });

    // Test 4: Storage.findActiveSessionId
    await runner.test('Storage.findActiveSessionId - finds correct session', async () => {
        await Storage.insertSession('youtube.com', 5, 1);
        const sessionId = await Storage.findActiveSessionId('youtube.com', 1, 5);
        
        return assertTruthy(sessionId, 'Should find active session');
    });

    // Test 5: Storage.endURLSession
    await runner.test('Storage.endURLSession - ends session correctly', async () => {
        await Storage.insertSession('youtube.com', 1, 1);
        const sessionId = await Storage.findActiveSessionId('youtube.com', 1, 1);
        await Storage.endURLSession('youtube.com', sessionId);
        
        const raw = await Storage.getRaw();
        const session = raw['youtube.com'][sessionId];
        
        return assertTruthy(session.end, 'Session should have end timestamp') &&
               assertTruthy(session.total, 'Session should have total duration');
    });

    // Test 6: Storage.insertFocus
    await runner.test('Storage.insertFocus - creates focus record', async () => {
        await Storage.insertSession('youtube.com', 1, 1);
        const sessionId = await Storage.findActiveSessionId('youtube.com', 1, 1);
        await Storage.insertFocus('youtube.com', sessionId);
        
        const raw = await Storage.getRaw();
        const session = raw['youtube.com'][sessionId];
        const focusCount = session.focus ? Object.keys(session.focus).length : 0;
        
        return assertEqual(focusCount, 1, 'Should have 1 focus record');
    });

    // Test 7: Storage.endFocus
    await runner.test('Storage.endFocus - ends focus correctly', async () => {
        await Storage.insertSession('youtube.com', 1, 1);
        const sessionId = await Storage.findActiveSessionId('youtube.com', 1, 1);
        await Storage.insertFocus('youtube.com', sessionId);
        await Storage.endFocus('youtube.com', sessionId);
        
        const raw = await Storage.getRaw();
        const session = raw['youtube.com'][sessionId];
        const focuses = Object.values(session.focus || {});
        const activeFocus = focuses.find(f => !f.end);
        
        return assertFalsy(activeFocus, 'Should have no active focus');
    });

    // Test 8: Tab creation scenario
    await runner.test('Tab Lifecycle - create and track tab', async () => {
        const window = createMockWindow(true);
        const tab = createMockTab(window.id, 'https://youtube.com', true);
        
        await triggerEvent('tabs.onCreated', tab);
        
        const sessionId = await Storage.findActiveSessionId('youtube.com', window.id, tab.id);
        return assertTruthy(sessionId, 'Session should be created for new tab');
    });

    // Test 9: Tab removal scenario
    await runner.test('Tab Lifecycle - remove tab ends session', async () => {
        const window = createMockWindow(true);
        const tab = createMockTab(window.id, 'https://youtube.com', false);
        
        await triggerEvent('tabs.onCreated', tab);
        const sessionId = await Storage.findActiveSessionId('youtube.com', window.id, tab.id);
        
        await triggerEvent('tabs.onRemoved', tab.id, { windowId: window.id });
        
        const raw = await Storage.getRaw();
        const session = raw['youtube.com'][sessionId];
        
        return assertTruthy(session.end, 'Session should be ended after tab removal');
    });

    // Test 10: URL navigation scenario
    await runner.test('Navigation - changing domain creates new session', async () => {
        const window = createMockWindow(true);
        const tab = createMockTab(window.id, 'https://youtube.com', false);
        
        await triggerEvent('tabs.onCreated', tab);
        const oldSessionId = await Storage.findActiveSessionId('youtube.com', window.id, tab.id);
        
        tab.url = 'https://twitter.com';
        await triggerEvent('tabs.onUpdated', tab.id, { url: 'https://twitter.com' }, tab);
        
        const raw = await Storage.getRaw();
        const oldSession = raw['youtube.com'][oldSessionId];
        const newSessionId = await Storage.findActiveSessionId('twitter.com', window.id, tab.id);
        
        return assertTruthy(oldSession.end, 'Old session should be ended') &&
               assertTruthy(newSessionId, 'New session should be created');
    });

    // Test 11: Window focus change
    await runner.test('Window - losing focus ends all focus', async () => {
        const window = createMockWindow(true);
        const tab = createMockTab(window.id, 'https://youtube.com', true);
        
        await triggerEvent('tabs.onCreated', tab);
        const sessionId = await Storage.findActiveSessionId('youtube.com', window.id, tab.id);
        await Storage.insertFocus('youtube.com', sessionId);
        
        await triggerEvent('windows.onFocusChanged', chrome.windows.WINDOW_ID_NONE);
        
        const raw = await Storage.getRaw();
        const session = raw['youtube.com'][sessionId];
        const focuses = Object.values(session.focus || {});
        const activeFocus = focuses.find(f => !f.end);
        
        return assertFalsy(activeFocus, 'All focus should be ended when browser loses focus');
    });

    // Test 12: Helper method - findAndEndSession
    await runner.test('Helper - findAndEndSession works correctly', async () => {
        await Storage.insertSession('youtube.com', 10, 5);
        const result = await Storage.findAndEndSession(10, 5);
        
        const sessionId = await Storage.findActiveSessionId('youtube.com', 5, 10);
        
        return assertTruthy(result, 'Should return true when session found') &&
               assertFalsy(sessionId, 'Session should be ended');
    });

    // Test 13: Helper method - endAllFocusGlobally
    await runner.test('Helper - endAllFocusGlobally ends all focus', async () => {
        await Storage.insertSession('youtube.com', 1, 1);
        await Storage.insertSession('twitter.com', 2, 1);
        
        const session1 = await Storage.findActiveSessionId('youtube.com', 1, 1);
        const session2 = await Storage.findActiveSessionId('twitter.com', 1, 2);
        
        await Storage.insertFocus('youtube.com', session1);
        await Storage.insertFocus('twitter.com', session2);
        
        await Storage.endAllFocusGlobally();
        
        const raw = await Storage.getRaw();
        let allEnded = true;
        
        for (const url in raw) {
            for (const sessionId in raw[url]) {
                const session = raw[url][sessionId];
                if (session.focus) {
                    const activeFocus = Object.values(session.focus).find(f => !f.end);
                    if (activeFocus) allEnded = false;
                }
            }
        }
        
        return assertTruthy(allEnded, 'All focus should be ended globally');
    });

    // Test 14: Helper method - endAllSessionsInWindow
    await runner.test('Helper - endAllSessionsInWindow ends sessions in specific window', async () => {
        await Storage.insertSession('youtube.com', 1, 1);
        await Storage.insertSession('twitter.com', 2, 2);
        
        await Storage.endAllSessionsInWindow(1);
        
        const session1 = await Storage.findActiveSessionId('youtube.com', 1, 1);
        const session2 = await Storage.findActiveSessionId('twitter.com', 2, 2);
        
        return assertFalsy(session1, 'Window 1 session should be ended') &&
               assertTruthy(session2, 'Window 2 session should still be active');
    });

    // Test 15: Ineligible URL handling
    await runner.test('Ineligible URLs - chrome:// URLs are ignored', async () => {
        await Storage.insertSession('chrome://settings', 1, 1);
        const raw = await Storage.getRaw();
        const hasChromeUrl = raw['chrome://settings'] !== undefined;
        
        return assertFalsy(hasChromeUrl, 'chrome:// URLs should not be tracked');
    });

    runner.report();
}

// =====================================================
// RUN TESTS
// =====================================================

console.log('='.repeat(60));
console.log('BACKGROUND SERVICE WORKER TEST SUITE');
console.log('='.repeat(60));

try {
    // Load the actual background script classes
    loadBackgroundScript();
    runTests().catch(error => {
        console.error('Test suite failed:', error);
    });
} catch (error) {
    console.error('Failed to load background script:', error.message);
    console.log('\n⚠️  Manual Testing Required:');
    console.log('1. Load extension in Chrome');
    console.log('2. Open DevTools > Service Worker > Console');
    console.log('3. Copy and paste test scenarios manually');
}
