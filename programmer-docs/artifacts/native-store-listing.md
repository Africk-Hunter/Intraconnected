# Native store listing — copy and answers

https://claude.ai/artifact/WxjYNp7ZvDLoNzAWTQtByj

Draft text and answers for the App Store (iOS) and Google Play (Android) listings. Plan and progress: `programmer-docs/artifacts/native-app-plan.html` (https://claude.ai/artifact/8AfWNA2bCDKhoEq7AumzaC). Rules that apply to everything below:

- Never write "end-to-end encrypted", "only you can decrypt" or "we cannot read your ideas" (decision C1: email recovery stays, so the service could technically read them). Say "encrypted on your device before it is saved" and nothing stronger.
- The app sells nothing and shows no prices (decision C2). Describe the account, not purchases.
- Re-read the current store rules before submitting. Apple 3.1.1 / 3.1.3 and Google's payments policy on external links change often.

## Identity

| Field | Value |
|---|---|
| App name | Intraconnected (fallback if taken on iOS: Intraconnected: Mind Map) |
| Bundle ID / package | `com.intraconnected.app` |
| Category | Productivity |
| Price | Free |
| Support URL | https://intraconnected.app/support |
| Privacy policy URL | https://intraconnected.app/privacy |
| Marketing URL | https://intraconnected.app |
| Devices | iPhone only; Android phones |

## Text

**Subtitle (iOS, 30 characters max):** `Mind maps that go deep`

**Keywords (iOS, 100 characters max, comma separated):**
`mind map,mindmap,ideas,notes,brainstorm,outline,checklist,planner,thinking,tree,organize,nodes`

**Promotional text (iOS, 170 max):**
`Map your mind. Start with one idea, branch it, and zoom into any branch. Drag ideas to reorganize and keep everything in sync across your devices.`

**Short description (Google Play, 80 max):**
`A mind map you can zoom into. Branch ideas, reorganize, and sync everywhere.`

**Full description (both stores):**

```
Intraconnected is a mind map built around zooming in.

Start with a single idea and branch it into more. Tap any idea to step inside it and see only what belongs there, then step back out when you're ready. Big maps stay readable because you only ever look at one level at a time.

• Branch ideas as deep as you like
• Drag an idea onto another to move it, or drag it to the trash to delete it
• Checklists and notes sit right inside your map
• Mark ideas High, Medium or Low priority and sort by priority or age
• Attach a link to any idea
• Import from Markdown, OPML, Notion, FreeMind and XMind, and export your whole map at any time
• Your map syncs between your phone and the web, and keeps working offline

Your ideas are encrypted on your device before they are saved.

Sign in with your Intraconnected account, or create one in the app. Delete your account and all of your data from Profile whenever you want.
```

(The free plan holds 50 ideas. Do not mention plans, prices or upgrading in the app listing.)

## Apple: App Privacy label

| Question | Answer |
|---|---|
| Email address | Collected. Linked to the user. Purpose: app functionality (account). Not used for tracking. |
| Other user content (the ideas, notes, checklists, feature requests) | Collected. Linked to the user. Purpose: app functionality. Not used for tracking. |
| Contact info other than email, location, identifiers, usage data, diagnostics, financial info | Not collected. (Card payments happen on the website through Stripe, not in the app.) |
| Tracking | None. No analytics or advertising SDK, so no tracking prompt. |

## Apple: other forms

- **Age rating:** no objectionable content built in, but users can write anything and it is stored on our servers, so answer the user-generated-content questions honestly (not shared with other users).
- **Export compliance:** the app uses AES-GCM through the browser's Web Crypto plus HTTPS. Whether that qualifies for the standard exemption is a legal declaration, so the owner answers it in App Store Connect (TestFlight > the build > Missing Compliance). `ITSAppUsesNonExemptEncryption` is deliberately not set in `Info.plist`.
- **Sign in with Apple:** not required, the app offers only email and password.
- **Account deletion (5.1.1(v)):** Profile > Account > Delete account. Needs the CORS change deployed to work from the app.

## Apple: App Review information

Demo account: create a verified account with a few sample ideas (tree two levels deep, one checklist, one note). Put its email and password in App Store Connect, not in this repo.

Review notes:

```
Intraconnected is a mind-mapping app. Sign in with the demo account above.

The app does not sell anything and has no in-app purchases. Account plans, if any, are managed on our website. Users can delete their account and all data from Profile > Account > Delete account.

Ideas are encrypted on the device before they are saved to our servers. The app only uses email and password sign-in.
```

## Google Play: Data safety

| Question | Answer |
|---|---|
| Does the app collect or share user data? | Collects; does not share with third parties for their own use. (Firebase / Google Cloud process data on our behalf.) |
| Data collected | Email address (account management); User content: ideas, notes, checklists, feature requests (app functionality). |
| Not collected | Location, contacts, photos, audio, device or other IDs, app activity, crash logs, financial info. |
| Encrypted in transit | Yes (HTTPS). |
| Encrypted at rest | Yes (idea text is encrypted on the device before it is stored; the database is also encrypted by the provider). Do not say end-to-end. |
| Can users request deletion? | Yes: in the app, Profile > Account > Delete account. Also by email at the support address. |
| Required in a closed test? | Fill this in before the first release to any track. |

## Google Play: other

- Content rating questionnaire: no violence, no mature content; the app stores user text privately (not shared).
- Target audience: 13+ (a general-audience productivity app; do not select children).
- **Closed-testing requirement (confirmed from Google's help page, Oct 13):** a personal account created after Nov 13, 2023 must run a closed test with at least 12 testers opted in continuously for 14 days before it can apply for production access. Google reviews the application, usually within 7 days. Verifying the account needs a real Android device (the Play Console app).
- **Graphics:** `assets/play-store/app-icon-512.png` (512x512 app icon) and `assets/play-store/feature-graphic-1024x500.png` (feature graphic, required for the listing).
- The upload key is created once with `keytool` (see `android/keystore.properties.example`). Keep the keystore and its passwords in a password manager. Play App Signing holds the real signing key.

## Screenshots

- **iOS:** the 6.9-inch iPhone size (1320 x 2868). Take them from a TestFlight build with the demo account.
- **Google Play:** at least two phone screenshots; the emulator's 1080 x 2400 is fine.
- Show: the map with a few ideas, a zoomed-in level, the Create sheet, a checklist, and the Move sheet. Do not show the Profile plan section or anything about upgrading.

## Demo account (both review forms, and the closed-test application)

1. In a browser, sign up at https://intraconnected.app/login with a throwaway email you control (an alias works) and a strong password. Verify the email.
2. Build a small tree: 3 top-level ideas, one with 3 children, one of those with 2 grandchildren; add one checklist (3 items, one ticked), one note, one link idea (https://intraconnected.app), and set a priority on two ideas.
3. Keep it under 50 ideas (free plan cap). Do not put real data in it.
4. Store its email and password in App Store Connect and the Play Console reviewer-credentials form only, never in this repo.

## Tester recruiting post (Google Play closed test)

Needs 12 testers, ideally about 20, each opted in for 14 continuous days. Collect Gmail addresses, or add a Google Group as the tester list. Suggested channels: r/AndroidClosedTesting, tester-swap Discords, r/mindmapping, r/PKMS, r/productivity, local Facebook groups. Do not use paid tester services.

```
Android testers wanted: free mind-mapping app (about 5 minutes, 14 days)

I'm launching Intraconnected, a mind map you zoom into: start with one idea, branch it, tap any idea to step inside it, and drag ideas around to reorganize. It has checklists, notes, priorities, import from Markdown/OPML/Notion and syncs with a web version.

Google requires 12 testers to stay opted in for 14 days before I can publish, so I'm looking for Android users. All you need to do:
1. Send me the Gmail address you use on Google Play.
2. Open the invite link I send back and tap "Become a tester", then install the app.
3. Stay opted in for 14 days. Open it a couple of times and tell me anything that feels broken or confusing (private feedback in Play is fine).

Happy to test your app in return. Reply or message me if you're in.
```
