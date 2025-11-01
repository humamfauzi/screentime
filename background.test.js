// Import the modules - chrome mock is set up in test-setup.js
const { Aux, Storage } = require('./fn.js');

describe('Aux Class', () => {
    describe('getTLD', () => {
        it('should extract TLD from a standard URL', () => {
            expect(Aux.getTLD('https://www.youtube.com/watch?v=123')).toBe('youtube.com');
            expect(Aux.getTLD('https://www.google.com/search')).toBe('google.com');
        });

        it('should handle URLs without www', () => {
            expect(Aux.getTLD('https://github.com/user/repo')).toBe('github.com');
        });

        it('should handle subdomain URLs', () => {
            expect(Aux.getTLD('https://mail.google.com')).toBe('google.com');
        });

        it('should handle URLs with ports', () => {
            expect(Aux.getTLD('http://localhost:3000/path')).toBe('localhost');
        });

        it('should handle URLs with multiple subdomains', () => {
            expect(Aux.getTLD('https://api.dev.example.com')).toBe('example.com');
        });

        it('should return original URL on error', () => {
            expect(Aux.getTLD('not-a-valid-url')).toBe('not-a-valid-url');
        });
    });

    describe('generateId', () => {
        it('should generate a 6-character ID', () => {
            const id = Aux.generateId();
            expect(id).toHaveLength(6);
        });

        it('should only contain alphanumeric uppercase characters', () => {
            const id = Aux.generateId();
            expect(id).toMatch(/^[A-Z0-9]{6}$/);
        });

        it('should generate unique IDs', () => {
            const ids = new Set();
            for (let i = 0; i < 100; i++) {
                ids.add(Aux.generateId());
            }
            // Allow some collisions but expect mostly unique
            expect(ids.size).toBeGreaterThan(85);
        });

        it('should generate different IDs on consecutive calls', () => {
            const id1 = Aux.generateId();
            const id2 = Aux.generateId();
            const id3 = Aux.generateId();
            // Very unlikely all three are the same
            expect(id1 === id2 && id2 === id3).toBe(false);
        });
    });

    describe('isEligibleUrl', () => {
        it('should return true for http/https URLs', () => {
            expect(Aux.isEligibleUrl('https://youtube.com')).toBe(true);
            expect(Aux.isEligibleUrl('http://example.com')).toBe(true);
            expect(Aux.isEligibleUrl('https://www.google.com/search?q=test')).toBe(true);
        });

        it('should return false for chrome:// URLs', () => {
            expect(Aux.isEligibleUrl('chrome://settings')).toBe(false);
            expect(Aux.isEligibleUrl('chrome://extensions')).toBe(false);
            expect(Aux.isEligibleUrl('chrome://newtab')).toBe(false);
        });

        it('should return false for chrome-extension:// URLs', () => {
            expect(Aux.isEligibleUrl('chrome-extension://abcdef123456')).toBe(false);
        });

        it('should return false for about: URLs', () => {
            expect(Aux.isEligibleUrl('about:blank')).toBe(false);
            expect(Aux.isEligibleUrl('about:config')).toBe(false);
        });

        it('should return false for file:// URLs', () => {
            expect(Aux.isEligibleUrl('file:///home/user/file.html')).toBe(false);
        });

        it('should return false for edge:// URLs', () => {
            expect(Aux.isEligibleUrl('edge://settings')).toBe(false);
        });

        it('should return false for moz-extension:// URLs', () => {
            expect(Aux.isEligibleUrl('moz-extension://abc123')).toBe(false);
        });

        it('should return false for null/undefined', () => {
            expect(Aux.isEligibleUrl(null)).toBe(false);
            expect(Aux.isEligibleUrl(undefined)).toBe(false);
            expect(Aux.isEligibleUrl('')).toBe(false);
        });
    });
});

describe('Storage Class', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Default mock implementation
        chrome.storage.local.get.mockResolvedValue({ raw: {} });
        chrome.storage.local.set.mockResolvedValue(undefined);
    });

    describe('getRaw', () => {
        it('should return stored raw data', async () => {
            const mockData = { 'youtube.com': { 'ABC123': {} } };
            chrome.storage.local.get.mockResolvedValue({ raw: mockData });

            const result = await Storage.getRaw();
            expect(result).toEqual(mockData);
            expect(chrome.storage.local.get).toHaveBeenCalledWith(['raw']);
        });

        it('should return empty object if no data exists', async () => {
            chrome.storage.local.get.mockResolvedValue({});

            const result = await Storage.getRaw();
            expect(result).toEqual({});
        });

        it('should handle storage errors gracefully', async () => {
            chrome.storage.local.get.mockRejectedValue(new Error('Storage error'));

            await expect(Storage.getRaw()).rejects.toThrow('Storage error');
        });
    });

    describe('saveRaw', () => {
        it('should save raw data to storage', async () => {
            const mockData = { 'youtube.com': {} };

            await Storage.saveRaw(mockData);
            expect(chrome.storage.local.set).toHaveBeenCalledWith({ raw: mockData });
        });

        it('should save empty object', async () => {
            await Storage.saveRaw({});
            expect(chrome.storage.local.set).toHaveBeenCalledWith({ raw: {} });
        });
    });

    describe('findActiveSessionId', () => {
        it('should return null for ineligible URLs', async () => {
            const result = await Storage.findActiveSessionId('chrome://settings', 1, 1);
            expect(result).toBeNull();
            expect(chrome.storage.local.get).not.toHaveBeenCalled();
        });

        it('should return null if URL has no sessions', async () => {
            chrome.storage.local.get.mockResolvedValue({ raw: {} });

            const result = await Storage.findActiveSessionId('youtube.com', 1, 1);
            expect(result).toBeNull();
        });

        it('should return sessionId for active session', async () => {
            const mockData = {
                'youtube.com': {
                    'ABC123': {
                        windowId: 1,
                        tabId: 5,
                        start: Date.now()
                    }
                }
            };
            chrome.storage.local.get.mockResolvedValue({ raw: mockData });

            const result = await Storage.findActiveSessionId('youtube.com', 1, 5);
            expect(result).toBe('ABC123');
        });

        it('should return null if session has ended', async () => {
            const mockData = {
                'youtube.com': {
                    'ABC123': {
                        windowId: 1,
                        tabId: 5,
                        start: Date.now(),
                        end: Date.now()
                    }
                }
            };
            chrome.storage.local.get.mockResolvedValue({ raw: mockData });

            const result = await Storage.findActiveSessionId('youtube.com', 1, 5);
            expect(result).toBeNull();
        });

        it('should handle multiple sessions and find correct one', async () => {
            const mockData = {
                'youtube.com': {
                    'ABC123': {
                        windowId: 1,
                        tabId: 5,
                        start: Date.now(),
                        end: Date.now()
                    },
                    'DEF456': {
                        windowId: 1,
                        tabId: 5,
                        start: Date.now()
                    }
                }
            };
            chrome.storage.local.get.mockResolvedValue({ raw: mockData });

            const result = await Storage.findActiveSessionId('youtube.com', 1, 5);
            expect(result).toBe('DEF456');
        });
    });

    describe('insertSession', () => {
        it('should not insert session for ineligible URLs', async () => {
            await Storage.insertSession('chrome://settings', 1, 1);
            expect(chrome.storage.local.set).not.toHaveBeenCalled();
        });

        it('should insert new session for new URL', async () => {
            chrome.storage.local.get.mockResolvedValue({ raw: {} });

            await Storage.insertSession('youtube.com', 5, 1);

            expect(chrome.storage.local.set).toHaveBeenCalled();
            const savedData = chrome.storage.local.set.mock.calls[0][0].raw;
            expect(savedData['youtube.com']).toBeDefined();
            const sessionId = Object.keys(savedData['youtube.com'])[0];
            expect(savedData['youtube.com'][sessionId]).toMatchObject({
                tabId: 5,
                windowId: 1
            });
            expect(savedData['youtube.com'][sessionId].start).toBeDefined();
            expect(typeof savedData['youtube.com'][sessionId].start).toBe('number');
        });

        it('should add session to existing URL', async () => {
            const existingData = {
                'youtube.com': {
                    'OLD123': { windowId: 1, tabId: 3, start: Date.now() }
                }
            };
            chrome.storage.local.get.mockResolvedValue({ raw: existingData });

            await Storage.insertSession('youtube.com', 5, 1);

            const savedData = chrome.storage.local.set.mock.calls[0][0].raw;
            expect(Object.keys(savedData['youtube.com'])).toHaveLength(2);
            expect(savedData['youtube.com']['OLD123']).toBeDefined();
        });
    });

    describe('insertFocus', () => {
        it('should not insert focus for ineligible URLs', async () => {
            await Storage.insertFocus('chrome://settings', 'ABC123');
            expect(chrome.storage.local.set).not.toHaveBeenCalled();
        });

        it('should return early if URL has no sessions', async () => {
            chrome.storage.local.get.mockResolvedValue({ raw: {} });

            await Storage.insertFocus('youtube.com', 'ABC123');
            expect(chrome.storage.local.set).not.toHaveBeenCalled();
        });

        it('should return early if session does not exist', async () => {
            const mockData = {
                'youtube.com': {
                    'OTHER123': { windowId: 1, tabId: 5 }
                }
            };
            chrome.storage.local.get.mockResolvedValue({ raw: mockData });

            await Storage.insertFocus('youtube.com', 'ABC123');
            expect(chrome.storage.local.set).not.toHaveBeenCalled();
        });

        it('should insert focus to existing session', async () => {
            const mockData = {
                'youtube.com': {
                    'ABC123': {
                        windowId: 1,
                        tabId: 5,
                        start: Date.now()
                    }
                }
            };
            chrome.storage.local.get.mockResolvedValue({ raw: mockData });

            await Storage.insertFocus('youtube.com', 'ABC123');

            const savedData = chrome.storage.local.set.mock.calls[0][0].raw;
            expect(savedData['youtube.com']['ABC123'].focus).toBeDefined();
            const focusId = Object.keys(savedData['youtube.com']['ABC123'].focus)[0];
            expect(savedData['youtube.com']['ABC123'].focus[focusId]).toMatchObject({
                start: expect.any(Number)
            });
            expect(savedData['youtube.com']['ABC123'].focus[focusId].end).toBeUndefined();
        });

        it('should create focus object if it does not exist', async () => {
            const mockData = {
                'youtube.com': {
                    'ABC123': {
                        windowId: 1,
                        tabId: 5,
                        start: Date.now()
                    }
                }
            };
            chrome.storage.local.get.mockResolvedValue({ raw: mockData });

            await Storage.insertFocus('youtube.com', 'ABC123');

            const savedData = chrome.storage.local.set.mock.calls[0][0].raw;
            expect(savedData['youtube.com']['ABC123'].focus).toBeDefined();
            expect(typeof savedData['youtube.com']['ABC123'].focus).toBe('object');
        });
    });

    describe('endURLSession', () => {
        it('should not end session for ineligible URLs', async () => {
            await Storage.endURLSession('chrome://settings', 'ABC123');
            expect(chrome.storage.local.set).not.toHaveBeenCalled();
        });

        it('should end active session', async () => {
            const startTime = Date.now() - 5000;
            const mockData = {
                'youtube.com': {
                    'ABC123': {
                        windowId: 1,
                        tabId: 5,
                        start: startTime
                    }
                }
            };
            chrome.storage.local.get.mockResolvedValue({ raw: mockData });

            await Storage.endURLSession('youtube.com', 'ABC123');

            const savedData = chrome.storage.local.set.mock.calls[0][0].raw;
            expect(savedData['youtube.com']['ABC123'].end).toBeDefined();
            expect(savedData['youtube.com']['ABC123'].total).toBeGreaterThan(0);
            expect(savedData['youtube.com']['ABC123'].total).toBeGreaterThanOrEqual(5000);
        });

        it('should not end already ended session', async () => {
            const mockData = {
                'youtube.com': {
                    'ABC123': {
                        windowId: 1,
                        tabId: 5,
                        start: Date.now() - 5000,
                        end: Date.now(),
                        total: 5000
                    }
                }
            };
            chrome.storage.local.get.mockResolvedValue({ raw: mockData });

            await Storage.endURLSession('youtube.com', 'ABC123');
            expect(chrome.storage.local.set).not.toHaveBeenCalled();
        });

        it('should return early if URL has no sessions', async () => {
            chrome.storage.local.get.mockResolvedValue({ raw: {} });

            await Storage.endURLSession('youtube.com', 'ABC123');
            expect(chrome.storage.local.set).not.toHaveBeenCalled();
        });
    });

    describe('endFocus', () => {
        it('should not end focus for ineligible URLs', async () => {
            await Storage.endFocus('chrome://settings', 'ABC123');
            expect(chrome.storage.local.set).not.toHaveBeenCalled();
        });

        it('should end active focus', async () => {
            const startTime = Date.now() - 3000;
            const mockData = {
                'youtube.com': {
                    'ABC123': {
                        windowId: 1,
                        tabId: 5,
                        start: Date.now(),
                        focus: {
                            'FOC123': { start: startTime }
                        }
                    }
                }
            };
            chrome.storage.local.get.mockResolvedValue({ raw: mockData });

            await Storage.endFocus('youtube.com', 'ABC123');

            const savedData = chrome.storage.local.set.mock.calls[0][0].raw;
            expect(savedData['youtube.com']['ABC123'].focus['FOC123'].end).toBeDefined();
            expect(savedData['youtube.com']['ABC123'].focus['FOC123'].total).toBeGreaterThan(0);
            expect(savedData['youtube.com']['ABC123'].focus['FOC123'].total).toBeGreaterThanOrEqual(3000);
        });

        it('should not end focus if no active focus exists', async () => {
            const mockData = {
                'youtube.com': {
                    'ABC123': {
                        windowId: 1,
                        tabId: 5,
                        start: Date.now(),
                        focus: {
                            'FOC123': { start: Date.now(), end: Date.now(), total: 1000 }
                        }
                    }
                }
            };
            chrome.storage.local.get.mockResolvedValue({ raw: mockData });

            await Storage.endFocus('youtube.com', 'ABC123');
            expect(chrome.storage.local.set).not.toHaveBeenCalled();
        });

        it('should return early if session does not exist', async () => {
            const mockData = {
                'youtube.com': {
                    'OTHER123': { windowId: 1, tabId: 5 }
                }
            };
            chrome.storage.local.get.mockResolvedValue({ raw: mockData });

            await Storage.endFocus('youtube.com', 'ABC123');
            expect(chrome.storage.local.set).not.toHaveBeenCalled();
        });
    });

    describe('endFocusAllExcept', () => {
        it('should end focus on all tabs in window except selected one', async () => {
            const mockData = {
                'youtube.com': {
                    'ABC123': {
                        windowId: 1,
                        tabId: 5,
                        focus: { 'FOC1': { start: Date.now() } }
                    }
                },
                'twitter.com': {
                    'DEF456': {
                        windowId: 1,
                        tabId: 6,
                        focus: { 'FOC2': { start: Date.now() } }
                    }
                }
            };
            chrome.storage.local.get.mockResolvedValue({ raw: mockData });

            await Storage.endFocusAllExcept(1, 5);

            const savedData = chrome.storage.local.set.mock.calls[0][0].raw;
            // Tab 5 focus should still be active
            expect(savedData['youtube.com']['ABC123'].focus['FOC1'].end).toBeUndefined();
            // Tab 6 focus should be ended
            expect(savedData['twitter.com']['DEF456'].focus['FOC2'].end).toBeDefined();
            expect(savedData['twitter.com']['DEF456'].focus['FOC2'].total).toBeDefined();
        });

        it('should not affect tabs in different windows', async () => {
            const mockData = {
                'youtube.com': {
                    'ABC123': {
                        windowId: 2,
                        tabId: 10,
                        focus: { 'FOC1': { start: Date.now() } }
                    }
                }
            };
            chrome.storage.local.get.mockResolvedValue({ raw: mockData });

            await Storage.endFocusAllExcept(1, 5);

            // Should not call set since no tabs in window 1 match
            expect(chrome.storage.local.set).not.toHaveBeenCalled();
        });
    });

    describe('findAndEndSession', () => {
        it('should find and end session by tabId and windowId', async () => {
            const mockData = {
                'youtube.com': {
                    'ABC123': {
                        windowId: 1,
                        tabId: 5,
                        start: Date.now(),
                        focus: { 'FOC1': { start: Date.now() } }
                    }
                }
            };
            chrome.storage.local.get.mockResolvedValue({ raw: mockData });

            const result = await Storage.findAndEndSession(5, 1);

            expect(result).toBe(true);
            expect(chrome.storage.local.set).toHaveBeenCalled();
            const savedData = chrome.storage.local.set.mock.calls[0][0].raw;
            expect(savedData['youtube.com']['ABC123'].end).toBeDefined();
            expect(savedData['youtube.com']['ABC123'].focus['FOC1'].end).toBeDefined();
        });

        it('should return false if session not found', async () => {
            chrome.storage.local.get.mockResolvedValue({ raw: {} });

            const result = await Storage.findAndEndSession(5, 1);
            expect(result).toBe(false);
        });
    });

    describe('endAllFocusInWindow', () => {
        it('should end all focus in specified window', async () => {
            const mockData = {
                'youtube.com': {
                    'ABC123': {
                        windowId: 1,
                        tabId: 5,
                        focus: { 'FOC1': { start: Date.now() } }
                    }
                },
                'twitter.com': {
                    'DEF456': {
                        windowId: 1,
                        tabId: 6,
                        focus: { 'FOC2': { start: Date.now() } }
                    }
                }
            };
            chrome.storage.local.get.mockResolvedValue({ raw: mockData });

            await Storage.endAllFocusInWindow(1);

            const savedData = chrome.storage.local.set.mock.calls[0][0].raw;
            expect(savedData['youtube.com']['ABC123'].focus['FOC1'].end).toBeDefined();
            expect(savedData['twitter.com']['DEF456'].focus['FOC2'].end).toBeDefined();
        });

        it('should exclude specified tab when exceptTabId is provided', async () => {
            const mockData = {
                'youtube.com': {
                    'ABC123': {
                        windowId: 1,
                        tabId: 5,
                        focus: { 'FOC1': { start: Date.now() } }
                    }
                },
                'twitter.com': {
                    'DEF456': {
                        windowId: 1,
                        tabId: 6,
                        focus: { 'FOC2': { start: Date.now() } }
                    }
                }
            };
            chrome.storage.local.get.mockResolvedValue({ raw: mockData });

            await Storage.endAllFocusInWindow(1, 5);

            const savedData = chrome.storage.local.set.mock.calls[0][0].raw;
            expect(savedData['youtube.com']['ABC123'].focus['FOC1'].end).toBeUndefined();
            expect(savedData['twitter.com']['DEF456'].focus['FOC2'].end).toBeDefined();
        });
    });

    describe('endAllFocusGlobally', () => {
        it('should end all active focus across all windows', async () => {
            const mockData = {
                'youtube.com': {
                    'ABC123': {
                        windowId: 1,
                        tabId: 5,
                        focus: { 'FOC1': { start: Date.now() } }
                    }
                },
                'twitter.com': {
                    'DEF456': {
                        windowId: 2,
                        tabId: 10,
                        focus: { 'FOC2': { start: Date.now() } }
                    }
                }
            };
            chrome.storage.local.get.mockResolvedValue({ raw: mockData });

            await Storage.endAllFocusGlobally();

            const savedData = chrome.storage.local.set.mock.calls[0][0].raw;
            expect(savedData['youtube.com']['ABC123'].focus['FOC1'].end).toBeDefined();
            expect(savedData['twitter.com']['DEF456'].focus['FOC2'].end).toBeDefined();
        });
    });

    describe('endAllSessionsInWindow', () => {
        it('should end all active sessions in specified window', async () => {
            const mockData = {
                'youtube.com': {
                    'ABC123': {
                        windowId: 1,
                        tabId: 5,
                        start: Date.now(),
                        focus: { 'FOC1': { start: Date.now() } }
                    }
                },
                'twitter.com': {
                    'DEF456': {
                        windowId: 1,
                        tabId: 6,
                        start: Date.now()
                    }
                }
            };
            chrome.storage.local.get.mockResolvedValue({ raw: mockData });

            await Storage.endAllSessionsInWindow(1);

            const savedData = chrome.storage.local.set.mock.calls[0][0].raw;
            expect(savedData['youtube.com']['ABC123'].end).toBeDefined();
            expect(savedData['twitter.com']['DEF456'].end).toBeDefined();
        });

        it('should not affect sessions in other windows', async () => {
            const mockData = {
                'youtube.com': {
                    'ABC123': {
                        windowId: 2,
                        tabId: 10,
                        start: Date.now()
                    }
                }
            };
            chrome.storage.local.get.mockResolvedValue({ raw: mockData });

            await Storage.endAllSessionsInWindow(1);

            // Should not call set since no sessions in window 1
            expect(chrome.storage.local.set).not.toHaveBeenCalled();
        });
    });

    describe('endAllActiveSessions', () => {
        it('should end all active sessions globally', async () => {
            const mockData = {
                'youtube.com': {
                    'ABC123': {
                        windowId: 1,
                        tabId: 5,
                        start: Date.now(),
                        focus: { 'FOC1': { start: Date.now() } }
                    }
                },
                'twitter.com': {
                    'DEF456': {
                        windowId: 2,
                        tabId: 10,
                        start: Date.now()
                    }
                }
            };
            chrome.storage.local.get.mockResolvedValue({ raw: mockData });

            await Storage.endAllActiveSessions();

            const savedData = chrome.storage.local.set.mock.calls[0][0].raw;
            expect(savedData['youtube.com']['ABC123'].end).toBeDefined();
            expect(savedData['youtube.com']['ABC123'].focus['FOC1'].end).toBeDefined();
            expect(savedData['twitter.com']['DEF456'].end).toBeDefined();
        });

        it('should not affect already ended sessions', async () => {
            const mockData = {
                'youtube.com': {
                    'ABC123': {
                        windowId: 1,
                        tabId: 5,
                        start: Date.now() - 10000,
                        end: Date.now() - 5000,
                        total: 5000
                    }
                }
            };
            chrome.storage.local.get.mockResolvedValue({ raw: mockData });

            await Storage.endAllActiveSessions();

            // Should not call set since session is already ended
            expect(chrome.storage.local.set).not.toHaveBeenCalled();
        });
    });

    describe('endFocusInOtherWindows', () => {
        it('should end focus in all windows except specified one', async () => {
            const mockData = {
                'youtube.com': {
                    'ABC123': {
                        windowId: 1,
                        tabId: 5,
                        focus: { 'FOC1': { start: Date.now() } }
                    }
                },
                'twitter.com': {
                    'DEF456': {
                        windowId: 2,
                        tabId: 10,
                        focus: { 'FOC2': { start: Date.now() } }
                    }
                }
            };
            chrome.storage.local.get.mockResolvedValue({ raw: mockData });

            await Storage.endFocusInOtherWindows(1);

            const savedData = chrome.storage.local.set.mock.calls[0][0].raw;
            // Window 1 focus should remain active
            expect(savedData['youtube.com']['ABC123'].focus['FOC1'].end).toBeUndefined();
            // Window 2 focus should be ended
            expect(savedData['twitter.com']['DEF456'].focus['FOC2'].end).toBeDefined();
        });
    });
});

describe('Background Event Handlers', () => {
    let handlers;

    beforeEach(() => {
        jest.clearAllMocks();
        chrome.storage.local.get.mockResolvedValue({ raw: {} });
        chrome.storage.local.set.mockResolvedValue(undefined);
        
        // Clear previous listeners
        handlers = {};
        
        // Capture listeners
        chrome.runtime.onInstalled.addListener.mockImplementation((fn) => {
            handlers.onInstalled = fn;
        });
        chrome.runtime.onStartup.addListener.mockImplementation((fn) => {
            handlers.onStartup = fn;
        });
        chrome.tabs.onCreated.addListener.mockImplementation((fn) => {
            handlers.onCreated = fn;
        });
        chrome.tabs.onUpdated.addListener.mockImplementation((fn) => {
            handlers.onUpdated = fn;
        });
        chrome.tabs.onActivated.addListener.mockImplementation((fn) => {
            handlers.onActivated = fn;
        });
        chrome.tabs.onRemoved.addListener.mockImplementation((fn) => {
            handlers.onRemoved = fn;
        });
        chrome.windows.onFocusChanged.addListener.mockImplementation((fn) => {
            handlers.onFocusChanged = fn;
        });
        chrome.windows.onRemoved.addListener.mockImplementation((fn) => {
            handlers.onWindowRemoved = fn;
        });
        chrome.runtime.onSuspend.addListener.mockImplementation((fn) => {
            handlers.onSuspend = fn;
        });

        // Load the background script to register handlers
        jest.isolateModules(() => {
            // Inject a variable before requiring background.js
            const { Aux, Storage } = require('./fn.js');
            global.Aux = Aux;
            global.Storage = Storage;
            require('./background.js');
        });
    });

    describe('onInstalled', () => {
        it('should initialize empty raw data', async () => {
            await handlers.onInstalled();

            expect(chrome.storage.local.set).toHaveBeenCalledWith({ raw: {} });
        });
    });

    describe('onStartup', () => {
        it('should initialize sessions for existing tabs', async () => {
            const mockWindows = [
                {
                    focused: true,
                    tabs: [
                        { id: 1, windowId: 1, url: 'https://youtube.com', active: true },
                        { id: 2, windowId: 1, url: 'https://twitter.com', active: false }
                    ]
                }
            ];
            chrome.windows.getAll.mockResolvedValue(mockWindows);

            await handlers.onStartup();

            // Should create sessions for both tabs
            expect(chrome.storage.local.set).toHaveBeenCalled();
        });

        it('should skip ineligible URLs', async () => {
            const mockWindows = [
                {
                    focused: true,
                    tabs: [
                        { id: 1, windowId: 1, url: 'chrome://settings', active: true }
                    ]
                }
            ];
            chrome.windows.getAll.mockResolvedValue(mockWindows);

            await handlers.onStartup();

            // Should not create session for chrome:// URL
            expect(chrome.storage.local.set).not.toHaveBeenCalled();
        });

        it('should handle errors gracefully', async () => {
            chrome.windows.getAll.mockRejectedValue(new Error('Windows API error'));

            await expect(handlers.onStartup()).resolves.not.toThrow();
        });
    });

    describe('onCreated', () => {
        it('should create session for new eligible tab', async () => {
            const tab = {
                id: 5,
                windowId: 1,
                url: 'https://youtube.com',
                active: true
            };

            await handlers.onCreated(tab);

            expect(chrome.storage.local.set).toHaveBeenCalled();
        });

        it('should not create session for ineligible tab', async () => {
            // Clear previous calls
            jest.clearAllMocks();
            chrome.storage.local.get.mockResolvedValue({ raw: {} });

            const tab = {
                id: 5,
                windowId: 1,
                url: 'chrome://settings',
                active: true
            };

            await handlers.onCreated(tab);

            // Should not create session for chrome:// URL
            expect(chrome.storage.local.set).not.toHaveBeenCalled();
        });
    });

    describe('onUpdated', () => {
        it('should handle URL changes', async () => {
            const changeInfo = { url: 'https://twitter.com' };
            const tab = { id: 5, windowId: 1, url: 'https://twitter.com' };
            
            chrome.storage.local.get.mockResolvedValue({
                raw: {
                    'youtube.com': {
                        'ABC123': {
                            windowId: 1,
                            tabId: 5,
                            start: Date.now(),
                            focus: { 'FOC1': { start: Date.now() } }
                        }
                    }
                }
            });

            await handlers.onUpdated(5, changeInfo, tab);

            // Should end old session and create new one
            expect(chrome.storage.local.set).toHaveBeenCalled();
        });

        it('should ignore non-URL changes', async () => {
            const changeInfo = { status: 'complete' };
            const tab = { id: 5, windowId: 1, url: 'https://youtube.com' };

            await handlers.onUpdated(5, changeInfo, tab);

            expect(chrome.storage.local.set).not.toHaveBeenCalled();
        });
    });

    describe('onActivated', () => {
        it('should switch focus to newly activated tab', async () => {
            chrome.tabs.get.mockResolvedValue({
                id: 5,
                windowId: 1,
                url: 'https://youtube.com'
            });
            
            chrome.storage.local.get.mockResolvedValue({
                raw: {
                    'youtube.com': {
                        'ABC123': {
                            windowId: 1,
                            tabId: 5,
                            start: Date.now()
                        }
                    }
                }
            });

            await handlers.onActivated({ tabId: 5, windowId: 1 });

            expect(chrome.storage.local.set).toHaveBeenCalled();
        });

        it('should handle tab that does not exist', async () => {
            chrome.tabs.get.mockRejectedValue(new Error('Tab not found'));

            await expect(handlers.onActivated({ tabId: 999, windowId: 1 })).resolves.not.toThrow();
        });
    });

    describe('onRemoved', () => {
        it('should end session when tab is removed', async () => {
            chrome.storage.local.get.mockResolvedValue({
                raw: {
                    'youtube.com': {
                        'ABC123': {
                            windowId: 1,
                            tabId: 5,
                            start: Date.now(),
                            focus: { 'FOC1': { start: Date.now() } }
                        }
                    }
                }
            });

            await handlers.onRemoved(5, { windowId: 1, isWindowClosing: false });

            expect(chrome.storage.local.set).toHaveBeenCalled();
        });
    });

    describe('onFocusChanged', () => {
        it('should handle window focus change', async () => {
            chrome.tabs.query.mockResolvedValue([
                { id: 5, windowId: 1, url: 'https://youtube.com', active: true }
            ]);
            
            chrome.storage.local.get.mockResolvedValue({
                raw: {
                    'youtube.com': {
                        'ABC123': {
                            windowId: 1,
                            tabId: 5,
                            start: Date.now()
                        }
                    }
                }
            });

            await handlers.onFocusChanged(1);

            expect(chrome.storage.local.set).toHaveBeenCalled();
        });

        it('should handle WINDOW_ID_NONE', async () => {
            const mockData = {
                'youtube.com': {
                    'ABC123': {
                        windowId: 1,
                        tabId: 5,
                        start: Date.now(),
                        focus: { 'FOC1': { start: Date.now() } }
                    }
                }
            };
            chrome.storage.local.get.mockResolvedValue({ raw: mockData });

            await handlers.onFocusChanged(chrome.windows.WINDOW_ID_NONE);

            // Should end all focus globally
            expect(chrome.storage.local.set).toHaveBeenCalled();
        });
    });

    describe('onWindowRemoved', () => {
        it('should end all sessions in removed window', async () => {
            chrome.storage.local.get.mockResolvedValue({
                raw: {
                    'youtube.com': {
                        'ABC123': {
                            windowId: 1,
                            tabId: 5,
                            start: Date.now()
                        }
                    }
                }
            });

            await handlers.onWindowRemoved(1);

            expect(chrome.storage.local.set).toHaveBeenCalled();
        });
    });

    describe('onSuspend', () => {
        it('should end all active sessions', async () => {
            chrome.storage.local.get.mockResolvedValue({
                raw: {
                    'youtube.com': {
                        'ABC123': {
                            windowId: 1,
                            tabId: 5,
                            start: Date.now(),
                            focus: { 'FOC1': { start: Date.now() } }
                        }
                    }
                }
            });

            await handlers.onSuspend();

            expect(chrome.storage.local.set).toHaveBeenCalled();
        });
    });
});
