# Intraconnected iOS build guide (Codemagic)

https://claude.ai/artifact/15b9a7XREbhUHF5dzejRKR

Sep 29, 2026

This guide takes Intraconnected from a Windows PC to a signed iOS build on your iPhone through TestFlight, with no Mac. Codemagic's cloud Macs do the building and signing; you do everything else from a browser and your terminal. Expect about 3–5 hours of your own work, spread over 2–3 days because Apple's enrollment review takes up to 48 hours. It costs $99 a year for Apple; Codemagic's free tier covers early builds.

## Before you start

Don't ship a phone build until the sync bugs are fixed. A phone app stays open in the background for days, so the A3 (empty map after a failed load) and A4 (silent failed saves, devices drifting apart) problems in `shipping-readiness.md` would hit far more often than in a browser tab. Steps 3–7 below (Apple and Codemagic accounts) can happen in parallel with that work.

Have these ready:

- [ ] A3 and A4 fixed and committed on `main` (or the branch you'll build from)
- [ ] The repo pushed to GitHub (Codemagic pulls from there)
- [ ] An iPhone on a recent iOS version, for TestFlight testing
- [ ] An Apple ID with two-factor authentication turned on (Settings → your name → Sign-In & Security on the iPhone)
- [ ] A credit card for the $99/year Apple fee
- [ ] Node 22 installed locally (the same version CI uses)
- [ ] A password manager, or somewhere safe to keep the IDs and files listed in the last section

What you can't do without a Mac, and the workaround:

| Mac-only task | Workaround |
| --- | --- |
| Run Xcode, build and sign | Codemagic's cloud Macs |
| iOS Simulator | Test on your real iPhone through TestFlight |
| Safari Web Inspector (debug the WebView live) | Reproduce in Chrome's mobile emulation first; for iOS-only bugs, rent a cloud Mac by the hour (MacinCloud, Scaleway) |
| `pod install` for CocoaPods | Codemagic runs it; only needed if your Capacitor project uses CocoaPods |

## Step 1 — Add Capacitor and the iOS project (Windows, ~20 min)

Capacitor wraps the built Vite app (`dist/`) in a native iOS shell. All of this runs on your Windows machine, from the repo root.

1. Install Capacitor:

   ```bash
   npm install @capacitor/core @capacitor/ios
   npm install -D @capacitor/cli
   ```
2. Create the config. Run `npx cap init "Intraconnected" "com.intraconnected.app" --web-dir dist`, or write `capacitor.config.ts` by hand:

   ```ts
   import type { CapacitorConfig } from '@capacitor/cli';

   const config: CapacitorConfig = {
     appId: 'com.intraconnected.app',
     appName: 'Intraconnected',
     webDir: 'dist',
   };

   export default config;
   ```

   Never add `server.url` pointing at the live site. Apple rejects apps that are just a website in a frame (guideline 4.2).
3. Build the web app once so `dist/` exists: `npm run build`.
4. Add the iOS project: `npx cap add ios`. On Windows it may warn that it can't run CocoaPods or Xcode steps. That's expected; Codemagic runs those on its Mac.
5. Check which dependency system the project uses, because it changes one line in Step 9:
   - `ios/App/Podfile` exists → **CocoaPods**. The build opens `ios/App/App.xcworkspace`.
   - No Podfile, and `ios/App/CapApp-SPM/` exists → **Swift Package Manager** (the default for new projects on recent Capacitor versions). The build opens `ios/App/App.xcodeproj`.
6. Sync after every web change: `npm run build && npx cap sync ios`.
7. Commit `capacitor.config.ts` and the `ios/` folder. Capacitor's generated `ios/.gitignore` already excludes build output, `Pods/` and the copied web assets.

To check this step worked: `ios/App/App/Info.plist` exists, and `npx cap doctor` lists `@capacitor/ios` with no errors.

## Step 2 — Code changes before the first iOS build

The app will build without these, but parts of it will be broken on the phone. Inside iOS the page's origin is `capacitor://localhost`, not `https://intraconnected.app`, which breaks two things in the current code.

| # | Problem | Where | Fix |
| --- | --- | --- | --- |
| 1 | Every Netlify function call uses a relative URL (`/.netlify/functions/...`). On the phone that resolves to `capacitor://localhost/.netlify/...`, which doesn't exist. Account deletion, feature requests and all billing calls fail. | `src/utilities/billing/billing.tsx`, `src/utilities/firebase/authFirebase.tsx`, `src/utilities/firebase/featureRequests.ts` | Add one helper, e.g. `apiUrl(path)`, that prefixes `https://intraconnected.app` when `Capacitor.isNativePlatform()` is true, and use it in all 8 `fetch` calls. |
| 2 | The functions' CORS allowlist only accepts the site's own origins, so even absolute URLs from the app get blocked. | `netlify/functions/lib/cors.ts` | Add `capacitor://localhost` to `allowedOrigins`. Every function still checks the Firebase ID token, so this opens nothing up. |
| 3 | The app must not sell anything on iOS (decision C2). | Pricing page, `UpgradeModal`, node-cap prompts | When `Capacitor.isNativePlatform()` is true, hide checkout. In the US you may link out to `https://intraconnected.app/pricing`; elsewhere show no purchase prompt. Re-check Apple's current rules before submitting. |
| 4 | Without "Remember me", the encryption key is only in `sessionStorage`. iOS kills background apps often, so users would be logged out constantly. | `src/utilities/dekStore.ts` | Store the key in the iOS Keychain with a secure-storage Capacitor plugin (D3 in the readiness doc). Can wait until after the first TestFlight build. |
| 5 | `netlify.toml` security headers never reach the bundled app. | `index.html` | Add a Content-Security-Policy `<meta>` tag mirroring the `netlify.toml` allowlist (D4). Can wait until after the first TestFlight build. |

Account deletion (row 1) matters for review: Apple requires in-app account deletion (guideline 5.1.1(v)), and it has to actually work in the build they test.

Also check the Firebase API key. If it's restricted to HTTP referrers in Google Cloud Console → APIs & Services → Credentials, sign-in will fail from `capacitor://localhost`. If there's no referrer restriction, nothing to do.

## Step 3 — Enroll in the Apple Developer Program ($99/year, up to 48 h wait)

Decide Individual or Organization first. It's hard to change later.

|  | Individual | Organization |
| --- | --- | --- |
| Seller name on the App Store | Your legal name | The company name |
| Needs | Apple ID with 2FA, government ID | A registered legal entity (e.g. an LLC), a D-U-N-S number, a website on the company domain |
| Extra wait | None | Getting a D-U-N-S number is free but can take days to weeks |

If you plan to form the LLC (item B6 in the readiness doc) before launch, wait and enroll as that Organization. If you want TestFlight builds now, enroll as an Individual; moving to an Organization later means a request to Apple Support.

1. The fastest route is the **Apple Developer** app on your iPhone (free on the App Store). Sign in with your Apple ID, tap Account → Enroll Now, and follow the prompts. It verifies your ID with the camera and charges through your Apple ID. The alternative is [developer.apple.com/programs/enroll](https://developer.apple.com/programs/enroll/) in a browser.
2. Use your legal name exactly as it appears on your ID.
3. Wait for the "Welcome to the Apple Developer Program" email, usually within 48 hours.
4. Sign in once to [App Store Connect](https://appstoreconnect.apple.com) and accept any agreements it shows. Uploads fail until you do, and Apple re-asks whenever it updates the agreement.

## Step 4 — Register the App ID and create the app record (~15 min)

The bundle ID must match `appId` in `capacitor.config.ts` exactly: `com.intraconnected.app`. Once an app is uploaded under a bundle ID, it can never be changed.

**Register the App ID**

1. Go to [developer.apple.com/account](https://developer.apple.com/account) → Certificates, IDs & Profiles → Identifiers → the blue **+**.
2. Choose **App IDs** → Continue → type **App** → Continue.
3. Description: `Intraconnected`. Bundle ID: **Explicit**, `com.intraconnected.app`.
4. Leave every capability unchecked. The app uses no push notifications, iCloud or Sign in with Apple. Click Continue → Register.

**Create the app in App Store Connect**

1. Go to [App Store Connect](https://appstoreconnect.apple.com) → Apps → the blue **+** → New App.
2. Fill in:
   - Platforms: **iOS**
   - Name: `Intraconnected`. This must be unique across the whole App Store; if it's taken, try `Intraconnected: Mind Map`. You can change it later.
   - Primary language: English (U.S.)
   - Bundle ID: pick `com.intraconnected.app` from the dropdown. If it's missing, the App ID registration above hasn't gone through yet; wait a few minutes.
   - SKU: `intraconnected-ios`. Only you see this.
   - User access: Full Access
3. Click Create. Then open App Information in the left sidebar and copy the **Apple ID**, a number like `6741234567`. Step 9 needs it.

## Step 5 — Create an App Store Connect API key (~10 min)

This key lets Codemagic create certificates, read build numbers and upload to TestFlight on your behalf, so you never need to type your Apple password or 2FA code into it.

1. In [App Store Connect](https://appstoreconnect.apple.com) → **Users and Access** → **Integrations** tab → **App Store Connect API** → **Team Keys**.
2. The first time, click **Request Access** and accept the terms. Only the Account Holder (you) can do this.
3. Click **Generate API Key** (or the **+**). Name: `Codemagic`. Access: **App Manager**.
4. Click **Download API Key**. You get a file named like `AuthKey_ABC123DEFG.p8`. **Apple lets you download it exactly once.** Store it in your password manager right away. If you lose it, revoke the key and make a new one.
5. Copy two values from the same page:
   - **Issuer ID**: a UUID shown above the list of keys.
   - **Key ID**: the 10-character ID in the key's row, also in the file name.

Never commit the `.p8` file to the repo. Anyone holding it with the two IDs can manage your apps.

## Step 6 — Create the Codemagic account and connect Apple (~15 min)

Codemagic's menus move around occasionally. If a label below doesn't match, search their docs for the same term.

**Create the account and add the app**

1. Sign up at [codemagic.io](https://codemagic.io/signup) with **GitHub**, and allow access to the Intraconnected repo. You can limit it to that one repo.
2. Click **Add application** → GitHub → pick the repo → project type **Ionic Capacitor App** (or "Other" if that's missing).
3. When asked how to configure builds, choose **codemagic.yaml**, not the Workflow Editor. The yaml file lives in the repo, so the build setup is versioned with the code.

**Connect the API key from Step 5**

1. Go to **Teams** → **Personal Account** → **Integrations** → **Developer Portal** → **Connect** (or Manage keys → Add key).
2. Fill in:
   - Name: `intraconnected-asc`. The yaml refers to it by exactly this name.
   - Issuer ID and Key ID from Step 5
   - Upload the `.p8` file
3. Save. The integration should show as connected.

Free tier: at the time of writing, personal accounts get a monthly allowance of macOS build minutes (historically 500), and one iOS build of this app should take 10–20. Check [codemagic.io/pricing](https://codemagic.io/pricing) for the current numbers.

## Step 7 — Code signing: certificate and provisioning profile (~20 min)

Every iOS build must be signed with two things: a **distribution certificate** (proves the build is from you) and a **provisioning profile** (ties that certificate to this bundle ID for App Store and TestFlight). Codemagic stores both and applies them at build time.

**7a. Generate the certificate in Codemagic**

1. Teams → Personal Account → **codemagic.yaml settings** → **Code signing identities** → **iOS certificates** tab.
2. Click **Generate certificate**. Choose the `intraconnected-asc` key, type **Apple Distribution**, and reference name `intraconnected_dist`.
3. Codemagic shows a password for the `.p12` file and offers a download. **Save both in your password manager.** The password is shown once, and you need both to sign from anywhere else (another CI service, or a Mac later).

Apple allows only a few distribution certificates per account. Don't generate new ones for every attempt; reuse this one.

**7b. Create the provisioning profile at Apple**

1. [developer.apple.com/account](https://developer.apple.com/account) → Certificates, IDs & Profiles → **Profiles** → **+**.
2. Under Distribution choose **App Store Connect** → Continue.
3. App ID: `com.intraconnected.app` → Continue.
4. Certificate: the **Apple Distribution** one Codemagic just created (it shows your name and an expiry date one year out) → Continue.
5. Name: `Intraconnected App Store` → Generate. No need to download it.

**7c. Pull the profile into Codemagic**

1. Back in Code signing identities → **iOS provisioning profiles** tab → **Fetch profiles**.
2. Tick `Intraconnected App Store`, set reference name `intraconnected_appstore`, and click **Download selected**.

The yaml in Step 9 doesn't name either file. It asks for "App Store distribution for `com.intraconnected.app`" and Codemagic finds the matching pair.

Both expire after a year. Put a calendar reminder for 11 months from today: regenerate the certificate, re-create the profile against it, and fetch it again. Expired signing is the most common reason an old working setup suddenly fails.

## Step 8 — Build variables (~5 min)

Vite bakes `VITE_*` variables into the bundle at build time, so Codemagic needs them too. The only one the app reads today is `VITE_STRIPE_PUBLISHABLE_KEY`; the Firebase config is hardcoded in `src/firebaseConfig.ts`.

1. In Codemagic open the app → **Environment variables** tab.
2. Add:
   - Name: `VITE_STRIPE_PUBLISHABLE_KEY`
   - Value: the `pk_test_…` key for now, the `pk_live_…` key once Stripe is live (B2 in the readiness doc)
   - Group: `production_env`
   - Secure: on (it isn't really secret, but it keeps it out of build logs)
3. Click Add.

If you add another `VITE_*` variable to the web app later, add it here too, or the iOS build silently gets `undefined`. Never put server secrets (`STRIPE_SECRET_KEY` and the like) here; they belong only in Netlify.

## Step 9 — Add codemagic.yaml (~15 min)

Create `codemagic.yaml` at the repo root, replace `0000000000` with the Apple ID number from Step 4, then commit and push. It handles both CocoaPods and Swift Package Manager projects, so you don't need to edit it for either.

```yaml
workflows:
  ios-testflight:
    name: iOS → TestFlight
    instance_type: mac_mini_m2
    max_build_duration: 60
    integrations:
      app_store_connect: intraconnected-asc
    environment:
      ios_signing:
        distribution_type: app_store
        bundle_identifier: com.intraconnected.app
      groups:
        - production_env
      vars:
        APP_STORE_APPLE_ID: 0000000000
      node: 22
      xcode: latest
      cocoapods: default
    scripts:
      - name: Install dependencies
        script: npm ci
      - name: Build web app
        script: npm run build
      - name: Sync Capacitor
        script: npx cap sync ios
      - name: Apply signing profiles
        script: xcode-project use-profiles
      - name: Set build number
        script: |
          LATEST=$(app-store-connect get-latest-testflight-build-number "$APP_STORE_APPLE_ID" 2>/dev/null || echo 0)
          NEW=$((LATEST + 1))
          sed -i '' "s/CURRENT_PROJECT_VERSION = [0-9]*;/CURRENT_PROJECT_VERSION = $NEW;/g" ios/App/App.xcodeproj/project.pbxproj
          echo "Build number: $NEW"
      - name: Build signed IPA
        script: |
          if [ -f ios/App/Podfile ]; then
            xcode-project build-ipa --workspace ios/App/App.xcworkspace --scheme App
          else
            xcode-project build-ipa --project ios/App/App.xcodeproj --scheme App
          fi
    artifacts:
      - build/ios/ipa/*.ipa
      - /tmp/xcodebuild_logs/*.log
    publishing:
      app_store_connect:
        auth: integration
        submit_to_testflight: true
```

What each part does:

| Part | What it does |
| --- | --- |
| `instance_type: mac_mini_m2` | The cloud Mac that runs the build. Covered by the free tier. |
| `integrations.app_store_connect` | Uses the API key from Step 6, by its name. |
| `ios_signing` | Picks the certificate and profile from Step 7 that match App Store distribution for this bundle ID. |
| `groups: production_env` | Loads the Step 8 variables. |
| `npm ci` / `npm run build` | Same as CI: clean install, then `tsc -b && vite build` into `dist/`. A type error stops the build here. |
| `npx cap sync ios` | Copies `dist/` into the iOS project and installs native dependencies (runs `pod install` itself when the project uses CocoaPods). |
| `xcode-project use-profiles` | Writes the signing settings into the Xcode project, since you can't do it in Xcode yourself. |
| Set build number | Apple rejects an upload whose build number was already used. This reads the latest TestFlight number and adds 1 (0 + 1 on the first build). |
| Build signed IPA | Compiles and signs the app into an `.ipa`. |
| `artifacts` | Keeps the `.ipa` and the Xcode logs downloadable from the build page. |
| `publishing` | Uploads the `.ipa` to App Store Connect and makes it available in TestFlight. |

The **version** users see (1.0, 1.1…) is separate from the build number. It's `MARKETING_VERSION` in `ios/App/App.xcodeproj/project.pbxproj`. Change it there by hand (every occurrence) when you release a new version; the build number takes care of itself.

The workflow has no `triggering` section, so it only runs when you start it. Once it's reliable, you can add one to build on every tag like `ios-v1.0.0`.

## Step 10 — First build, TestFlight and your iPhone (~1 h, mostly waiting)

**Run the build**

1. In Codemagic open the app → **Start new build** → pick the branch → workflow **iOS → TestFlight** → Start.
2. Watch the steps. A first build usually takes 10–20 minutes. If a step goes red, open it, read the last 30 lines, and check Troubleshooting below.
3. A green build ends with "Publishing to App Store Connect" succeeded.

**Wait for Apple to process it**

1. In App Store Connect → your app → **TestFlight** tab, the build shows as "Processing" for 5–30 minutes. Apple emails you when it's done.
2. It will then say **Missing Compliance**. Click **Manage** and answer the encryption questions. Intraconnected does use encryption (AES-GCM for idea content, through the browser's built-in Web Crypto, plus HTTPS). Apps that only use standard algorithms provided by the operating system usually qualify for the exemption, but read each question and answer it truthfully for your situation; this is an export-law declaration, not a formality.
3. Once you know your answer, you can skip the prompt on future builds by adding `ITSAppUsesNonExemptEncryption` to `ios/App/App/Info.plist` (a boolean, `false` if you're exempt).

**Install on your iPhone**

1. TestFlight tab → **Internal Testing** → **+** → create a group named `Me` → add yourself as a tester. Internal testers need no Apple review.
2. Turn on automatic distribution for the group, so every new build reaches you without clicking.
3. On the iPhone, install **TestFlight** from the App Store, sign in with the same Apple ID, open the invite email, and tap Install.

**Smoke test on the phone**

- [ ] Sign up with a new account, sign out, sign in again
- [ ] Create, rename, move and delete ideas; checklists and link nodes work
- [ ] Force-quit the app, reopen: are you still signed in, and are all ideas there?
- [ ] Same account on the website: edits made on one show up on the other
- [ ] Link nodes open the page in Safari, not inside the app
- [ ] Nothing offers a purchase (Step 2, row 3)
- [ ] Delete a throwaway account from Profile: it actually deletes (Step 2, row 1)
- [ ] Nothing is hidden under the notch or home bar; sheets rise above the keyboard

## Before submitting for App Store review

TestFlight for yourself needs none of this. A public App Store release needs all of it. Review usually takes 1–3 days, and a rejection just means fixing and resubmitting.

**Make the app feel native (guideline 4.2, minimum functionality)**

Apple rejects apps that feel like a website in a frame. Do D3 from the readiness doc first: status bar and splash screen plugins, keyboard handling, haptics, and secure storage for the encryption key. Also add a real app icon and splash (D2).

**Decide iPhone-only or iPad too**

Capacitor projects target iPhone and iPad by default. If you list iPad, Apple requires iPad screenshots and tests on iPad. Unless you've tested on iPad, make it iPhone-only: in `ios/App/App.xcodeproj/project.pbxproj` set every `TARGETED_DEVICE_FAMILY` to `1`.

**Fill in the App Store listing** (App Store Connect → your app → the iOS version page)

- [ ] Screenshots for the iPhone size App Store Connect marks as required (currently the largest, 6.9-inch display). Take them on your phone from a TestFlight build with a demo account.
- [ ] Description, subtitle (30 characters) and keywords (100 characters, comma-separated)
- [ ] Support URL: `https://intraconnected.app/landing`, which should show `support@intraconnected.app` (check B5 in the readiness doc)
- [ ] Privacy policy URL: `https://intraconnected.app/privacy`
- [ ] Category: Productivity
- [ ] Age rating questionnaire. The app has no objectionable content, but it does let users write anything, so answer "user-generated content" questions honestly.
- [ ] Pricing and Availability: Free

**App Privacy "nutrition label"** (App Store Connect → App Privacy)

- Contact info → Email address: collected, linked to the user, for app functionality. Not used for tracking.
- User content → Other user content (the ideas): collected, linked to the user, for app functionality.
- Tracking: none. There is no analytics or advertising SDK, so no App Tracking Transparency prompt is needed.
- Don't describe the data as "end-to-end encrypted" anywhere in the listing (decision C1).

**App Review Information**

- [ ] A demo account: a verified email and password, with a few sample ideas already in it. Reviewers won't sign up themselves.
- [ ] A note explaining that paid plans are managed on the website and the app sells nothing, that account deletion is in Profile, and that ideas are encrypted on the device.

**Rules to double-check at submission time**

| Guideline | What it means here | Status |
| --- | --- | --- |
| 3.1.1 / 3.1.3 In-app purchase | No purchases in the app; outside the US, no pointers to web purchases either. Rules on external links have been changing; re-read them. | Depends on Step 2, row 3 |
| 4.2 Minimum functionality | Must feel like an app, not a website | Needs D2 and D3 |
| 5.1.1(v) Account deletion | Must be possible inside the app | Exists; must work on the phone (Step 2, row 1) |
| 4.8 Sign in with Apple | Only required when you offer other third-party sign-ins | Not required; email and password only |

**Submit**

In the iOS version page, under Build, select the TestFlight build → Save → **Add for Review** → **Submit**. Choose manual release if you want to pick the launch moment after approval.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| "No matching profiles found" in Apply signing profiles | The profile wasn't fetched, or was made for a different bundle ID or certificate | Redo Step 7c. Check the profile's bundle ID is exactly `com.intraconnected.app` and it uses the certificate from 7a. |
| Signing fails after working for months | Certificate or profile expired (1 year) | Regenerate the certificate, re-create the profile against it, fetch again (Step 7). |
| "Maximum number of certificates generated" | Apple's cap on distribution certificates | Revoke an unused one at developer.apple.com → Certificates, or reuse the saved `.p12`. |
| Build step fails with a TypeScript error | `tsc -b` runs as part of `npm run build` | Same error as local CI. Fix it locally, push, rebuild. |
| `npm ci` fails | `package-lock.json` out of date with `package.json` | Run `npm install` locally, commit the updated lock file. |
| "workspace does not exist" / "project does not exist" | CocoaPods vs Swift Package Manager mismatch | The yaml checks for `ios/App/Podfile`. Make sure the `ios/` folder was committed whole. |
| Upload fails: "bundle version must be higher" | Build number reused | Check the Set build number step's output. As a stopgap, replace `echo 0` with a number above the last upload. |
| Upload fails mentioning an agreement | Apple updated its license agreement | Sign in to App Store Connect and accept it. |
| Build stuck on "Missing Compliance" | Encryption questions unanswered | Answer them (Step 10), or add `ITSAppUsesNonExemptEncryption` to Info.plist. |
| App opens to a blank white screen | Web build missing from the iOS project, or a JS error on start | Make sure the yaml runs `npm run build` before `npx cap sync ios`. For JS errors, reproduce in Chrome's mobile view. |
| Sign-in fails on the phone only | Firebase API key restricted by HTTP referrer | Step 2, last paragraph. |
| Account deletion or feature requests fail on the phone only | Relative function URLs or CORS | Step 2, rows 1 and 2. |
| Logged out every time the app is reopened | Encryption key only in `sessionStorage` | Step 2, row 4. |

## Things to write down

Keep these in your password manager. None of them go in the repo except the two marked public.

| Item | Where it comes from | Secret? | Used in |
| --- | --- | --- | --- |
| Bundle ID `com.intraconnected.app` | You chose it (Step 1) | No (public) | `capacitor.config.ts`, Apple portal, yaml |
| App's Apple ID number | App Store Connect → App Information (Step 4) | No (public) | `codemagic.yaml` |
| Issuer ID | App Store Connect → Integrations (Step 5) | Yes | Codemagic integration |
| Key ID | Same page, and the `.p8` file name (Step 5) | Yes | Codemagic integration |
| `AuthKey_….p8` file | Downloaded once (Step 5) | **Yes, high** | Codemagic integration |
| Distribution certificate `.p12` + its password | Codemagic, shown once (Step 7a) | **Yes, high** | Signing anywhere other than Codemagic |
| Certificate and profile expiry date | Apple portal → Certificates / Profiles | No | Calendar reminder at 11 months |
| Apple Developer renewal date | developer.apple.com → Membership | No | $99/year; apps disappear from the store if it lapses |
