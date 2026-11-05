#!/usr/bin/env bash
# Static sanity checks on a built IPA. Usage: scripts/verify-ipa.sh path/to/Macro.ipa [expected-bundle-id] [healthkit:0|1]
# This proves the archive is structurally sound. It does NOT prove the app installs or runs on a device.
set -euo pipefail
IPA="${1:?usage: verify-ipa.sh <ipa> [bundle-id] [healthkit 0|1]}"
EXPECTED_ID="${2:-io.fuelprivate.tracker.q7k2m9x4}"
HK="${3:-0}"
fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "ok:   $*"; }

[ -f "$IPA" ] || fail "no such file $IPA"
W="$(mktemp -d)"; trap 'rm -rf "$W"' EXIT
unzip -q "$IPA" -d "$W"
APP="$(find "$W/Payload" -maxdepth 1 -name '*.app' -type d | head -1)"
[ -n "$APP" ] || fail "no .app inside Payload/"
ok "found $(basename "$APP")"

plist() { /usr/libexec/PlistBuddy -c "Print :$1" "$APP/Info.plist" 2>/dev/null || python3 - "$APP/Info.plist" "$1" <<'P'
import plistlib,sys
d=plistlib.load(open(sys.argv[1],'rb')); print(d.get(sys.argv[2],''))
P
}

ID="$(plist CFBundleIdentifier)"
[ "$ID" = "$EXPECTED_ID" ] || fail "bundle id is '$ID', expected '$EXPECTED_ID' (changing it makes iOS treat this as a different app and the old data is NOT carried over)"
ok "bundle id $ID"
for k in CFBundleExecutable CFBundleShortVersionString CFBundleVersion NSCameraUsageDescription NSMotionUsageDescription; do
  [ -n "$(plist $k)" ] || fail "Info.plist missing $k"
done
ok "Info.plist keys present (version $(plist CFBundleShortVersionString) build $(plist CFBundleVersion))"

EXE="$APP/$(plist CFBundleExecutable)"
[ -f "$EXE" ] || fail "executable missing"
if command -v lipo >/dev/null; then lipo -archs "$EXE" | grep -q arm64 || fail "executable has no arm64 slice"; ok "arm64 slice present"
elif command -v file >/dev/null; then file "$EXE" | grep -q arm64 || fail "executable is not arm64"; ok "arm64 (via file)"; fi

[ -f "$APP/main.jsbundle" ] || fail "main.jsbundle missing: this is a debug build that wants a dev server, not a standalone app"
[ "$(stat -c %s "$APP/main.jsbundle" 2>/dev/null || stat -f %z "$APP/main.jsbundle")" -gt 100000 ] || fail "main.jsbundle suspiciously small"
ok "main.jsbundle present"
[ -d "$APP/Frameworks" ] || echo "note: no Frameworks/ directory (fine if everything is statically linked)"
find "$APP" -name '*.mobileprovision' | grep -q . && echo "note: embedded provisioning profile present (Sideloadly replaces it)"
[ -d "$APP/PlugIns" ] && fail "unexpected app extensions in PlugIns/ (they need their own App IDs; not supported by this build)"

if [ "$HK" = "1" ]; then
  # An unsigned archive carries no entitlements in its signature, so the HealthKit variant is checked at the
  # project level by the workflow (ios/*/*.entitlements). Here we only check the usage string is present.
  [ -n "$(plist NSHealthShareUsageDescription)" ] || fail "HealthKit variant but NSHealthShareUsageDescription missing"
  ok "HealthKit usage description present (entitlement itself is checked in the project and is applied only by signing)"
fi
echo "ALL CHECKS PASSED (structural only; not installed, not launched)"
