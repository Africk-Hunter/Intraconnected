# Plan: Encryption hardening (Phase 0) and KMS-backed recovery (Option 1)

Audience: a coding agent working in this repo. Read `CLAUDE.md` first; its rules apply (no git commits unless the owner says so, no emojis, never call the encryption "end-to-end", keep `programmer-docs/DEVLOG.md` updated, run `npm run typecheck && npm run lint && npm test && npm run build` before calling anything done).

Background: `programmer-docs/artifacts/encryption-hardening-plan.html` (the review that led to this plan). Summary: the field encryption (AES-256-GCM) is sound, but the recovery copy of the key (`emailEncryptedDEK`) is derived from the account email and uid, neither of which is secret, so anyone with a database copy plus the email can decrypt. Phase 0 tightens the cryptography around it. Part B (KMS recovery) replaces the email-derived wrap with one only a Google Cloud KMS key can open, so a stolen database alone is useless and every release of a key is logged.

Explicit non-goals: no "we cannot read your ideas" claim (we still can, via KMS); no zero-knowledge mode; no Vault notes (separate plan, shelved); no bulk re-encryption of existing ideas; no new email vendor.

## Ground rules for the whole job

1. **Read support ships before write support.** Old tabs and installed apps must never meet data they cannot read. `syncEngine.ts` skips a doc it cannot decrypt, so an old client meeting `enc2:` would silently show missing ideas. Every new format gets (a) a release that can read it, then (b) a later release that writes it, switched by a constant (see "Kill switches").
2. **Lazy migration only.** New and edited fields use the new format. Old ones stay readable forever. Never write a job that rewrites every idea: each rewrite bumps `updatedAt`, which makes every other device re-read the doc through the incremental pull (see "Cost savers" in `CLAUDE.md`).
3. **Kill switches.** Put the write-side choices in one place (`src/utilities/cryptoConfig.ts`): `WRITE_ENC2`, `WRITE_PASSWORD_WRAP_V3`, `WRITE_KMS_RECOVERY`. Each defaults to `false` in the first release and flips to `true` in a follow-up. Note each in `DEVLOG.md` like the existing cost-saver switches.
4. **Do not add a second path that writes idea docs.** All idea writes still go through `ideaStore.ts` and the outbox.

## Part A: Phase 0 (no user-visible change)

### A1. Non-extractable key at runtime

Files: `src/utilities/dekStore.ts`, `src/utilities/dekStore.test.ts`, `src/utilities/crypto.ts` (`generateDEK`, `importKey`).

Problem: on the web, ordinary (non-"Remember me") sessions put the raw key as base64 in `sessionStorage` (`dek_session`), and every key is created extractable, so any script on the page can read it.

Change:
- Keep the key extractable only where it must be re-wrapped (sign-up, password change, recovery, `unlockDEKForRewrap`). After `setDEK`, hold a **non-extractable** copy in `_dek` (export raw once in memory, re-import with `extractable: false`).
- Web, not remembered: store the non-extractable key in the existing IndexedDB store (`intraconnected-keys`) and put a marker in `sessionStorage` (`dek_session_marker`). On load: if the marker is present, use the IndexedDB key; if neither the marker nor the `session_remembered` flag is present, delete the IndexedDB key. This keeps "close the tab and you are signed out" while removing the readable key.
- Migrate: if an old `dek_session` raw value exists, import it once as non-extractable, store it as above, and remove the raw value. Keep the existing `dek_local` migration.
- Native: no change. The Keychain/Keystore store needs raw bytes and is OS-protected.
- Keep `clearDEK()` semantics exactly (synchronous in-memory clear, returned promise for storage cleanup) and make it clear the new marker too.

Tests: update `dekStore.test.ts` for the new storage shape, add a test that the in-memory key reports `extractable === false`, and a test that the old `dek_session` value is migrated and removed.

### A2. Versioned, context-bound field encryption (`enc2:`)

Files: `src/utilities/crypto.ts`, `src/utilities/sync/outbox.ts` (`encryptItems`, `encryptIdea`, `encryptPatch`, around lines 405-440), `src/utilities/sync/syncEngine.ts` (decrypt, around lines 115-145), tests in `crypto.test.ts`.

Format:

```
enc2:<keyId>:<base64(iv(12) + ciphertext)>
keyId = "k1"            (a constant for now; lets a later key rotation coexist)
AAD   = utf8(uid + "|" + ideaId + "|" + fieldName)
fieldName = content | link | noteTitle | items.<itemId>.text | items.<itemId>.link
```

Rules:
- `encryptField(text, dek, aad)` writes `enc2:`; `decryptField(value, dek, aad)` accepts `enc2:` (verifies AAD), `enc:` (legacy, ignores AAD), and plaintext (unchanged, as now).
- Do **not** bind `parentID`, `updatedAt` or priority into the AAD: moves and priority changes must not invalidate ciphertext.
- The outbox queue is per account (`sync_outbox_<uid>`), so `uid` is available in `sendOp`. Pass it down. For checklist items use the item's `id`.
- Undo of a delete (`restoreIdeas`) and imports keep or create ids and re-encrypt on send, so they need no special handling.
- A decryption failure on one field must keep today's behaviour (the doc is skipped, not fatal).
- Stage 1 release: reading `enc2:` works, writing stays `enc:` (`WRITE_ENC2 = false`). Stage 2 (later): flip `WRITE_ENC2`.

### A3. Plaintext padding (inside `enc2:` only)

Plaintext inside `enc2:` is `[4-byte big-endian length][utf8 bytes][zero padding]`, padded to the next bucket: 64, 128, 256, 512, 1024, 2048 bytes, then multiples of 1024. This hides exact text length. Decrypt strips it. Do not change `enc:` handling. Check that the largest realistic checklist stays well under the 1 MiB Firestore document limit.

### A4. Argon2id password wrap (`v3:`)

Files: `src/utilities/crypto.ts` (`wrapDEK`, `unwrapDEK`, `isLegacyPasswordWrap`), `src/components/Auth.tsx` (upgrade path near line 215), `netlify.toml` (line 26 CSP), `vite-plugins/nativeCsp.ts` (line 19 CSP).

Format: `v3:argon2id:m=32768,t=3,p=1:<base64 salt(16)>:<base64(iv + ciphertext)>`. Random salt per wrap; parameters stored with the wrap so they can change later. KDF output is 32 bytes, imported as an AES-GCM key. Existing `v2:` (PBKDF2 600k) and unprefixed (PBKDF2 100k) wraps must keep opening.

Implementation notes:
- Use a bundled WASM Argon2id (for example `hash-wasm`). Load it with a dynamic `import()` only in the sign-in and sign-up paths, so the marketing bundle does not grow.
- WASM needs `'wasm-unsafe-eval'` in `script-src`, in **both** `netlify.toml` and `vite-plugins/nativeCsp.ts`. Keep them in step. Confirm the app still loads under `npm run dev:functions` (netlify headers apply there).
- If WASM cannot load, sign-in with a `v3:` wrap must show a clear error, and writing must fall back to `v2:` so sign-in is never bricked.
- Tests inject cheap parameters (for speed) through an optional argument; production constants stay at the values above. Verify the memory cost is acceptable on a low-end Android WebView (32 MiB); if not, lower `m` and note it.
- The upgrade runs at sign-in exactly as the `v2:` upgrade does (rename `isLegacyPasswordWrap` to `needsPasswordWrapUpgrade`: true for anything not `v3:` once `WRITE_PASSWORD_WRAP_V3` is on).
- The email wrap stays PBKDF2 here; Part B replaces it.

### A5. Local data audit (report first, do not change behaviour yet)

Trace what sign-out, idle sign-out (`utilities/idleSignOut.ts`), `SessionEndedModal` and `clearDEK()` leave in `localStorage`: the decrypted `ideas` cache, `sync_outbox_<uid>`, `sync_seen_<uid>`, `sync_wm_<uid>`, billing cache. `CLAUDE.md` says `sync_owner` guards against another account's cached map, which suggests the cache is kept on purpose. Write the findings into `DEVLOG.md` and stop: removing unsent outbox operations loses user data, so any wipe is the owner's decision.

### A6. Tests

Extend `src/utilities/crypto.test.ts`:
- A fixed fixture per format (`enc:`, `enc2:`, wrap v1, v2, v3) produced once and committed, decrypted in a test, so a refactor cannot silently break old data.
- Tamper test: move an `enc2:` value to a different idea id or field name; decryption must fail.
- Padding: lengths fall in buckets; round trip is exact for empty, ASCII, multibyte and 5 KB inputs.
- Unwrap works for all three wrap versions; wrong password fails.

## Part B: KMS-backed recovery (replaces the email wrap)

Design in one paragraph: at sign-up and at sign-in the client encrypts the key to a **Cloud KMS asymmetric public key** (RSA-OAEP, SHA-256) and stores the result as `recoveryWrap` in `users/{uid}/meta/encryption`. The public key ships in the client (public by design, like `firebaseConfig.ts`), so no server call is needed to enroll. Only on recovery does a Netlify function ask KMS to decrypt, which Google records in Cloud Audit Logs. The function also writes its own audit record the user can see.

### B1. One-time infrastructure (owner does this; give them exact steps, do not assume access)

1. In the Google Cloud project behind Firebase: create a key ring and an asymmetric key:
   ```
   gcloud kms keyrings create intraconnected --location=global
   gcloud kms keys create recovery --keyring=intraconnected --location=global \
     --purpose=asymmetric-encryption --default-algorithm=rsa-decrypt-oaep-3072-sha256
   gcloud kms keys versions get-public-key 1 --key=recovery --keyring=intraconnected \
     --location=global --output-file=recovery-public.pem
   ```
   Decide region and protection level (software vs HSM) with the owner; check current KMS pricing before choosing HSM.
2. Create a dedicated service account with only decrypt permission on that key (`roles/cloudkms.cryptoKeyDecrypter` bound to the key, nothing broader). Do not reuse the Firebase Admin account.
3. Turn on Data Access audit logs for Cloud KMS (IAM and Admin, Audit Logs) so each decrypt is recorded.
4. Netlify env vars: `KMS_KEY_VERSION_NAME_K1` (full key-version resource name for key ID `k1`), `KMS_SERVICE_ACCOUNT_JSON` (base64). Never put these in the repo or client. Keep each old `KMS_KEY_VERSION_NAME_K<n>` mapping configured for as long as any account has a wrap with that key ID.
5. Commit the public key as a constant in the client (`src/utilities/recoveryKey.ts`) with a matching logical key ID. Wrap values use `kms1:<keyId>:<ciphertext>` so the server selects the correct retained KMS key version after rotation. Legacy `kms1:<ciphertext>` wraps use `KMS_KEY_VERSION_NAME`.

### B2. Client wrap format

`recoveryWrap = "kms1:<keyId>:" + base64(RSA-OAEP-SHA256(publicKey, DEK_raw_32_bytes || utf8(uid)))`. The server maps the logical key ID to `KMS_KEY_VERSION_NAME_<KEYID>` (for example `k1` → `KMS_KEY_VERSION_NAME_K1`); retain old mappings while wraps still exist. Cloud KMS RSA-OAEP has no label, so the uid rides inside the plaintext and the server checks it on decrypt. RSA-OAEP 3072 with SHA-256 holds about 318 bytes; the payload is under 200. Use `crypto.subtle` (`importKey('spki', ...)` then `encrypt({ name: 'RSA-OAEP' })`). New function `wrapDEKForRecovery(dek, uid)` in `crypto.ts`.

### B3. Server: `netlify/functions/recover-key.ts`

- Use `authed({ signInMessage, recentSignIn: { maxAgeSeconds: 600, message } }, ...)` from `lib/handler.ts`.
- Rate limit with `checkRateLimit` (same style as `REFUND_RATE_LIMIT` / `REFUND_RATE_WINDOW_MS`), for example 5 per hour per uid.
- Read `users/{uid}/meta/encryption.recoveryWrap` with the Admin SDK; reject unless it is a valid legacy or key-ID-bearing `kms1:` wrap.
- Resolve key-ID-bearing wraps only through the matching `KMS_KEY_VERSION_NAME_<KEYID>` environment variable (legacy wraps use `KMS_KEY_VERSION_NAME`), then call KMS `asymmetricDecrypt` (package `@google-cloud/kms`). Check the trailing bytes equal `uid`; if not, 403.
- Write an audit document (below), then return `{ dek: base64 }` with `Cache-Control: no-store`.
- Optional hardening to **verify before relying on**: require evidence of a recent password reset (for example the Admin `UserRecord.tokensValidAfterTime` is within a window such as 7 days of `auth_time`). Test in Firebase test mode whether an email-link password reset updates that field; if it does not, skip this check and say so in `DEVLOG.md`.
- Tests in `netlify/tests/recover-key.test.ts`, mocking KMS (follow `testUtils.ts` and existing tests): rejects without token, rejects an old sign-in, rate-limit, wrong-uid payload, success path writes the audit record.

### B4. Audit log and in-app notice

- Top-level collection `recoveryAudit/{autoId}` with `{ uid, at: serverTimestamp(), result }`. No IP address (privacy).
- `firestore.rules`: clients may read their own (`resource.data.uid == request.auth.uid`) and never write. Add cases to `netlify/tests/firestore-rules.test.ts`. Remember rules only take effect when pasted into the Firebase Console by hand; say so in your final report.
- `delete-account.ts` must delete that user's `recoveryAudit` documents.
- Client: after any sign-in, if an audit record is newer than the last one the user has seen, show a dismissible notice ("Your encryption key was used for account recovery on <date>. If this was not you, change your password and contact support."). Store the last-seen time in `meta/preferences` or localStorage. An email notice is deliberately left out; it needs a new email vendor, which is the owner's call.

### B5. Client flows to change

Replace every `wrapDEKWithEmail` / `unwrapDEKWithEmail` use:
- `Auth.tsx` sign-up (line 145), legacy-account branch (line 234): store `recoveryWrap` instead of the email wrap.
- `Auth.tsx` `handleEmailRecovery` (line 248): if `recoveryWrap` exists, call `recover-key` through `apiUrl()` (never a raw `fetch('/.netlify/functions/...')`), import the returned key, re-wrap with the new password, and store. If only the legacy `emailEncryptedDEK` exists, use the old path.
- `Auth.tsx` sign-in (line 207): the "email changed, re-wrap" logic goes away for accounts with `recoveryWrap`, because the new wrap is not tied to an email. Keep `syncBillingEmail()`.
- `authFirebase.ts` `requestEmailChange` (around line 121), `AuthAction.tsx` `verifyAndChangeEmail`, `SessionEndedModal.tsx` (line 62): drop the email re-wrap and the pending-email wrap for accounts with `recoveryWrap`. Keep them for legacy accounts until migrated.
- `encryptionKeys.ts`: add `storeRecoveryWrap`, and `removeLegacyEmailWrap` using `deleteField()` for `emailEncryptedDEK`, `emailWrapFor`, `pendingEmail`, `pendingEmailEncryptedDEK`.

### B6. Migration

At each successful password sign-in with the key in memory: if there is no `recoveryWrap`, create and store it; once the write has succeeded, delete the legacy email-wrap fields. Accounts that never sign in again keep the old derivable wrap; this cannot be fixed without their password. Note it in the Privacy copy and the final report. `WRITE_KMS_RECOVERY` gates creating the new wrap; reading both paths ships first.

## Documentation to update in the same change

- `CLAUDE.md`: "Client-side encryption" section (new wrap, Argon2id, `enc2:`, what is logged), the C1 sentence, the file list; keep "never say end-to-end".
- `src/pages/Privacy.tsx`, `src/pages/Terms.tsx` (section 4), `src/pages/Support.tsx`: replace "locked with information tied to your account" with plain wording ("derived from your email address and account ID, which are not secret" for the legacy wrap; for the new system, that our recovery system can still unlock your key, that each use is recorded, and that you will see a notice). Add: ciphertext length and idea ids (creation time) are visible; scripts or browser extensions running in the page can use the key while you are signed in; the web version is delivered by us. Say we can still decrypt; do not claim otherwise.
- `programmer-docs/app-store-encryption-documentation.md`: add RSA-OAEP and Argon2id.
- `programmer-docs/DEVLOG.md`: concise entry with the kill switches.
- `programmer-docs/artifacts/launch-checklist.html` item C1: note the change (the owner ticks items; do not edit tick state).
- `programmer-docs/CHANGELOG.md`: no entry (not a feature).

## Suggested slicing (one reviewable change each, no commits)

1. Read support: `enc2:`, padding, `v3:` unwrap, CSP `wasm-unsafe-eval`, `recoveryWrap` reading, tests and fixtures. All write switches off.
2. Non-extractable runtime key (A1).
3. Part B server and rules: `recover-key.ts`, audit collection, rules tests, delete-account change.
4. Part B client: new wrap on sign-up and sign-in, recovery flow, notice, migration, behind `WRITE_KMS_RECOVERY`.
5. Docs and legal copy.
6. After a release has soaked (and the minimum supported app version can read the new formats): flip the three write switches in a separate small change.

## Manual test matrix (report what you could and could not run)

New sign-up; sign-in with a `v2:` account (upgrade to `v3:` once enabled); wrong password; password reset then sign-in (new path and legacy path); email change then password reset; "Remember me" and plain sessions across tab close and reload; two tabs and two devices syncing a mix of `enc:` and `enc2:` ideas; offline edit then reconnect; checklist edits; undo of a delete; import; account deletion (audit records removed); `npm run cap:sync` and a device or emulator build with WASM and the Keychain path.

## Open decisions to ask the owner (do not guess)

KMS region and protection level; Argon2id memory parameter after the Android test; reset-evidence window (or skipping it); whether to add email notices later (needs a vendor); whether any local wipe at sign-out is wanted (A5).
