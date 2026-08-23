# Dev Log — Private Changelog

Personal record of every update. Not displayed to users. See `programmer-docs/CHANGELOG.md` for the public-facing feature announcements.

---

## Launch Readiness Audit Follow-up — 2026-08-17
- Ran a fresh pre-launch audit (`programmer-docs/artifacts/launch-readiness-audit.md`) across auth/security, billing robustness, and production readiness — separate from and broader than the 2026-08-11/2026-08-13 billing-specific audits. Closed all 5 Blocking findings, all 7 High findings, and the CI/dependency items from Medium/Low, in one pass.
- **`reset-subscription-test.ts` no longer reachable on any deployed instance.** It was live in production with only an auth check — any signed-in user could POST to it directly and instantly reset their own billing to free, bypassing `cancel-subscription.ts`'s `cancel_at_period_end` semantics. Now gated on `process.env.ALLOW_TEST_RESET === "true"` (404 otherwise, checked before anything else runs) — a var that must only ever exist in a local `.env`, never in Netlify's site environment variables. `programmer-docs/stripe-testing.local.md` documents the opt-in.
- **Webhook failures are no longer invisible.** `stripe-webhook.ts`'s billing write had no try/catch and no monitoring anywhere existed — a Firestore failure after Stripe had already charged someone was undiscoverable until they emailed asking where their upgrade went. Now wrapped in try/catch: success or failure is persisted to a new top-level `webhookEvents/{eventId}` collection (Admin-SDK-only, not reachable by any Firestore rule), and a failure still returns 500 so Stripe's own retry keeps trying. The same `webhookEvents` doc also closes the idempotency gap — redelivery of an already-`"processed"` event is now a checked no-op instead of relying on incidental merge-write idempotency.
- **Email verification**, gated where it actually matters rather than blocking the whole app: `handleSignUp` now calls `sendEmailVerification` (best-effort); Profile gained a "Verify Your Email" section (resend + "I've verified — refresh", the latter forcing an ID-token refresh via `getIdToken(true)` so the server sees it too) that only renders while unverified. Server-side, `create-payment-intent.ts` now uses a new `verifyIdTokenDetailed()` (`lib/firebaseAdmin.ts`) to read the token's `email_verified` claim and 403s an unverified checkout attempt directly — closes the case of hitting the function without going through the UI at all. Existing app access (idea creation, everything else) is untouched; only starting a paid checkout requires it.
- **Rate limiting** extended past `submit-feature-request.ts` (which already had its own) to `create-payment-intent`, `cancel-subscription`, and `delete-account` — previously auth-gated but callable at unlimited frequency. New shared `lib/rateLimit.ts` (Firestore sliding-window, same shape as the existing bespoke one) rather than duplicating the pattern a fourth time.
- **CORS given an explicit, stated policy** instead of no policy either way: new `lib/cors.ts` only grants `Access-Control-Allow-Origin` back to the site's own deploy origins (`process.env.URL`/`DEPLOY_PRIME_URL`/`DEPLOY_URL` plus local `netlify dev`), never a wildcard, with preflight handling — applied to every client-invoked function (not `stripe-webhook.ts`, which is server-to-server and has no Origin-based model to begin with).
- **CI now actually typechecks and lints.** `.github/workflows/test.yml` runs `npm run typecheck` (new script — `tsc -b` for the app plus a separate `tsc -p tsconfig.functions.json` pass, since Netlify Functions have their own project and aren't covered by the app's build) and `npm run lint` (new script — `eslint .` had no script at all before this) ahead of `npm test` and `npm run build`; `build` itself is now `tsc -b && vite build` instead of a bare `vite build` that could ship a type error straight through. Turning this on surfaced a backlog of pre-existing errors nothing had ever caught (no one had run `tsc` or `eslint .` before) — fixed all of them (mostly `noUnusedLocals`/implicit-`any`/null-vs-undefined narrowing gaps in `MobileMindMap.tsx`, `MobileMoveSheet.tsx`, `RenameModal.tsx`, `organizers.tsx`, `parseChangelog.ts`; one genuine cross-package type conflict in `vite.config.ts` from vitest bundling its own nested vite, documented with a narrow cast) rather than leaving the new gate red on day one. One incidental deletion flagged separately: `Idea.tsx` had a fully-wired but never-called `handleRootPriority`/`rootPriority` mechanism (state, an effect keeping it in sync, and a handler matching the documented priority-write pattern) with no UI ever calling it — removed as dead code to satisfy `noUnusedLocals`, but this reads like paused feature work, not cruft, so flagging here in case a "set root priority" UI was actually wanted.
- Also added `argsIgnorePattern`/`varsIgnorePattern: '^_'` to `eslint.config.js` — the codebase already used a leading-underscore convention for intentionally-unused params (`_context` in every Netlify function) and destructured discards (`_p`), but nothing had told ESLint about it, so `npm run lint` was flagging all of it.
- **Password/session hardening.** `checkPassword` now requires 8+ characters (was 6) and no longer bans spaces (NIST 800-63B: length matters more than arbitrary complexity, and banning spaces blocks real passphrases) — upper bound loosened from 20 to 128, a sanity cap rather than a real constraint. Separately, `setPersistence` was previously called unconditionally with `browserLocalPersistence` on mount, completely ignoring the "Keep me signed in" checkbox — meaning unchecking it never actually shortened the Firebase Auth session, only the encryption key's persistence. It's now applied per sign-in/sign-up (`browserLocalPersistence` vs `browserSessionPersistence` based on `rememberMe`), so both halves of "remember me" agree.
- **"Still finalizing" can no longer mean forever.** `CheckoutModal.tsx` already waited on the live billing listener rather than a flat timer (see 2026-08-11 entry) with a 20s "still finalizing" message; added a second, longer threshold (2 minutes) that swaps to an honest "this is taking unusually long, you won't be charged again, email us if it doesn't resolve" message with a `mailto:` link, instead of leaving the original message technically-true-but-misleading if the webhook is actually stuck rather than just slow.
- **Blank-white-screen crashes fixed.** New `ErrorBoundary.tsx` (class component, reuses the existing `.overlay`/`.modal.neobrutal` markup rather than any component that could itself be mid-crash) now wraps the whole app in `Index.tsx` — previously zero error boundaries existed anywhere, so any uncaught render error showed nothing at all.
- **Data export added** ("delete my data" existed via `delete-account.ts`; "export my data" didn't). Entirely client-side — `fetchFullIdeaList()` already reads the decrypted copy out of `localStorage` (see E2E Encryption), so there's nothing a server endpoint could add — new "Export Your Data" section in Profile downloads a JSON file (ideas + basic account info) via the same Blob/object-URL pattern `Auth.tsx` already uses for the recovery-code download.
- **Dependency check.** `jose` (flagged as "worth a second look") turned out to already resolve to `4.15.9`, the latest 4.x, via the existing override's floor — bumped the override string to match so it stays an accurate floor rather than a stale one; `npm audit` found no live jose vulnerability. The same pass surfaced a real high-severity CSRF advisory (GHSA-qwww-vcr4-c8h2) in `react-router`, a production dependency — fixed with an in-range bump (`^7.5.2` → `^7.18.2`, no breaking change). Remaining `npm audit` findings are all `netlify-cli`/dev-tooling-only (not shipped) or firebase-admin transitive deps where the suggested "fix" is actually a major downgrade — left alone.
- **37 new tests** across 5 new files (`create-payment-intent.test.ts`, `cancel-subscription.test.ts`, `delete-account.test.ts`, `stripe-webhook.test.ts`, `reset-subscription-test.test.ts`, `lib/rateLimit.test.ts`) — previously none of the money-path Netlify Functions had any test coverage at all. Mocks `lib/firebaseAdmin`/`lib/stripe`/`lib/rateLimit` via `vi.mock`, with a small shared `lib/testUtils.ts` (`fakeDocRef`, `fakeRequest`) rather than a full generic fake-Firestore layer — kept deliberately lighter than that, each test file builds just the chain shape it needs. Covers auth/rate-limit/validation gating on every function, the email-verification gate, the reset-endpoint's new env gate, and — the two most load-bearing new behaviors — webhook idempotency (a redelivered `"processed"` event short-circuits) and the failure-log-and-500 path (a thrown billing write is both persisted and triggers a Stripe retry). 86/86 tests passing (49 pre-existing + 37 new), typecheck clean, lint clean, build clean.
- Not committed (per this file's standing rule). `firestore.rules` publish to the Firebase Console and Stripe going live are both still open from the earlier billing audits — untouched by this pass.

## Billing Audit Follow-up — 2026-08-17
- Closed a gap outside the original 2026-08-11 audit's scope: **a fully refunded Lifetime purchase kept its access forever** — nothing in `stripe-webhook.ts` ever listened for `charge.refunded`, so the path was pay → get a full refund from support → keep the product permanently, with no code anywhere to revoke it. This had actually been an explicit, accepted trade-off in the (since-deleted) original design doc ("handled manually via support for now"), carried unquestioned into the audit artifact's own "Already decided" list — revisited and fixed on request rather than left as-is.
- New `deriveLifetimeRefundUpdate(uid, currentBilling)` (`lib/billingEvents.ts`) — a no-op unless the account is currently on `"lifetime"`, which is what makes it idempotent on Stripe's at-least-once redelivery. `stripe-webhook.ts` special-cases `charge.refunded` outside the normal `extractUidFromEvent()`/`deriveBillingUpdate()` path: Charge metadata is a separate dictionary from the PaymentIntent's and is never copied over automatically, so the firebaseUid/plan tag has to be resolved with an extra `paymentIntents.retrieve()` call. Gated on `charge.refunded === true` (the boolean, meaning *fully* refunded) rather than the event firing at all — confirmed as a policy call before writing code — since `charge.refunded` also fires on partial refunds (e.g. a support goodwill credit), which must not revoke access from someone who substantively still paid.
- **This only fires if the Stripe Dashboard's webhook endpoint is actually subscribed to `charge.refunded`** — same "can't be verified or changed from this repo" caveat as the Firestore rules publish step. `CLAUDE.md`'s Pricing & Billing section updated accordingly.
- **Same-day correction #1:** the first version reverted every refund to `"free"` unconditionally — wrong for an Annual subscriber who'd upgraded to Lifetime and then got *that upgrade* refunded, since they still had a legitimate claim to the Annual access they'd separately paid for. New `BillingDoc.previousPlan` field snapshots whatever `plan` was immediately before a Lifetime purchase overwrote it (captured in the `payment_intent.succeeded` branch of `deriveBillingUpdate()`, guarded against redelivery so a retried event can't re-snapshot it as `"lifetime"` itself); every other branch passes it through unchanged or clears it once the account is confirmed off Lifetime. `deriveLifetimeRefundUpdate()` now reverts to `currentBilling.previousPlan` instead of a hardcoded `"free"` (still falling back to `"free"` when unset — a genuine free→lifetime purchase, or a doc written before this field existed), and clears it once consumed. Initial version of this correction deliberately did not resurrect a live Stripe subscription for the annual→lifetime case, on the reasoning that the original subscription was already canceled immediately at upgrade time — flagged as an accepted trade-off rather than hidden. See the next correction: that trade-off was rejected on review.
- **Same-day correction #2:** reverting to `"annual"` on its own was called out as a real gap, not an acceptable trade-off — a Firestore label with no live subscription behind it grants indefinite unbilled access, since nothing would ever bill or expire it again. New `resumeAnnualSubscription()` (`stripe-webhook.ts`) actually resumes billing: creates a fresh subscription off-session on the same Stripe Customer, reusing the payment method that customer already has on file from the original subscription. That only works because `create-payment-intent.ts`'s Lifetime branch now also attaches the PaymentIntent to a Stripe Customer (reused if one already exists) — previously it created a fully anonymous PaymentIntent with no `customer` at all, which silently severed the relationship (and saved payment method) a prior Annual subscription had already established. Also fixed while in there: that customer resolution now happens *after* each branch's own already-lifetime/already-annual rejection check, not before — the original refactor accidentally moved it earlier, which would have created a wasted Stripe Customer for every rejected double-purchase attempt. Reuses `deriveBillingUpdate()`'s own `customer.subscription.updated` mapping (by synthesizing the event Stripe would otherwise send for the new subscription) instead of duplicating its status-gating logic, so a resume that comes back `"incomplete"` is handled exactly like a brand-new signup. Falls back to `"free"` — never to an ungated `"annual"` — if there's no customer/price to resume against or Stripe rejects the attempt.
- 5 new tests for the refund path in `billingEvents.test.ts`, a new `charge.refunded`/resume-subscription test block in `stripe-webhook.test.ts`, and 2 new tests in `create-payment-intent.test.ts` covering the Lifetime-purchase customer reuse. 92/92 tests passing across the whole suite, both typechecks clean. Updated the billing audit artifact to add this as a new High finding (including both same-day corrections) and mark the corresponding "Already decided" item as revisited.

## Billing Audit Follow-up — 2026-08-11
- Full audit of the not-yet-deployed Stripe integration found 3 critical, 2 high, 2 medium, 2 low gaps (Firestore rules not locking `meta/billing` to server-only writes chief among them — still open, needs a Console rules change). Low-priority items fixed immediately; Critical/High tracked for a deliberate pass since they involve real billing policy calls.
- `CLAUDE.md`'s Pricing & Billing section corrected to describe the checkout flow actually shipped (embedded Stripe Elements via `create-payment-intent.ts`) instead of the originally-planned Checkout-Session-redirect design it still described; new Firestore Security Rules section records the live Console rules verbatim, since no `firestore.rules` file exists in the repo to hold them.
- Added `.github/workflows/test.yml` — `npm test` now runs in CI on push to `main` and on every PR, so the existing (previously CI-less) Vitest suite has a regression guard going forward.
- New `src/utilities/billing/pricingDisplay.ts` (`ANNUAL_PRICE_DISPLAY`, `LIFETIME_PRICE_DISPLAY`) is now the single source for the marketing-copy prices previously hardcoded as `"$1.99"`/`"$4.99"` across `Pricing.tsx` and `UpgradeModal.tsx` (7 call sites across 2 files). Display-only — the actual charge still always comes live from Stripe at checkout.
- `CheckoutModal.tsx` no longer declares success on a flat 1.5s timer after the card charge confirms — it now watches `billingPlan` (the same Firestore listener already running in `Idea.tsx`) and only closes once the plan doc actually reflects the purchase, with a 20s "still finalizing" fallback if the webhook is slow. On confirmation it hands off to a new `UpgradeCelebrationModal` (confetti + `/sounds/roblox-badge.mp3`, same treatment as `FeatureImplementedModal`) via a new `celebrationPlan` context field, with plan-specific copy for Annual vs. Lifetime. Removed the old `checkoutBanner`/`?checkout=success` mechanism in `Idea.tsx` — it was dead code from the pre-embedded-checkout design (flagged in the billing audit) and is now fully superseded by this.
- Account deletion moved server-side: new `delete-account` Netlify Function (Admin SDK) now does the whole thing in one place — cancels any Stripe subscription **immediately** (not `cancel_at_period_end`, since there's no account left to keep access for), wipes `ideas`/`meta` in chunked batches, then deletes the Firebase Auth user. `deleteUserAccount()` in `authFirebase.tsx` still reauthenticates client-side first (confirms the password, surfaces `auth/wrong-password` the same way as before) but now just calls that function instead of deleting Firestore docs doc-by-doc itself. Closes the gap where a deleted account's Annual subscription kept renewing forever with no record left to trace it to (billing audit, High finding).
- Closed the double-billing gap (billing audit, High finding): `create-payment-intent.ts` now rejects (409) an Annual checkout if the caller already has a `subscriptionStatus` of `active`/`trialing`/`past_due`, and rejects a Lifetime purchase if `billing.plan` is already `"lifetime"` — previously nothing stopped `subscriptions.create` from silently stacking a second, independent subscription on the same Stripe customer. `Pricing.tsx` now hides the Annual/Lifetime cards it doesn't apply to (mirrors `UpgradeModal`'s existing `showAnnual` gate, which this page never had), backed by a new `useBillingPlanSync` hook — `billingPlan` was previously only kept live inside `Idea.tsx`, so an already-Annual user landing on `/pricing` directly (no `/main` visit yet this session) saw a stale `'free'` and the plan cards for what they already had. Also wired to `MarketingTransition.tsx`. `fetchCheckoutIntent`/`CheckoutModal` now surface the server's actual rejection message ("You already have an active Annual subscription.") instead of a generic retry prompt that would just fail the same way again.
- Closed the first of three billing audit Critical findings: **Annual → Lifetime upgrade now cancels the old subscription.** `deriveBillingUpdate()` (`lib/billingEvents.ts`) gained a second, optional parameter — the user's current billing doc — so it can decide whether a Lifetime purchase needs to flag a prior subscription for cancellation, and whether an incoming `.updated`/`.deleted` event is about a subscription a Lifetime purchase already superseded; stayed 100% free of Stripe/Firestore SDK calls (still just plain objects in, plain objects out — `currentBilling` is caller-supplied data, not a live read). `stripe-webhook.ts` now fetches that doc itself (new `extractUidFromEvent()` + the existing `getBillingDoc()`) before calling it, and — only when the pure function flags a `cancelSubscriptionId` — best-effort calls `stripe().subscriptions.cancel()` **immediately** (not `cancel_at_period_end`; chosen because the upgrade discount already gives a flat, non-prorated credit for the switch, and immediate cancel only triggers one downstream event — `.deleted` — to guard against re-clobbering the plan, instead of two). Both `.updated` and `.deleted` now refuse to overwrite an already-`"lifetime"` plan, which is exactly what those two events are for once that cancel call goes through. Redelivery-safe by construction (a retried `payment_intent.succeeded` reads the already-updated doc and naturally computes no cancellation needed). 12 new tests in `billingEvents.test.ts`, including two end-to-end sequences that chain the real purchase → cancel → webhook flow through the function rather than testing each event in isolation — 35/35 passing, typecheck clean.
- Closed the second of three billing audit Critical findings: **a lapsed or never-completed subscription no longer grants the paid plan.** There is no expiration check anywhere else in this app — no polling, no "on login" verification (Firestore's `onSnapshot` just mirrors whatever's already written, immediately, whenever a client next subscribes — so this was never a staleness gap, only ever a question of what the webhook does when it fires). `customer.subscription.updated` previously wrote `plan: "annual"` for literally any `sub.status`; it now recomputes `plan` fresh on every event via `ANNUAL_ACCESS_STATUSES` (`active`/`trialing`/`past_due` grant it, everything else — `incomplete`, `incomplete_expired`, `unpaid`, `paused` — actively revokes it back to `"free"`). Confirmed with explicit sign-off before writing code that this needed to be a real revoke, not just a refusal to grant: a subscription that lapses to `unpaid` may never actually get deleted by Stripe depending on dunning config, so `.deleted` can't be relied on as the only revocation path — a no-op here would leave a since-lapsed account stuck on `"annual"` forever. `past_due` deliberately still grants access (Stripe's Smart Retries run ~2-3 weeks; revoking on the first failed charge, which can be a bank flagging a transaction rather than an actual non-payment, is harsher than warranted) — asymmetric with the existing, stricter Lifetime-upgrade-discount eligibility check, which already excluded `past_due`/`unpaid`, so a struggling-to-collect subscriber keeps access but doesn't get handed a new discount. 9 new tests (44 total, up from 35) — a parameterized case per status, the exploit scenario from the audit (an abandoned, never-paid subscription) as its own named regression, and a dedicated active-revoke test that starts from a previously-`"annual"` billing doc rather than a blank one, to specifically exercise the downgrade direction. Typecheck clean.
- Closed the last of three billing audit Critical findings in code: **`meta/billing` is no longer client-writable.** New `firestore.rules` (repo root) — the wildcard `meta/{metaDocId}` rule now explicitly excludes `metaDocId != 'billing'`, with a separate `meta/billing` block granting read-only access back. The exclusion on the wildcard is what actually matters: Firestore ORs overlapping `match` blocks together, so a more-specific sibling block alone wouldn't have overridden the wildcard's existing unconditional "yes" for that same path. Confirmed via full-repo search (not just PRD 001's claim) that no client code path anywhere writes to `meta/billing` — only `subscribeBillingStatus()`'s read-only listener touches it — so this can't break anything live. Couldn't verify with Firestore's Rules Unit Testing emulator (needs a JVM, not available here) — traced every scenario by hand instead (owner read/write of `meta/billing`, cross-user access, every other `meta/*` doc, Admin SDK calls, signed-out requests) and walked through the OR-combination logic explicitly before writing it, given this closes the audit's headline exploit. **This file is authored, not deployed** — by request, no Firebase CLI/`firebase.json` tooling was set up (that's PRD 001's fuller rollout plan, deliberately deferred); applying this requires manually pasting it into the Firebase Console → Firestore → Rules → Publish. The repo and the live project can drift until that's done by hand.
- **All three billing audit Critical findings (and both High findings) are now closed in code**, across several follow-up sessions after the original 2026-08-11 audit. The one exception is deploying `firestore.rules` itself, which has to happen outside this repo — nothing in this stretch of work has been committed yet either (per this file's own standing rule, that's a separate, explicit step).
- Went beyond the original audit's scope on request: the 50-node free-tier cap (previously an explicitly-accepted, client-only UX gate — a technical user could bypass it by calling the Firestore write functions directly) is now also enforced in `firestore.rules`. Firestore rules can't count a collection directly, so this uses a denormalized counter at `meta/nodeCount`: `ideas/{ideaId}`'s `create` rule checks `nodeCount.count < 50 || billing.plan != 'free'`. Deliberately scoped to minimize reads/writes per explicit request — `adjustNodeCount()` (`firebaseHelpers.tsx`) only touches the counter while `getCachedBillingStatus().plan === 'free'` (a paid account is never capped, so maintaining a counter for one is pure overhead with no benefit), which bounds the *entire* cost of this feature, for a free account, to at most 50 extra read+write pairs *ever* — mechanically capped by the same limit it enforces — and zero extra cost for paid accounts. New `useNodeCountResync()` hook overwrites the counter with the true count (`fetchFullIdeaList().length`, a localStorage read — no Firestore cost) once per session whenever the plan is free, which is what keeps it accurate through a paid→free downgrade (the counter isn't touched while paid, so it'd otherwise be stale) and initializes it correctly for existing users' first session after this ships (a fresh `meta/nodeCount` doc would otherwise start from 0, letting them create up to 50 *more* on top of whatever they already had).
- **Explicitly not fully tamper-proof, and documented as such rather than overclaimed:** Firestore rules evaluate each document write independently, with no way to verify a write to `nodeCount` actually corresponds to a real idea being created or deleted in the same batch — a sufficiently sophisticated attacker who reverse-engineers this specific mechanism could still manipulate the counter directly. What this closes is the exact scenario that prompted it: a user calling this app's own Firestore-write functions directly past the cap. A fully tamper-proof version needs a Cloud Function trigger, which this app doesn't have and wasn't in scope here. `nodeCount` can never be deleted by the client (`allow delete: if false`) specifically to prevent a cheaper version of that same attack (delete-and-recreate to reset it) — closing that path was worth the one extra rule line even though the direct-manipulation path remains.
- Couldn't verify the new `ideas`/`nodeCount` rules against the Firestore emulator either (same JVM constraint as the `meta/billing` fix) — traced every scenario by hand again (under/at/over cap for free and paid accounts, brand-new user with no `nodeCount` doc yet, attempted delete of the counter, cross-user, signed-out, non-creation writes staying ungated). One specific uncertainty flagged rather than guessed past: whether Firestore rules' `get()` on a nonexistent document throws or fails open — official docs don't spell this out and don't fetch cleanly enough to confirm either way, so the rule uses an explicit `!exists()` guard (the pattern Google's own rules docs example uses) instead of relying on unverified behavior, accepting a possible extra read in exchange for not betting a security rule on an assumption.
- Deleted, per request: all three PRD docs under `docs/prds/` (they were pre-existing, untracked — never committed, so no git history of the deletion). Every CLAUDE.md reference to them has been rewritten to describe the design decisions directly rather than point at now-missing files; `firestore.rules`' own comments had one stray reference removed too.

## Stripe Payments (Annual & Lifetime Plans) — 2026-08-11 — not yet deployed
- Per [PRD 003](docs/prds/003-stripe-payments.md): two new Netlify Functions — `create-checkout-session` (authenticated, creates a Stripe Checkout Session server-side, `mode: 'subscription'` for Annual / `mode: 'payment'` for Lifetime, `client_reference_id`/`subscription_data.metadata.firebaseUid` set to the Firebase uid) and `stripe-webhook` (unauthenticated by design — Stripe calls it — verifies the Stripe signature before doing anything, then writes `users/{uid}/meta/billing`). Event-to-Firestore-write mapping pulled out as a pure `deriveBillingUpdate()` (`lib/billingEvents.ts`) and unit-tested against fixture events, same for the client's `isWithinFreeLimit()` gate (`src/utilities/billing/limits.tsx`)
- `meta/billing` is the first per-user Firestore doc in this app written only server-side; client subscribes via `subscribeBillingStatus()` (first `onSnapshot`-based read in `firebaseHelpers.tsx`, mirrored to `localStorage` so `canCreateIdea()` stays a synchronous read)
- Free tier capped at 50 total nodes (`FREE_NODE_LIMIT`); gated at both creation entry points (desktop Navbar create button, mobile FAB `addChild()`) plus a redundant check inside `handleIdeaCreation`/`handleChecklistCreation`/`handleNoteCreation` — client-side UX gate only, not a security boundary (would need Firestore rules beyond PRD 001's ownership-only rules to enforce server-side)
- New `UpgradeModal` (desktop + mobile, shared via context `upgradeModalOpen`); Pricing page's Annual/Lifetime CTAs now call `startCheckout()` instead of the old inert `ctaHref="#"`; `PriceCard` gained an `onCtaClick` prop that swaps its `<a>` for a `<button>`; signed-out checkout attempts remember the plan in `sessionStorage` and resume automatically post-login; `?checkout=success` shows a brief "Finalizing your upgrade…" banner to cover webhook lag; Profile modal's Account tab shows current plan
- `firebase-admin` moved from `devDependencies` to `dependencies` (pre-existing latent risk — it already ran at Netlify Function runtime for the feature-request functions); `stripe` added as a runtime dependency; `netlify-cli` added as a dev dependency (`npm run dev:functions` runs `netlify dev`)
- **Not yet live** — needs manual setup outside the codebase before it works end-to-end: a Stripe account with two Price objects (recurring annual, one-time lifetime), and these Netlify environment variables per deploy context (test vs. live): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ANNUAL`, `STRIPE_PRICE_LIFETIME`. The webhook endpoint (`/.netlify/functions/stripe-webhook`) also needs to be registered with Stripe once a real deploy URL exists

## V 1.07.2 — Minor Update — Feature Request Security & Terms of Service — 2026-08-10
- Feature request submission moved server-side: new Netlify Functions (`submit-feature-request`, `check-feature-request-status`) proxy the GitHub Issues API using a server-held `GITHUB_TOKEN`; client no longer holds the token, `.env.example` and `VITE_GITHUB_TOKEN`/`VITE_GITHUB_REPO` removed
- Functions verify the caller's Firebase ID token via `firebase-admin` (`lib/firebaseAdmin.ts`, service account from `FIREBASE_SERVICE_ACCOUNT_BASE64`) before touching Firestore or GitHub; `submit-feature-request` also enforces server-side title/body length caps, profanity filtering, and a 5-per-24h rate limit per user (`createdAt` added to `TrackedIssue`)
- `submitFeatureRequest()` in `featureRequests.ts` replaces the old direct-to-GitHub `fetch` + `saveTrackedIssue`; both desktop `PatchNotes` and `MobilePatchNotesSheet` now surface the server's actual error message instead of a generic string
- New Terms of Service page (`src/pages/Terms.tsx`, `/terms` route); Privacy page and shared SCSS classes renamed from `privacy*` to `legal*` so both pages share styling; Privacy policy content updated to describe email-based password recovery (replacing the old recovery-code language) and self-serve account deletion, plus a new "Feature Requests" section noting submissions are posted as public GitHub issues
- Auth screen: "Keep me signed in" checkbox now collapses/fades out on the signup panel (confirm-password view) instead of staying visible; Privacy link replaced with a Terms + Privacy link row (`.legalLinks`)
- `netlify.toml` and `tsconfig.functions.json` added to build/bundle the new functions; `@netlify/functions`, `firebase-admin`, `@types/node` added as dev dependencies

## V 1.07.1 — Minor Update — Bug Fixes — 2026-08-10
- Auth screen: "Keep me signed in" checkbox added next to Forgot password; when checked, the DEK is also persisted to `localStorage` (`dek_local`) alongside `sessionStorage` so the session survives a full browser restart, not just a tab reload
- Onboarding modal: now waits for `auth.onAuthStateChanged` to resolve before calling `fetchOnboardingSeen()`, fixing a race where the Firestore read could fire before the user was authenticated
- Mobile: sheet, help, patch notes, mind map, and profile overlays made mutually exclusive — opening any one now closes the others if already open
- Mobile: long-press drag suppressed for the first second after `MobileMindMap` mounts, preventing an accidental drag from a press that was already in progress on load/navigation
- Mobile patch notes sheet given its own auto-height sizing (`mmobile-patchnotes-sheet`) instead of inheriting the fixed help-sheet height, so it doesn't leave excess empty space

## V 1.07 — Note Ideas — 2026-08-10
- New idea type: Notes — a third creation tab alongside Idea and Checklist; give it a title plus a long-form body (2000 chars) instead of a single content line
- `isNote` set at creation via the Note tab and immutable afterward — notes can't convert to/from a standard idea; `noteTitle` holds the header label. Replaces the old length-threshold "note mode" auto-detection (`NOTE_MODE_THRESHOLD`/`NOTE_WIDE_THRESHOLD` removed) with an explicit flag
- `resolveIdeaLabel()` added to centralize the idea/note label lookup and used everywhere a node's label is displayed: mind map (desktop + mobile), breadcrumbs, headers, delete confirmation, move/navigate sheets
- Desktop: note cards render dark green (`$neo-green`) in a typewriter font (`Courier Prime`, loaded via Google Fonts in `index.html`); always render "wide" (double grid column) regardless of body length; not draggable/droppable (same as checklists)
- Desktop note editing: title via `RenameModal` (now note-aware — button reads "Name Note"/"Save"), body via inline `contentEditable` (was a plain `<textarea>` in the initial checkpoint) with pasted content sanitized to plain text and clamped at 2000 chars; separate copy button copies the note body
- Note body and leaf-node "Show more/less" now animate with a physical Web Animations API height roll (overshoot + settle) instead of snapping instantly; the collapse button grows/shrinks in lockstep with the same animation
- Desktop leaf and link node rendering merged into a single code path (`handleNodeClick` opens the link in a new tab, otherwise navigates); link nodes gained the same rename/copy affordances leaf nodes already had
- Mobile: notes render as a two-line header+body list item with their own color, get a dedicated edit sheet (separate title + body fields, "Edit note"), and are excluded as drag/move/navigate targets
- Firebase: `isNote` and `noteTitle` synced and encrypted like other idea fields; `updateNoteTitleInFirebase()` added
- Idea creation modal: idea textarea cap raised 200 → 2000 chars; tabs crossfade instead of unmounting and the panel stack height-animates between tabs; checklist item add/remove get press-in/collapse animations
- Loading state: three-dot bounce placeholder shown while ideas are being fetched from localStorage, replacing a blank grid on load
- Help screen 3 (desktop) gets a Note entry; stray 100-char cap on the link-change textarea removed

## V 1.06.1 — 2026-07-01
- Profile navbar button gets `navButton--active` highlight while the profile modal is open (matches help/patch notes button behavior)
- `docs/` added to `.gitignore`

## V 1.06 — Profile Modal & Account Management — 2026-06-30
- Logout button replaced with a Profile button (new `Profile.svg`) on desktop navbar and mobile FAB; opens a new `ProfileModal`
- Profile modal — desktop: left tab sidebar + right content panel; mobile: card-list → back-nav pattern; tabs: Account (active), Customization (disabled, coming soon)
- Account tab: send password reset email, log out, delete account (requires current password + typing "DELETE"; reauthenticates, wipes all Firestore ideas + meta docs, deletes Firebase Auth user)
- `deleteUserAccount` and `sendPasswordReset` helpers added to `authFirebase.tsx`
- Manual recovery code screen removed: DEK decryption failure after password reset now triggers automatic email recovery instead of showing a recovery code input form
- Signup now shows a user-facing error message for `auth/email-already-in-use` instead of logging to console
- `profileModalOpen` / `setProfileModalOpen` added to `IdeaContext`; `signUserOut` prop removed from `Navbar`
- Neobrutal design tokens extracted to `variables.scss` (`$neo-btn-radius`, `$neo-btn-border`, `$neo-btn-shadow`, etc.); hardcoded values in `index.scss` replaced with variables

## V 1.05.6 Code Cleanup - 2026-06-30
- Cleaned up/refactored mobile code.

## V 1.05.5 ET PHONE HOME + OTHER QOL CHANGES — 2026-06-30
- Home button added to desktop navbar and mobile FAB — jumps to root with fade transition, grays out when already at root
- Desktop navbar redesigned: logo button replaced with a dedicated pink Mind Map toggle; Create button moved to the top of the sidebar
- Mobile long-press drag polish: node plays a "charging" outline/scale animation before drag initiates; haptic pulse on threshold; held node goes fully invisible; ghost plays a shrink-fade landing animation on drop; "Move to parent" zone slides in instead of appearing instantly
- Mobile touch/scroll fixes: non-passive `touchmove` handlers on FAB and header prevent iOS scroll-recognizer misfires; `overscroll-behavior: none` on node list; various sheet overflow/height fixes
- Desktop link nodes: copy button now copies the URL instead of the idea text
- `MindMapBlack.svg` and `Home.svg` assets added; mind map icon updated site-wide

## V 1.05.4 — PESTICIDE SPRAY — 2026-06-26
- Desktop DnD: custom collision detection replaces the default — `trash`/`last-idea` use rect intersection, idea nodes use pointer-proximity with a 10px buffer; fixes misfires when dragging across gaps
- Desktop DnD: custom drag modifier replaces `restrictToWindowEdges` — constrains left/right/top but leaves the bottom open so the trash is reachable
- Desktop checklist nodes: item list truncates when overflowing with a "Show more ▾" fade overlay; "Show less ▴" collapses it; state resets on navigation
- Desktop checklist nodes: item action buttons (link, edit, delete) grouped in a wrapper div for cleaner layout
- Desktop leaf nodes: expand/collapse arrows relabeled from bare `▾`/`▴` to "Show more ▾" / "Show less ▴"
- Mobile: sheet bottom lifts with the software keyboard via `visualViewport` resize tracking
- Mobile: FAB bar hidden while any sheet is open (`mmobile-fab-area--hidden`)
- Mobile drag: auto-scrolls the node list when dragging within 80px of the top/bottom edge; activates after 250ms, scrolls 4px/frame
- Mobile mind map sheet: remounts on navigation (`key={currentId}`) so ancestor expansion always reflects the current node; ancestors pre-expanded synchronously via `useLayoutEffect` before paint; auto-scroll re-triggers on `currentId` change

## V 1.05.3 — Mobile Swipe & Drag — 2026-06-26
- Swipe-to-reveal actions: swiping left on any node slides it to expose three action buttons — edit (blue), move (yellow), delete (red); swiping back or tapping elsewhere dismisses the reveal; one node revealed at a time
- Edit sheet: replaces the old rename + separate link sheets; single combined sheet with auto-growing textarea (name) + optional URL input (leaf nodes only), opened from the swipe-reveal pen button; `commitEdit()` saves name and/or link in one pass
- Mobile drag-and-drop: long-press (360ms) now initiates a drag with a ghost element that follows the touch; drop onto a sibling node reparents under it; a "↑ Move to parent" drop zone appears at the top of the list when dragging inside a nested level; checklist and link nodes excluded as drop targets; `touchmove` prevented on document during drag to stop scroll interference
- Edit mode removed: `editMode` state, and the "Tap a node to edit it" hint are gone; the `actions` bottom sheet variant is also removed — all node actions are now accessed via swipe
- Navigation simplified: `navigateMobile()` with its 65ms/90ms fade timeouts removed; navigation is instant (`setCurrentId` directly); `nodesVisible` and `mobileNavTimeouts` state also removed
- Page title trimmed: `<title>` and all OG/Twitter meta tags changed from "Intraconnected — Private Mind Mapping" to "Intraconnected"
- Vite dev server: `host: true` added so the dev server is accessible on LAN (useful for testing on a physical mobile device)
- New `public/images/Move.svg` asset added for the swipe-reveal move button

## V 1.05.2 — Minor Fixes — 2026-06-25
- Onboarding modal: seen-state now synced to Firestore (`preferences.onboardingSeen`) so dismissing on one device suppresses it on all others.
- Root priority buttons (inline 1/2/3 in sidebar) removed because it wasn't obvious what they did.
- Logo button sizing fixed on desktop (width/height 100% now applied outside the mobile-only media query).

## V 1.05.1 — SCRUBBIN' DA FLOORS (POLISH) — 2026-06-24
- Onboarding modal: shown once on first visit (`onboarding_v1_seen` in localStorage); three cards with animated CSS mini-illustrations (tree structure, click-to-navigate, drag on desktop / long-press on mobile)
- Navigation fade transition: nodes briefly fade out (60ms) before the root changes and fade back in; applied to both desktop (`nodesVisible` / `ideaNodes--fade`) and mobile (`mmobile-content--fade`) via `navigateToIdea()` in context
- New `ArrowBack.svg` replaces the CSS-flipped arrow on the back button; back and sort button heights reduced from 2.8rem → 2rem; mobile back button updated from `‹` text to the SVG icon
- Mind map drag fix: mouse move/up handlers moved to document-level listeners so panning continues when the cursor passes over fixed navbars
- Navbar active state: help and patch notes buttons gain `navButton--active` highlight when their panels are open
- `LastIdea` drop zone text wrapped in a 3-line clamped `<span>`; element moved from `rootAdditionalButtons` into `rootSpacer`
- iOS/touch fixes: passive `touchstart` on document enables CSS `:active` on iOS Safari; `.neobrutal-button:active` now mirrors `:hover` pressed style; `e.preventDefault()` moved inside `!touchMoved.current` guard to prevent scroll blocking
- Help screen 6 animation fix: P1/P3 ribbon keyframes swapped so the high-priority (tall/red) ribbon animates last; mobile `.overlay` gets `overflow-y: auto` so tall modals scroll on small screens

## V 1.05 — GETTING MY PRIORITIES STRAIGHT — 2026-06-23
- Priority system: ideas can be marked P1 (red), P2 (orange), or P3 (yellow) via a ribbon button in the top-left corner of each card; ribbon height conveys urgency at a glance
- Sort mode: toggle button below Back switches between Priority order (P1 first) and Age order (creation order); persisted to `localStorage`; FLIP animation smoothly reorders the grid on sort change
- Root priority: 1/2/3 buttons appear in the sidebar when navigated into a child node to mark the current root's priority
- Mobile: ribbon on every node in the list; action sheet exposes P1/P2/P3 priority buttons; priority option added to the creation sheet; sort toggle in the idea-count header row
- Help screens: new screen 6 "Priority & Sorting" added to both desktop (animated ribbon cycling + sort reorder demo) and mobile (animated node ribbon demo + grid explanation); pager updated from 5 to 6

## V 1.04.1 — Feature Request Tracking & Tablet Layout — 2026-06-22
- Feature request tracking: submitted GitHub issues are saved to Firestore (`meta/featureRequests`); on login, closed+completed issues are detected and a celebration modal fires with confetti and a sound effect
- Mobile UI breakpoint widened from 576px to 1023px so the mobile layout serves tablets; full tablet scaling pass added for all mobile UI elements (nav, FAB buttons, sheets, nodes, checklists, help screens)
- Help/navigate sheet repositioned from bottom-anchored (above FAB) to top-anchored (`top: 68px`) with `max-height: calc(100dvh - 82px)` and pop animation origin flipped to top
- Node card padding reduced slightly across leaf, parent, and link node types
- V 1.0 Mind Map entry removed from the public CHANGELOG

## V 1.04 — Firebase Optimization — 2026-06-22
- Timestamp-based sync guard: on page load, read one `meta/sync` doc instead of the full ideas collection; full fetch only runs when the remote timestamp differs from the locally cached one (cross-device sync, first login, cleared storage)
- Every Firebase idea write now also updates `meta/sync.lastModified` and mirrors the value to `localStorage`, keeping both sides in lockstep
- Checklist item writes decoupled from localStorage writes; Firebase write debounced 1.5s per checklist ID so rapid toggling/editing collapses to a single write
- Subtree deletion replaced with a single `writeBatch` commit across all deleted node IDs instead of one `deleteDoc` call per node
- Patch notes Firebase read skipped when `localStorage` already has a cached value for the current user; only fetched on first visit per device
- `clearLocalStorage()` changed from `localStorage.clear()` to `localStorage.removeItem('ideas')` to preserve patch notes and sync timestamp keys across full re-fetches

## V 1.03.11 — Mobile Fixes — 2026-06-22
- All mobile FAB buttons (help, patch notes, navigate, create, edit) animate their icon on active state (scale up + lift); patch notes and navigate buttons also change background color
- Mind map sheet entry animation now radial-pops from click origin (same as help/patch notes sheets)
- Mind map sheet and help sheet bottom edge repositioned to clear the FAB bar instead of overlapping it
- Sass `lighten()` → `color.adjust()` deprecation fix in `idea.scss` and `mobileMindMap.scss`; overlay uses `100dvh` fallback

## V 1.03.10 — EVEN MORE POLISH (I guess?) — 2026-06-22
- Checklist items can now have individual links (optional `link` field on `ChecklistItem`); link button in hover controls on desktop card, desktop modal, and mobile sheet; linked items render as `<a>` tags; Firebase encryption/decryption updated to handle item links
- Delete confirm modal pop animation now originates from the trash can position instead of cursor; idea name clamped to 4 lines to prevent oversized names from breaking the modal
- Mind map tree resets collapse state on close (remounted via `treeKey`); node button max-width increased 160→240px with overflow clipping
- Mobile sheet container uses `max-height: 80dvh` + `overflow: hidden` to fix content bleed on dynamic viewport heights
- `IdeaNode` `isHidden` simplified from `useState` to a derived value

## V 1.03.9 — POLISHING DIS SHII — 2026-06-21
- All desktop modals (Rename, Delete, Link, Checklist, Creation) now use `AnimatedOverlay` for pop-in/out animations keyed from click origin
- Mind map always rendered in DOM (opacity/pointer-events toggle); auto-centers on current idea node on open; zoom now pivots around cursor position
- Checklist nodes display inline as read-only cards in the desktop mind map
- Desktop mid-section fades out (opacity transition) instead of unmounting when mind map opens; navbar create button and depth holder fade similarly
- Mobile header title converted to editable textarea (inline rename, saves on blur)
- Mobile sheet and help/patch notes pop animations changed from slide-up to radial-pop from click origin
- Mobile rename sheet input upgraded from `<input>` to auto-growing `<textarea>`
- Mobile checklist sheet edit input upgraded from `<input>` to auto-growing `<textarea>`
- Mobile navigate button animation: icon scales up and inverts on active state
- Help badge colors corrected: nav badge → teal, edit badge → yellow
- Help sheet back button styled consistently (orange, reduced padding)
- `TooltipButton` accepts `wrapperClassName` prop for hiding the wrapper div

## V 1.03.8 — Mind Map Line Fix — 2026-06-21
- Fixed collapse toggle line extending past '+' circle when children are hidden
- Consistent vertical line centering across all mind map connectors

## V 1.03.7 — SEO & Polish — 2026-06-20
- SEO Optimization
- Mobile create sheet: optional link input added to new-idea sheet.
- Bottom bar and sheets use env(safe-area-inset-bottom) to clear iPhone home indicator

## V 1.03.6 — Mobile Mind Map — 2026-06-20
- Replaced Navigate bottom sheet with full-screen Mind Map overlay (`MobileMindMapSheet`) with entry animation and styled vertical tree

## V 1.03.5 — Checklist Item Drag & Edit — 2026-06-20
- Drag-to-reorder checklist items in desktop card, desktop modal, and mobile sheet
- Inline checklist item text editing via pen icon (click to edit, Enter/blur to commit) in all three views

## V 1.03.4 — Icon Refresh & Help Polish — 2026-06-20
- New skinny icon variants across mobile FAB area (MindMap, Open, PatchNotes, Plus); navigate and patch notes buttons colored teal and yellow
- Help screens polished: checklist badge uses real CSS checkbox, patch notes shown as real button, node type order fixed
- Bug fix: `rootIdStack` no longer double-pushes root on re-render

## V 1.03.3 — Expanded Help & Streamlined Onboarding — 2026-06-19
- Help carousel expanded from 3 to 5 screens (desktop + mobile)
- Desktop screens 4–5: Mind Map overview, depth dots + patch notes
- Mobile screens 3–5: checklist node type, Navigate button, edit mode + patch notes
- Recovery code screen removed from signup/migration/restore flows — users go straight to `/main`
- New users auto-shown help on first load via `sessionStorage` flag

## V 1.03.2 — Polish & UX Improvements — 2026-06-19
- Added Privacy Policy page (`/privacy` route, link on auth screen)
- Leaf nodes truncate long text with a fade overlay + animated expand/collapse toggle
- Node fade-out when pending delete; fades back in if cancelled
- Custom CSS checkboxes replace emoji checkboxes in mobile checklist (inline + sheet)
- MindMap collapse toggle redesigned: vertical line + circle button
- Leaf nodes in MindMap and mobile node headers get line-clamping
- Patch notes "new" state synced to/from Firestore
- Help and patch notes panels are now mutually exclusive (opening one closes the other)
- `scrollbar-gutter: stable` added to prevent layout shift on scroll

## V 1.03.1 — 2026-06-19
- Fixed checklist bug (item state / toggle behavior)

## V 1.03 — Checklist Ideas
- Added checklist idea type: titled checklist with check/uncheck, add, and delete per item
- Desktop: inline card with checkboxes + full-view `ChecklistModal`
- Mobile: inline accordion toggle + full-view checklist sheet
- End-to-end encryption for checklist item text in Firestore
- Code cleanup pass

## V 1.02.1 — Minor Fixes
- Minor changes / small fixes (unspecified)

## V 1.02 — End-to-End Encryption
- AES-256-GCM encryption for all idea `content` and `link` fields
- Two-layer key scheme: DEK wrapped by password-derived KEK + recovery KEK + email KEK
- Recovery code flow: generated on first login, shown once, acknowledged flag stored in Firestore
- Email recovery: unwrap DEK using email-derived KEK (no email sent; Firebase Auth ownership = proof)
- DEK persisted in `sessionStorage` across page reloads; cleared on sign-out
- `enc:` prefix on ciphertext for backward-compatible migration of legacy plaintext

## V 1.01.1 — Recommend Features Button
- Added "Recommend Features" button

## V 1.01 — Patch Notes & Tooltips
- Added in-app patch notes panel (desktop right sidebar, patch notes button)
- Added mobile patch notes bottom sheet (patch notes button in FAB area)
- `parseChangelog` utility reads `programmer-docs/CHANGELOG.md` at build time
- Replaced raw `<button>` nav buttons with `TooltipButton` (1000ms hover delay)

## V 1.0.x — Mobile, Navigation & QOL Patches
- Mobile quick-navigate sheet (◎ button; jump to any node)
- Mobile grid background styling
- Mobile view overhaul + cleanup pass
- Delete confirmation modal added; delete modal tweaks
- Multiple bug fixes (general)
- Mobile styling fixes (multiple passes)
- Styling tweaks (general)
- Rename bug fix
- More robust idea renaming (handles edge cases)
- Fixed dropping ideas into link nodes (link nodes no longer accept drops)
- Link change tweaks + link change functionality added
- `RenameModal` updates
- Depth indicator fix
- Styling changes (multiple passes)
- Reworked help screen
- Depth indicator added
- Mobile styling fixes
- Copy-text button added
- Link idea functionality added
- Mobile responsiveness changes
- Favicon updated
- Rename functionality added
- Various QOL changes
- `_redirects` file added (Netlify SPA routing)
- Backwards navigation (back button / parent traversal)
- Helper functions file restructured (`utilities/idea/`)
- Parent-change (reparent) functionality added

## V 1.0 — Mind Map
- Full-tree overlay with pan, zoom, expand/collapse, click-to-navigate
- `rootIdStack` for desktop navigation history
- Ancestor nodes start expanded; others start collapsed

## Pre-1.0 — Foundation
- Drag and drop (dnd-kit) with delete-to-trash and reparent-on-drop
- Delete logic implemented
- Help screen (3-screen carousel)
- Logout functionality
- Context refactor (`IdeaContext`)
- Full descent + idea creation flow
- Idea creation modal
- Firebase Firestore connection + user auth
- Core styling, flexbox layout, large-desktop responsiveness
- Initial commit
