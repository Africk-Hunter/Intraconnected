# Stripe test-mode run — 2026-09-29

https://claude.ai/artifact/GNh85NxT9Zgwj43tZnXZag

Every billing path, run locally against Stripe test mode before the live keys go in. Covers A5, A6,
the webhook-events part of B2, and a local practice run of B4 from `shipping-readiness.md`.

**Test cards** (any future expiry, any CVC/ZIP):

| Card | Behavior |
|---|---|
| `4242 4242 4242 4242` | Succeeds |
| `4000 0025 0000 3155` | Needs 3-D Secure |
| `4000 0000 0000 0002` | Declined |
| `4000 0000 0000 9995` | Insufficient funds |

**To start any test over:** Profile → Developer Testing → **Reset to Free**.

## 0. Setup (once)

1. **Check the env vars.** `.env` or the linked Netlify site's env (which `netlify dev` pulls in) needs:
   - `STRIPE_SECRET_KEY=sk_test_…`
   - `STRIPE_PRICE_ANNUAL` (a test-mode recurring yearly price)
   - `STRIPE_PRICE_LIFETIME` (a test-mode one-time price)
   - `FIREBASE_SERVICE_ACCOUNT_BASE64`
   - `ALLOW_TEST_RESET=true` (local only, never in Netlify)

   As of 2026-09-29, `.env` only has `STRIPE_WEBHOOK_SECRET` and `VITE_STRIPE_PUBLISHABLE_KEY`. The
   publishable key, secret key and prices must all come from the same Stripe account in test mode.
2. **Turn on customer emails (A5).** In Stripe Dashboard (test mode) → Settings → Customer emails,
   turn on successful payments, failed payments and upcoming renewals.
3. **Log in to the Stripe CLI:** `stripe login`.
4. **Start everything:** `npm run dev:stripe`. Open `http://localhost:8888`, not the Vite port, which
   has no functions.
5. **Check the webhook secret.** If `[stripe]` prints a `whsec_…` that doesn't match `.env`, update
   `.env` and restart.
6. **Keep three things open while testing:**
   - the `[netlify]` / `[stripe]` terminal output
   - Firestore Console at `users/{uid}/meta/billing`
   - Stripe Dashboard → Developers → Events

## 1. Gates before payment

1. **Unverified email:** sign up a new account and don't verify it. Try to check out. It should be
   refused with a verify-your-email error (403 from `create-payment-intent`).
2. **Signed out:** go to `/pricing` and click a plan. You should land on `/`. After you sign in,
   checkout should reopen with that plan.

## 2. Lifetime purchase

1. On a verified free account, buy Lifetime with `4242…`.
2. `[stripe]` should show `payment_intent.succeeded` → 200.
3. `meta/billing` should show `plan: "lifetime"` and `previousPlan: "free"`.
4. The UI should update without a reload, and the node cap should be gone.
5. In Stripe → Customers, the customer should have your email, and the PaymentIntent should have
   `receipt_email` and `metadata.firebaseUid`.
6. **Duplicate guard:** try to buy Lifetime again. The card should be hidden. Calling the function
   directly should return 409.

## 3. Annual purchase

1. Reset to Free, then buy Annual with `4242…`.
2. `meta/billing` should show `plan: "annual"`, `subscriptionStatus: "active"` and a
   `stripeSubscriptionId`.
3. The subscription in Stripe should have `metadata.firebaseUid`.
4. **Duplicate guard:** the Annual card should disappear from Pricing and UpgradeModal.

## 4. Card failures

1. Reset to Free, then try the declined card and the insufficient-funds card on both plans.
   - Each should show an inline error.
   - `plan` should stay `free`.
   - You should be able to retry with `4242…` in the same modal.
2. Try the 3-D Secure card on both plans.
   - Complete the challenge once. The plan should be granted.
   - Fail it once. There should be an error, and no plan granted.

## 5. Cancelling Annual

1. On Annual, go to Profile → Account → Cancel.
2. In Stripe, the subscription should show `cancel_at_period_end: true`.
   `customer.subscription.updated` should arrive, and the plan should stay `annual`.
3. In Stripe Dashboard, cancel the subscription immediately.
4. `customer.subscription.deleted` should arrive, and the plan should become `free`.

## 6. Annual → Lifetime upgrade

1. Reset, then buy Annual.
2. Open the upgrade picker. The Lifetime price should be $14.99 less (the `get-lifetime-price`
   preview).
3. Buy Lifetime.
   - The charged amount in Stripe should match the discounted price.
   - The old subscription should be cancelled immediately.
   - `meta/billing` should show `plan: "lifetime"` and `previousPlan: "annual"`.
4. Check that the `.updated` and `.deleted` events for the old subscription did not downgrade the
   plan. The subscription fields should be cleared, and the plan should stay `lifetime`.

## 7. Refunds

1. **Self-serve Lifetime refund, from free:** go from free to Lifetime, then Profile → Account →
   Refund.
   - `charge.refunded` should arrive.
   - The plan should go back to `free` and `previousPlan` to `null`.
2. **Upgrade then refund (A6):** do step 6, then refund.
   - A new subscription should appear on the same customer with status `trialing`.
   - Its `trial_end` should equal the old subscription's `current_period_end`.
   - It should use the same card, and its `cancel_at_period_end` should match the old one.
   - The plan should become `annual`, and no new charge should appear.
   - Repeat with Cancel clicked before upgrading. The new subscription should then also have
     `cancel_at_period_end: true`.
3. **Partial refund:** in Dashboard, refund only part of a Lifetime charge. The plan should stay
   `lifetime`.
4. **Outside the 14-day window:** in Firestore Console, set `billing.updatedAt` to more than 14 days
   ago.
   - The Refund button should be hidden or ineligible.
   - The function should point to the support email.
5. **Dashboard refund:** refund a Lifetime charge in full from the Dashboard. The downgrade should
   happen the same way as the self-serve refund.

## 8. Webhook reliability

1. **Duplicate delivery:** after any event, run `stripe events resend evt_…`. You should get a 200
   and no change to billing (the `webhookEvents` dedupe).
2. **Retry after downtime:** stop `netlify dev` but leave `stripe listen` running. Make a purchase.
   The delivery should fail.
3. Restart `netlify dev` and run `stripe events resend evt_…`. The plan should now be granted.
4. **Bad signature:** send a POST to `/.netlify/functions/stripe-webhook` with a fake body. It should
   return 400.

## 9. Account deletion

1. On an Annual account, delete the account from Profile.
2. In Stripe, the subscription should be cancelled immediately.
3. In Firestore, the user's `ideas` and `meta` should be gone.
4. The Auth user should be deleted.

## 10. Before switching to live keys

- **B4:** in the browser console, check for CSP violations throughout. Watch the 3-D Secure iframe
  and Stripe's `*.js.stripe.com` subdomains (the policy is missing those).
- Clean up test customers and subscriptions in Stripe, or leave them, since test mode is separate
  from live.
- **B2:** the live webhook endpoint needs these four events: `payment_intent.succeeded`,
  `customer.subscription.updated`, `customer.subscription.deleted` and `charge.refunded`. Confirm
  `ALLOW_TEST_RESET` is not set in Netlify.

## What this local run can't cover

- **Renewals and failed renewals** (`past_due` grace, E1 event ordering) need a Stripe test clock,
  and checkout creates its own customers without one. Skip them or test them later.
- **Receipt emails** aren't sent automatically in test mode. Use "Send receipt" on a payment in the
  Dashboard to preview one.
