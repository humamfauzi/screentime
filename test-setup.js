/**
 * Jest Setup File
 * Creates mock Chrome APIs for testing
 */

// Create mock Chrome API
global.chrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      clear: jest.fn()
    }
  },
  tabs: {
    get: jest.fn(),
    query: jest.fn(),
    onCreated: { addListener: jest.fn() },
    onUpdated: { addListener: jest.fn() },
    onActivated: { addListener: jest.fn() },
    onRemoved: { addListener: jest.fn() },
    onDetached: { addListener: jest.fn() },
    onAttached: { addListener: jest.fn() },
    onReplaced: { addListener: jest.fn() }
  },
  windows: {
    WINDOW_ID_NONE: -1,
    getAll: jest.fn(),
    onFocusChanged: { addListener: jest.fn() },
    onRemoved: { addListener: jest.fn() }
  },
  runtime: {
    onInstalled: { addListener: jest.fn() },
    onStartup: { addListener: jest.fn() },
    onSuspend: { addListener: jest.fn() }
  }
};

// Reset mocks before each test
beforeEach(() => {
  // Clear all mocks
  jest.clearAllMocks();
  
  // Reset mock storage
  global.__mockStorage__ = {};
  
  // Setup default mock implementations
  chrome.storage.local.get.mockImplementation((keys, callback) => {
    const result = {};
    if (Array.isArray(keys)) {
      keys.forEach(key => {
        result[key] = global.__mockStorage__?.[key];
      });
    }
    if (callback) callback(result);
    return Promise.resolve(result);
  });

  chrome.storage.local.set.mockImplementation((items, callback) => {
    global.__mockStorage__ = global.__mockStorage__ || {};
    Object.assign(global.__mockStorage__, items);
    if (callback) callback();
    return Promise.resolve();
  });

  chrome.storage.local.clear.mockImplementation((callback) => {
    global.__mockStorage__ = {};
    if (callback) callback();
    return Promise.resolve();
  });
});

afterEach(() => {
  // Clean up
  delete global.__mockStorage__;
});
