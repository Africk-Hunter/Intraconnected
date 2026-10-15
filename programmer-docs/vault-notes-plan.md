# Plan: Vault notes (shelved, build later)

Audience: a coding agent working in this repo. **Do not start until the owner says so.** Read `CLAUDE.md` first; its rules apply (no git commits unless told, no emojis, never "end-to-end", `DEVLOG.md` updates, `npm run typecheck && npm run lint && npm test && npm run build` before done).

Depends on `programmer-docs/encryption-phase0-and-kms-recovery-plan.md` being shipped first, specifically: the context-bound `enc2:` helper (AES-GCM with AAD), the Argon2id loader and the `'wasm-unsafe-eval'` CSP change, and the non-extractable key patterns. Reuse them; do not build a second copy.

## What it is

A new note type for secrets such as passwords. Its text is encrypted with a separate **vault key** that is protected by a vault passphrase and a recovery code. We never hold a copy of either, so we cannot read vault notes. Everything else in the app keeps working exactly as now. Product, Privacy and Terms wording is the owner's decision (see "Wording").

## Product decisions already taken

- Immutable at creation, like `isNote`: ideas and vault notes never convert.
- Leaf only: a vault note cannot have children and cannot receive drops.
- Separate passphrase from the account password, on purpose, so an email password reset never touches the vault.
- Losing both passphrase and recovery code loses the vault contents only. Offer an explicit "Reset vault" that deletes vault notes and starts a new key.
- Free plan: vault notes count toward the 50-node cap like any idea.
- No structured fields in the first version: label, secret body, optional site link.
- No children, no import creation, no checklist variant.

## Data model

`src/utilities/types.ts`: add `isVault?: boolean` to `StandardIdea`. `noteTitle` holds the label and `content` the secret body (same shape as notes); `link` holds an optional site. All three hold **vault ciphertext**, not text.

Keep `isVault` immutable: make sure no patch type in `sync/ops.ts` (`IdeaPatch`, `applyOpLocally`) can change it after creation.

### Double encryption (this is the key design choice)

Encrypt vault fields with the vault key first (`vault:<keyId>:<base64>`, AAD = `uid|ideaId|fieldName`), then let the existing outbox encrypt that string again with the account key (`enc2:`). This needs **no special case** in `outbox.ts` or `syncEngine.ts`: after the normal decrypt, a vault field is still the opaque `vault:` string. It also means the local `ideas` cache in `localStorage` holds only vault ciphertext, never vault plaintext. Do not skip the outer encryption based on a text prefix: a normal idea whose text starts with `vault:` would then be stored unencrypted. Interpret `vault:` values only for ideas with `isVault === true`.

## Keys and storage

New document `users/{uid}/meta/vault`:

```
{
  v: 1,
  passphraseWrap: "v3:argon2id:...",     // vault key, wrapped by the passphrase (same format as the account password wrap)
  recoveryWrap:   "rc1:<base64(iv+ct)>", // vault key, wrapped by the recovery code
  createdAt: serverTimestamp()
}
```

- The vault key (VK) is a random 256-bit AES-GCM key. It is held **in memory only**, as a non-extractable `CryptoKey`. Never write it to `sessionStorage`, IndexedDB, the Keychain or `localStorage`.
- Recovery code: at least 128 bits, shown as groups of Crockford base32 (for example 26 characters in groups of 5 or 6). Derive the wrapping key with HKDF-SHA-256 (the code is high entropy, so no slow KDF), `salt = uid`, `info = "intraconnected-vault-recovery-v1"`.
- Passphrase: minimum length 12 and a simple strength meter (no new dependency unless the owner approves). Argon2id with the same parameters constant as the account wrap.
- Changing the passphrase re-wraps the VK (cheap). Forgot passphrase: enter the recovery code, set a new passphrase, re-wrap. Generate a new recovery code on that path and show it again.
- The server never sees VK, the passphrase or the code. `meta/vault` fits the existing `meta/{metaDocId}` owner rule; add a case to `netlify/tests/firestore-rules.test.ts`. `delete-account.ts` already wipes `meta`; confirm it includes `vault`.

New module `src/utilities/vault/` with `vaultStore.ts` (in-memory VK, lock/unlock, timers), `vaultCrypto.ts` (wrap, unwrap, recovery code generate/encode/derive, `encryptVaultField`, `decryptVaultField`), tests alongside.

### Locking

Lock (drop VK from memory) on: manual lock, idle timeout inside the vault (default 5 minutes; choices 1, 5, 15), page hidden for 60 seconds, `clearDEK()`, idle sign-out, sign-out. Add the vault lock to `clearDEK()` so it happens in the same synchronous step as the in-memory key clear.

## Creating and using vault notes

- First use: setup wizard: choose a passphrase, show the recovery code once, require the user to re-type some groups of it to continue (a typed check that they saved it), then create `meta/vault`.
- Creation: `handleVaultCreation` in `src/utilities/idea/creation.ts`, beside `handleNoteCreation`; it must check `canCreateIdea()`. It encrypts the three fields with VK, then calls the normal `ideaStore` create. The UI never passes vault plaintext to `ideaStore`.
- Desktop: add a Vault option to the Create modal. Mobile: add a Vault tab to the `create` sheet next to Idea / Checklist / Note (`src/components/mobile/`), plus `mobileTypes.ts` if the sheet state needs it.
- Card (`IdeaNode.tsx`): locked state shows a lock icon and "Vault note" with no label. Unlocked shows the label; the body stays masked (dots) until Reveal. Reveal, copy and edit all require the vault to be unlocked, otherwise open the unlock prompt.
- Copy: `navigator.clipboard.writeText`, then write an empty string after about 30 seconds. Check this works in the Capacitor WebViews; if not, note it rather than adding a plugin without asking.
- Edit: decrypt, edit in a local field, re-encrypt on save. Rename flows (`currentNameChangeId`, `updateIdeaName`) must route vault notes through the vault editor, not the plain rename modal.
- Delete and move go through `useIdeaActions()` as usual. Toasts and confirmation modals that print an idea's name must print "Vault note" for vault ideas.

## Everywhere the text must stay opaque (audit checklist)

Search the codebase for places that read `idea.content`, `noteTitle` or `link` and make each treat vault ideas as opaque. Add a single helper `displayText(idea)` (returns a lock label for vault ideas) and use it. At minimum:

- `src/utilities/idea/search.ts` and both search UIs: exclude vault fields (matching on ciphertext would be meaningless and leaky).
- `MindMap.tsx`, `MobileMindMapSheet`, `Breadcrumb.tsx`, `MoveModal`, `MobileMoveSheet`, `DeleteConfirmModal`, `UndoToast`, `MobileUndoToast`, `CardMenu`, `useIdeaActions` copy action, `suggestedIdeas`.
- Exporters (`idea/exporters.ts`, JSON export in `ProfileModal`): exclude vault notes by default. Provide a separate "Export vault" action, enabled only while unlocked, with a warning that the file is decrypted.
- Importers (`idea/importers.ts`, `importIdeas.ts`): never create vault notes; strip an imported `isVault`.
- `sortIdeas`, priority and links: priority is allowed; do not call `openIdeaLink` on vault ciphertext.
- Mobile rows in `MobileMindMap` and `SortableMobileChecklistItem` n/a, but check the row renderer for notes.
- Help, Shortcuts and patch notes copy.

## Sync and rules

No change to the outbox or `syncEngine` thanks to double encryption, other than carrying `isVault` through the idea shape and encryption of `noteTitle`. Confirm `applyOpLocally`, `rebase`, `coalesce` and `findOrphans` treat the three fields as ordinary strings. Firestore document rules for `ideas` are unchanged. Free-plan counting is unchanged.

## Tests

- Vault crypto: wrap and unwrap with passphrase and with recovery code; wrong passphrase and wrong code fail; AAD mismatch (moving a field to another idea) fails; recovery code encode/decode round trip and typo rejection.
- Double encryption round trip through the outbox encryption and `syncEngine` decrypt: the stored cache value for a vault idea stays `vault:...`.
- A normal idea whose text starts with `vault:` is still encrypted by the outbox and displayed as ordinary text.
- `isVault` cannot be changed by any patch.
- Search, exporters and importers exclude or strip vault notes.
- Locking: timer, page-hidden, and `clearDEK()` drop the key.
- Component tests where the repo already has them for Create, card display and the mobile sheet.

## Documentation and wording

- `CLAUDE.md`: new Vault section (data model, double encryption, in-memory key, opaque-text rule, file list).
- `programmer-docs/CHANGELOG.md`: a feature entry in the existing `## TAG | Title` format. `DEVLOG.md`: concise entry.
- Privacy and Terms: a Vault paragraph. It may say the vault key is never sent to us and that we cannot read vault notes, **but only for vault notes**, with the lost-passphrase-and-code warning and the line that the web version is delivered by us. `CLAUDE.md` currently forbids "we cannot read" wording because of the email recovery decision; this feature is the planned exception, so get the owner's explicit approval of the exact copy first. Also update `Support.tsx`, store listings and `programmer-docs/app-store-encryption-documentation.md`.
- Recommend the native apps in the copy for people who store passwords, since their code is fixed at install time.

## Suggested slicing (no commits)

1. `vaultCrypto.ts`, `vaultStore.ts`, recovery code, tests (no UI).
2. Data model, `handleVaultCreation`, the opaque-text helper and the audit-checklist changes.
3. Desktop UI: setup wizard, unlock prompt, card display, edit, reveal, copy, lock timer.
4. Mobile UI.
5. Export/import rules, rules test, delete-account check.
6. Docs and approved wording.

## Open decisions to ask the owner

Auto-lock default and options; passphrase minimum and strength meter style; whether to allow "use my account password as vault passphrase" (recommended no); structured fields (username/password/notes) later or now; biometric unlock in the native apps; clipboard clearing on native; exact public wording; whether Reset vault should also be reachable without being signed in.
