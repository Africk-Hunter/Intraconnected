# Launch readiness audit — 2026-08-17

Artifact: https://claude.ai/code/artifact/8b26bf28-385a-4167-b19e-f309a19c411b

Read-only pass across auth, billing, and production readiness, run to answer one
question: what still stands between "it works" and "it's safe to take real
payments." Method: static code review only — no live requests made, no `npm audit`,
no live Stripe test transactions, no check of what Firestore rules are actually
published in the Firebase Console right now versus what's in this repo. Treat this
as a map of what the code says, not a live-fire test of the deployed system.

## The short version

Five things stand between this app and safely taking a real payment: **the
test-reset endpoint, the unpublished Firestore rules, Stripe not being live yet,
missing email verification, and silent webhook failures.** All five are small,
contained fixes — none require a redesign.

Everything in **High** is worth clearing out shortly after, since it's concentrated
almost entirely on the parts of the app now handling money and legal obligations
rather than the app's existing mind-mapping features, which this pass didn't need
to touch.

**Update — 2026-08-17:** 13 of these findings are now fixed in code (see
`programmer-docs/DEVLOG.md`'s "Launch Readiness Audit Follow-up" entry for the
full detail per item) — everything below marked ✅. The two Blocking items left
open are the two that can't be done from this repo at all: publishing
`firestore.rules` to the Firebase Console, and switching Stripe over to live
keys/webhook registration. Four Medium/Low items (refund tooling, modal
accessibility, a general support contact, analytics) were left out of this pass
by request and remain open.

## Blocking (5)

Fix these before the first real card is charged — each one is a way money or access
ends up wrong with no one noticing.

- ✅ **Fixed** — **Any signed-in user can cancel their own subscription outright** — `netlify/functions/reset-subscription-test.ts`
  is live in production with no environment or role check. Any authenticated user
  can POST to it directly, instantly cancel their Stripe subscription, and force
  their billing doc back to free — skipping the graceful `cancel_at_period_end`
  flow that `cancel-subscription.ts` was actually built for. A code comment says
  it's "not linked from any production UI path," but nothing enforces that.
  *Now 404s on every deployed instance unless `ALLOW_TEST_RESET=true` is set — which must only ever exist in a local `.env`.*

- ⬜ **Still open — requires the Firebase Console, not code** — **The billing lockdown is written but not switched on** — the Firestore rules
  that stop a client from writing `meta/billing` directly (and granting itself any
  plan it wants) exist in `firestore.rules`, but publishing them means manually
  pasting the file into the Firebase Console. Until that happens, the entire
  billing security model is a draft, not a defense.

- ⬜ **Still open — requires the Stripe Dashboard, not code** — **Stripe itself isn't live** — `DEVLOG.md` still marks billing as not yet
  deployed. Live Stripe keys and the webhook endpoint need to be registered in the
  Stripe Dashboard before a real card can be charged at all.

- ✅ **Fixed** — **No one confirms an email address is real** — `src/components/Auth.tsx`'s
  `handleSignUp` never calls `sendEmailVerification`, and nothing checks
  `emailVerified` before granting access. A customer who mistypes their email
  during checkout has no recovery path, and a throwaway address is enough to
  create a paying account.
  *Signup now sends a verification email; Profile has resend/refresh; `create-payment-intent.ts` 403s an unverified checkout server-side.*

- ✅ **Fixed** — **A charge can succeed while the upgrade silently fails** — the Firestore write
  in `netlify/functions/stripe-webhook.ts` has no try/catch, and there's no error
  monitoring anywhere in the app (no Sentry, nothing). If that write throws after
  Stripe has already taken someone's money, the failure is invisible until the
  customer emails asking where their upgrade went.
  *Wrapped in try/catch; success/failure now persists to `webhookEvents/{eventId}`, and a failure still 500s so Stripe retries.*

## High (7)

Not launch-blocking on their own, but each one is a gap specifically on the parts
of the app that now touch real money or a real legal obligation.

- ✅ **Fixed** — **CI doesn't check types before merge** — `.github/workflows/test.yml` runs
  `vitest run` and nothing else, no `tsc`, no lint. `npm run build` is bare
  `vite build` too, so a type error can ship straight to production with a fully
  green CI check.
  *New `typecheck`/`lint` scripts, both wired into CI ahead of `test`/`build`; `build` is now `tsc -b && vite build`. Fixed the full pre-existing error backlog this surfaced.*

- ✅ **Fixed** — **Payment and account endpoints have no rate limit** — `create-payment-intent`,
  `delete-account`, and `cancel-subscription` are all properly auth-gated, but
  callable at unlimited frequency by whoever's signed in. Only the
  feature-request endpoint throttles requests today.
  *New shared `lib/rateLimit.ts` applied to all three.*

- ✅ **Fixed** — **The money path is the least-tested part of the app** — tests exist for
  billing-event derivation, node-count limits, and one idea helper; nothing
  exercises `stripe-webhook.ts`, `create-payment-intent.ts`,
  `cancel-subscription.ts`, `delete-account.ts`, or the checkout UI itself.
  There's no end-to-end layer at all.
  *37 new tests across 5 new files cover all four functions plus the new rate limiter (86/86 passing total). No e2e/UI layer added — out of scope for this pass.*

- ✅ **Fixed** — **One bad render is a blank white screen** — no React error boundary exists
  anywhere in the component tree. A crash mid-render (during checkout or
  anywhere else) shows a paying customer nothing but white, with no report
  generated anywhere.
  *New `ErrorBoundary.tsx` wraps the whole app in `Index.tsx`.*

- ✅ **Fixed** — **"Still finalizing" can mean forever** — if the webhook's Firestore write is
  slow or fails after a successful charge, `CheckoutModal.tsx` just keeps
  showing "still finalizing" — no polling, no fallback re-check, no way out for
  the person who already paid.
  *A second, longer timeout now swaps to an honest message with a support email link.*

- ✅ **Fixed** — **Deletion exists; export doesn't** — `delete-account.ts` is fully built and
  thorough. There's no matching "export my data" path. Once there are paying —
  possibly EU — customers, offering deletion without portability is a
  half-finished data-rights story.
  *New client-side "Export Your Data" section in Profile — downloads a JSON file of decrypted ideas + account info.*

- ✅ **Fixed** — **Webhook replays aren't explicitly guarded** — there's no event-id dedup log
  in `stripe-webhook.ts`. Idempotency currently rides on incidental merge-write
  behavior, which doesn't protect against an out-of-order redelivery
  overwriting newer billing state with a stale version.
  *New `webhookEvents/{eventId}` collection checked before processing; a redelivered "processed" event is now a checked no-op.*

## Medium (5)

Worth doing, none of it should hold up launch on its own.

- **Refunds mean opening the Stripe dashboard** — no in-app refund tooling
  exists. Fine for launch, but it's currently an undocumented manual process
  rather than an actual support runbook.

- **Checkout modals skip a few accessibility basics** — neither
  `CheckoutModal.tsx` nor `UpgradeModal.tsx` sets `role="dialog"`,
  `aria-modal`, or traps focus. Close buttons are labeled correctly, but
  keyboard users can tab out of an open payment modal.

- **Nowhere to ask for help** — the only support contact anywhere in the app is
  a `mailto:` buried inside `Terms.tsx`/`Privacy.tsx`. `Pricing.tsx` — where
  billing questions actually happen — has no contact path at all.

- ✅ **Fixed** — **Login has no real teeth** — passwords are 6–20 characters with no
  complexity check, sessions have no idle or absolute timeout, and checking
  "remember me" leaves the encryption key sitting in `localStorage`
  indefinitely (`src/utilities/dekStore.ts`).
  *Password minimum raised to 8 (NIST-aligned, spaces now allowed); "remember me" now also gates the actual Firebase Auth session persistence, not just the encryption key. Idle/absolute session timeout still not implemented — a bigger UX feature, left out of this pass.*

- ✅ **Fixed** — **No stated CORS policy** — Netlify functions don't set an explicit CORS
  policy in either direction, not locked down, not deliberately open.
  *New `lib/cors.ts` — explicit origin allowlist (this site's own deploy URLs only), applied to every client-invoked function.*

## Low (2)

Flagged for awareness, not action.

- **Zero analytics — on purpose** — `src/pages/Privacy.tsx` states plainly that
  the app uses no analytics or tracking. A real, deliberate stance worth
  keeping — just note it means launching a paid product with no usage
  visibility unless that trade-off is revisited later.

- ✅ **Checked** — **One pinned dependency worth a second look** — `jose` is pinned at
  `^4.15.5` via a package override in `package.json`. Worth a quick check that
  this isn't sitting below a version with a since-patched fix.
  *Already resolving to `4.15.9` (latest 4.x) — floor bumped to match, no live vulnerability. Same pass fixed a real high-severity CSRF advisory in `react-router` (in-range bump, no breaking change).*

## Already solid (7)

Not everything here needs work — these are worth knowing about too.

- **Terms of Service and Privacy Policy are real documents** — `src/pages/Terms.tsx`
  and `src/pages/Privacy.tsx` are substantive, specific pages, not stubs,
  covering liability, the encryption model, account deletion, and governing
  law.

- **Password reset works end-to-end** — wired correctly through Firebase's own
  reset-email flow, with a working "forgot password" link in `Auth.tsx`.

- **Every sensitive function checks who's calling** — every Netlify function
  that touches billing or account data verifies the caller's Firebase ID token
  via `verifyIdToken` (`netlify/functions/lib/firebaseAdmin.ts`) before doing
  anything.

- **No XSS sinks anywhere** — no `dangerouslySetInnerHTML`, no raw `innerHTML`
  writes; every piece of user content renders through React's default
  escaping.

- **Secrets load from env, and fail loudly when missing** — admin credentials
  and Stripe keys are never hardcoded. Every function throws a clear error at
  call time if a required variable is unset, instead of failing silently.

- **The gnarly billing edge cases are actually handled** — duplicate
  purchases, annual→lifetime upgrades, and the node-cap design are all
  thought through carefully and regression-tested against real event
  sequences (`netlify/functions/lib/billingEvents.test.ts`), not just
  individual branches.

- **Account deletion is genuinely thorough** — one function
  (`delete-account.ts`) cancels the Stripe subscription immediately, wipes
  every idea and meta document, and deletes the Auth user — no orphaned
  state left behind.
