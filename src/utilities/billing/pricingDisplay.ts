// Marketing-display prices only — quoted in prose/props across the public
// Pricing page and the in-app UpgradeModal. Not the source of the actual
// charge: that always comes live from Stripe at checkout time (see
// fetchCheckoutIntent / fetchLifetimePricePreview in billing.tsx). Keeping
// these here just stops the marketing copy from drifting out of sync with
// itself if the Stripe price is ever changed.
import { ANNUAL_PRICE_CENTS } from '../../../shared/pricing';

export const ANNUAL_PRICE_DISPLAY = '$14.99';
export const LIFETIME_PRICE_DISPLAY = '$39.99';

// Numeric twin of ANNUAL_PRICE_DISPLAY (shared with the server, which credits
// it toward Lifetime). pricingDisplay.test.ts fails if the two drift.
export { ANNUAL_PRICE_CENTS };
export const ANNUAL_PRICE_PER_MONTH_DISPLAY = formatMoney(Math.round(ANNUAL_PRICE_CENTS / 12), 'usd');

export function formatMoney(amountCents: number, currency: string): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(amountCents / 100);
}
