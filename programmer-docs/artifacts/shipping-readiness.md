# Intraconnected ship readiness — 2026-09-29

https://claude.ai/artifact/4ToZoxbevgUMJEVvt5SS63

This single document replaces three earlier ones: `launch-readiness-audit.md` (Aug 17),
`mvp-shipping-audit.md` (Aug 26) and `native-app-playbook.md` (Aug 26). Everything still open in
those files was re-checked against current code and is listed here, along with six new code problems
found on Sep 29. Items those audits already closed are kept at the end so the history isn't lost.

Build health as of Sep 29 (branch `Landing`, with uncommitted work): typecheck is clean,
123/123 tests pass, the production build succeeds, and lint reports 0 errors and 17 warnings. This
is a code review only. No live Stripe or Firebase calls were made.

**Status, end of Sep 29:** A1–A6 are all fixed in code. None of it is committed or deployed yet, and
some pieces still need work outside the code:
- A2 needs B1 (publishing the rules).
- A5 needs the Stripe Dashboard email settings.
- A6 needs a test-mode run.
- A3/A4 need a manual two-device check.

C1, C3 and C4 are decided; C2 awaits confirmation.

**Verdict: not ready to take payments.** Left: the checks above, the 6 steps outside the repo (B),
and the C2 decision. None of the 8 native-app phases have been started.

## A. Fix in code before charging anyone

- **A1 — The privacy promise about encryption isn't true.** At signup the app stores a third copy of
  each user's encryption key, `emailEncryptedDEK`, in Firestore (`Auth.tsx:129/189/236/274`). That
  copy is locked with a key derived only from the user's email address and uid (`crypto.ts`
  `wrapDEKWithEmail`), and the server knows both. So anyone who can read Firestore can decrypt every
  idea. That contradicts `Privacy.tsx:26/39/62/126` ("We cannot read them", "Only you can decrypt")
  and `Terms.tsx:55/84` ("end-to-end encrypted"). **Done Sep 29 (C1: keep email recovery):**
  Privacy, Terms, the recovery-code screen in `Auth.tsx`, `index.html` JSON-LD and
  `site.webmanifest` no longer claim end-to-end encryption, and Privacy now discloses the
  recovery key copy.
- **A2 — Users can reset their own rate limits.** The `meta/{metaDocId}` rule in `firestore.rules`
  lets a signed-in user write any of their own `meta` docs except `billing` and `nodeCount`. That
  includes `rateLimit_*`, which throttles `checkout`, `cancelSubscription`, `deleteAccount` and
  `refundLifetime`. It also includes `featureRequests`, the 5-per-day cap on creating GitHub issues
  with your `GITHUB_TOKEN`. **Fix:** exclude both from the rule and give the client no write access.
  Only Netlify Functions touch these docs. Do this before B1. **Fixed in code Sep 29:** the
  wildcard now also excludes `featureRequests` and `rateLimit_*`, with no grant-back block. Takes
  effect only once B1 publishes the rules.
- **A3 — One failed load leaves a user's map empty, and it stays empty.** `organizers.tsx` clears the
  local ideas *before* it fetches, then saves the sync timestamp even if the fetch failed. Every
  later load then skips the fetch. The fetch fails on a network error, or when a single doc won't
  decrypt, because `Promise.all` fails the whole batch. Once the local list is empty, the node-count
  resync also writes 0 to `meta/nodeCount`. **Fix:** fetch first, only replace local data when the
  fetch succeeds, don't save the timestamp on failure, and decrypt each doc separately.
- **A4 — Failed saves are silent, and devices drift apart.** Every Firestore write helper in
  `firebaseHelpers.tsx` catches its error and only logs it. The idea stays in localStorage, so the
  user sees it, but it's never saved to the server. Separately, a tab or app that stays open misses
  edits made on other devices. Its next save overwrites the shared sync timestamp, so its later loads
  skip the fetch. Deleting items from that out-of-date view can leave another device's new children
  orphaned in Firestore. **Fix:** tell the user when a save fails and retry or roll it back. Replace
  the single shared timestamp with a live listener, or at least refetch when the app regains focus.
  This is a design task. It also blocks the native app.
  **A3 and A4 fixed in code Sep 29** with a new sync layer in `src/utilities/sync/` (`organizers.tsx`
  is deleted):
  - Every change is saved to an outbox on the device before it's sent. Changes go out one at a time,
    in order, and are retried until the server accepts them, so they survive reloads and offline
    periods.
  - If the server refuses a change, sending pauses and a banner offers **Try again** or **Discard
    change**. Nothing is thrown away automatically.
  - Loading from the server fetches everything first and only then replaces the local copy. Offline,
    it throws instead of returning an empty list. Each idea is decrypted separately, so one bad doc
    doesn't hide the rest.
  - Each device now keeps its own change counter, replacing the single shared timestamp. A listener
    pulls in other devices' changes, but only while the app is visible, and 3 s after edits pause.
  - Ideas left without a parent are moved to the top level.
  - Cost: about 1 extra read per page load plus 1 per edit, and no extra writes.
  - Not yet checked in a running app with two signed-in devices (see the plan's manual checklist).
- **A5 — Stripe customers have no email address.** `create-payment-intent.ts` creates customers with
  only `metadata`. Without an email, Stripe can't send receipts, failed-payment notices or renewal
  reminders, and several US states' auto-renewal laws require those reminders for annual plans.
  **Fix:** pass the verified email when creating the customer, backfill existing customers, and turn
  on receipt and renewal emails in the Stripe Dashboard. **Fixed in code Sep 29:** the verified
  email now comes from the ID token (`verifyIdTokenDetailed`), and `resolveCustomer` sets it on new
  customers and updates it on existing ones at their next checkout (tested). **Still to do:** turn on
  receipt, failed-payment and upcoming-renewal emails in Stripe Dashboard → Settings → Customer
  emails, for both test and live mode.
- **A6 — Refunding an upgrade to Lifetime probably drops the user to Free.** When an Annual→Lifetime
  upgrade is refunded, `resumeAnnualSubscription` in `stripe-webhook.ts` creates the new Annual
  subscription with `default_incomplete`. Nothing ever confirms it. The saved card is also attached to
  the old subscription, not set as the customer's default. So the new subscription most likely stays
  `incomplete`. (This is inferred from Stripe's documented behavior, not tested.) **Fix:** copy the
  old subscription's default payment method onto the customer, create the new subscription
  off-session with `error_if_incomplete` or `allow_incomplete`, then test it in test mode and add a
  unit test. **Fixed in code Sep 29, differently:** instead of charging again, the restore creates a
  subscription that is `trialing` until the end of the year already paid for, with the old
  subscription's card and its `cancel_at_period_end` choice. If that year is over, or anything is
  missing, the user goes to Free. Six new unit tests cover it. **Still to do:** run the
  upgrade-then-refund flow once in Stripe test mode.

## B. Outside the repo, before charging anyone

- **B1 — Publish `firestore.rules`** in Firebase Console → Firestore → Rules for project
  `interconnectedness-3a37b`, after fixing A2. Until then, any user can grant themselves Lifetime, and
  the node cap isn't enforced on the server. This has been open since Aug 17.
- **B2 — Switch Stripe to live mode.** `.env` still holds `pk_test_…`. Set the live values of
  `VITE_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ANNUAL`
  and `STRIPE_PRICE_LIFETIME` in Netlify's production environment. Register a live webhook endpoint
  subscribed to `payment_intent.succeeded`, `customer.subscription.updated`,
  `customer.subscription.deleted` and `charge.refunded` (without that last one, refunded customers
  keep Lifetime). Make sure `ALLOW_TEST_RESET` isn't set in Netlify. Open since Aug 17.
- **B3 — Point Firebase's email templates at your own page.** In Console → Authentication →
  Templates, set the action URL to `https://intraconnected.app/auth/action`. Open since Aug 26.
- **B4 — Test on the live deploy.** Make a real purchase (including a 3-D Secure test card), sign in
  and sign out, and check the browser console for requests blocked by the Content Security Policy.
  Stripe's guidance also lists `https://*.js.stripe.com` for `script-src` and `frame-src`, which the
  policy doesn't include. Open since Aug 26.
- **B5 — Check that `support@intraconnected.app` actually receives mail.** It's referenced from
  Pricing, Terms, Privacy, the checkout timeout message and the refund fallback.
- **B6 — Business setup.**
  - Terms names you personally as the operator, so you're personally liable for the service; an LLC
    would separate that.
  - Nothing collects sales tax or VAT. Use Stripe Tax or a merchant of record such as Paddle or
    Lemon Squeezy.
  - The checkout screen should state clearly that Annual renews automatically.

## C. Decisions only you can make

- **C1 — Decided Sep 29: keep email recovery**, reword the copy. Done; see A1. Never describe the
  app as "end-to-end encrypted" anywhere (store listings included) unless this is revisited.
- **C2 — Recommended Sep 29, pending confirmation:** Stripe on the web stays the only billing
  system for v1. The native app sells nothing; where store rules allow it (currently the US on both
  stores), it links out to `/pricing`, elsewhere it shows no purchase prompt. Add in-app purchase
  later only if app-store signups become a meaningful share, through RevenueCat, writing to
  `meta/billing` with a `source` field (`stripe`/`apple`/`google`) so one system never overwrites
  another's plan. Store rules on external links are changing quickly; re-check them before D5/D6.
- **C3 — Decided Sep 29: Codemagic.** It supports Capacitor directly, signs builds with an App
  Store Connect API key (no `fastlane match` needed), uploads to TestFlight, and has a free monthly
  allowance of macOS minutes. You still need an iPhone to test on. Setup steps are in D6.
- **C4 — Decided Sep 29: keep showing** the disabled "Customization — Coming soon" tab. No change.

## D. Native app track (from the Aug 26 playbook, re-checked)

Nothing exists yet: no `capacitor.config`, no `ios/`, no `android/`. The approach is still Capacitor
in this repo, wrapping `dist/`. A React Native rewrite would throw away every DOM component and
`@dnd-kit`, and a Trusted Web Activity only covers Android. A3 and A4 (fixed in code Sep 29) had to come first: a phone app stays
open in the background far longer than a browser tab does.

How the app behaves inside a WebView compared with a browser tab:

- **Fine as is:** Firebase Auth (email and password), `BrowserRouter`, and email links from
  `AuthAction.tsx`.
- **Sync:** handled by the Sep 29 sync layer. Changes are queued on the device, and another device's changes are pulled when the app comes back to the foreground. Verify it on a real phone.
- **Encryption key:** unless the user checked "Remember me", the key lives only in `sessionStorage`.
  When the OS kills the app, the user is sent back to the password login, so native users would be
  logged out constantly. Store the key in the platform keychain with a secure-storage plugin.
- **Security headers:** `netlify.toml` headers never reach the bundled app. Add a CSP `<meta>` tag
  to `index.html` instead.
- **Stripe checkout:** depends on C2.

The phases:

1. **D1 — Install Capacitor.**
   `npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android`, then
   `npx cap init "Intraconnected" "com.intraconnected.app" --web-dir dist`, `npm run build`,
   `npx cap add ios`, `npx cap add android`. After every change: `npm run build && npx cap sync`.
   Commit `ios/` and `android/`, and gitignore their build output. Keep `webDir: 'dist'` and
   `androidScheme: 'https'`. Never set `server.url` to the live site: Apple rejects that under
   guideline 4.2.
2. **D2 — Icons and splash screen.** Export `MainLargerLogo.svg` to a 1024×1024 `assets/icon.png`
   with `sharp`, and make a 2732×2732 mint `assets/splash.png`. Then run
   `npx capacitor-assets generate --iconBackgroundColor "#E9F9E5" --splashBackgroundColor "#E9F9E5"`.
3. **D3 — Native plugins.** Install `@capacitor/app`, `status-bar`, `splash-screen`, `keyboard` and
   `haptics`.
   - Required: make Android's back button navigate up through `MobileMindMap.tsx`'s breadcrumbs
     using `App.addListener('backButton', …)`. Today it closes the app.
   - Set the keyboard plugin's `resize: 'none'` so it doesn't fight the existing `visualViewport`
     handling.
   - Use secure storage for the encryption key.
4. **D4 — CSP `<meta>` tag** mirroring the `netlify.toml` allowlist.
5. **D5 — Android and Play Store (works on Windows).**
   - In Android Studio, build a signed `.aab` and enroll in Play App Signing.
   - The Play Console account costs $25 once.
   - Fill in the Data safety form truthfully. Say data is encrypted in transit and at rest, not
     "end-to-end encrypted" (C1 kept email recovery).
   - Release to internal testing first, then production.
6. **D6 — iOS and App Store (needs C3).**
   - Enroll in the Apple Developer Program ($99 a year), build and sign with Codemagic (C3), and
     go through TestFlight to review. Setup:
     1. Register the bundle ID `com.intraconnected.app` and create the app record in App Store
        Connect.
     2. Create an App Store Connect API key (App Manager role) and connect it in Codemagic →
        Integrations → Developer Portal.
     3. In Codemagic → Code signing identities, generate an Apple Distribution certificate and
        fetch an App Store provisioning profile.
     4. Commit a `codemagic.yaml` workflow: `npm ci` → `npm run build` → `npx cap sync ios` →
        `xcode-project use-profiles` → bump the build number → `xcode-project build-ipa` → publish
        to TestFlight.
     5. Put `VITE_*` build variables in a Codemagic environment group.
   - Guideline 3.1.1 (in-app purchase) is covered by C2, and 4.2 (minimum functionality) by D3.
   - 4.8 doesn't apply: Sign in with Apple isn't required when the app only offers email login.
   - 5.1.1(v) is already met: account deletion exists.
7. **D7 — Continuous builds**, set up only after D5 and D6 have each been done once by hand.
   Codemagic can run the Android build too, so both can live in one `codemagic.yaml`. On
   every release, bump the version in `android/app/build.gradle` and the iOS build number.
8. **D8 — Release loop.** Native changes wait for store review; web changes still deploy
   instantly. Firebase, the security rules and the encryption are shared between web and app. Only
   the payment system differs.

## E. Should fix, not blocking

- **E1 — Out-of-order webhook events.** Stripe doesn't guarantee event order, and the handler
  trusts each event's own status, so an older event can overwrite a newer one. Fetch the
  subscription fresh from Stripe, or compare each event's `created` time.
- **E2 — Refund window.** The 14-day window counts from `billing.updatedAt`, which any webhook write
  changes. Store `lifetimePurchasedAt` instead.
- **E3 — "Remember me" stores the raw encryption key in `localStorage`.**
- **E4 — Sessions never time out**, either after idle time or after a fixed maximum.
- **E5 — No error monitoring.** Client failures, including A4's failed saves, are invisible.
  Having no analytics is deliberate.
- **E6 — The client can set `meta/nodeCount` to any number.** This is accepted and disclosed; a real
  fix needs a Cloud Function.
- **E7 — No end-to-end or UI tests** cover the checkout screens or the sync layer.
- **E8 — `/` shows the login form, not the landing page.** Deferred; see CLAUDE.md → Marketing Site
  Routing & SEO.
- **E9 — 17 `react-hooks/exhaustive-deps` lint warnings.** Each needs individual review.

## F. Corrections to the earlier documents

- The Aug 26 audit said the code-side work was done. A1–A6 show it wasn't.
- The Aug 17 audit said the `webhookEvents` log guards against out-of-order redelivery. It only
  catches duplicates of the same event; ordering is still open (E1).
- The Aug 26 audit said the CSP uses a script hash. That was replaced by `'unsafe-inline'`; see
  CLAUDE.md.
- The playbook said email recovery would run more often on phones. Actually, when the OS kills the
  app, the user just logs in again with their password, which works normally. The real problem is
  those frequent logouts, and email recovery itself is A1.
- The playbook's Data safety wording ("end-to-end encrypted") is only accurate if C1 goes that way.

## G. Already fixed

- **Aug 17:**
  - The test billing-reset endpoint now returns 404 unless `ALLOW_TEST_RESET` is set.
  - Email verification is sent at signup and required on the server before checkout.
  - Webhook failures are caught, recorded in `webhookEvents`, and retried by Stripe after a 500.
  - Duplicate webhook events are detected by event ID.
  - CI now runs typecheck and lint, and `build` runs `tsc -b`.
  - Rate limiting was added (its storage is still client-writable; see A2).
  - 37 billing tests were added.
  - `ErrorBoundary` was added.
  - The checkout's "still finalizing" message now times out.
  - Users can export their data as JSON.
  - The minimum password length is 8, and "Remember me" also controls session persistence.
  - The CORS allowlist is in place.
  - `jose` was bumped to 4.15.9 and a react-router advisory was patched.
- **By Aug 26:**
  - Self-serve Lifetime refunds (`refund-lifetime.ts`).
  - Checkout modals have focus traps and dialog roles.
  - A support contact appears on Pricing.
- **Aug 26:**
  - Terms and Privacy now match the live billing.
  - `apple-touch-icon.png` and `og-image.png` were generated.
  - The PWA icon set was added.
  - Metadata points to `/landing`, with a 4-URL sitemap and a "New here?" link.
  - Security headers were added (not yet verified live; see B4).
  - Debug logs were removed.
  - The Pricing call-to-action uses client-side navigation.
  - `.netlify/` was excluded from tests and lint (lint warnings went from 47 to 17).
  - Refunds were documented in CLAUDE.md.
- **Aug 13:** `firestore.rules` stops clients from writing `meta/billing`. It isn't published yet
  (B1).

## H. Already solid (re-checked Sep 29)

- Every billing and account function verifies the caller's ID token, and the webhook verifies
  Stripe's signature.
- There are no XSS sinks: no `dangerouslySetInnerHTML` and no raw `innerHTML`.
- Secrets come from environment variables, and code fails with a clear error if one is missing.
- Edge cases are handled and regression-tested with real event sequences: duplicate purchases,
  Annual→Lifetime upgrades, refunds that restore the previous plan, and the `past_due` grace period.
- Account deletion is complete: it cancels Stripe, wipes the user's data, and deletes the Auth user.
- Cancelling Annual keeps access until the paid year ends.
