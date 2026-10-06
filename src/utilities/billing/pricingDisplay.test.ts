import { describe, expect, it } from 'vitest';
import { ANNUAL_PRICE_CENTS, ANNUAL_PRICE_DISPLAY, ANNUAL_PRICE_PER_MONTH_DISPLAY, formatMoney } from './pricingDisplay';

describe('pricingDisplay', () => {
    it('keeps the numeric annual price in sync with its display string', () => {
        expect(formatMoney(ANNUAL_PRICE_CENTS, 'usd')).toBe(ANNUAL_PRICE_DISPLAY);
    });

    it('works out the per-month price from the annual price', () => {
        expect(ANNUAL_PRICE_PER_MONTH_DISPLAY).toBe('$1.25');
    });
});
