import type { CssFontSource, StripeElementStyle } from '@stripe/stripe-js';

// CardElement renders in its own iframe, so it can't see the app's @import
// in index.scss — load the same Google Fonts URL again here.
export const checkoutFonts: CssFontSource[] = [
    { cssSrc: 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap' },
];

// CardElement has no border/background/box-shadow of its own — those come
// from the wrapping .checkoutFormCardBox in checkoutModal.scss. This only
// controls the text itself.
export const cardElementStyle: StripeElementStyle = {
    base: {
        color: '#000000',
        fontFamily: '"DM Sans", sans-serif',
        fontSize: '19px',
        lineHeight: '1.6',
        '::placeholder': {
            color: 'rgba(0, 0, 0, 0.4)',
        },
    },
    invalid: {
        color: '#C80000', // $danger
    },
};
