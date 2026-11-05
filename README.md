# Macro — private iPhone nutrition & fitness tracker

React Native (Expo SDK 54, development build) · TypeScript · Expo Router · SQLite · Open Food Facts · USDA FoodData Central.
No account, no ads, no analytics. All diary data stays on the device.

## Status

| Phase | Scope | State |
|---|---|---|
| 1 | Theme, navigation, Home dashboard, SQLite, diary, goals | Written. Logic and SQL tested; **never launched on a device** |
| 2 | Barcode scanner, food search, custom foods, saved meals, logging | Written. Logic and SQL tested; **never launched on a device** |
| 3 | Steps/distance/active energy (HealthKit or phone motion), workouts, weight, measurements, water history, exercise-calorie option | Written. Pure logic, migrations and SQL tested; **HealthKit and motion code never run on a device; native API usage unverified** |
| 4 | Meal planning, voice logging, weekly budget, comparison, reports, notifications | Not started |
| 5 | Widgets, Siri shortcuts, backup/export | Not started |
| 6 | IPA | Unsigned-IPA workflow for Sideloadly written, **never run**; paid-signing workflow is an untested template |

Nothing here has been run on an iPhone yet. Treat every screen as unverified until you have tried it.

## Requirements

- macOS with Xcode (current release) for building iOS
- Node.js 20.19 or newer
- A physical iPhone (the camera scanner does not work in the simulator)

## First run

```bash
npm install
npx expo install --check     # reports/fixes any package that doesn't match SDK 54
cp .env.example .env         # optional: add a free USDA API key
npx expo prebuild --platform ios
npx expo run:ios --device    # builds a development build onto a connected iPhone
npm start                    # later runs: start the dev server for the installed build
```

Commit the generated `package-lock.json`. The `ios/` folder is generated and git-ignored.

Expo Go is not the target; use the development build so native modules (camera, SQLite, later HealthKit and widgets) work.

## Checks

```bash
npm test             # Jest unit tests
npm run typecheck    # tsc --noEmit
npm run doctor       # dependency/SDK compatibility
```

## Data sources

- **Packaged products and barcodes:** Open Food Facts (free, no key, community-edited, so always check against the label).
- **Generic foods:** USDA FoodData Central (Foundation + SR Legacy). Works with the shared `DEMO_KEY`, which is heavily rate limited. A free personal key in `.env` is recommended.
- Energy handling: Open Food Facts reports kilojoules in `energy_100g`; the app converts kJ to kcal (÷ 4.184) and never treats kJ as kcal. Products with no energy value are rejected rather than guessed.
- Foods you look up, scan or log are saved in SQLite, so they stay searchable and loggable offline. Searching online needs a connection.

## Installing on your own iPhone

An unsigned IPA cannot be installed. You need Apple signing.

**Free Apple ID (Xcode "Personal Team")**
- Run `npx expo run:ios --device` or open `ios/*.xcworkspace` in Xcode and choose your Personal Team.
- Builds expire after **7 days** and must be re-installed. Limits apply to the number of apps and App IDs.
- Several capabilities are unavailable to free accounts. Check Apple's capability table for HealthKit and App Groups before Phase 3/5, since widgets need shared storage.

**Paid Apple Developer Program (about £79/$99 per year)**
- Needed for longer-lived signing, ad-hoc distribution to registered devices, and the full capability list.
- Create a development or ad-hoc provisioning profile for your bundle ID (change `com.example.fuel` in `app.json` to your own).

See **SIDELOAD.md** for the free-Apple-ID route (`.github/workflows/ios-sideload.yml`, unsigned IPA, never run yet).

`.github/workflows/ios-build-signed.yml` is a manual, **untested** template for producing an IPA in GitHub Actions. It expects these repository secrets: `IOS_CERT_P12_BASE64`, `IOS_CERT_PASSWORD`, `IOS_PROFILE_BASE64`, `IOS_PROFILE_NAME`, `IOS_TEAM_ID`, `IOS_BUNDLE_ID`, `KEYCHAIN_PASSWORD`, and optionally `EXPO_PUBLIC_USDA_API_KEY`. Never commit certificates, profiles or keys.

## Updating

Pull changes, run `npm install`, then `npx expo prebuild --platform ios` again if native modules changed, and re-run `npx expo run:ios --device`. Database changes are applied automatically by versioned migrations in `src/db/schema.ts`.

## Project layout

```
app/        Expo Router screens (tabs, add sheet, scan, search, log, custom-food, meals)
src/theme   colour tokens and ThemeProvider (follows system light/dark)
src/db      SQLite schema, migrations, repositories
src/services Open Food Facts, USDA, barcode validation, HTTP helper
src/utils   nutrition maths, dates, input parsing
src/components shared UI
src/__tests__  unit tests
```

## Privacy

Diary, foods, meals and settings live only in the on-device SQLite database. The only network calls are food lookups to Open Food Facts and USDA (the search text or barcode is sent). Profile → "Delete all data" erases everything.
