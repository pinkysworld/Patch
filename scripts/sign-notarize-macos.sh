#!/bin/bash
set -euo pipefail

APP_PATH="${1:-}"
if [[ -z "$APP_PATH" || ! -d "$APP_PATH" || "$APP_PATH" != *.app ]]; then
  echo "Usage: sign-notarize-macos.sh /path/to/App.app" >&2
  exit 2
fi

: "${PATCH_MACOS_P12_BASE64:?PATCH_MACOS_P12_BASE64 is required when macOS signing is required}"
: "${PATCH_MACOS_P12_PASSWORD:?PATCH_MACOS_P12_PASSWORD is required when macOS signing is required}"
: "${PATCH_MACOS_SIGN_IDENTITY:?PATCH_MACOS_SIGN_IDENTITY is required when macOS signing is required}"
: "${PATCH_APPLE_ID:?PATCH_APPLE_ID is required when macOS notarization is required}"
: "${PATCH_APPLE_TEAM_ID:?PATCH_APPLE_TEAM_ID is required when macOS notarization is required}"
: "${PATCH_APPLE_APP_PASSWORD:?PATCH_APPLE_APP_PASSWORD is required when macOS notarization is required}"

VERIFICATION_PATH="$(dirname "$APP_PATH")/.patch-macos-signature-verified"
rm -f "$VERIFICATION_PATH"

WORK="$(mktemp -d "${TMPDIR:-/tmp}/patch-signing.XXXXXX")"
KEYCHAIN="$WORK/patch-signing.keychain-db"
P12="$WORK/signing.p12"
NOTARY_ZIP="$WORK/notary.zip"
NOTARY_JSON="$WORK/notary.json"
KEYCHAIN_PASSWORD="$(openssl rand -hex 24)"
ORIGINAL_KEYCHAINS=()
while IFS= read -r line; do
  line="${line#\"}"; line="${line%\"}"
  [[ -n "$line" ]] && ORIGINAL_KEYCHAINS+=("$line")
done < <(security list-keychains -d user)
cleanup() {
  if ((${#ORIGINAL_KEYCHAINS[@]})); then security list-keychains -d user -s "${ORIGINAL_KEYCHAINS[@]}" >/dev/null 2>&1 || true; fi
  security delete-keychain "$KEYCHAIN" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT INT TERM

python3 - "$P12" <<'PY'
import base64, os, pathlib, sys
pathlib.Path(sys.argv[1]).write_bytes(base64.b64decode(os.environ['PATCH_MACOS_P12_BASE64'], validate=True))
PY
security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN"
security set-keychain-settings -lut 21600 "$KEYCHAIN"
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN"
security import "$P12" -k "$KEYCHAIN" -P "$PATCH_MACOS_P12_PASSWORD" -T /usr/bin/codesign -T /usr/bin/security
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN" >/dev/null
security list-keychains -d user -s "$KEYCHAIN" "${ORIGINAL_KEYCHAINS[@]}"

codesign --force --deep --options runtime --timestamp --sign "$PATCH_MACOS_SIGN_IDENTITY" "$APP_PATH"
codesign --verify --deep --strict --verbose=2 "$APP_PATH"

ditto -c -k --sequesterRsrc --keepParent "$APP_PATH" "$NOTARY_ZIP"
xcrun notarytool submit "$NOTARY_ZIP" \
  --apple-id "$PATCH_APPLE_ID" \
  --team-id "$PATCH_APPLE_TEAM_ID" \
  --password "$PATCH_APPLE_APP_PASSWORD" \
  --wait \
  --output-format json > "$NOTARY_JSON"
python3 - "$NOTARY_JSON" <<'PY'
import json, sys
with open(sys.argv[1], encoding='utf-8') as handle:
    result = json.load(handle)
status = result.get('status')
if status != 'Accepted':
    print(f"Apple notarization was not accepted: {status or 'missing status'}", file=sys.stderr)
    raise SystemExit(2)
print(f"Apple notarization accepted: {result.get('id', 'unknown submission')}")
PY
xcrun stapler staple "$APP_PATH"
xcrun stapler validate "$APP_PATH"
codesign --verify --deep --strict --verbose=2 "$APP_PATH"
spctl --assess --type execute --verbose=2 "$APP_PATH"
printf '%s' 'macos-developer-id-notarized-v1' > "$VERIFICATION_PATH"

printf 'Verified Developer ID signature, notarization and Gatekeeper assessment for %s\n' "$APP_PATH"
