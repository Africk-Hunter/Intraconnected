import { firestore } from "./firebaseAdmin";
import { stripe } from "./stripe";
import { isEligibleForLifetimeUpgradeDiscount, type BillingDoc } from "./billingEvents";

// Flat credit toward Lifetime for existing Annual subscribers, equal to
// what they already paid for the year. 0/unset disables the feature.
const LIFETIME_UPGRADE_DISCOUNT_CENTS = (() => {
    const raw = Number(process.env.STRIPE_LIFETIME_UPGRADE_DISCOUNT_CENTS);
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
})();

export async function getBillingDoc(uid: string): Promise<BillingDoc | null> {
    const doc = await firestore().collection("users").doc(uid).collection("meta").doc("billing").get();
    return doc.exists ? (doc.data() as BillingDoc) : null;
}

// Best-effort: a failure here should never block checkout, just fall back
// to full price.
export async function getLifetimeUpgradeDiscountCents(uid: string): Promise<number> {
    if (LIFETIME_UPGRADE_DISCOUNT_CENTS <= 0) return 0;
    try {
        const billing = await getBillingDoc(uid);
        return isEligibleForLifetimeUpgradeDiscount(billing) ? LIFETIME_UPGRADE_DISCOUNT_CENTS : 0;
    } catch {
        return 0;
    }
}

export interface LifetimePrice {
    amount: number;
    currency: string;
    discountCents: number;
}

// Shared by create-payment-intent.ts (actually charges this) and
// get-lifetime-price.ts (previews it before checkout opens) so the two
// never drift out of sync.
export async function getLifetimePrice(uid: string, priceId: string): Promise<LifetimePrice> {
    const price = await stripe().prices.retrieve(priceId);
    if (typeof price.unit_amount !== "number") {
        throw new Error("Lifetime price has no unit_amount.");
    }
    const discountCents = await getLifetimeUpgradeDiscountCents(uid);
    const amount = Math.max(price.unit_amount - discountCents, 0);
    return { amount, currency: price.currency, discountCents };
}
