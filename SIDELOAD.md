# Installing Macro with Sideloadly (free Apple ID)

**Status: nothing in this document has been verified on a device.** The workflow has never been run, the IPA has never been installed, and the app has never been launched. Treat the first build as a test.

## 1. Build the IPA (no Mac)
1. Push this project to a GitHub repository (private is fine). Do **not** commit certificates or Apple credentials; none are needed.
2. Repository → **Actions → "Build IPA for Sideloadly (free Apple ID)" → Run workflow**. Leave **healthkit** unchecked (see section 4).
3. When it finishes, download the artifact `Macro-unsigned-ipa` (contains `Macro-unsigned.ipa` and a SHA-256 file). If it fails, open the log; the first run will probably need small fixes. A failed run uploads the xcodebuild log.
4. Optional: add a repository secret `EXPO_PUBLIC_USDA_API_KEY` for USDA search. Note it is compiled into the app, so it is not secret from you or anyone who has the IPA.

A green run proves only that the app compiled and the IPA has the right bundle ID, a JavaScript bundle, an arm64 binary and the required Info.plist keys (`scripts/verify-ipa.sh`). It does not prove the app installs or runs.

## 2. Install
1. Install Sideloadly on your PC/Mac and connect the iPhone (trust the computer; enable Developer Mode in Settings → Privacy & Security on iOS 16+).
2. Drag `Macro-unsigned.ipa` into Sideloadly, enter your Apple ID, click **Start**.
3. On the phone: Settings → General → VPN & Device Management → trust your Apple ID profile.

## 3. Keeping your data when updating
- iOS keeps an app's data when a new build is installed over it **with the same bundle ID and the same signing identity**. The bundle ID `io.fuelprivate.tracker.q7k2m9x4` must never change.
- Use the **same Apple ID** every time. Do not tick any option in Sideloadly that changes the bundle ID, and do not uninstall the app first, because uninstalling deletes the database.
- Sideloadly may rewrite the bundle ID for free accounts (it adds your Team ID). Whether it does so consistently is **unverified**; check after your first update that your diary is still there before relying on it. Export/backup is planned for Phase 5, so until then **you have no backup of your diary**.
- Free-account profiles expire after **7 days**; re-run Sideloadly (same Apple ID, same IPA or a newer one) before then. Apple limits free accounts to about 10 new App IDs per 7 days, 3 apps and 3 devices.
- The database migrates forward automatically (tested: v2 data survives the v3 migration). It refuses to open a database from a newer app version rather than damaging it.

## 4. What free signing cannot do (HealthKit, widgets, Shortcuts)
- **HealthKit** needs the `com.apple.developer.healthkit` entitlement. Sideloadly's own changelog says custom entitlements require a paid Apple Developer account, so with a free Apple ID the HealthKit build will most likely fail to sign or crash when asked for access. Sideloadly cannot add entitlements the Apple account is not allowed to grant. This is **unverified for your account**.
  - The default build therefore excludes HealthKit and uses **Phone motion** (Core Motion, no entitlement): steps and walking distance for roughly the last 7 days, kept in a local cache afterwards. No active calories, no workouts, no Apple Health weight.
  - If you do try the HealthKit build, the app records an "attempting" flag before asking. If iOS kills the app, the next launch switches HealthKit off and says why.
  - The one reliable route to real Apple Health data is a paid Apple Developer Program account ($99/yr).
- **Widgets** are separate app extensions that need their own App ID and, to share data with the app, an App Group. App Groups are not available to free accounts, and extra App IDs eat the 10-per-week limit. Phase 5 widgets are therefore expected not to work with free sideloading. Not tested.
- **App Shortcuts (App Intents)** may work without special entitlements but need native Swift code that does not exist yet, and I have not verified how Sideloadly handles them.

## 5. If the app will not install or launch
Send me the Sideloadly error text and, if it installs but crashes, what you did right before. Do not assume the IPA is valid just because the workflow went green.
