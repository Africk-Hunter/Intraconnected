# Intraconnected — CLAUDE.md

## When stuck, output your current hypothesis before making changes.

## CRITICAL: Git Commits
**NEVER create a git commit unless the user explicitly tells you to commit.**

## Project Overview
Node-based mind-mapping app. Users create hierarchical idea trees, navigate into nodes, drag to reparent/delete, rename/link via modals.

## Commands
```bash
npm run dev    # start dev server
npm run build  # production build
```

## Tech Stack
- **React 19**, **TypeScript** (strict), **Vite**, **SCSS**
- **Firebase** — Auth (email/password) + Firestore
- **@dnd-kit/core** — drag and drop
- **React Router v7** — `/` (login) and `/main`

## Architecture

### Data Flow
1. Login → fetch from Firestore → write to `localStorage`
2. All reads: `localStorage` via utility functions
3. All writes: `localStorage` + Firestore simultaneously
4. `newIdeaSwitch` toggle triggers re-reads — toggle **after** writing to localStorage, never before

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
`ChecklistIdea` has no `link` field. Use `getIdeaLink(idea)` from `utilities/idea/helpers.tsx`.

### `ideas` state is not the full list
Use `fetchFullIdeaList()` (reads localStorage) to get all ideas. Never assume `ideas` contains anything outside the current view.

### `rootIdStack` is a ref, not state
Mutations don't trigger re-renders. `MobileMindMap` uses local `currentId` state instead.

### `updateIdeaParentId` syncs Firebase automatically
Do not add a separate Firebase call after — it double-writes.

### Priority writes require both calls
```ts
updateIdeaPriority(id, priority);           // localStorage only
schedulePriorityFirebaseWrite(id, priority); // debounced Firestore sync
```
Never call `updateIdeaPriorityInFirebase` directly from a component.

### Checklist items are encrypted in Firestore
`updateChecklistItemsInFirebase` encrypts both `items[].text` and `items[].link`. Never write raw item text/link to Firestore directly.

### `setNewIdeaSwitch` must be called inside Firebase `.then()`
Not in the button's `onClick`.

### Modal `min-height` specificity
`.neobrutal.modal` has `min-height: 18rem`. Override: `.neobrutal.modal.confirmModal { min-height: auto; }` at all three breakpoints.

### `setIdeas` accepts functional updates
`setIdeas((prev) => prev.filter(...))` works despite the loose `(ideas: any) => void` typing.

### Firebase collection path
Ideas at `users/{uid}/ideas/{ideaId}`. Config hardcoded in `src/firebaseConfig.ts` (no `.env`).

### Password change requires DEK re-wrap
If adding "change password" via `updatePassword()`, re-wrap the DEK with the new password and update `encryptedDEK` in Firestore — otherwise next login throws on `unwrapDEK` and sends user to recovery screen.

### E2E Encryption
All idea `content` and `link` fields AES-256-GCM encrypted before Firestore writes. Ciphertext stored as `enc:<base64>`. `decryptField` passes plaintext through unchanged (backward-compat). DEK in module-level `_dek` (dekStore.ts) + `sessionStorage` key `dek_session`. `clearDEK()` wipes both on sign-out.

## Pricing & Billing

Three plans: `free` (capped at `FREE_NODE_LIMIT` = 50 nodes, `src/utilities/billing/limits.tsx`), `annual` (Stripe subscription), `lifetime` (Stripe one-time payment). `canCreateIdea()` gates node creation against the cached plan — a client-side UX nicety only; the cap is actually enforced server-side via `firestore.rules` (see below). **Not yet deployed** (per DEVLOG) — pre-launch.

- **Checkout is embedded Stripe Elements, not a Checkout Session redirect.** `startCheckout(plan)` (`src/utilities/billing/billing.tsx`) → signed-out users are bounced to `/` with the intended plan stashed in `sessionStorage` (`pending_checkout_plan`), resumed post-login via `consumePendingCheckoutPlan()`. Signed-in users hit `create-payment-intent` (Netlify function), which returns a PaymentIntent client secret (lifetime) or an incomplete Subscription's invoice client secret (annual) — mounted into a `<CardElement>` (`CheckoutModal.tsx`/`CheckoutForm.tsx`) and confirmed client-side via `stripe.confirmCardPayment`. Uses `VITE_STRIPE_PUBLISHABLE_KEY`. (Docs/DEVLOG previously described a server-redirected Stripe Checkout Session via a `create-checkout-session` function — that function does not exist; this is the shipped design.)
- **Intended source of truth is the server, but this is not currently enforced.** The client is *supposed* to never write billing state directly — `stripe-webhook.ts` verifies the Stripe signature, runs the event through the pure `deriveBillingUpdate()` (`netlify/functions/lib/billingEvents.ts`), and merges the result into Firestore at `users/{uid}/meta/billing`. **However, live Firestore rules do not lock that path down** (see Firestore Security Rules below) — a signed-in client can currently write to their own `meta/billing` doc directly and grant themselves any plan. Treat this as an open pre-launch blocker, not a documented safe design.
- **Client sync**: `subscribeBillingStatus()` (`firebaseHelpers.tsx`) listens on that Firestore doc and mirrors every snapshot to `localStorage` (`billing_plan`) so `getCachedBillingStatus()` can read synchronously (e.g. from `canCreateIdea()`).
- **Cancellation (self-serve)**: `cancelSubscription()` → `cancel-subscription` Netlify function sets `cancel_at_period_end: true` (never an immediate cancel) so the user keeps access through the period they paid for; the plan only flips to `free` when `customer.subscription.deleted` fires.
- **No separate expiration check exists anywhere — `plan` is recomputed fresh on every `customer.subscription.updated`.** There's no polling and no "on login" verification; `subscribeBillingStatus()`'s Firestore listener just mirrors whatever's already written, whenever a client happens to be subscribed (which does catch up immediately on next open, since `onSnapshot` delivers current state right away, not just future deltas — so this isn't a staleness gap, just means the *webhook* is the only place doing anything). `ANNUAL_ACCESS_STATUSES` (`lib/billingEvents.ts`) gates it: `active`/`trialing`/`past_due` grant `"annual"` (past_due is a deliberate policy call — Stripe's Smart Retries run ~2-3 weeks, revoking on the first failed charge is harsher than warranted), everything else (`incomplete`, `incomplete_expired`, `unpaid`, `paused`) actively downgrades to `"free"` — not a no-op, a real revoke, since a subscription that lapses to `unpaid` may never actually get deleted by Stripe (depends on dunning config), so `.deleted` can't be relied on as the only revocation path.
- **Account deletion is server-side.** `deleteUserAccount()` (`authFirebase.tsx`) reauthenticates client-side (confirms the password, surfaces `auth/wrong-password`), then calls `delete-account` (Netlify function, Admin SDK) to do everything else in one place: cancels any Stripe subscription **immediately** (not `cancel_at_period_end` — there's no one left to keep access for), wipes every `ideas`/`meta` doc, and deletes the Firebase Auth user. Client then just calls `auth.signOut()` to clear local session state.
- **Duplicate-purchase guard**: `create-payment-intent.ts` rejects (409) an Annual checkout if `subscriptionStatus` is already `active`/`trialing`/`past_due`, and rejects a Lifetime purchase if `plan` is already `"lifetime"` — Stripe allows multiple subscriptions per customer and won't dedupe for you. `Pricing.tsx` hides whichever card doesn't apply (mirrors `UpgradeModal`'s `showAnnual` gate), backed by `useBillingPlanSync()` so `billingPlan` stays live outside the authenticated app too (`Idea.tsx` and `MarketingTransition.tsx` both use it — the public marketing pages never mount `Idea.tsx`, so without this `billingPlan` would be stuck at its default `'free'` there).
- **Subscription uid resolution**: `subscriptions.create` (annual) and `paymentIntents.create` (lifetime) in `create-payment-intent.ts` stamp `firebaseUid` onto `metadata` server-side at creation time, since renewal/cancellation webhook events carry no `client_reference_id` of their own.
- **Annual → Lifetime upgrade cancels the old subscription.** `deriveBillingUpdate()` (`lib/billingEvents.ts`) is no longer a single-argument pure function — it also takes the user's *current* billing doc (fetched by `stripe-webhook.ts` via `extractUidFromEvent()` + `getBillingDoc()`, still no Stripe/Firestore SDK calls inside `deriveBillingUpdate` itself). On a Lifetime `payment_intent.succeeded`, if the current doc has a `stripeSubscriptionId`, the result carries `cancelSubscriptionId` and `stripe-webhook.ts` cancels it **immediately** (best-effort, never blocks the Firestore write — matches the flat, non-prorated upgrade-discount design, which already treats the switch as fully credited). Both `customer.subscription.updated` and `.deleted` refuse to write over an already-`"lifetime"` plan (the former no-ops, the latter clears the now-defunct subscription fields but keeps `plan: "lifetime"`) — needed because that immediate cancel is exactly what triggers those two events for the just-superseded subscription. Regression-tested end-to-end in `billingEvents.test.ts` (chains real event sequences through the function, not just each branch in isolation).
- **A fully refunded Lifetime purchase is auto-downgraded — to whatever plan the account had *before* that purchase, not unconditionally to `free`.** `stripe-webhook.ts` special-cases `charge.refunded` outside the normal `extractUidFromEvent()`/`deriveBillingUpdate()` path: Charge metadata is a separate dictionary from the PaymentIntent's and is never copied over automatically, so the firebaseUid/plan tag has to be resolved with an extra `paymentIntents.retrieve()` call rather than read straight off the event. Gated on `charge.refunded === true` (the boolean, meaning *fully* refunded) — `charge.refunded` the *event* also fires on partial refunds (e.g. a support goodwill credit), which must not revoke access. The pure part of the logic is `deriveLifetimeRefundUpdate(uid, currentBilling)` (`lib/billingEvents.ts`) — a no-op unless the account is currently on `"lifetime"`, which is what makes it idempotent on Stripe's at-least-once redelivery. **This only fires if the Stripe Dashboard's webhook endpoint is actually subscribed to `charge.refunded`** — same "can't be verified or changed from this repo" caveat as the Firestore rules publish step below; check the endpoint's enabled-events list in the Dashboard before assuming refunds are live.
  - **`BillingDoc.previousPlan`** records what `plan` was immediately before a Lifetime purchase overwrote it — free→lifetime snapshots `"free"`, an Annual upgrade snapshots `"annual"` — set inside the `payment_intent.succeeded` branch of `deriveBillingUpdate()`. Guarded against redelivery: if `currentBilling.plan` is already `"lifetime"` (a retried/duplicate delivery of the same purchase, not a second one — `create-payment-intent.ts` already rejects a second Lifetime purchase outright), the existing `previousPlan` is reused rather than re-snapshotted as `"lifetime"` itself. Every other branch of `deriveBillingUpdate()` passes it through unchanged (or clears it to `null` once the account is confirmed off Lifetime) purely so the field survives to the moment a refund actually needs it; `deriveLifetimeRefundUpdate()` reads it, reverts `plan` to it (falling back to `"free"` if `null`/unset — covers docs written before this field existed), and clears it back to `null` once consumed.
  - **Reverting to `"annual"` actually resumes billing — it does not just flip a Firestore label.** The original subscription was already canceled immediately at upgrade time (see the Annual→Lifetime upgrade note above), so there's nothing in Stripe for a bare `plan: "annual"` write to describe — it would grant indefinite access with nothing ever set up to bill or expire it again. Instead, `resumeAnnualSubscription()` (`stripe-webhook.ts`) creates a fresh subscription off-session on the same Stripe Customer, reusing whatever payment method that customer already has on file from the original subscription — which is why `create-payment-intent.ts` now keeps a Lifetime PaymentIntent on that same Customer too (previously anonymous, with no `customer` field at all, silently severing this relationship). Reuses `deriveBillingUpdate()`'s own `customer.subscription.updated` mapping by synthesizing the event Stripe would otherwise send for the newly created subscription, rather than duplicating its status-gating logic — so a resume that comes back `"incomplete"` (declined card, 3DS required, no payment method on file) is handled exactly like a brand-new signup: not granted access until a real `active`/`trialing`/`past_due` status is confirmed, either immediately or via that subscription's own later webhook events. Falls back to `"free"` — never to an ungated `"annual"` — if there's no customer/price to resume against, or if Stripe rejects the attempt outright.
- Price IDs (`STRIPE_PRICE_ANNUAL`, `STRIPE_PRICE_LIFETIME`) and secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) are env vars, not hardcoded — unlike the Firebase config.
- All known billing gaps from an internal audit (2026-08-11) are closed in code as of 2026-08-13; the Firestore rule fix (below) still needs to be manually published in the Firebase Console — that step can't happen from this repo. (The design-doc PRDs this section used to cite have been deleted — this file is now the source of truth for the design decisions themselves, not a pointer to them.)

## Firestore Security Rules

**A `firestore.rules` file now exists in this repo** (added 2026-08-13) — but rules are still only *authored* here; they're deployed by pasting this file's contents into the Firebase Console (project `interconnectedness-3a37b`) → Firestore → Rules → Publish. No Firebase CLI/`firebase.json` setup yet (deliberately deferred — a fuller CLI-based deploy pipeline is a reasonable future step if ever wanted, but hasn't been set up). **Check the Console before assuming this file matches what's actually live** — a manual publish step means the two can drift.

Confirmed live rules as of 2026-08-11 (pulled directly from the Firebase Console), before this fix — ownership-only, with **no per-document restriction within a user's own `meta/` collection**:

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

`meta/billing` was writable by the client under that wildcard even though it's meant to be server-write-only (see Pricing & Billing above) — any signed-in user could grant themselves any plan directly via the Firestore SDK. `firestore.rules` fixes this: the `meta/{metaDocId}` wildcard now explicitly excludes `metaDocId != 'billing'`, with a separate `meta/billing` block granting read-only access back (`allow write: if false`). The exclusion is load-bearing, not the separate block alone — Firestore combines overlapping `match` blocks with a logical OR, so a more-specific sibling block by itself would not have overridden the wildcard's existing "yes". Confirmed via full-repo search that no client code path ever writes to `meta/billing` (only `subscribeBillingStatus()`'s read-only listener touches that path), so this cannot break anything. Doesn't affect the Admin SDK (`stripe-webhook.ts`, `delete-account.ts`) — rules never apply to Admin SDK calls, only to client-authenticated requests.

**The 50-node free-tier cap is also enforced here now**, via a denormalized counter at `meta/nodeCount` — Firestore rules can only read individual documents (`get()`/`exists()`), there's no way to count a collection's size directly in a rule. `ideas/{ideaId}`'s `create` rule checks `nodeCount.count < 50 || billing.plan != 'free'`; `nodeCount` itself is excluded from the `meta/{metaDocId}` wildcard the same way `billing` is, gets its own `allow create, update` (owner-only, must be an int) and `allow delete: if false` (deletable would let a free user reset it and bypass the cap indefinitely — see the bootstrapping note below). If `nodeCount` doesn't exist yet (brand-new user, or this session's resync hasn't landed), the create rule fails open rather than blocking a user's very first-ever creation on that race — bounded because the doc can never be deleted, so this only ever matters once.

**This is deliberately not fully tamper-proof, and that's disclosed rather than hidden.** The client maintains the counter itself (`adjustNodeCount()` in `firebaseHelpers.tsx` — `+1` per idea created, `-N` per batch delete, but only while `getCachedBillingStatus().plan === 'free'`, since a paid account is never capped and maintaining the counter for one would be pure overhead), and `useNodeCountResync()` overwrites it with the true count (`fetchFullIdeaList().length` — a localStorage read, not Firestore) once per session whenever the plan is free, which is what keeps it accurate through the "was paid, downgraded to free" case and initializes it correctly for existing users' first session after this shipped. Firestore rules evaluate each document write independently — they cannot verify a write to `nodeCount` actually corresponds to a real idea being created or deleted in the same batch, so a sufficiently sophisticated attacker who reverse-engineers this mechanism could still manipulate the counter directly. What this closes is the scenario it was built for: a user calling this app's own Firestore-write functions directly past the cap. A fully tamper-proof version needs a Cloud Function trigger, which this app doesn't have.

## Email Action Handler Page

`src/pages/AuthAction.tsx` (route `/auth/action`) is a branded replacement for Firebase's default hosted action page — the generic, unbranded page that `verifyEmail`/`resetPassword`/`recoverEmail` links point to out of the box. It reads `mode`/`oobCode` off the query string and calls the matching modular-SDK function itself (`applyActionCode`, `verifyPasswordResetCode` + `confirmPasswordReset`, `checkActionCode`), styled with the same neobrutal card/logo/background as `Auth.tsx`.

**This has no effect until it's pointed to from the Firebase Console** (project `interconnectedness-3a37b`) → Authentication → Templates → each template's edit icon → "Customize action URL" → set to `https://intraconnected.app/auth/action`. This is a per-project Console setting covering all three templates at once, not a per-`sendEmailVerification()`-call `actionCodeSettings` — same "authored here, published there, can't be verified or changed from this repo" caveat as the Firestore rules publish step above.

The `resetPassword` branch intentionally just calls `confirmPasswordReset` and sends the user back to `/`; it does **not** attempt to re-wrap the DEK. `Auth.tsx`'s existing `handleSignIn` → `handleEmailRecovery` flow already handles that on the user's next sign-in (old-password `unwrapDEK` fails → falls back to `emailEncryptedDEK` → re-wraps with the new password) — see Critical Gotchas → Password change requires DEK re-wrap. Duplicating that here would race it.

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
`priority?: 1 | 2 | 3` (1=High/red, 2=Medium/orange, 3=Low/yellow). Corner ribbon in top-left of each node. Always write both calls (see Critical Gotchas above).

Sorting via `sortIdeas(ideas, mode)` in `parsing.tsx`: `'priority'` (P1→P2→P3→none) or `'recent'` (ascending `id`). Persisted to localStorage as `idea_sort_mode`.

### Drag and Drop (Desktop only)
Disabled on mobile. Drop targets: `trash`, `last-idea`, `idea-{id}`. Checklist nodes cannot receive drops. `PointerSensor` requires 10px movement.

Custom collision detection: `trash`/`last-idea` use rect intersection; idea nodes use pointer-proximity with 10px buffer. Custom drag modifier constrains left/right/top edges but leaves bottom open (so trash is reachable). Do not restore `restrictToWindowEdges`.

### Desktop Navbar
Left sidebar: **Create** (green, top) → **Home** (burnt-orange; grays out + disabled when `rootId === 1`, triggers fade transition via `setNodesVisible`) → **Mind Map toggle** (pink, `MindMapBlack.svg`; wraps in `.nav-btn-group` which gets `--active` class). Right sidebar: log out, help, patch notes.

`returnToRoot()` from `utilities/idea/helpers` handles stack clearing.

### Desktop Node Overflow
Both checklist item lists and leaf-node content truncate when overflowing with a "Show more ▾" fade overlay; "Show less ▴" collapses. State resets on navigation.

### Mobile UI (`MobileMindMap`, shown ≤576px)
Rendered at bottom of `Idea.tsx`; CSS swaps desktop/mobile at 576px. Mobile-specific sub-components live in `src/components/mobile/` (`MobileChecklistItemSheet`, `SortableMobileChecklistItem`, `mobileTypes.ts`).

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
