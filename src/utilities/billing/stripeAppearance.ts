import type { CssFontSource, StripeElementStyle } from '@stripe/stripe-js';

// CardElement renders in its own iframe, so it can't see the app's @import
// in index.scss — load the same Google Fonts URL again here.
export const checkoutFonts: CssFontSource[] = [
    { cssSrc: 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap' },
];

// CardElement has no border/background/box-shadow of its own — those come
// from the wrapping .checkoutFormCardBox in checkoutModal.scss. This only
// controls the text itself.
//
// CardElement renders in a cross-origin iframe, so checkoutModal.scss's
// @media queries can't reach it — the 19px/25px split below mirrors the
// same $mobile (576px) breakpoint by hand. Computed fresh each render
// (CheckoutForm calls this, not the old static export) rather than reacting
// to resize, since the Elements instance is recreated per checkout anyway
// (`key={checkoutPlan}` in CheckoutModal.tsx).
export function getCardElementStyle(): StripeElementStyle {
    const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 577px)').matches;

    return {
        base: {
            color: '#000000',
            fontFamily: '"DM Sans", sans-serif',
            fontSize: isDesktop ? '25px' : '19px',
            lineHeight: '1.6',
            '::placeholder': {
                color: 'rgba(0, 0, 0, 0.4)',
            },
        },
        invalid: {
            color: '#C80000', // $danger
        },
    };
}
