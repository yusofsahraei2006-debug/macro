/**
 * True only for builds produced with the HealthKit entitlement (see app.config.js).
 * In other builds the HealthKit native module is never loaded or called, so a missing
 * entitlement can never crash the app.
 */
export const HEALTHKIT_BUILD = process.env.EXPO_PUBLIC_HEALTHKIT_ENABLED === '1';
