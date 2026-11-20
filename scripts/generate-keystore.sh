#!/usr/bin/env bash
# Generates a permanent production release Keystore for signing Mizan Android APK/AAB builds.
# Keeps all credentials strictly local (gitignored) and outputs Base64 + SHA-256 fingerprint.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEYSTORE_FILE="${1:-$ROOT_DIR/mizan-release.jks}"
KEY_ALIAS="${ANDROID_KEY_ALIAS:-mizan-release}"
KEY_VALIDITY_DAYS="${ANDROID_KEY_VALIDITY:-10000}"

if ! command -v keytool >/dev/null 2>&1; then
  echo "Error: 'keytool' (JDK 17/21) is required to generate an Android release keystore." >&2
  exit 1
fi

if [ -f "$KEYSTORE_FILE" ]; then
  echo "Error: Keystore already exists at $KEYSTORE_FILE" >&2
  echo "Refusing to overwrite an existing signing key (losing it prevents updating installed apps)." >&2
  exit 1
fi

STORE_PASS="${ANDROID_KEYSTORE_PASSWORD:-}"
KEY_PASS="${ANDROID_KEY_PASSWORD:-}"

if [ -z "$STORE_PASS" ]; then
  read -r -s -p "Enter strong Keystore password (min 8 chars): " STORE_PASS
  echo ""
fi
if [ "${#STORE_PASS}" -lt 8 ]; then
  echo "Error: Keystore password must be at least 8 characters." >&2
  exit 1
fi

if [ -z "$KEY_PASS" ]; then
  read -r -s -p "Enter Key password (press Enter to reuse Keystore password): " KEY_PASS
  echo ""
  KEY_PASS="${KEY_PASS:-$STORE_PASS}"
fi

DNAME="${ANDROID_KEY_DNAME:-CN=Mizan Ledger, OU=Mobile, O=Mizan, L=Tehran, ST=Tehran, C=IR}"

keytool -genkeypair -v \
  -keystore "$KEYSTORE_FILE" \
  -alias "$KEY_ALIAS" \
  -keyalg RSA \
  -keysize 4096 \
  -sigalg SHA256withRSA \
  -validity "$KEY_VALIDITY_DAYS" \
  -storetype PKCS12 \
  -storepass "$STORE_PASS" \
  -keypass "$KEY_PASS" \
  -dname "$DNAME"

chmod 600 "$KEYSTORE_FILE"

cat > "$ROOT_DIR/keystore.properties" <<EOF
storeFile=$(basename "$KEYSTORE_FILE")
storePassword=$STORE_PASS
keyAlias=$KEY_ALIAS
keyPassword=$KEY_PASS
EOF
chmod 600 "$ROOT_DIR/keystore.properties"

echo ""
echo "=================================================================="
echo "Keystore generated successfully: $KEYSTORE_FILE"
echo "Local signing config written to: $ROOT_DIR/keystore.properties (gitignored)"
echo "=================================================================="
echo ""
echo "SHA-256 Certificate Fingerprint (for Play Console / Digital Asset Links):"
keytool -list -v -keystore "$KEYSTORE_FILE" -alias "$KEY_ALIAS" -storepass "$STORE_PASS" | grep -E "SHA256:|SHA1:" || true
echo ""
echo "For GitHub Actions Secret 'ANDROID_KEYSTORE_BASE64', run:"
echo "  base64 -w 0 \"$KEYSTORE_FILE\""
echo ""
echo "WARNING: Back up $KEYSTORE_FILE in a password manager and NEVER commit it to Git!"
