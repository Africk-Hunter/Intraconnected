import { useState } from 'react';
import { isNative, WEB_ORIGIN } from '../platform';

// What the app may offer for upgrading. The website sells through Stripe. The
// store apps sell nothing (launch-checklist C2), and only where the store's
// rules allow it point to the website:
//   checkout  the website: plans, prices, Stripe checkout
//   link-out  the app, US store: one link to the pricing page, no prices
//   none      the app, anywhere else or unknown: no purchase prompt at all
export type PurchaseMode = 'checkout' | 'link-out' | 'none';

export const PRICING_URL = `${WEB_ORIGIN}/pricing`;

export function purchaseModeFor(native: boolean, storeCountry: string | null): PurchaseMode {
    if (!native) return 'checkout';
    return storeCountry?.toUpperCase() === 'US' ? 'link-out' : 'none';
}

// The store country is not read yet (it needs a small native plugin), so the
// app is always 'none' until that exists. Unknown always means no prompt.
export function usePurchaseMode(): PurchaseMode {
    const [mode] = useState<PurchaseMode>(() => purchaseModeFor(isNative(), null));
    return mode;
}
