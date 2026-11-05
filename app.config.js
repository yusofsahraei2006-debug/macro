// Dynamic Expo config layered on app.json.
//
// HealthKit is OPT-IN per build. Adding the HealthKit native module's config plugin makes Xcode request the
// `com.apple.developer.healthkit` entitlement, which a free Apple ID / Sideloadly install may not be able to
// provide. The default build therefore omits it and the app uses phone-motion steps instead.
//
//   EXPO_PUBLIC_HEALTHKIT_ENABLED=1 npx expo prebuild --platform ios   -> build WITH the HealthKit entitlement
//
// The same variable is inlined into the JavaScript bundle (src/config.ts), so the UI only offers HealthKit
// in builds that actually contain it. Set it for BOTH prebuild and the Xcode build.
const withHealthKit = process.env.EXPO_PUBLIC_HEALTHKIT_ENABLED === '1';

module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    ...(withHealthKit
      ? [
          [
            '@kingstinct/react-native-healthkit',
            {
              NSHealthShareUsageDescription:
                'Macro reads your steps, distance, active energy, workouts and weight to show your activity. Health data never leaves your device.',
              // Macro never writes to Health.
              NSHealthUpdateUsageDescription: false,
              // Background delivery needs an extra entitlement that free accounts cannot get.
              background: false,
            },
          ],
        ]
      : []),
  ],
});
