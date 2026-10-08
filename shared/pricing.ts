// What the Annual plan costs, in cents. The app quotes it ($14.99) and the
// server credits exactly this much toward Lifetime for an Annual subscriber
// who upgrades (netlify/functions/lib/lifetimePricing.ts). The charge itself
// always comes live from Stripe; change the Stripe price and this together.
export const ANNUAL_PRICE_CENTS = 1499;
