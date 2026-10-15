# Plan: Vault notes

Audience: a coding agent working in this repo with no other context. Follow this document top to bottom. Where it gives exact names, formats, strings or file paths, use them as written. Where it says "decide", pick the simplest option that fits the surrounding code and note the choice in the DEVLOG entry.

Status: product decisions taken with the owner on 2026-10-14. Not started. Do not start until the owner says to build it.

---

## 0. Ground rules (read first)

1. Read `CLAUDE.md` in full before touching code. Its rules apply on top of this plan, in particular:
   - **Never create a git commit.** The owner commits.
   - **No emojis anywhere** (UI, copy, aria labels, toasts). Icons are inline SVGs using `currentColor`.
   - **Never call any encryption "end-to-end".** This plan allows the words "we can't read" for **vault notes only** (section 13 has the approved copy). It does not allow them for ordinary ideas.
   - Every idea change goes through `src/utilities/idea/ideaStore.ts`. Never write `users/{uid}/ideas/*` directly.
   - `setNewIdeaSwitch` is toggled **after** a write, never before.
   - Modals use the existing `AnimatedOverlay` + `.modal.neobrutal` pattern; pass `onEscape`.
   - Any new mobile overlay must register `useBackHandler` (existing sheets already do through the `sheet` state).
2. Do not add npm dependencies. Everything here uses Web Crypto and `hash-wasm` (already installed).
3. Do not change `firestore.rules`, `netlify.toml`, `vite-plugins/nativeCsp.ts`, `capacitor.config.ts`, `Info.plist` or any Netlify function. None of them need to change (section 11 explains why).
4. Before you say you're done: `npm run typecheck && npm run lint && npm test && npm run build && npm run build:native` must all pass. Report the test count.
5. When stuck, write down your current hypothesis before changing code (CLAUDE.md rule).

---

## 1. What we are building

A fourth kind of note: the **vault note**, for passwords and other secrets.

- A vault note has a **label** (for example "Bank login"), a **secret** (free text, up to 2000 characters) and an optional **site link**. No structured username/password fields in this version.
- All three fields are encrypted with a separate **vault key** before the app's normal encryption runs on top. The vault key is protected by a **vault passphrase** and a **recovery code**. Neither ever leaves the device, and the server's KMS recovery cannot open vault notes. This is the one place in the product where we can truthfully say "we can't read it".
- There is **one vault per account** and **one passphrase** for all vault notes. The user sets it once in **Profile → Vault**. Unlocking once opens every vault note until the vault locks again.
- The vault locks after **5 minutes** without a vault action (user can pick 1, 5 or 15 in Profile → Vault), after the page or app has been in the background for **60 seconds**, on **Lock now**, and on sign-out (including idle sign-out). There is no "remember" option. The key lives in memory only.

### Product decisions already taken (do not reopen)

| Topic | Decision |
|---|---|
| Fields | Label + secret + optional link. |
| Passphrase rules | **None.** Any non-empty passphrase is accepted (must be typed twice and match). No strength meter. No check against the account password. |
| Auto-lock | Default 5 minutes; options 1 / 5 / 15. Plus 60 s in background, Lock now, sign-out. |
| Remember unlock | No. Memory only, every lock asks again. |
| Recovery code | Yes. Shown once when created, with Copy and Download options; no typing check is required. |
| Lost passphrase and code | **Reset vault** in Profile → Vault. User types `RESET`. Deletes every vault note and the vault itself, then they can set up a new one. |
| Clipboard | Copy buttons exist. Do **not** clear the clipboard afterwards (the owner's call: the user is responsible for their clipboard). |
| Biometrics | Not in this version. |
| Free plan | Vault notes count toward the 50-idea cap like any idea. |
| Shape | Immutable at creation (an idea never becomes a vault note or the reverse). Leaf only (no children, never a drop or move target). |
| Search | Vault notes never appear in search results or suggestions. |
| Export | Left out of the normal Markdown/OPML/JSON export. A separate "Export vault notes" button in Profile → Vault (unlocked only) downloads decrypted JSON. |
| Import | Imports never create vault notes. |
| Setup location | Profile → Vault tab. Trying to create a vault note before setup sends the user there. |

### Out of scope

Biometric unlock, structured fields, password generator, strength meter, clipboard clearing, searching vault labels, sharing, vault checklists, vault notes with children, importing into the vault, marketing/landing page copy, App Store / Play listing changes.

---

## 2. How it works (design summary)

```
plaintext label/secret/link
   │  vault key (VK), AES-256-GCM, AAD = uid|ideaId|vault.<field>, padded
   ▼
"vault1:<keyId>:<base64>"          ← this string is what the app stores as the idea's
   │                                 noteTitle / content / link, locally and in the outbox
   │  account key (DEK), existing outbox encryptField (enc2:)
   ▼
"enc2:k1:<base64>"                 ← what Firestore holds
```

Consequences you rely on:

- **The outbox and sync engine need no vault logic.** After the normal decrypt, a vault field is still the opaque `vault1:` string. The `ideas` cache in `localStorage` therefore only ever holds vault ciphertext.
- Never skip the outer encryption based on a text prefix. Only interpret `vault1:` values for ideas with `isVault === true`. A normal idea whose text happens to start with `vault1:` is ordinary text.
- Moving, prioritising, deleting and undoing a delete never touch the encrypted fields, and the AAD does not include `parentID`, so none of them break decryption. Undo restores the same ids, so the AAD still matches.
- Changing the passphrase or the recovery code re-wraps the **same** VK. Existing notes are never re-encrypted. Only Reset creates a new VK (with a new `keyId`).

A vault note is stored as a normal note plus one flag:

```ts
{ id, parentID, isNote: true, isVault: true,
  noteTitle: "vault1:…",   // label
  content:   "vault1:…",   // secret
  link:      "vault1:…",   // site link (encrypted even when empty)
  priority?: 1 | 2 | 3 }
```

Setting `isNote: true` is deliberate: every existing "notes can't have children / can't be drop targets / aren't navigable / aren't move targets" rule (`isNoteMode`) then applies to vault notes for free. Every place that **displays** note text must check `isVaultIdea` first (section 7 lists them all).

`isVault` itself is stored unencrypted in Firestore (like `isNote`). That is acceptable and is disclosed in the Privacy copy.

---

## 3. Formats (exact)

### 3.1 Firestore document `users/{uid}/meta/vault`

```ts
interface VaultMeta {
  v: 1;
  keyId: string;          // 8 lowercase hex chars, random per vault (new one on Reset)
  passphraseWrap: string; // see 3.3
  recoveryWrap: string;   // see 3.4
  createdAt: Timestamp;   // serverTimestamp() on setup
  updatedAt: Timestamp;   // serverTimestamp() on every write
}
```

The existing `meta/{metaDocId}` rule in `firestore.rules` already gives the owner read/write/delete. Writes to this doc go straight through `setDoc`/`updateDoc`/`deleteDoc`/`runTransaction`; the "only through the outbox" rule covers idea docs, not meta docs.

### 3.2 Vault key

- 32 random bytes from `crypto.getRandomValues`.
- In memory it is always a **non-extractable** AES-GCM `CryptoKey` (`importKey('raw', raw, {name:'AES-GCM'}, false, ['encrypt','decrypt'])`).
- Code that needs to re-wrap (change passphrase, new recovery code, recovery) unwraps a fresh **raw** copy with the secret the user just typed, wraps it, then calls `raw.fill(0)`. Never export the in-memory key; never store raw bytes anywhere.

### 3.3 Passphrase wrap

```
vpw1:argon2id:m=<m>,t=<t>,p=<p>:<base64 salt, 16 bytes>:<base64(iv12 ‖ ciphertext)>
```

- KEK = Argon2id(passphrase, salt, params) via the existing `deriveArgon2Key` in `src/utilities/crypto.ts`. Params default to the existing `ARGON2_DEFAULTS` (`m=32768, t=3, p=1`); tests pass smaller ones.
- Plaintext = the 32 raw VK bytes. AES-GCM with AAD = `intraconnected-vault-key|<uid>|<keyId>`.
- The AAD matters: it stops anyone who can write to the database from substituting the account DEK wrap (`meta/encryption.encryptedDEK`) for the vault wrap when a user happens to use the same password for both. Do not drop it.
- If Argon2id can't load, **throw**. Never fall back to PBKDF2 for vault wraps. Surface the "couldn't load" error separately from "wrong passphrase" (same rule CLAUDE.md gives for account wraps).

### 3.4 Recovery code and recovery wrap

- Code = 20 random bytes, encoded as **Crockford base32** (alphabet `0123456789ABCDEFGHJKMNPQRSTVWXYZ`), exactly 32 characters, shown as 8 groups of 4 separated by `-`, for example `7K3M-Q9RT-…`.
- Parsing the user's input: uppercase; remove spaces and `-`; map `O`→`0`, `I`→`1`, `L`→`1`; any other character outside the alphabet (including `U`) → `malformed-code`; length must be exactly 32 → decode to 20 bytes.
- Wrapping key = HKDF-SHA-256 over the 20 code bytes: `salt = UTF-8("intraconnected-vault|" + uid)`, `info = UTF-8("intraconnected-vault-recovery-v1")`, output AES-GCM 256, non-extractable. The code is high-entropy (160 bits), so no slow KDF.
- Wrap string: `vrc1:<base64(iv12 ‖ ciphertext)>`, same plaintext and same AAD as 3.3.

### 3.5 Vault field

```
vault1:<keyId>:<base64(iv12 ‖ ciphertext)>
```

- Plaintext = `padEncryptedField(text)` (the existing length-bucket padding from `crypto.ts`). Decrypt with `unpadEncryptedField`.
- AAD = `<uid>|<ideaId>|vault.<field>` where `<field>` is `noteTitle`, `content` or `link`.
- All three fields are always written, even when empty (an empty link is encrypted as `""`), so the stored shape never reveals whether a link exists.
- `keyId` lets the app tell "this note belongs to a vault that has since been reset" apart from "damaged".

---

## 4. Files to create

```
src/utilities/vault/
  vaultCrypto.ts        pure crypto + formats (section 5.1)
  vaultCrypto.test.ts
  vaultSession.ts       in-memory key, locks, timers, label cache (5.2), no Firebase imports
  vaultSession.test.ts
  vaultService.ts       Firestore + orchestration (5.3)
  vaultService.test.ts  (pure parts only; mock firebase like ideaStore.test.ts mocks the outbox)
  useVaultState.ts      React hook over vaultSession (5.4)
  useVaultLabels.ts     effect that decrypts labels after unlock / data changes (5.4)
src/components/vault/
  VaultUnlockForm.tsx   passphrase field + Unlock (+ "Forgot passphrase?")
  VaultNotePanel.tsx    view/edit one vault note (shared by desktop modal and mobile sheet)
  VaultNoteModal.tsx    desktop modal wrapper around VaultNotePanel
  VaultCreateFields.tsx label/secret/link inputs for the Create modal tab and the mobile create sheet
  RecoveryCodeCard.tsx  shows a code, Copy, Download, and the two-group re-type check
  VaultSettings.tsx     everything in Profile → Vault
src/styles/vault.scss
public/images/Lock.svg  hand-drawn padlock for the changelog entry, same stroke style as public/images/Pen.svg
```

## 5. Core modules (exact behaviour)

### 5.1 `src/utilities/crypto.ts` (small change) and `vaultCrypto.ts`

In `crypto.ts`, add `export` to these existing declarations (no renames, no behaviour change): `uint8ToBase64`, `base64ToUint8`, `aesEncrypt`, `aesDecrypt`, `deriveArgon2Key`, `ARGON2_DEFAULTS`.

`vaultCrypto.ts` exports:

```ts
export type VaultField = 'noteTitle' | 'content' | 'link';
export type VaultErrorCode =
  | 'wrong-passphrase' | 'wrong-code' | 'malformed-code'
  | 'other-vault' | 'damaged' | 'argon2-unavailable'
  | 'not-set-up' | 'already-set-up' | 'locked' | 'offline';
export class VaultError extends Error { constructor(public code: VaultErrorCode, message?: string) }

export function generateVaultKeyId(): string;                    // 4 random bytes → 8 lowercase hex
export function generateRawVaultKey(): Uint8Array;               // 32 random bytes
export function importVaultKey(raw: Uint8Array): Promise<CryptoKey>; // non-extractable

export function generateRecoveryCode(): string;                  // formatted, 8 groups of 4
export function parseRecoveryCode(input: string): Uint8Array;    // throws VaultError('malformed-code')
export function recoveryCodeGroups(code: string): string[];      // the 8 groups, for the re-type check

export function wrapWithPassphrase(raw: Uint8Array, passphrase: string, uid: string, keyId: string, params?: Argon2Parameters): Promise<string>;
export function unwrapWithPassphrase(wrap: string, passphrase: string, uid: string, keyId: string): Promise<Uint8Array>;
export function wrapWithRecoveryCode(raw: Uint8Array, code: string, uid: string, keyId: string): Promise<string>;
export function unwrapWithRecoveryCode(wrap: string, code: string, uid: string, keyId: string): Promise<Uint8Array>;

export function encryptVaultField(text: string, key: CryptoKey, keyId: string, uid: string, ideaId: number, field: VaultField): Promise<string>;
export function decryptVaultField(value: string, key: CryptoKey, keyId: string, uid: string, ideaId: number, field: VaultField): Promise<string>;
export function vaultKeyIdOf(value: string | undefined): string | null; // null if not /^vault1:[0-9a-f]{8}:/
```

Error mapping:
- AES-GCM failure in `unwrapWithPassphrase` → `wrong-passphrase`; in `unwrapWithRecoveryCode` → `wrong-code`.
- An error with `code === 'crypto/argon2-unavailable'` from `deriveArgon2Key` → `argon2-unavailable`. Never report it as a wrong passphrase.
- `decryptVaultField`: keyId in the value differs from `keyId` → `other-vault`; anything else that fails (bad prefix, bad base64, AES failure, bad padding) → `damaged`.
- Malformed wrap strings → `damaged`.

### 5.2 `vaultSession.ts` (in-memory state, **no Firebase import**)

This file is imported by `helpers.ts` and `dekStore.ts`, and `helpers.ts` is pulled into every route through `IdeaContext`. If it imports Firebase, Firebase ends up in the marketing bundle. It may import `../platform` (already imported by `helpers.ts`).

```ts
export interface VaultSnapshot { unlocked: boolean; keyId: string | null; version: number }
export type LockReason = 'manual' | 'idle' | 'background' | 'signout' | 'reset' | 'other-tab';

export function getVaultSnapshot(): VaultSnapshot;   // same object until something changes (useSyncExternalStore needs that)
export function subscribeVault(listener: () => void): () => void;
export function setVaultUnlocked(key: CryptoKey, keyId: string, uid: string): void;
export function lockVault(reason: LockReason): void; // synchronous
export function requireVaultKey(): { key: CryptoKey; keyId: string; uid: string }; // throws VaultError('locked')
export function touchVault(): void;                  // pushes the idle deadline out
export type AutoLockMinutes = 1 | 5 | 15;
export function getAutoLockMinutes(): AutoLockMinutes; // localStorage 'vault_autolock_minutes', default 5, try/catch
export function setAutoLockMinutes(m: AutoLockMinutes): void; // also re-arms the timer
export function getCachedVaultLabel(cipher: string): string | undefined;
export function cacheVaultLabel(cipher: string, label: string): void; // bumps version + notifies
```

Behaviour:
- `lockVault` sets key/keyId/uid to null, **clears the label cache**, clears timers and listeners, bumps `version`, notifies. If reason is `manual` or `reset`, post `{ type: 'lock' }` on a `BroadcastChannel('intraconnected-vault')` (guard `typeof BroadcastChannel !== 'undefined'`). On receiving that message, call `lockVault('other-tab')` (which must not re-broadcast). Each tab unlocks on its own; unlocking is never broadcast.
- Idle: keep `idleDeadline = Date.now() + minutes*60_000`, refreshed by `touchVault()` and by `setVaultUnlocked`. A `setTimeout` fires `lockVault('idle')` at the deadline.
- Background: on `document.visibilitychange` to hidden, record `hiddenAt` and start a 60 s timer → `lockVault('background')`. On visible, clear that timer.
- Timers can be frozen while a phone app is suspended, so also check deadlines on wake: when the page becomes visible and from `onAppResume` (`utilities/platform.ts`), lock if `Date.now() >= idleDeadline` or `Date.now() - hiddenAt >= 60_000`.
- The label cache maps the **ciphertext string** (the stored `noteTitle`) to the plaintext label. Keying by ciphertext means an edit or a sync from another device automatically misses the cache instead of showing a stale label.

Hook it into sign-out: in `src/utilities/dekStore.ts`, `clearDEK()` must call `lockVault('signout')` as its **first** synchronous statement (before `_dek = null`). That covers sign-out, idle sign-out, account deletion and `SessionEndedModal`.

### 5.3 `vaultService.ts` (Firestore and orchestration)

Uses `db`, `auth` from `src/firebaseConfig.ts`. All functions throw `VaultError` for user-facing failures.

```ts
export async function loadVaultMeta(): Promise<VaultMeta | null>;
export async function prepareVaultSetup(passphrase: string): Promise<PendingVault>; // runs Argon2 + generates code, writes nothing
export async function commitVaultSetup(pending: PendingVault): Promise<void>;     // writes meta/vault, unlocks
export async function unlockVault(passphrase: string): Promise<void>;
export async function verifyRecoveryCode(code: string): Promise<VerifiedRecovery>; // returns raw VK holder; writes nothing
export async function prepareRecoveredVault(v: VerifiedRecovery, newPassphrase: string): Promise<PendingRewrap>; // new passphrase wrap + NEW recovery code
export async function changeVaultPassphrase(current: string, next: string): Promise<void>;
export async function prepareNewRecoveryCode(passphrase: string): Promise<PendingRewrap>;
export async function commitRewrap(p: PendingRewrap): Promise<void>;               // updateDoc, unlocks
export function discardPending(p: PendingVault | PendingRewrap | VerifiedRecovery): void; // zero raw bytes
export async function resetVault(): Promise<number>;                                 // returns notes deleted
export async function decryptVaultNote(idea: StandardIdea): Promise<{ label: string; secret: string; link: string }>;
export async function decryptMissingLabels(ideas: IdeaType[]): Promise<boolean>;    // true if it cached anything new
export async function saveVaultNote(id: number, next: { label: string; secret: string; link: string }, previous: { label: string; secret: string; link: string }): Promise<void>;
export async function buildVaultExport(): Promise<string>;                          // JSON text
```

Details:
- **`loadVaultMeta`**: `getDoc(doc(db,'users',uid,'meta','vault'))`. On success, write the doc's `v`, `keyId`, `passphraseWrap`, `recoveryWrap` to `localStorage['vault_meta_<uid>']` (JSON, try/catch) and return it; if the doc doesn't exist, remove that key and return `null`. If the read fails (offline), return the cached copy if there is one, otherwise throw `VaultError('offline')`. The cached wraps are ciphertext protected by Argon2id or a 160-bit code, the same exposure as the server copy, and caching them is what allows unlocking offline.
- **Setup is two steps on purpose.** `prepareVaultSetup` creates keyId, raw VK, both wraps and the code in memory. The UI shows the code with Copy and Download options; the user can continue without typing it back in. `commitVaultSetup` then writes. Use `runTransaction`: read `meta/vault`; if it exists throw `already-set-up`; else `set` it with `createdAt`/`updatedAt: serverTimestamp()`. Setup needs a connection; if offline, throw `offline`. After a successful write: `setVaultUnlocked(await importVaultKey(raw), keyId, uid)`, refresh the localStorage meta cache, zero the raw bytes.
- **`unlockVault`**: `loadVaultMeta()` (null → `not-set-up`), `unwrapWithPassphrase`, import non-extractable, zero raw, `setVaultUnlocked`.
- **Forgot passphrase**: `verifyRecoveryCode(code)` unwraps with the code (proves it's right before asking for a new passphrase). `prepareRecoveredVault` wraps the same raw VK with the new passphrase **and** with a brand-new recovery code (the old code is now spent, since the user just used it, maybe in an unsafe place). The UI shows the new code with Copy and Download options, then `commitRewrap` does `updateDoc(meta/vault, { passphraseWrap, recoveryWrap, updatedAt })`. Until that commit nothing changes, so closing midway leaves the old passphrase and code valid.
- **Change passphrase**: unwrap with `current` (wrong → `wrong-passphrase`), wrap with `next`, `updateDoc({ passphraseWrap, updatedAt })`, unlock. One step, no new code.
- **New recovery code**: unwrap with passphrase, generate code, wrap, return pending → UI shows code with Copy and Download options → `commitRewrap` writes only `recoveryWrap`.
- All `updateDoc` writes on `meta/vault`: if `navigator.onLine === false` throw `offline` before trying; wrap the write in a 15 s timeout and report `offline` on timeout. Partial failure is harmless because the VK never changes.
- **`resetVault`** (no unlock needed, works when the passphrase is lost):
  1. If offline, throw `offline`.
  2. `await deleteDoc(meta/vault)`. If this fails, stop and change nothing else.
  3. Remove `localStorage['vault_meta_<uid>']`, call `lockVault('reset')`.
  4. `const removed = deleteIdeasById(fetchFullIdeaList().filter(isVaultIdea).map(i => i.id))` (new ideaStore function, section 6).
  5. Clear the undo history so no Undo can bring back an unreadable vault note: add `clearUndo()` to `src/utilities/idea/undoStack.ts` if no equivalent exists, and call it.
  6. Return `removed.length`. The caller toggles `newIdeaSwitch`.
- **`decryptVaultNote`**: `requireVaultKey()`, decrypt the three fields in parallel, `cacheVaultLabel(idea.noteTitle, label)`, `touchVault()`.
- **`decryptMissingLabels`**: if locked return false. For each `isVaultIdea` whose `noteTitle` has no cached label and whose keyId matches the session's, decrypt just the label and cache it. Skip (don't throw) on `damaged`/`other-vault`. Return whether anything was added.
- **`saveVaultNote`**: `requireVaultKey()`. Build a patch with only the changed fields, each re-encrypted (`link` passes through `cleanLink` from `idea/helpers.ts` first; empty stays empty). Call the new `updateVaultFields(id, patch)` once (one outbox op, one Firestore write). Cache the new label. `touchVault()`.
- **`buildVaultExport`**: requires unlocked. Decrypt every vault note and return
  `JSON.stringify({ exportedAt, warning: "This file is NOT encrypted. Anyone who opens it can read these secrets.", vaultNotes: [{ label, secret, link, priority, path }] }, null, 2)`
  where `path` is the names of the ideas above it, top level first (use `resolveIdeaLabel` on ancestors).

Creation lives in `src/utilities/idea/creation.ts` next to the others:

```ts
export async function handleVaultCreation(label: string, parentID: number, secret: string, link: string, priority?: 1 | 2 | 3): Promise<boolean> {
    if (!canCreateIdea()) return false;
    const { key, keyId, uid } = requireVaultKey();
    const id = Date.now();
    const [noteTitle, content, encLink] = await Promise.all([
        encryptVaultField(label, key, keyId, uid, id, 'noteTitle'),
        encryptVaultField(secret, key, keyId, uid, id, 'content'),
        encryptVaultField(cleanLink(link), key, keyId, uid, id, 'link'),
    ]);
    createIdea({ id, content, parentID, link: encLink, isNote: true, isVault: true, noteTitle, ...(priority ? { priority } : {}) });
    cacheVaultLabel(noteTitle, label);
    touchVault();
    return true;
}
```

Callers `await` it, then toggle `newIdeaSwitch` and close the form. Plaintext never reaches `ideaStore`.

### 5.4 Hooks

- `useVaultState()` = `useSyncExternalStore(subscribeVault, getVaultSnapshot)`.
- `useVaultLabels(setNewIdeaSwitch, newIdeaSwitch)`: mounted **once** in `src/pages/Idea.tsx` (it covers the mobile view too, which is rendered inside `Idea.tsx`). Effect on `[snapshot.version, snapshot.unlocked, newIdeaSwitch]`: if unlocked, `decryptMissingLabels(fetchFullIdeaList())` and toggle `newIdeaSwitch` only if it returned `true` (this can't loop: the second pass finds nothing missing). Separately, when `unlocked` flips to `false`, toggle `newIdeaSwitch` once so every label goes back to "Vault note".

---

## 6. Data layer edits

| File | Change |
|---|---|
| `src/utilities/types.ts` | `StandardIdea`: add `isVault?: boolean; // set at creation (Vault tab); immutable. noteTitle/content/link hold vault1: ciphertext` |
| `src/utilities/idea/helpers.ts` | Add `export const VAULT_LABEL = 'Vault note';` and `export function isVaultIdea(idea: IdeaType \| undefined): idea is StandardIdea & { isVault: true }` (true when not a checklist and `isVault === true`). `resolveIdeaLabel`: check vault **first** and return `getCachedVaultLabel(idea.noteTitle ?? '') \|\| VAULT_LABEL`. `getIdeaLink`: return `''` for vault ideas (the stored link is ciphertext; only the vault panel opens the real one). `isNoteWide`: `false` for vault ideas (normal card width). |
| `src/utilities/sync/syncEngine.ts` | `decodeIdea`, standard branch: add `...(data.isVault === true ? { isVault: true } : {}),`. **Required**: without it the flag is lost on every pull. Nothing else changes. |
| `src/utilities/sync/outbox.ts` | No change. `encryptIdea` already spreads every plain field (so `isVault` is sent) and encrypts `noteTitle`/`content`/`link`. |
| `src/utilities/sync/ops.ts` | No change. `IdeaPatch` has no `isVault`, which is what keeps it immutable; a test locks that in. |
| `src/utilities/idea/ideaStore.ts` | Add `updateVaultFields(id, patch: { content?: string; noteTitle?: string; link?: string })` → `commit({ kind: 'update', id, patch })`. Add `deleteIdeasById(ids: number[]): IdeaType[]` (local removal + delete ops in chunks of `DELETE_CHUNK_SIZE`, returns removed ideas; reuse the code in `recursivelyDeleteChildren`). |
| `src/utilities/dekStore.ts` | `clearDEK()`: first line `lockVault('signout');`. |
| `src/utilities/idea/search.ts` | First line of both `searchIdeas` and `suggestedIdeas`: `ideas = ideas.filter((idea) => !isVaultIdea(idea));`. |
| `src/utilities/idea/copyText.ts` | `childLine`: vault child → `'[Vault note]'`. `ideaCopyText`: vault → `''` (callers never use it for vault, see below). |
| `src/utilities/idea/exporters.ts` | `buildIdeaTree`: drop vault ideas before building (`ideas.filter(i => !isVaultIdea(i))`). That covers Markdown, OPML and the JSON importer's tree. |
| `src/components/modals/ProfileModal.tsx` → `handleExportData` | JSON export: `ideas: fetchFullIdeaList().filter(i => !isVaultIdea(i))`. |
| `src/utilities/idea/importers.ts` → `parseIntraconnectedJson` | Filter `isVault` entries out of `list` before `buildIdeaTree` (belt and braces; a test covers it). |
| `src/pages/Idea.tsx` URL handling | In both places that accept an id from the address (`readIdeaFromUrl` on load and `onPopState`), treat an id that belongs to a vault idea as missing. |

---

## 7. UI changes, every touch point

Shared rule: anything that shows a vault note's label calls `resolveIdeaLabel` (cached label when unlocked, "Vault note" when locked). Nothing outside `VaultNotePanel`, `VaultCreateFields` and the export ever shows the secret or link.

### 7.1 Context (`src/context/IdeaContext.tsx`)

Add:
```ts
vaultNote: { id: number; mode: 'view' | 'edit' } | null;   setVaultNote(...)
profileTabRequest: 'vault' | null;                          setProfileTabRequest(...)
```
`ProfileModal`: when it opens with `profileTabRequest` set, select that tab (desktop `activeTab`, mobile `mobileView`) and clear the request. Helper used everywhere a "Set up vault" or "Forgot passphrase?" button appears: close the current modal/sheet, `setProfileTabRequest('vault')`, `setProfileModalOpen(true)`.

### 7.2 Desktop card (`src/components/IdeaNode.tsx`)

- `const vault = isVaultIdea(idea);` and `const { unlocked } = useVaultState();`.
- For a vault idea, `censored` is treated as `false`.
- Add a `vault` branch **before** the `if (veiled)` branch, after the drag-and-drop setup (keep the same `ref`, `style`, `attributes`, `dragListeners`, `onContextMenu`, `data-idea-id`, priority ribbon and ⋯ button as the other branches):
  - Classes: `neobrutal-button ideaNode note ideaNode--vault` plus the fade/priority classes.
  - Click and Enter → `setVaultNote({ id, mode: 'view' })`.
  - Body: `LockIcon` (locked) or `UnlockIcon` (unlocked) from `Icons.tsx`; the label (`resolveIdeaLabel(idea)`); a masked line `••••••••` (`aria-hidden`); a hint: locked "Locked · click to unlock", unlocked "Click to open".
  - `canAcceptDrop` is already false (it's a note).

### 7.3 Card menu (`src/components/CardMenu.tsx`)

For a vault idea, the menu is exactly: **Open vault note** (Enter) → view; **Edit vault note** (R) → edit; **Move to…** (M); the Priority chips; **Delete** (D). No rename, link, copy or censor items.

### 7.4 Actions (`src/utilities/idea/useIdeaActions.ts`)

- `openIdea(id)`: vault → `setVaultNote({ id, mode: 'view' })`.
- `renameIdea(id)`: vault → `setVaultNote({ id, mode: 'edit' })` (so F2/R and the card title never open `RenameModal` for a vault note).
- `copyIdea(id)` (also Ctrl/Cmd+C): vault → `showNotice('Open the vault note to copy its secret')`, copy nothing.
- Delete, move and priority need no change. Toast names come from `shortName` → `getNameFromID` → `resolveIdeaLabel`, so they say "Vault note" when locked.

### 7.5 Desktop modal (`VaultNoteModal.tsx`, mounted in `Idea.tsx` next to the other modals, only when `!isMobileUI`)

`<AnimatedOverlay open={vaultNote !== null} onEscape={close}>` around `<div className="modal neobrutal confirmModal vaultModal">` containing `<VaultNotePanel ideaId={…} initialMode={…} onClose={close} onOpenVaultSettings={…} />`. Add `.vaultModal` to the `min-height: auto` rule at all three breakpoints (CLAUDE.md "Modal min-height").

### 7.6 `VaultNotePanel.tsx` (shared)

Props: `ideaId`, `initialMode`, `onClose`, `onOpenVaultSettings`, optional `onDirtyChange(dirty: boolean)`.

States, in order of precedence:
1. Idea missing (deleted elsewhere) → call `onClose`.
2. Vault not set up (`loadVaultMeta()` returned null) → "This vault note belongs to a vault that was reset, so it can't be opened." + **Delete** (via `useIdeaActions().requestDelete` on desktop or the `requestDelete` prop on mobile) + **Close**.
3. Locked → `<VaultUnlockForm onUnlocked={…} onForgot={onOpenVaultSettings} />`.
4. Unlocked, note's keyId ≠ session keyId, or decrypt throws `damaged` → the same "can't be opened" message as in 2 (for `damaged`: "This vault note is damaged and can't be opened."), with Delete and Close.
5. **View**: heading = label. Link row (only if the link is non-empty): the address as text, **Open** (`openIdeaLink`), **Copy**. Secret: masked `••••••••••••` with **Reveal**/**Hide** and **Copy**; when revealed, show it in a `<pre className="vault-secret">` (wraps, selectable). Buttons: **Edit**, **Lock vault** (`lockVault('manual')`), **Close**.
6. **Edit**: label `<input maxLength={100}>` (required), secret `<textarea maxLength={2000}>`, link `<input>` (placeholder "Site address (optional)"). **Cancel** returns to view; **Save** → `saveVaultNote` → `setNewIdeaSwitch(prev => !prev)` → view. Report dirty state through `onDirtyChange`.

Rules: plaintext lives only in this component's state. Subscribe with `useVaultState()`: when the vault locks, wipe the plaintext state and show the unlock form. Reveal resets each time the panel opens. Call `touchVault()` on open, Reveal, Copy, Edit and Save. Copy uses `navigator.clipboard.writeText` and shows "Copied" feedback, the same style as the existing checklist copy buttons. On error show "Couldn't copy to the clipboard".

Inputs: no autofill of the account password into vault fields. The passphrase field uses `type="password"`, `autoComplete="off"`, `name="vault-passphrase"`, `data-1p-ignore`, `data-lpignore="true"`. Setup and change-passphrase "new" fields use `autoComplete="new-password"`. The secret textarea uses `autoComplete="off"` and `spellCheck={false}`.

### 7.7 `VaultUnlockForm.tsx`

A form with one passphrase field and **Unlock**. While unlocking (Argon2 takes about a second) show the existing spinner style (`.authSpinner` from `Auth.tsx`'s styles or an equivalent) and disable the button. Error text:

| code | text |
|---|---|
| wrong-passphrase | That passphrase doesn't match. |
| argon2-unavailable | The vault's security module couldn't load. Reload the page and try again. |
| offline | Connect to the internet to unlock your vault on this device for the first time. |
| not-set-up | You haven't set up your vault yet. (with a **Set up vault** button) |

Below the button, a text button **Forgot passphrase?** → `onForgot`.

### 7.8 Desktop Create modal (`src/components/modals/CreationModal.tsx`)

- Tabs become `'idea' | 'checklist' | 'note' | 'vault'`; add a **Vault** tab button after Note (`creation-tab--vault`).
- Add prop `handleVaultCreation` (wire it in `Idea.tsx` where the other three are passed).
- **Text never crosses into or out of the vault tab.** In `switchTab`, skip the `masterContentRef` carry-over when either the old or new tab is `'vault'`, and never write vault fields into `masterContentRef`. Otherwise a secret would flow into a plain idea.
- Vault panel content (`VaultCreateFields`): if the vault isn't set up, a short explainer + **Set up vault** button (opens Profile → Vault, closing this modal). If locked, `VaultUnlockForm` inline. If unlocked: label (placeholder "Name, e.g. Bank login", maxLength 100), secret (placeholder "Password or secret", maxLength 2000), link (placeholder "Site address (optional)").
- The priority picker applies as on the other tabs.
- Create button for the vault tab: disabled until the label is non-empty and the vault is unlocked; while `await handleVaultCreation(...)` runs, disable it; on `true`, close, toggle `newIdeaSwitch`, `reset()`.
- `reset()` clears the vault fields. `recomputePanelHeight` gets a `'vault'` branch measured like the note branch (sum of the section's children natural heights plus gaps).
- Ctrl/Cmd+Enter in the secret field creates, like the note body.

### 7.9 Profile → Vault (`ProfileModal.tsx` + `VaultSettings.tsx`)

- `type Tab` gains `'vault'`. Insert into `TABS` after `data`: `{ id: 'vault', label: 'Vault', desc: 'Passphrase, recovery code and auto-lock for vault notes' }`. It appears in both the desktop sidebar and the mobile tab list automatically. Give `.profile-tab--vault` a colour in `profileModal.scss` following the pattern of the other tabs.
- `tabContent.vault = <VaultSettings />`.
- In the Data tab, under "Export Your Data", add one line: "Vault notes are left out. Export them from the Vault tab while it's unlocked."

`VaultSettings` screens (calls `loadVaultMeta()` when shown; show a spinner while loading):

**Not set up**
- Text: see 13.4 "Intro".
- If any vault ideas exist anyway (a vault reset on another device), show: "You have N vault notes from an old vault. They can't be opened. Reset vault removes them." and show the Reset section.
- **Set up vault** → step 1.

**Setup step 1 (passphrase)**: two password fields ("Vault passphrase", "Type it again"); **Continue** enabled when both are non-empty and equal; on Continue → `prepareVaultSetup` (spinner).

**Setup step 2 (recovery code)**: `RecoveryCodeCard` with the code. **Copy**, **Download** (`downloadFile` from `utilities/download.ts`, filename `intraconnected-vault-recovery-code.txt`, contents in 13.4). Then: "To make sure you saved it, type group X and group Y." Pick two different random group numbers (1–8) once per screen. Two inputs, compared after normalising (uppercase, `O`→`0`, `I`/`L`→`1`). **Finish setup** enabled only when both match → `commitVaultSetup`. **Back** discards (`discardPending`).

**Set up, locked**: `VaultUnlockForm`, then the always-available sections below.

**Set up, unlocked**: "Your vault is unlocked." + **Lock now**, then the sections below.

Always-available sections (when set up):
1. **Auto-lock**: three chips "1 min", "5 min", "15 min" (current one highlighted) → `setAutoLockMinutes`. Text: "Locks after this long without using a vault note, and when the app is in the background for a minute. This setting is per device."
2. **Change passphrase**: current, new, new again → `changeVaultPassphrase`.
3. **New recovery code**: passphrase → `prepareNewRecoveryCode` → `RecoveryCodeCard` with the same check → `commitRewrap`. Text: "Your old recovery code will stop working."
4. **Forgot passphrase?**: recovery code input → `verifyRecoveryCode` → new passphrase ×2 → `prepareRecoveredVault` → `RecoveryCodeCard` (new code) with the check → `commitRewrap`.
5. **Export vault notes** (enabled only when unlocked): warning text from 13.4 → `buildVaultExport` → `downloadFile(json, 'application/json', 'intraconnected-vault-export-YYYY-MM-DD.json')`.
6. **Reset vault** (danger styling, like Delete Account): text from 13.4 with the live count of vault notes; input with placeholder `Type "RESET" to confirm`; **Reset vault** button (class `danger`) enabled only when the input is exactly `RESET` → `resetVault()` → toggle `newIdeaSwitch` → show "Vault reset. N vault notes deleted." and return to the Not set up screen.

Error text for any `offline` failure: "You're offline. Connect to the internet and try again." For `wrong-code`: "That recovery code doesn't match." For `malformed-code`: "That doesn't look like a recovery code. It has 32 letters and numbers." For `already-set-up`: reload the meta and show the locked screen.

`ProfileModal.handleClose` must reset `VaultSettings` to its first screen (unmounting it is enough) and must zero any pending secrets (`discardPending` on unmount).

### 7.10 Mobile (`src/components/mobile/`)

`mobileTypes.ts`: add `| { type: 'vault'; nodeId: number; mode: 'view' | 'edit' }` to `SheetState`.

`MobileMindMap.tsx`:
- `createTab` union gains `'vault'`; add a **Vault** tab button after Note (`mmobile-create-tab--vault`, `setNameFlash(0)` like the others). The panel uses `VaultCreateFields` (same three states as desktop). `commitCreate`: vault branch, label required (`flashMissingName()` otherwise), `await handleVaultCreation(label, currentId, secret, link, newIdeaPriority)`, then toggle `newIdeaSwitch` and `closeSheet()`. Do not carry text between the vault tab and the other tabs.
- `tapNode`: before the existing `isNoteMode` check (around line 964), vault → `setSheet({ type: 'vault', nodeId, mode: 'view' })`.
- `openEditSheet(node)`: first line, vault → `setSheet({ type: 'vault', nodeId: node.id, mode: 'edit' })` and return. This covers swipe → edit and actions → Edit.
- Actions sheet: hide the whole Copy row for vault ideas.
- Row rendering (the `noteMode ? … : …` block around line 1735): add a vault branch first: `LockIcon`/`UnlockIcon`, `resolveIdeaLabel(child)`, a masked `••••••`; `colorClass` `mmobile-node--vault`. Same for the drag ghost (around line 1805).
- Sheet title: `'New vault note'` for the create tab; `'Vault note'` for the vault sheet.
- Render `<VaultNotePanel ideaId={sheet.nodeId} initialMode={sheet.mode} onClose={closeSheet} onOpenVaultSettings={…} onDirtyChange={…} requestDelete={requestDelete} />` for `sheet.type === 'vault'`. Store dirty state in a ref; `isSheetDirty()` returns it for vault sheets, so swipe-down/Back/scrim ask "Discard what you typed?" like the other sheets.
- Mobile inputs must be at least 16px (existing rule).

`MobileMoveSheet`, `MobileMindMapSheet`, `MobileSearchSheet`: no change needed (notes are already excluded as targets; labels come from `resolveIdeaLabel`; search filters vault). Check each once.

### 7.11 Other places to check (expected: no change)

`MindMap.tsx` (label via `resolveIdeaLabel`, click does nothing for notes, not a drop target), `Breadcrumb.tsx` (a vault note can never be the current level), `MoveModal.tsx` (notes excluded as targets; moving name via `resolveIdeaLabel`), `DeleteConfirmModal.tsx` (vault notes have no children, so they're deleted at once and never reach it), `UndoToast`/`MobileUndoToast` (labels via `shortName`), `sortIdeas`/`mapLens` (priority and id only). Open each and confirm. Fix anything that reads `.content`, `.noteTitle` or `.link` of a vault idea directly.

### 7.12 Styles (`src/styles/vault.scss`, imported where the vault components are)

- Add `$vault: #3B4252;` and `$vault-ink: #FFFFFF;` to `variables.scss`. Vault cards and mobile rows use them (white text on the dark slate meets 4.5:1). Keep the neobrutal border/shadow of other cards.
- Masked text uses a monospace stack and letter-spacing.
- Follow existing breakpoints (`$mobile-ui` for touch-UI rules).

### 7.13 Help

If a help screen or `MobileHelpSheet` lists the kinds of ideas (search `src/components/helpMenus`, `helpScreens.ts`, `MobileHelpSheet.tsx` for "Note"), add: "Vault note: for passwords and secrets. Locked with a separate passphrase that only you know." No new keyboard shortcuts, so `ShortcutsModal` doesn't change.

---

## 8. Tests (vitest, `environment: 'node'`, follow existing test style)

`src/utilities/vault/vaultCrypto.test.ts`
- Passphrase wrap round trip (use small Argon2 params, for example `{ m: 32, t: 1, p: 1 }`, like `crypto.test.ts`); wrong passphrase → `wrong-passphrase`; wrong uid or keyId (AAD) → `wrong-passphrase`.
- An account-style `v3:argon2id:` wrap of the same key bytes does **not** unwrap as a vault wrap (AAD/prefix separation).
- Recovery code: 32 chars, 8 groups; `parseRecoveryCode` accepts lowercase, spaces, missing hyphens, `O`/`I`/`L` substitutions; rejects `U`, wrong length. Recovery wrap round trip; wrong code → `wrong-code`.
- Field round trip for all three fields including empty string and 2000 characters; padding hides lengths inside a bucket (two different short texts give equal-length ciphertext); moving ciphertext to another idea id or field → `damaged`; a different keyId → `other-vault`.
- `argon2-unavailable` is reported when `hash-wasm` import fails (mock it), not `wrong-passphrase`.

`src/utilities/vault/vaultSession.test.ts` (fake timers, stub `document`/`localStorage` like other tests)
- Unlock then idle deadline locks; `touchVault` extends it; `setAutoLockMinutes` re-arms.
- Hidden 60 s locks; visible before 60 s doesn't. Wake-up check locks if the deadline passed while timers were frozen.
- `lockVault` clears the label cache and notifies; snapshot identity changes only on change.
- `clearDEK()` locks the vault (import `dekStore` with its dependencies mocked).

`src/utilities/vault/vaultService.test.ts` (mock `firebase/firestore` and `../../firebaseConfig`)
- Setup writes nothing until `commitVaultSetup`; commit refuses when the doc exists.
- `loadVaultMeta` falls back to the localStorage copy when `getDoc` rejects, and throws `offline` with no copy.
- Reset deletes `meta/vault` first and touches no idea when that fails; on success removes exactly the vault ideas.
- `saveVaultNote` sends one update containing only changed fields.

Existing test files, add cases:
- `ops.test.ts`: an update op leaves `isVault` untouched; `// @ts-expect-error` on an `IdeaPatch` with `isVault`.
- `ideaStore.test.ts`: `updateVaultFields` is one op; `deleteIdeasById` chunking.
- `search.test.ts`: vault notes never match (even when the query equals the ciphertext) and never appear in suggestions.
- `exporters.test.ts`: Markdown and OPML omit vault notes.
- `importers.test.ts`: JSON with a vault entry imports without it.
- `helpers.test.ts`: `resolveIdeaLabel` returns "Vault note" when not cached and the label when cached; `getIdeaLink` is `''` for vault.
- Double encryption: `encryptField(vaultCipher, dek, aad)` then `decryptField` returns the identical `vault1:` string (add to `vaultCrypto.test.ts`, mocking `cryptoConfig` like `crypto.test.ts`).
- A normal idea whose content starts with `vault1:` still goes through `encryptField` and renders as text (`resolveIdeaLabel` returns it unchanged because `isVault` is not set).
- `netlify/tests/firestore-rules.test.ts`: the `meta/{metaDocId}` rule does not exclude `vault` (assert the rules text has no `'vault'` exclusion).

No component test framework exists in this repo; do not add one. Verify the UI by hand (section 10).

---

## 9. Order of work (each step ends green: typecheck, lint, test)

1. `crypto.ts` exports, `vaultCrypto.ts` + tests.
2. `vaultSession.ts` + tests, `clearDEK` hook-up.
3. Data layer edits from section 6 + their tests.
4. `vaultService.ts`, `handleVaultCreation`, hooks + tests.
5. Desktop: context fields, `IdeaNode`, `CardMenu`, `useIdeaActions`, `VaultUnlockForm`, `VaultNotePanel`, `VaultNoteModal`, Create modal tab, styles.
6. Profile → Vault (`VaultSettings`, `RecoveryCodeCard`) and the Data tab note.
7. Mobile.
8. Help line, docs and copy (section 12–13), changelog icon.
9. Full check: `npm run typecheck && npm run lint && npm test && npm run build && npm run build:native`.

## 10. Manual checks (run `npm run dev`; report which ones you did)

1. Set up a vault, see the code, fail the re-type check, pass it. `meta/vault` exists in Firestore with `vpw1:`/`vrc1:` values.
2. Create a vault note on desktop. In Firestore the idea has `isVault: true` and `enc2:` values; `localStorage.ideas` shows `vault1:` values, never the label or secret.
3. Lock now: card shows "Vault note" and the lock icon; opening it asks for the passphrase.
4. Wrong passphrase message; right one opens; Reveal, Copy secret, Open link, Edit and Save all work.
5. Auto-lock at 1 minute; background lock (switch tabs for over 60 s); second tab locks on Lock now in the first.
6. Search for the label: no result. Export Markdown/JSON: no vault note. Export vault notes: decrypted JSON.
7. Move a vault note, delete it, Undo: still opens.
8. Change passphrase; new recovery code; Forgot passphrase with the code (gives a new code; the old code no longer works).
9. Reset vault with `RESET`: notes gone, setup screen back.
10. Mobile layout (narrow window with touch emulation): create via the Vault tab, tap to open, swipe → edit, actions sheet has no Copy row, Back closes the sheet.
11. Sign out and back in: vault is locked; vault notes still open with the passphrase.

---

## 11. Why nothing else needs to change

- `firestore.rules`: `meta/vault` is covered by the existing owner-only `meta/{metaDocId}` rule; idea docs are unchanged; the free-plan counter is unchanged.
- CSP: Argon2id already loads through `hash-wasm` and `'wasm-unsafe-eval'` is already allowed in both policies.
- `delete-account.ts` already deletes the whole `meta` collection (includes `vault`), and the client clears `localStorage` (includes `vault_meta_*` and `vault_autolock_minutes`).
- Native apps: the vault key is in memory only, so there is no Keychain/Keystore work. App backgrounding is handled by the visibility and resume checks in 5.2. Check on a device later that backgrounding for over a minute locks the vault; if `visibilitychange` doesn't fire in a WebView, add an `onAppPause` helper to `platform.ts` (next to `onAppResume`) and use it in `vaultSession.ts`.

## 12. Documentation to update

**`CLAUDE.md`**: add this section after "Client-side encryption":

```md
### Vault notes (`src/utilities/vault/`, `src/components/vault/`)
A note type for secrets. `isVault: true` (always with `isNote: true`, immutable, leaf only). `noteTitle` (label), `content` (secret) and `link` hold `vault1:<keyId>:<base64>` ciphertext made with a separate vault key (AES-256-GCM, AAD `uid|ideaId|vault.<field>`, padded); the outbox then encrypts that string again like any field, so `outbox.ts`/`syncEngine.ts` have no vault logic (except `decodeIdea` carrying `isVault`). Only interpret `vault1:` on ideas with `isVault`.
- Key: random 256-bit, wrapped in `meta/vault` by the vault passphrase (`vpw1:`, Argon2id, AAD `intraconnected-vault-key|uid|keyId`) and by a 160-bit recovery code (`vrc1:`, HKDF). We never see either, and KMS recovery can't open vault notes. In memory only, non-extractable (`vaultSession.ts`, which must not import Firebase). Locks after 1/5/15 min without vault use, 60 s in the background, Lock now, and in `clearDEK()`.
- Changing the passphrase or code re-wraps the same key; only Reset vault (Profile → Vault, type RESET) makes a new one and deletes all vault notes.
- Text stays opaque everywhere else: `resolveIdeaLabel` returns the cached label or "Vault note", `getIdeaLink` returns `''`, search/export/import skip vault notes, copy never copies a secret. Only `VaultNotePanel`, `VaultCreateFields` and "Export vault notes" handle plaintext.
- Copy may say "we can't read vault notes" (and only about vault notes); never "end-to-end".
```

Also in `CLAUDE.md`: add `isVault?: boolean` to the `StandardIdea` block under "Idea Data Shape", and in "Client-side encryption" add one sentence: "Vault notes are the exception: see Vault notes."

**`programmer-docs/CHANGELOG.md`**: new entry at the top. Use the next version after the current top entry (it is `V 1.10` at the time of writing, so `V 1.11` unless a newer one exists):

```md
## V 1.11 | Vault Notes
image: /images/Lock.svg
A new kind of note for passwords and other secrets. Vault notes get a second lock, a passphrase only you know, so not even we can read them. The vault locks itself when you step away.
```

**`programmer-docs/DEVLOG.md`**: new entry at the top, the usual style: `## Vault Notes — <date>`, the first line says what passed (typecheck, lint, N tests, build, build:native) and **not deployed**, then 4–6 bullets: formats, files, the double-encryption point, the `decodeIdea` change, anything you decided yourself, and what still needs a device check.

**Memory**: none (the owner's agent keeps that).

## 13. Public and in-app copy (approved drafts)

The owner approved drafting this copy into the plan. **Show the owner the final Privacy, Terms and Support diffs and wait for explicit approval before treating the feature as done.** `Privacy.tsx` and `Terms.tsx` may have uncommitted edits; add to them, don't overwrite them.

### 13.1 Privacy (`src/pages/Privacy.tsx`, "How Your Data Is Protected" list, new `<li>` after the KMS recovery item)

> Vault notes get a second layer of encryption. Their name, text and link are encrypted on your device with a separate vault key before the encryption described above is applied. The vault key is protected by your vault passphrase and by a recovery code that only you are shown. We never receive your vault passphrase, your recovery code or the vault key, and our key recovery system cannot unlock vault notes, so we cannot read them. Which ideas are vault notes, where they sit in your map, their priority and their approximate size are not hidden. The web app is delivered by our servers each time you open it, so this protection relies on that code working as described; in the mobile apps, the code is fixed when the app is installed or updated. If you forget your vault passphrase and lose your recovery code, no one, including us, can open your vault notes.

Also, where Privacy describes export (around "You can choose Markdown or OPML…"), add: "Vault notes are not included in these exports; you can export them separately from Profile → Vault while your vault is unlocked, and that file is not encrypted."

### 13.2 Terms (`src/pages/Terms.tsx`, Section 4 "Encryption and Data Loss", new paragraph at the end of the section)

> **Vault notes.** Vault notes are encrypted with a key protected by a passphrase and a recovery code that we never receive. We cannot recover vault notes or reset a vault passphrase for you. If you lose both your vault passphrase and your recovery code, your vault notes cannot be opened again, and the only option is to delete them with Reset vault. You are responsible for keeping your recovery code safe.

### 13.3 Support (`src/pages/Support.tsx`, new question near the existing account recovery question)

> **I forgot my vault passphrase.**
> Open Profile, then Vault, and choose "Forgot passphrase?". Enter the recovery code you saved when you set up the vault, then choose a new passphrase. You'll get a new recovery code. If you don't have the recovery code either, we can't open your vault notes for you: they're locked with a key we never receive. You can delete them and start again with Reset vault.

### 13.4 In-app strings

- **Intro (not set up)**: "Vault notes are for passwords and other secrets. They get a second lock: a vault passphrase that only you know. We never receive it, so we can't read your vault notes, and we can't help you back in if you forget it."
- **Step 1**: "Choose a vault passphrase. It's separate from your account password. There's no way for us to reset it, so pick something you'll remember."
- **Step 2**: "This is your recovery code. If you forget your vault passphrase, it's the only way back in. Save it somewhere safe outside this app, such as a password manager or on paper. It won't be shown again."
- **Re-type check**: "To make sure you saved it, type group {X} and group {Y}."
- **Download file contents**:
  ```
  Intraconnected vault recovery code
  Account: {email}
  Created: {YYYY-MM-DD}

  {CODE}

  Use this code in Profile > Vault > Forgot passphrase? if you forget your vault passphrase.
  Anyone with this code and access to your account can open your vault notes. Keep it private.
  ```
- **Export warning**: "This downloads your vault notes as a file that is not encrypted. Anyone who opens the file can read them."
- **Reset**: "Reset vault deletes all {N} vault notes and lets you start over with a new passphrase. Only do this if you've lost both your passphrase and your recovery code. This can't be undone."
- **Card hints**: "Locked · click to unlock" / "Click to open". Mobile rows: no hint, just the lock icon.

## 14. Final report to the owner

When done, report: what passed (with the test count); which manual checks you ran; every place you deviated from this plan and why; the Privacy/Terms/Support diffs for approval; and these open items for the owner:
- Check on a real phone that backgrounding locks the vault (section 11).
- Re-check the App Store encryption questionnaire answer now that vault notes add a passphrase-protected layer (no code change made).
- Add the feature to the launch checklist artifact if wanted.
