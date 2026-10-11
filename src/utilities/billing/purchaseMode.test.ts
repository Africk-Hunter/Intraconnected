import { describe, it, expect } from 'vitest';
import { purchaseModeFor, PRICING_URL } from './purchaseMode';

describe('purchaseModeFor', () => {
    it('is plain checkout on the web, whatever the country', () => {
        expect(purchaseModeFor(false, null)).toBe('checkout');
        expect(purchaseModeFor(false, 'US')).toBe('checkout');
        expect(purchaseModeFor(false, 'DE')).toBe('checkout');
    });

    it('links out from the app only for the US store', () => {
        expect(purchaseModeFor(true, 'US')).toBe('link-out');
        expect(purchaseModeFor(true, 'us')).toBe('link-out');
    });

    it('offers nothing in the app anywhere else', () => {
        expect(purchaseModeFor(true, 'DE')).toBe('none');
        expect(purchaseModeFor(true, 'GB')).toBe('none');
        expect(purchaseModeFor(true, '')).toBe('none');
    });

    it('offers nothing in the app when the country is unknown', () => {
        expect(purchaseModeFor(true, null)).toBe('none');
    });

    it('links to the real pricing page', () => {
        expect(PRICING_URL).toBe('https://intraconnected.app/pricing');
    });
});
