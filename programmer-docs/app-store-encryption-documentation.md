# Intraconnected: Encryption Documentation for App Store Connect

App: Intraconnected (iOS), Bundle ID `com.intraconnected.app`
Developer: Hunter Africk (sole proprietor)

## Summary

Intraconnected is a mind-mapping app for organising ideas. It uses only standard, published encryption algorithms, all from the Web Crypto API built into the system web view (WebKit on iOS). The app contains no proprietary or unpublished cryptography and no custom cryptographic implementation. Encryption is used solely to protect the user's own data (idea text, checklist text and links) before it leaves the device, and to protect network traffic. It is not used for any other purpose, and the app offers no encryption service, messaging, VPN, or file-encryption feature to users.

## Algorithms

| Purpose | Algorithm | Notes |
|---|---|---|
| Encrypting idea text, notes, links and checklist items before storage on the server | AES-256-GCM | 96-bit random IV per field, generated with `crypto.getRandomValues` |
| Protecting the data encryption key (DEK) under the user's password | AES-256-GCM, key derived with PBKDF2-HMAC-SHA-256 | 600,000 iterations (100,000 for older accounts); salt derived from the account id |
| Account-recovery wrap of the DEK, derived from the account email | AES-256-GCM, key derived with PBKDF2-HMAC-SHA-256 | 100,000 iterations |
| DEK generation | AES-256 key from `crypto.subtle.generateKey` | Random, per account |
| Storing the DEK on the device | iOS Keychain (device-only, no iCloud sync) | Uses Apple's system encryption; the app adds none of its own |
| Network traffic to Firebase (Authentication, Firestore) and the app's own API | TLS (HTTPS) via the operating system's networking stack | No custom TLS code or certificate handling |

Key length is 256 bits for all symmetric keys. No asymmetric cryptography, key exchange, or digital-signature code is implemented in the app.

## Where the cryptography lives

- `src/utilities/crypto.ts`: AES-GCM field encryption, PBKDF2 key derivation, key wrapping. All calls go to the platform's `crypto.subtle`.
- `src/utilities/dekStore.ts`: holds the unwrapped key in memory and in the iOS Keychain.

## Use of encryption

1. The encryption is used to protect the user's stored data and credentials. It is not the app's primary function.
2. Users cannot supply their own keys or algorithms, and cannot use the app to encrypt arbitrary files or communications.
3. The app does not provide an encryption API to other software.

## Export classification

The app uses standard encryption algorithms in addition to the encryption in Apple's operating system, so it is declared as using non-exempt encryption (`ITSAppUsesNonExemptEncryption` = true). The developer self-classifies it as mass-market encryption software under ECCN 5D992.c (License Exception ENC / mass-market, 15 CFR 740.17(b)(1) and Note 3 to Category 5, Part 2) because it is a consumer application, available to the public through the App Store, whose cryptographic functionality is not user-modifiable and which is limited to protecting the user's own data.

Contact: gamehunter5879@gmail.com
