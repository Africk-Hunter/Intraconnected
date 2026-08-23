// Marketing-display prices only — quoted in prose/props across the public
// Pricing page and the in-app UpgradeModal. Not the source of the actual
// charge: that always comes live from Stripe at checkout time (see
// fetchCheckoutIntent / fetchLifetimePricePreview in billing.tsx). Keeping
// these here just stops the marketing copy from drifting out of sync with
// itself if the Stripe price is ever changed.
export const ANNUAL_PRICE_DISPLAY = '$1.99';
export const LIFETIME_PRICE_DISPLAY = '$4.99';
