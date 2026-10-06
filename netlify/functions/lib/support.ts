// Netlify Functions can't import from src/ (separate bundle/tsconfig — see
// LIFETIME_UPGRADE_DISCOUNT_CENTS in lifetimePricing.ts for the same
// constraint), so this mirrors src/utilities/support.ts rather than sharing
// it directly. Keep both in sync if this ever changes.
export const SUPPORT_EMAIL = "support@intraconnected.app";
