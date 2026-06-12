#!/usr/bin/env bash
#
# Builds, packages, signs and installs the Air Quality menu bar app.
#
# The bundle's Info.plist is the versioned source of truth at menubar/Info.plist
# (NOT inside build/, which is generated and gitignored). This script assembles
# build/AirQuality.app around it, signs it with a STABLE code-signing identity,
# then installs to /Applications.
#
# Why the stable signature matters: macOS Local Network privacy keys the
# permission grant to the app's code signature. Ad-hoc signing changes the
# signature every build, so the grant never sticks and the MQTT socket gets
# silently blocked ("No route to host"). See CLAUDE.md → menubar for the full
# story. The identity below must exist in the login keychain (one-time setup:
# Keychain Access → Certificate Assistant → Create a Certificate, type
# "Code Signing", named exactly as SIGN_IDENTITY).
#
# Usage:
#   ./package.sh              # build, sign, install to /Applications, open
#   ./package.sh --no-install # build + sign the bundle only
#
set -euo pipefail

cd "$(dirname "$0")"

SIGN_IDENTITY="${SIGN_IDENTITY:-Teras Air Quality Signing}"
APP="build/AirQuality.app"
INSTALL=1
[[ "${1:-}" == "--no-install" ]] && INSTALL=0

# Fail early if the signing identity is missing — an unsigned/ad-hoc bundle
# would break the Local Network permission grant.
if ! security find-identity -p codesigning | grep -q "$SIGN_IDENTITY"; then
    echo "ERROR: code-signing identity '$SIGN_IDENTITY' not found in keychain." >&2
    echo "Create it once: Keychain Access → Certificate Assistant → Create a Certificate" >&2
    echo "  → type 'Code Signing', name '$SIGN_IDENTITY'. (See CLAUDE.md → menubar.)" >&2
    exit 1
fi

echo "==> Building (release)"
swift build -c release

echo "==> Assembling $APP from menubar/Info.plist"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"
cp Info.plist "$APP/Contents/Info.plist"
cp .build/release/AirQuality "$APP/Contents/MacOS/AirQuality"

echo "==> Signing with '$SIGN_IDENTITY'"
codesign --force --sign "$SIGN_IDENTITY" "$APP"

if [[ "$INSTALL" == "1" ]]; then
    echo "==> Installing to /Applications"
    # Quit any running instance so the new binary is the one that launches.
    pkill -f "/Applications/AirQuality.app/Contents/MacOS/AirQuality" 2>/dev/null || true
    sleep 1
    rm -rf /Applications/AirQuality.app
    cp -R "$APP" /Applications/AirQuality.app
    open /Applications/AirQuality.app
    echo "==> Done. On first launch, allow the Local Network prompt."
else
    echo "==> Done (bundle at $APP, not installed)."
fi
