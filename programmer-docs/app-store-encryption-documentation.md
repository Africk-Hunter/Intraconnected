# Intraconnected: Encryption Documentation for App Store Connect

App: Intraconnected (iOS), Bundle ID `com.intraconnected.app`
Developer: Hunter Africk (sole proprietor)

## Summary

Intraconnected is a mind-mapping app for organising ideas. It uses standard, published encryption algorithms through the Web Crypto API, a bundled Argon2id implementation, and Google Cloud KMS for server-side recovery. The app contains no proprietary or unpublished cryptography and no custom cryptographic implementation. Encryption is used solely to protect the user's own data (idea text, checklist text and links) before it leaves the device, and to protect network traffic. It is not used for any other purpose, and the app offers no encryption service, messaging, VPN, or file-encryption feature to users.

## Algorithms

| Purpose | Algorithm | Notes |
|---|---|---|
| Encrypting idea text, notes, links and checklist items before storage on the server | AES-256-GCM | 96-bit random IV per field, generated with `crypto.getRandomValues` |
| Protecting the data encryption key (DEK) under the user's password | AES-256-GCM with a key derived by Argon2id | New format uses 32 MiB memory, 3 iterations, parallelism 1; older v2 wraps use PBKDF2-HMAC-SHA-256 with 600,000 iterations, and legacy wraps use 100,000 |
| Account-recovery wrap for enrolled accounts | RSA-OAEP with SHA-256 and a 3,072-bit Google Cloud KMS key | Client encrypts the 32-byte DEK and account ID with the public key; the private key stays in Cloud KMS and is used only by the authenticated recovery function |
| Legacy account-recovery wrap | AES-256-GCM, key derived with PBKDF2-HMAC-SHA-256 | 100,000 iterations; derived from the email address and account ID |
| DEK generation | AES-256 key from `crypto.subtle.generateKey` | Random, per account |
| Storing the DEK on the device | iOS Keychain (device-only, no iCloud sync) | Uses Apple's system encryption; the app adds none of its own |
| Network traffic to Firebase (Authentication, Firestore) and the app's own API | TLS (HTTPS) via the operating system's networking stack | No custom TLS code or certificate handling |

Key length is 256 bits for symmetric keys. RSA-OAEP is used only to wrap a user's own DEK for account recovery; the app has no general-purpose asymmetric cryptography, key exchange, or digital-signature feature.

## Where the cryptography lives

- `src/utilities/crypto.ts`: AES-GCM field encryption and password wrapping through the Web Crypto API; Argon2id is loaded from the bundled `hash-wasm` module. RSA-OAEP public-key wrapping also uses the Web Crypto API.
- `netlify/functions/recover-key.ts`: calls Google Cloud KMS to unwrap an enrolled recovery key after a recent sign-in; successful key releases are logged to a Firestore audit collection and Google Cloud Audit Logs.
- `src/utilities/dekStore.ts`: holds the unwrapped key in memory and in the iOS Keychain.

## Use of encryption

1. The encryption is used to protect the user's stored data and credentials. It is not the app's primary function.
2. Users cannot supply their own keys or algorithms, and cannot use the app to encrypt arbitrary files or communications.
3. The app does not provide an encryption API to other software.

## Export classification

The app uses standard encryption algorithms in addition to the encryption in Apple's operating system, so it is declared as using non-exempt encryption (`ITSAppUsesNonExemptEncryption` = true). The developer self-classifies it as mass-market encryption software under ECCN 5D992.c (License Exception ENC / mass-market, 15 CFR 740.17(b)(1) and Note 3 to Category 5, Part 2) because it is a consumer application, available to the public through the App Store, whose cryptographic functionality is not user-modifiable and which is limited to protecting the user's own data.

Contact: gamehunter5879@gmail.com
