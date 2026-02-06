// Import the modules - chrome mock is set up in test-setup.js
const { Aux, StorageV2 } = require('./fn.js');

describe('Aux Class', () => {
    describe('getTLD', () => {
        it('should extract hostname from a standard URL', () => {
            expect(Aux.getTLD('https://www.youtube.com/watch?v=123')).toBe('www.youtube.com');
            expect(Aux.getTLD('https://www.google.com/search')).toBe('www.google.com');
        });

        it('should handle URLs without www', () => {
            expect(Aux.getTLD('https://github.com/user/repo')).toBe('github.com');
        });

        it('should preserve subdomain URLs', () => {
            expect(Aux.getTLD('https://mail.google.com')).toBe('mail.google.com');
        });

        it('should handle URLs with ports', () => {
            expect(Aux.getTLD('http://localhost:3000/path')).toBe('localhost');
        });

        it('should preserve multiple subdomains', () => {
            expect(Aux.getTLD('https://api.dev.example.com')).toBe('api.dev.example.com');
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
