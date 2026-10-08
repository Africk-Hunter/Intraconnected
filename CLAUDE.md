# Intraconnected — CLAUDE.md

## When stuck, output your current hypothesis before making changes.

## CRITICAL: Git Commits
**NEVER create a git commit unless the user explicitly tells you to commit.**

## Project Overview
Node-based mind-mapping app. Users create hierarchical idea trees, navigate into nodes, drag to reparent/delete, rename/link via modals.

## Commands
```bash
npm run dev            # Vite dev server (no Netlify Functions)
npm run dev:functions  # netlify dev — app + Netlify Functions (applies netlify.toml headers)
npm run dev:stripe     # netlify dev + `stripe listen` forwarding webhooks locally
npm run build          # tsc -b && vite build
npm run typecheck      # app + functions (tsconfig.functions.json)
npm run lint
npm test               # vitest run
```
CI (`.github/workflows/test.yml`) runs typecheck → lint → test → build.

## Pre-launch status
Not launched. `programmer-docs/artifacts/launch-checklist.html` (published as an artifact, open it in a browser) is the single source of truth for what still blocks paying customers and the native app (Console/Dashboard steps, pending decisions, the Capacitor plan). Check it before assuming something is live.

## Tech Stack
- **React 19**, **TypeScript** (strict), **Vite**, **SCSS**
- **Firebase** — Auth (email/password) + Firestore
- **Netlify** — hosting + Functions (`netlify/functions/`, billing/account/feature-request endpoints; Admin SDK)
- **Stripe** — embedded Elements checkout (see Pricing & Billing)
- **@dnd-kit/core** — drag and drop
- **React Router v7** — `/` (landing) + `/pricing` (marketing, via `MarketingTransition`), `/login` (sign-in/up), `/main` (app), `/landing` (redirects to `/`), `/terms`, `/privacy`, `/auth/action` (Firebase email actions). `ScrollToTop` in `Index.tsx` resets scroll on route change.

## Architecture

### Data Flow
1. Login → `syncOnLoad()` (`utilities/sync/syncEngine.ts`) → pulls from Firestore into `localStorage` `ideas` only if another device changed something (else one small read)
2. All reads: `localStorage` via utility functions
3. All writes: through **`utilities/idea/ideaStore.ts`**, which updates `localStorage` *and* queues the change in the **sync outbox** (`utilities/sync/outbox.ts`) in one call — the outbox persists each change, then sends it to Firestore in order, retrying until accepted
4. `newIdeaSwitch` toggle triggers re-reads — toggle **after** writing to localStorage, never before
5. While open, `startSyncListener()` watches `meta/sync` and pulls another device's changes (only while the tab/app is visible, debounced 3s)

### Sync layer (`src/utilities/sync/`)
- `ops.ts` — pure core (unit-tested in `ops.test.ts`): `SyncOp` (`create`/`update`/`delete`), `rebase`, `coalesce`, `classifyError`, `findOrphans`, `othersChanged`.
- `outbox.ts` — the **only** code that writes idea docs. Queue lives in `localStorage` `sync_outbox_<uid>` (per account — never sent under another account). One op = one `writeBatch`: idea write + free-plan `nodeCount` increment + `meta/sync` `devices.<deviceId>` increment. Updates use `update()` (fails `not-found` on an idea deleted elsewhere → op dropped + refresh) — never `setDoc(merge)`, which silently re-created partial docs. A refused write (`permission-denied` etc.) **pauses** the queue and shows `SyncStatusBanner` (Try again / Discard); nothing is auto-discarded. `flushOutbox()` runs at sign-out.
- `syncEngine.ts` — `pullFromServer` uses `getDocsFromServer` (plain `getDocs` answers from the empty cache offline = "no ideas"), decrypts per doc (one bad doc is skipped, not fatal), rebases this device's unsent ops on top, and only then replaces `localStorage`. Moves orphaned ideas (parent deleted) to the top level. `sync_owner` guards against showing another account's cached map.
- **Change detection is per-device counters, not timestamps**: each device only bumps its own counter in `meta/sync.devices`, and stores the others' last-seen values in `sync_seen_<uid>`. Any other device's counter moving = something to pull. `meta/sync.lastModified` is still written only for tabs running a pre-sync build.
- `onSyncRefreshed()` (`syncStore.ts`) fires after a pull — `Idea.tsx`/`MobileMindMap.tsx` use it to step out of an idea deleted on another device.

### Import / Export (Profile → Data)
Both are client-side only (ideas are only ever decrypted in the browser) and never plan-gated for export.
- Export: pure `idea/exporters.ts` (`ideasToMarkdown`, `ideasToOpml`; JSON built in `ProfileModal`), downloaded via `utilities/download.ts`.
- Import: pure parsers in `idea/importers.ts` (OPML, Markdown, Notion zip, plain text, FreeMind `.mm`, XMind, our JSON) → `ImportNode` tree → `importToIdeas()`; `idea/xml.ts` and `idea/zip.ts` replace an XML/zip dependency. `idea/importIdeas.ts` is the only write path: it appends to localStorage and queues creates with `enqueueMany()` (parents first). Everything lands under one new top-level idea. Free plan is checked up front (the rules would otherwise refuse mid-import and pause the outbox); one import is capped at `MAX_IMPORT_IDEAS` (2000).

### State Management
Global state in `src/context/IdeaContext.tsx` via `useIdeaContext()`. Key fields:
- `checklistModalId: number | null` — which checklist is open; `null` = closed
- `newIdeaSwitch: boolean` — toggle after any localStorage write to force re-reads
- `ideas` — **only current root's direct children**, NOT all ideas. Use `fetchFullIdeaList()` for all ideas.

### Idea Data Shape (`src/utilities/types.ts`)
```ts
interface ChecklistItem {
  id: string;        // String(Date.now())
  text: string;
  checked: boolean;
  link?: string;
}

interface StandardIdea {
  type?: 'standard'; // undefined = standard (backward-compat)
  id: number;
  content: string;
  parentID: number;
  link: string;
  priority?: 1 | 2 | 3;  // 1=High, 2=Medium, 3=Low
  isNote?: boolean;      // set at creation (Note tab); immutable — ideas and notes never convert
  noteTitle?: string;    // header label while isNote; `content` holds the note body
}

interface ChecklistIdea {
  type: 'checklist';
  id: number;
  content: string;
  parentID: number;
  items: ChecklistItem[];
  priority?: 1 | 2 | 3;
}

type IdeaType = StandardIdea | ChecklistIdea;
```

### Navigation Model
- `rootId` — currently displayed idea (its children fill the grid)
- `rootIdStack` — `useRef<number[]>` history stack; push on zoom-in, pop on back (desktop only)
- Root always `id: 1`, never deletable

### Node Types (render-time, `IdeaNode.tsx`)
- **leaf** — no children, no link → green (`$leaf`)
- **parent** — has children → blue (`$sky`)
- **link** — has URL → yellow (`$link`)
- **checklist** — `type === 'checklist'` → indigo; not navigable, no DnD drops

## Critical Gotchas

### Always use `getIdeaLink()` — never `.link` directly
`ChecklistIdea` has no `link` field. Use `getIdeaLink(idea)` from `utilities/idea/helpers.ts`. To open one, use `openIdeaLink(url)` (same file), never `window.open` directly — it refuses anything but http(s)/mailto, so a `javascript:` link that got into the data can't run. `cleanLink()` likewise only stores http(s) addresses; the importers filter links with `isWebLink`.

### `ideas` state is not the full list
Use `fetchFullIdeaList()` (reads localStorage) to get all ideas. Never assume `ideas` contains anything outside the current view.

### `rootIdStack` is a ref, not state
Mutations don't trigger re-renders. `MobileMindMap` uses local `currentId` state instead.

### Every idea change is ONE call to `ideaStore.ts`
`createIdea`, `updateIdeaName`, `updateIdeaNoteTitle`, `updateIdeaLink`, `updateIdeaParentId`, `updateIdeaPriority`, `updateChecklistItems` and `recursivelyDeleteChildren` each update the local copy *and* queue the Firestore write. There is no separate "write to Firebase" call to add after them (there used to be — `updateXInFirebase`, `schedulePriorityFirebaseWrite`, `scheduleChecklistFirebaseWrite` — they no longer exist). The local half is applied with `applyOpLocally` from `sync/ops.ts`, the same function the sync engine rebases with. Creation goes through `handleIdeaCreation`/`handleChecklistCreation`/`handleNoteCreation` (`idea/creation.ts`), which also check `canCreateIdea()`. Deletes are split into batches of 450 ids.

### Checklist items are encrypted in Firestore
The outbox (`encryptIdea`/`encryptPatch` in `utilities/sync/outbox.ts`) encrypts `content`, `link`, `noteTitle`, and both `items[].text` and `items[].link` at send time. Queued ops are stored as plaintext in localStorage (same exposure as the `ideas` cache). Never write raw values to Firestore directly.

### Priority and checklist writes are debounced
`updateIdeaPriority` and `updateChecklistItems` record the change in the outbox immediately; only the send waits 1.5s, merging rapid edits into one write.

### `setNewIdeaSwitch` must be called after the write
Toggle it after the `ideaStore` call (in `.then()` for the ones that return a Promise: `updateIdeaName`, `updateIdeaNoteTitle`, `updateIdeaLink`), never before. Those promises resolve as soon as the change is recorded locally and in the outbox (not on server ack), so this works offline too.

### Never write idea docs to Firestore except through the outbox
Use `ideaStore.ts` / `enqueue()` — a direct `setDoc`/`deleteDoc` on `users/{uid}/ideas` skips ordering, retry, the node counter and the `meta/sync` counter other devices watch.

### Modal `min-height` specificity
`.neobrutal.modal` has `min-height: 18rem`. Override: `.neobrutal.modal.confirmModal { min-height: auto; }` at all three breakpoints.

### `setIdeas` accepts functional updates
`setIdeas((prev) => prev.filter(...))` works despite the loose `(ideas: any) => void` typing.

### Firebase collection path
Ideas at `users/{uid}/ideas/{ideaId}`; per-user meta docs at `users/{uid}/meta/{billing|nodeCount|sync|encryption|preferences|featureRequests|rateLimit_*}`. Firebase web config is hardcoded in `src/firebaseConfig.ts` (public by design). The only client env var is `VITE_STRIPE_PUBLISHABLE_KEY`; server secrets live in Netlify env vars.

### Password change requires DEK re-wrap
If adding "change password" via `updatePassword()`, re-wrap the DEK with the new password and update `encryptedDEK` in Firestore — otherwise next login throws on `unwrapDEK` and falls through to email recovery.

### Client-side encryption (NOT end-to-end — never call it that)
All idea text fields are AES-256-GCM encrypted on the device before Firestore writes. Ciphertext stored as `enc:<base64>`. `decryptField` passes plaintext through unchanged (backward-compat). The DEK is stored in `meta/encryption` wrapped two ways: by password (`encryptedDEK`) and by email + uid (`emailEncryptedDEK`, which powers password-reset recovery). The email wrap is derivable by anyone with database access and the account's email, so **the service could technically read ideas**. Decided 2026-09-29 (launch-checklist C1): keep email recovery. Privacy/Terms/`index.html`/`site.webmanifest` are worded accordingly. Don't reintroduce "end-to-end", "only you can decrypt" or "we cannot read" anywhere, store listings included.

At runtime the DEK is held in module-level `_dek` (`dekStore.ts`) + `sessionStorage` `dek_session`, and also `localStorage` `dek_local` when "Remember me" is checked (raw key, no expiry — known item E3). `clearDEK()` wipes all three on sign-out.

## Pricing & Billing

Three plans: `free` (capped at `FREE_NODE_LIMIT` = 50 nodes, `src/utilities/billing/limits.tsx`), `annual` (Stripe subscription), `lifetime` (Stripe one-time payment). `canCreateIdea()` gates node creation against the cached plan — a client-side UX nicety only; the cap is actually enforced server-side via `firestore.rules` (see below). **Not yet deployed** (per DEVLOG) — pre-launch.

- **Checkout is embedded Stripe Elements, not a Checkout Session redirect.** `startCheckout(plan)` (`src/utilities/billing/billing.tsx`) → signed-out users are bounced to `/` with the intended plan stashed in `sessionStorage` (`pending_checkout_plan`), resumed post-login via `consumePendingCheckoutPlan()`. Signed-in users hit `create-payment-intent` (Netlify function), which returns a PaymentIntent client secret (lifetime) or an incomplete Subscription's invoice client secret (annual) — mounted into a `<CardElement>` (`CheckoutModal.tsx`/`CheckoutForm.tsx`) and confirmed client-side via `stripe.confirmCardPayment`. Uses `VITE_STRIPE_PUBLISHABLE_KEY`. (Docs/DEVLOG previously described a server-redirected Stripe Checkout Session via a `create-checkout-session` function — that function does not exist; this is the shipped design.)
- **The server is the source of truth for billing.** The client never writes billing state — `stripe-webhook.ts` verifies the Stripe signature, runs the event through the pure `deriveBillingUpdate()` (`netlify/functions/lib/billingEvents.ts`), and merges the result into Firestore at `users/{uid}/meta/billing`. Enforced by `firestore.rules` (`meta/billing` is `allow write: if false` for clients), published to the Console 2026-09-29.
- **Client sync**: `subscribeBillingStatus()` (`billing/billingCache.ts`) listens on that Firestore doc and mirrors every snapshot to `localStorage` (`billing_plan_<uid>` — per account, so a second account on the same browser never sees the first one's plan) so `getCachedBillingStatus()` can read synchronously (e.g. from `canCreateIdea()`).
- **Cancellation (self-serve)**: `cancelSubscription()` → `cancel-subscription` Netlify function sets `cancel_at_period_end: true` (never an immediate cancel) so the user keeps access through the period they paid for; the plan only flips to `free` when `customer.subscription.deleted` fires.
- **Refunds (self-serve, Lifetime only)**: `requestLifetimeRefund()` → `refund-lifetime` Netlify function, wired into Profile → Account. Annual doesn't need an equivalent — `cancel_at_period_end` above already covers "I changed my mind," since there's nothing to un-refund on a subscription that just stops renewing. Lifetime has no such lapse mechanism (it's a one-time charge), so this exists specifically for that case: a bounded, no-questions-asked window (`REFUND_WINDOW_MS`, 14 days from `billing.updatedAt` — which any later webhook write also bumps, so the window can drift; known item E2) rather than a support queue, matching how low the dollar amount is. Rate-limited (`REFUND_RATE_LIMIT`/`REFUND_RATE_WINDOW_MS`) same as the other billing endpoints. The function only ever triggers the Stripe refund — the actual plan downgrade happens the same way a Stripe Dashboard-initiated refund would: via the `charge.refunded` webhook path (`deriveLifetimeRefundUpdate`, see below), not written directly here. Outside the 14-day window, `isLifetimeRefundEligible()` gates the UI and the function itself falls back to pointing the user at `SUPPORT_EMAIL` for a manual case-by-case refund.
- **No separate expiration check exists anywhere — `plan` is recomputed fresh on every `customer.subscription.updated`.** There's no polling and no "on login" verification; `subscribeBillingStatus()`'s Firestore listener just mirrors whatever's already written, whenever a client happens to be subscribed (which does catch up immediately on next open, since `onSnapshot` delivers current state right away, not just future deltas — so this isn't a staleness gap, just means the *webhook* is the only place doing anything). `ANNUAL_ACCESS_STATUSES` (`lib/billingEvents.ts`) gates it: `active`/`trialing`/`past_due` grant `"annual"` (past_due is a deliberate policy call — Stripe's Smart Retries run ~2-3 weeks, revoking on the first failed charge is harsher than warranted), everything else (`incomplete`, `incomplete_expired`, `unpaid`, `paused`) actively downgrades to `"free"` — not a no-op, a real revoke, since a subscription that lapses to `unpaid` may never actually get deleted by Stripe (depends on dunning config), so `.deleted` can't be relied on as the only revocation path.
- **Account deletion is server-side.** `deleteUserAccount()` (`authFirebase.ts`) reauthenticates client-side (confirms the password, surfaces `auth/wrong-password`), then calls `delete-account` (Netlify function, Admin SDK) to do everything else in one place: cancels any Stripe subscription **immediately** (not `cancel_at_period_end` — there's no one left to keep access for), wipes every `ideas`/`meta` doc, and deletes the Firebase Auth user. Client then just calls `auth.signOut()` to clear local session state. The function itself also requires the ID token's `auth_time` to be within 10 minutes (`verifyIdTokenWithAuthTime`, 403 otherwise) — the password re-check alone happens in the browser, so a merely valid token must not be enough; the client's reauth is what mints the fresh `auth_time`. **If cancelling the subscription fails, nothing is deleted** (502) unless Stripe confirms it's already canceled/gone — otherwise the card would keep being charged for an account that no longer exists.
- **Duplicate-purchase guard**: `create-payment-intent.ts` rejects (409) an Annual checkout if `subscriptionStatus` is already `active`/`trialing`/`past_due` **or the plan is Lifetime** (an Annual subscription on a Lifetime account would bill yearly for nothing — the webhook never records it), and rejects a Lifetime purchase if `plan` is already `"lifetime"` — Stripe allows multiple subscriptions per customer and won't dedupe for you. Because only the webhook writes `meta/billing`, those Firestore checks alone leave a gap right after paying (doc still says `free`), so it also **asks Stripe** (`subscriptions.list` / `paymentIntents.list` on the Customer; a fully refunded Lifetime PaymentIntent doesn't count). That needs the Customer id before any webhook has run, so `recordStripeCustomer()` (`lib/lifetimePricing.ts`) writes it onto `meta/billing` at checkout time — a brand-new doc gets the full free-plan shape via `create()` (never a bare `{stripeCustomerId}`, which would leave `plan` undefined on the client). `Pricing.tsx` hides whichever card doesn't apply (mirrors `UpgradeModal`'s `showAnnual` gate), backed by `useBillingPlanSync()` so `billingPlan` stays live outside the authenticated app too (`Idea.tsx` and `MarketingTransition.tsx` both use it — the public marketing pages never mount `Idea.tsx`, so without this `billingPlan` would be stuck at its default `'free'` there).
- **Subscription uid resolution**: `subscriptions.create` (annual) and `paymentIntents.create` (lifetime) in `create-payment-intent.ts` stamp `firebaseUid` onto `metadata` server-side at creation time, since renewal/cancellation webhook events carry no `client_reference_id` of their own.
- **Annual → Lifetime upgrade cancels the old subscription.** `deriveBillingUpdate()` (`lib/billingEvents.ts`) is no longer a single-argument pure function — it also takes the user's *current* billing doc (fetched by `stripe-webhook.ts` via `extractUidFromEvent()` + `getBillingDoc()`, still no Stripe/Firestore SDK calls inside `deriveBillingUpdate` itself). On a Lifetime `payment_intent.succeeded`, if the current doc has a `stripeSubscriptionId`, the result carries `cancelSubscriptionId` and `stripe-webhook.ts` cancels it **immediately** (best-effort, never blocks the Firestore write — matches the flat, non-prorated upgrade-discount design, which already treats the switch as fully credited). Both `customer.subscription.updated` and `.deleted` refuse to write over an already-`"lifetime"` plan (the former no-ops, the latter clears the now-defunct subscription fields but keeps `plan: "lifetime"`) — needed because that immediate cancel is exactly what triggers those two events for the just-superseded subscription. Regression-tested end-to-end in `billingEvents.test.ts` (chains real event sequences through the function, not just each branch in isolation).
- **A fully refunded Lifetime purchase is auto-downgraded — to whatever plan the account had *before* that purchase, not unconditionally to `free`.** `stripe-webhook.ts` special-cases `charge.refunded` outside the normal `extractUidFromEvent()`/`deriveBillingUpdate()` path: Charge metadata is a separate dictionary from the PaymentIntent's and is never copied over automatically, so the firebaseUid/plan tag has to be resolved with an extra `paymentIntents.retrieve()` call rather than read straight off the event. Gated on `charge.refunded === true` (the boolean, meaning *fully* refunded) — `charge.refunded` the *event* also fires on partial refunds (e.g. a support goodwill credit), which must not revoke access. The pure part of the logic is `deriveLifetimeRefundUpdate(uid, currentBilling)` (`lib/billingEvents.ts`) — a no-op unless the account is currently on `"lifetime"`, which is what makes it idempotent on Stripe's at-least-once redelivery. **This only fires if the Stripe Dashboard's webhook endpoint is actually subscribed to `charge.refunded`** — same "can't be verified or changed from this repo" caveat as the Firestore rules publish step; check the endpoint's enabled-events list in the Dashboard before assuming refunds are live.
  - **`BillingDoc.previousPlan`** records what `plan` was immediately before a Lifetime purchase overwrote it — free→lifetime snapshots `"free"`, an Annual upgrade snapshots `"annual"` — set inside the `payment_intent.succeeded` branch of `deriveBillingUpdate()`. Guarded against redelivery: if `currentBilling.plan` is already `"lifetime"` (a retried/duplicate delivery of the same purchase, not a second one — `create-payment-intent.ts` already rejects a second Lifetime purchase outright), the existing `previousPlan` is reused rather than re-snapshotted as `"lifetime"` itself. Every other branch of `deriveBillingUpdate()` passes it through unchanged (or clears it to `null` once the account is confirmed off Lifetime) purely so the field survives to the moment a refund actually needs it; `deriveLifetimeRefundUpdate()` reads it, reverts `plan` to it (falling back to `"free"` if `null`/unset — covers docs written before this field existed), and clears it back to `null` once consumed.
  - **Reverting to `"annual"` restores the rest of the year already paid for — with no new charge.** The original subscription was already canceled immediately at upgrade time (see the Annual→Lifetime upgrade note above), so a bare `plan: "annual"` write would describe nothing in Stripe. `resumeAnnualSubscription()` (`stripe-webhook.ts`) reads the most recently canceled subscription on the same Customer and creates a new one with `trial_end` = that subscription's original `current_period_end` (status `trialing`, which already grants Annual), its saved `default_payment_method`, and its `cancel_at_period_end` carried over; `trial_settings.end_behavior.missing_payment_method: "cancel"` ends it cleanly if no card is on file. First charge is on the original renewal date. If that date has passed (or there's no prior subscription), the account goes to `"free"` — deliberately no off-session charge right after a refund request. (Decided 2026-09-29; the earlier version charged a new year immediately via `default_incomplete`, which never actually completed.) This is why `create-payment-intent.ts` keeps a Lifetime PaymentIntent on the same Customer. Reuses `deriveBillingUpdate()`'s own `customer.subscription.updated` mapping via a synthesized event. Falls back to `"free"` — never an ungated `"annual"` — on any Stripe error.
- **Stripe Customers carry the account's email** (`resolveCustomer()` in `create-payment-intent.ts`, from the verified ID token; existing Customers are updated on each checkout) and Lifetime PaymentIntents set `receipt_email` — without it Stripe sends no receipts, failed-payment notices or renewal reminders. Which of those emails actually go out is a Stripe Dashboard setting (Settings → Customer emails), not code.
- Functions share setup through `netlify/functions/lib/handler.ts` (`authed()`: CORS preflight, method, ID-token check, optional recent-sign-in check). `cancel-subscription`, `refund-lifetime`, `delete-account` and `get-lifetime-price` use it; `create-payment-intent` and `submit-feature-request` read the token's email claims instead, and `stripe-webhook` is signature-authenticated. `checkRateLimit` runs in a Firestore transaction so parallel requests can't all slip under the limit; `submit-feature-request` uses it and requires a verified email (each request opens a GitHub issue with the server's token).
- Price IDs (`STRIPE_PRICE_ANNUAL`, `STRIPE_PRICE_LIFETIME`) and secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) are env vars, not hardcoded — unlike the Firebase config.
- **Webhook event ordering is not guarded** — `webhookEvents/{eventId}` only dedupes redeliveries of the *same* event; a delayed older `customer.subscription.updated` can overwrite newer state (known item E1).
- Open billing items (live Stripe keys/webhook events, Customer email settings, test-mode refund run) are tracked in `programmer-docs/artifacts/launch-checklist.html`. This file is the source of truth for the billing *design decisions*; that one is the source of truth for what's still *outstanding*.

## Firestore Security Rules

**`firestore.rules` is live — published to the Firebase Console on 2026-09-29** (the version with the `billing`/`nodeCount`/`featureRequests`/`rateLimit_*` exclusions described below). Rules are authored in this repo but deployed by pasting the file into the Firebase Console (project `interconnectedness-3a37b`) → Firestore → Rules → Publish. No Firebase CLI/`firebase.json` setup yet (deliberately deferred). **Any edit to `firestore.rules` does nothing until it's re-published by hand**, and a manual step means the two can drift — check the Console before assuming they match.

For history, the live rules before 2026-09-29 (pulled from the Console 2026-08-11) were ownership-only, with **no per-document restriction within a user's own `meta/` collection**:

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/ideas/{ideaId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /users/{userId}/meta/{document} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

`meta/billing` was writable by the client under that wildcard even though it's meant to be server-write-only (see Pricing & Billing above) — any signed-in user could grant themselves any plan directly via the Firestore SDK. `firestore.rules` fixes this: the `meta/{metaDocId}` wildcard now explicitly excludes `metaDocId != 'billing'`, with a separate `meta/billing` block granting read-only access back (`allow write: if false`). The exclusion is load-bearing, not the separate block alone — Firestore combines overlapping `match` blocks with a logical OR, so a more-specific sibling block by itself would not have overridden the wildcard's existing "yes". Confirmed via full-repo search that no client code path ever writes to `meta/billing` (only `subscribeBillingStatus()`'s read-only listener touches that path), so this cannot break anything. The same wildcard also excludes `featureRequests` and `rateLimit_*` (added 2026-09-29) — the Netlify Functions' own throttling state, which a client could otherwise clear to bypass the limits; no client code touches them, so they get no grant-back block at all. Doesn't affect the Admin SDK (`stripe-webhook.ts`, `delete-account.ts`) — rules never apply to Admin SDK calls, only to client-authenticated requests.

**The 50-node free-tier cap is also enforced here now**, via a denormalized counter at `meta/nodeCount` — Firestore rules can only read individual documents (`get()`/`exists()`), there's no way to count a collection's size directly in a rule. `ideas/{ideaId}`'s `create` rule checks `nodeCount.count < 50 || billing.plan != 'free'`; `nodeCount` itself is excluded from the `meta/{metaDocId}` wildcard the same way `billing` is, gets its own `allow create, update` (owner-only, must be an int) and `allow delete: if false` (deletable would let a free user reset it and bypass the cap indefinitely — see the bootstrapping note below). If `nodeCount` doesn't exist yet (brand-new user, or this session's resync hasn't landed), the create rule fails open rather than blocking a user's very first-ever creation on that race — bounded because the doc can never be deleted, so this only ever matters once.

**This is deliberately not fully tamper-proof, and that's disclosed rather than hidden.** The client maintains the counter itself (in the same batch as each idea write — `sendOp()` in `utilities/sync/outbox.ts` — `+1` per idea created, `-N` per batch delete, but only while `getCachedBillingStatus().plan === 'free'`, since a paid account is never capped and maintaining the counter for one would be pure overhead), and `useNodeCountResync()` overwrites it with the true count (`fetchFullIdeaList().length` — a localStorage read, not Firestore) once per session whenever the plan is free, which is what keeps it accurate through the "was paid, downgraded to free" case and initializes it correctly for existing users' first session after this shipped. Firestore rules evaluate each document write independently — they cannot verify a write to `nodeCount` actually corresponds to a real idea being created or deleted in the same batch, so a sufficiently sophisticated attacker who reverse-engineers this mechanism could still manipulate the counter directly. What this closes is the scenario it was built for: a user calling this app's own Firestore-write functions directly past the cap. A fully tamper-proof version needs a Cloud Function trigger, which this app doesn't have.

## Security Headers & CSP

`netlify.toml` carries a `[[headers]]` block (added 2026-08-26) applying a real `Content-Security-Policy` plus `X-Frame-Options`/`X-Content-Type-Options`/`Referrer-Policy`/`Strict-Transport-Security`/`Permissions-Policy` to every response. Scoped to what the app actually loads: Stripe.js (`js.stripe.com`, plus `api.stripe.com`/`m.stripe.com`/`m.stripe.network`/`r.stripe.com` for checkout and its fraud-detection calls), Firebase (`firestore.googleapis.com`, `identitytoolkit.googleapis.com`, `securetoken.googleapis.com`), and Google Fonts. Both `style-src` and `script-src` keep `'unsafe-inline'` — confirmed the hard way: `netlify.toml` headers apply globally, including to `netlify dev` (used by `npm run dev:functions`/`dev:stripe`), not just to production. An earlier version allowlisted the one inline `<script>` in `index.html` (the JSON-LD block) by exact SHA-256 hash instead of `'unsafe-inline'` on `script-src` — this broke `netlify dev` outright, because a hash/nonce present in `script-src` makes browsers ignore `'unsafe-inline'` entirely (per the CSP spec's own backward-compat rule), and `@vitejs/plugin-react` injects its own inline Fast Refresh preamble script in dev mode that changes every session and can't be hashed in advance. Trade-off accepted rather than fought further: this app has no XSS sinks anywhere (no `dangerouslySetInnerHTML`, no raw `innerHTML` — see `programmer-docs/artifacts/launch-checklist.html`, section 20), so the marginal protection a strict `script-src` adds here is smaller than the cost of a CSP that's broken in a real, regularly-used dev workflow. **Still not verified against a live deploy** — confirm checkout and sign-in actually work once this is live, before assuming the rest of the policy (the allowlisted domains) is correct.

## Marketing Site Routing & SEO

`/` is the landing page (via `MarketingTransition`, same as `/pricing`) and the sign-in/up form lives at `/login` (decided and done 2026-10-06, launch-checklist E8). A signed-in visitor who opens `/` is sent on to `/main` by `utilities/firebase/homeRedirect.ts`, loaded by dynamic import after first paint so Firebase stays out of the marketing bundle; `/pricing` is deliberately not redirected, since signed-in users go there to buy. Everything that sends someone to sign in now targets `/login`: sign-out (`signUserOut`), a missing session in `Idea.tsx`, `startCheckout` for signed-out users, the landing/pricing CTAs, the navbar "Log In" link and `AuthAction.tsx`. Terms/Privacy back buttons and account deletion go to `/`. `/landing` is kept as a redirect to `/` for old links. `index.html`'s canonical URL, Open Graph/Twitter tags and JSON-LD `url` are `https://intraconnected.app/`, and `sitemap.xml` lists `/` (priority 1.0), `/pricing`, `/terms` and `/privacy` (`/login` is deliberately left out). `/auth/action` is unchanged.

## Email Action Handler Page

`src/pages/AuthAction.tsx` (route `/auth/action`) is a branded replacement for Firebase's default hosted action page — the generic, unbranded page that `verifyEmail`/`resetPassword`/`recoverEmail` links point to out of the box. It reads `mode`/`oobCode` off the query string and calls the matching modular-SDK function itself (`applyActionCode`, `verifyPasswordResetCode` + `confirmPasswordReset`, `checkActionCode`), styled with the same neobrutal card/logo/background as `Auth.tsx`.

**This has no effect until it's pointed to from the Firebase Console** (project `interconnectedness-3a37b`) → Authentication → Templates → each template's edit icon → "Customize action URL" → set to `https://intraconnected.app/auth/action`. This is a per-project Console setting covering all three templates at once, not a per-`sendEmailVerification()`-call `actionCodeSettings` — same "authored here, published there, can't be verified or changed from this repo" caveat as the Firestore rules above.

The `resetPassword` branch intentionally just calls `confirmPasswordReset` and sends the user back to `/`; it does **not** attempt to re-wrap the DEK. `Auth.tsx`'s existing `handleSignIn` → `handleEmailRecovery` flow already handles that on the user's next sign-in (old-password `unwrapDEK` fails → falls back to `emailEncryptedDEK` → re-wraps with the new password) — see Critical Gotchas → Password change requires DEK re-wrap. Duplicating that here would race it.

## Shared code (`shared/`)
Plain TypeScript imported by both `src/` and `netlify/functions/` (functions can't import from `src/`): `SUPPORT_EMAIL`, the profanity filter, `FREE_NODE_LIMIT`, `ANNUAL_PRICE_CENTS` (the app's displayed price *and* the server's Lifetime-upgrade credit), `BillingPlan`, `TrackedIssue`. `firestore.rules` can't import anything, so its `< 50` is a literal — `netlify/tests/firestore-rules.test.ts` fails if it drifts from `FREE_NODE_LIMIT`. Keep `shared/` free of browser, Node and third-party imports. `src/utilities/support.ts`, `profanityFilter.ts` and the `netlify/functions/lib` twins are one-line re-exports.

## Key Conventions

### Modals
```tsx
<section className="overlay">
  <div className="modal neobrutal [modifier]">
    <section className="modalButtons">
      <button className="modalButton cancel neobrutal-button">Cancel</button>
      <button className="modalButton continue neobrutal-button">Action</button>
    </section>
  </div>
</section>
```
`cancel` → yellow (`$link`), `continue` → green (`$leaf`), `delete` → red (`$danger`).
Add `confirmModal` to `.modal` for modals without a textarea (fixes `min-height`).

### Rename Flow (Desktop)
`currentNameChangeId === -1` = renaming root. `setNewIdeaSwitch` must be called inside the Firebase `.then()` after `updateIdeaName`.

### Delete Flow
Dragging to trash sets `pendingDeleteId` → `DeleteConfirmModal` → `recursivelyDeleteChildren(id)` (localStorage + Firestore) → filter `ideas` state.

### Priority System
`priority?: 1 | 2 | 3` (1=High/red, 2=Medium/orange, 3=Low/yellow). Corner ribbon in top-left of each node. One `updateIdeaPriority(id, priority)` call does both halves (see Critical Gotchas above).

Sorting via `sortIdeas(ideas, mode)` in `parsing.tsx`: `'priority'` (P1→P2→P3→none) or `'recent'` (ascending `id`). Persisted to localStorage as `idea_sort_mode`.

### Drag and Drop (Desktop only)
Disabled on mobile. Drop targets: `trash`, `last-idea`, `idea-{id}`. Checklist nodes cannot receive drops. `PointerSensor` requires 10px movement.

Custom collision detection: `trash`/`last-idea` use rect intersection; idea nodes use pointer-proximity with 10px buffer. Custom drag modifier constrains left/right/top edges but leaves bottom open (so trash is reachable). Do not restore `restrictToWindowEdges`.

### Desktop Navbar
Left sidebar: **Create** (green, top) → **Home** (burnt-orange; grays out + disabled when `rootId === 1`, triggers fade transition via `setNodesVisible`) → **Mind Map toggle** (pink, `MindMapBlack.svg`; wraps in `.nav-btn-group` which gets `--active` class). Right sidebar: log out, help, patch notes.

`navigateToId(1)` (from `useIdeaContext()`) handles returning to root and rebuilding the stack.

### Desktop Node Overflow
Both checklist item lists and leaf-node content truncate when overflowing with a "Show more ▾" fade overlay; "Show less ▴" collapses. State resets on navigation.

### Mobile UI (`MobileMindMap`, shown ≤576px)
Rendered at bottom of `Idea.tsx`; CSS swaps desktop/mobile at 576px. All mobile components live in `src/components/mobile/` (`MobileMindMap`, `MobileMoveSheet`, `MobileHelpSheet`, `MobileMindMapSheet`, `MobilePatchNotesSheet`, `MobileChecklistItemSheet`, `SortableMobileChecklistItem`, `mobileTypes.ts`).

Key differences from desktop:
- **Navigation**: local `currentId` state, not `rootIdStack`; breadcrumb bar at top; navigation is instant (`setCurrentId` directly — no fade/timeout)
- **Sheets**: local `sheet` state (`SheetState` union from `mobileTypes.ts`) — does **not** use context modal flags
- **Sheet types**: `rename | edit | move | link | confirmDelete | checklist` (`actions` sheet removed; `edit` replaces separate rename+link sheets)
- **Edit sheet**: single sheet with auto-growing textarea (name) + optional URL input (leaf only); `commitEdit()` saves both in one pass
- **Swipe-to-reveal**: swipe left on any node slides it to expose three buttons — edit (blue), move (yellow), delete (red); swiping back or tapping elsewhere dismisses; one node revealed at a time; tracked via `swipeRevealedId` state
- **Mind map**: `showMindMap` boolean (not a SheetState); rendered by `MobileMindMapSheet` (◎ FAB button)
- **Drag-and-drop**: long-press (360ms, `pressingNodeId` state) initiates drag with a ghost element (`isDragging`/`dragPos`); drop onto sibling reparents; "↑ Move to parent" zone slides in at list top when dragging inside a nested level (`parentZoneRef`); auto-scrolls near edges (80px, 250ms delay, 4px/frame); checklist/link nodes excluded as drop targets; `touchmove` prevented on document during drag
- **Checklist nodes**: tap = inline accordion (`expandedChecklists` Set); tap OpenIcon = open `checklist` sheet
- **FAB**: patch notes, ◎ (mind map), + (create) — edit mode and ✎ button removed
- **Keyboard**: `keyboardInset` state tracks `visualViewport` resize to lift sheets above software keyboard

### Changelog & DEVLOG
- `programmer-docs/CHANGELOG.md` — only significant new features get entries; bug fixes are silent `.x` patches
- Format: `## TAG | Title\nDescription`
- `programmer-docs/DEVLOG.md` — tracks every update before pushing; concise; collapse same-feature issues into one point; do not commit yourself

### Artifacts saved to the repo
When a Claude-published artifact (audit, report, etc.) is also saved as a file in `programmer-docs/artifacts/`, put the artifact's `claude.ai/code/artifact/...` link on its own line directly under the `#` title, before any body text — so the live version is the first thing visible when the file is opened.
