// Marketing-display prices only — quoted in prose/props across the public
// Pricing page and the in-app UpgradeModal. Not the source of the actual
// charge: that always comes live from Stripe at checkout time (see
// fetchCheckoutIntent / fetchLifetimePricePreview in billing.tsx). Keeping
// these here just stops the marketing copy from drifting out of sync with
// itself if the Stripe price is ever changed.
export const ANNUAL_PRICE_DISPLAY = '$14.99';
export const LIFETIME_PRICE_DISPLAY = '$39.99';

// Numeric twin of ANNUAL_PRICE_DISPLAY, only used to work out the per-month
// figure. pricingDisplay.test.ts fails if the two drift.
export const ANNUAL_PRICE_CENTS = 1499;
export const ANNUAL_PRICE_PER_MONTH_DISPLAY = formatMoney(Math.round(ANNUAL_PRICE_CENTS / 12), 'usd');

export function formatMoney(amountCents: number, currency: string): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(amountCents / 100);
}
