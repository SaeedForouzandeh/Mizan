#!/usr/bin/env bash
# Standardized Production Android Build Script (Signed APK & AAB) for Mizan.
# Usage:
#   bash scripts/build-android.sh --all [--version-name 1.0.0] [--version-code 1]
#   bash scripts/build-android.sh --apk
#   bash scripts/build-android.sh --aab
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="all"
VERSION_NAME=""
VERSION_CODE=""
SKIP_TESTS="false"
ALLOW_EPHEMERAL_KEYSTORE="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apk) MODE="apk"; shift ;;
    --aab) MODE="aab"; shift ;;
    --all) MODE="all"; shift ;;
    --version-name) VERSION_NAME="${2:-}"; shift 2 ;;
    --version-code) VERSION_CODE="${2:-}"; shift 2 ;;
    --skip-tests) SKIP_TESTS="true"; shift ;;
    --allow-ephemeral-keystore) ALLOW_EPHEMERAL_KEYSTORE="true"; shift ;;
    -h|--help)
      cat <<'USAGE'
Mizan Android Production Release Builder

Options:
  --all                        Build both signed APK and signed AAB (default)
  --apk                        Build signed APK only
  --aab                        Build signed AAB only
  --version-name <semver>      Override Android versionName (default: package.json version)
  --version-code <integer>     Override Android versionCode (default: 1)
  --skip-tests                 Skip lint & unit tests (not recommended for production)
  --allow-ephemeral-keystore   Allow CI-only ephemeral keystore when permanent secrets are absent
USAGE
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

cd "$ROOT_DIR"

# 1. Pre-flight toolchain checks
for bin in node npm java keytool; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "Error: Required tool '$bin' was not found in PATH." >&2
    exit 1
  fi
done

SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
if [ -z "$SDK_ROOT" ] || [ ! -d "$SDK_ROOT" ]; then
  echo "Error: ANDROID_SDK_ROOT or ANDROID_HOME must point to a valid Android SDK installation." >&2
  exit 1
fi

BUILD_TOOLS_DIR="$(ls -d "$SDK_ROOT/build-tools/"* 2>/dev/null | sort -V | tail -n 1 || true)"
if [ -z "$BUILD_TOOLS_DIR" ] || [ ! -x "$BUILD_TOOLS_DIR/apksigner" ] || [ ! -x "$BUILD_TOOLS_DIR/zipalign" ]; then
  echo "Error: Android SDK build-tools (zipalign & apksigner) not found under $SDK_ROOT/build-tools." >&2
  exit 1
fi

# Resolve default version metadata
if [ -z "$VERSION_NAME" ]; then
  VERSION_NAME="$(node -p "require('./package.json').version")"
fi
VERSION_NAME="${VERSION_NAME#v}"
VERSION_CODE="${VERSION_CODE:-1}"

# 2. Resolve production signing credentials (refuse accidental debug/unsigned production builds)
if [ -f "$ROOT_DIR/keystore.properties" ] && [ -z "${ANDROID_KEYSTORE_PATH:-}" ]; then
  while IFS='=' read -r k v; do
    case "$k" in
      storeFile) ANDROID_KEYSTORE_PATH="${v//$'\r'/}" ;;
      storePassword) ANDROID_KEYSTORE_PASSWORD="${v//$'\r'/}" ;;
      keyAlias) ANDROID_KEY_ALIAS="${v//$'\r'/}" ;;
      keyPassword) ANDROID_KEY_PASSWORD="${v//$'\r'/}" ;;
    esac
  done < "$ROOT_DIR/keystore.properties"
fi

if [ -n "${ANDROID_KEYSTORE_BASE64:-}" ] && [ -z "${ANDROID_KEYSTORE_PATH:-}" ]; then
  DECODED_KS="$ROOT_DIR/mizan-release.jks"
  echo "$ANDROID_KEYSTORE_BASE64" | base64 -d > "$DECODED_KS"
  chmod 600 "$DECODED_KS"
  ANDROID_KEYSTORE_PATH="$DECODED_KS"
fi

if [ -z "${ANDROID_KEYSTORE_PATH:-}" ] || [ -z "${ANDROID_KEYSTORE_PASSWORD:-}" ] || [ -z "${ANDROID_KEY_ALIAS:-}" ]; then
  if [ "$ALLOW_EPHEMERAL_KEYSTORE" = "true" ]; then
    echo "::warning::No permanent keystore configured. Creating ephemeral CI verification keystore (DO NOT distribute to end users)."
    ANDROID_KEYSTORE_PATH="$ROOT_DIR/mizan-ci-ephemeral.jks"
    ANDROID_KEYSTORE_PASSWORD="mizanCiVerifyPass2026"
    ANDROID_KEY_ALIAS="mizan-release"
    ANDROID_KEY_PASSWORD="mizanCiVerifyPass2026"
    rm -f "$ANDROID_KEYSTORE_PATH"
    keytool -genkeypair -v \
      -keystore "$ANDROID_KEYSTORE_PATH" \
      -alias "$ANDROID_KEY_ALIAS" \
      -keyalg RSA -keysize 4096 -sigalg SHA256withRSA -validity 365 \
      -storetype PKCS12 \
      -storepass "$ANDROID_KEYSTORE_PASSWORD" \
      -keypass "$ANDROID_KEY_PASSWORD" \
      -dname "CN=Mizan CI Verification, OU=CI, O=Mizan, L=Tehran, ST=Tehran, C=IR"
  else
    echo "Error: Missing Android release signing credentials!" >&2
    echo "To prevent Google Play Protect 'Unsafe app' warnings, production builds require a permanent release keystore." >&2
    echo "Run 'npm run android:keystore' to generate one locally, or set ANDROID_KEYSTORE_BASE64 / ANDROID_KEYSTORE_PASSWORD / ANDROID_KEY_ALIAS / ANDROID_KEY_PASSWORD." >&2
    exit 1
  fi
fi

ANDROID_KEY_PASSWORD="${ANDROID_KEY_PASSWORD:-$ANDROID_KEYSTORE_PASSWORD}"
if [ ! -f "$ANDROID_KEYSTORE_PATH" ] && [ -f "$ROOT_DIR/$ANDROID_KEYSTORE_PATH" ]; then
  ANDROID_KEYSTORE_PATH="$ROOT_DIR/$ANDROID_KEYSTORE_PATH"
fi
if [ ! -f "$ANDROID_KEYSTORE_PATH" ]; then
  echo "Error: Keystore file not found at $ANDROID_KEYSTORE_PATH" >&2
  exit 1
fi

export ANDROID_KEYSTORE_PATH
export ANDROID_KEYSTORE_PASSWORD
export ANDROID_KEY_ALIAS
export ANDROID_KEY_PASSWORD
export NODE_ENV="production"

# 3. Run quality checks & production web build
if [ "$SKIP_TESTS" != "true" ]; then
  echo "==> Running TypeScript check and unit tests..."
  npm run lint
  npm test
fi

echo "==> Building production web bundle (dist/)..."
npm run build

# 4. Initialize / sync Capacitor Android shell
if [ ! -d "$ROOT_DIR/node_modules/@capacitor/android" ]; then
  echo "==> Installing Capacitor Android tooling (--no-save)..."
  npm install --no-save @capacitor/core @capacitor/cli @capacitor/android
fi

if [ ! -d "$ROOT_DIR/android" ]; then
  echo "==> Creating Android project via Capacitor..."
  npx cap add android
fi

echo "==> Syncing web assets into Android project..."
npx cap sync android

# 5. Apply production security hardening & version metadata
echo "==> Applying Android production security hardening (v${VERSION_NAME} / code ${VERSION_CODE})..."
node "$ROOT_DIR/scripts/harden-android.mjs" \
  --android-dir "$ROOT_DIR/android" \
  --version-name "$VERSION_NAME" \
  --version-code "$VERSION_CODE"

# 6. Execute Gradle Release Build(s)
OUT_DIR="$ROOT_DIR/release-artifacts"
mkdir -p "$OUT_DIR"

GRADLE_TASKS=()
if [ "$MODE" = "apk" ] || [ "$MODE" = "all" ]; then
  GRADLE_TASKS+=("assembleRelease")
fi
if [ "$MODE" = "aab" ] || [ "$MODE" = "all" ]; then
  GRADLE_TASKS+=("bundleRelease")
fi

echo "==> Running Gradle tasks: ${GRADLE_TASKS[*]}..."
(
  cd "$ROOT_DIR/android"
  chmod +x gradlew
  ./gradlew --no-daemon "${GRADLE_TASKS[@]}"
)

# 7. Verify & export signed release artifacts + SHA-256 checksums
APK_SIGNED_FINAL="$OUT_DIR/mizan-v${VERSION_NAME}-release-signed.apk"
AAB_SIGNED_FINAL="$OUT_DIR/mizan-v${VERSION_NAME}-release-signed.aab"

if [ "$MODE" = "apk" ] || [ "$MODE" = "all" ]; then
  RAW_RELEASE_APK="$ROOT_DIR/android/app/build/outputs/apk/release/app-release.apk"
  RAW_UNSIGNED_APK="$ROOT_DIR/android/app/build/outputs/apk/release/app-release-unsigned.apk"

  if [ -f "$RAW_RELEASE_APK" ]; then
    cp "$RAW_RELEASE_APK" "$APK_SIGNED_FINAL"
  elif [ -f "$RAW_UNSIGNED_APK" ]; then
    ALIGNED_TMP="$OUT_DIR/mizan-aligned.apk"
    "$BUILD_TOOLS_DIR/zipalign" -f -v -p 4 "$RAW_UNSIGNED_APK" "$ALIGNED_TMP"
    "$BUILD_TOOLS_DIR/apksigner" sign \
      --ks "$ANDROID_KEYSTORE_PATH" \
      --ks-key-alias "$ANDROID_KEY_ALIAS" \
      --ks-pass "pass:$ANDROID_KEYSTORE_PASSWORD" \
      --key-pass "pass:$ANDROID_KEY_PASSWORD" \
      --v1-signing-enabled true \
      --v2-signing-enabled true \
      --v3-signing-enabled true \
      --out "$APK_SIGNED_FINAL" \
      "$ALIGNED_TMP"
    rm -f "$ALIGNED_TMP"
  else
    echo "Error: Expected release APK not found in android/app/build/outputs/apk/release/." >&2
    exit 1
  fi

  echo "==> Verifying APK v1/v2/v3 cryptographic signature..."
  "$BUILD_TOOLS_DIR/apksigner" verify --verbose --print-certs "$APK_SIGNED_FINAL"
  cp "$APK_SIGNED_FINAL" "$OUT_DIR/mizan-release-signed.apk"
fi

if [ "$MODE" = "aab" ] || [ "$MODE" = "all" ]; then
  RAW_AAB="$ROOT_DIR/android/app/build/outputs/bundle/release/app-release.aab"
  if [ ! -f "$RAW_AAB" ]; then
    echo "Error: Expected release AAB not found at $RAW_AAB." >&2
    exit 1
  fi
  cp "$RAW_AAB" "$AAB_SIGNED_FINAL"
  echo "==> Verifying AAB cryptographic signature..."
  # NOTE: do NOT use `jarsigner -verify -strict` here. Android upload keys
  # are self-signed by design, and -strict turns that into a fatal error
  # ("PKIX path building failed", exit code 4) even though the AAB is
  # correctly signed. Plain -verify prints "jar verified" (exit 0) for a
  # correctly signed bundle, and the grep below still fails the build if
  # the bundle is unsigned or broken.
  JARSIGNER_OUT="$(jarsigner -verify "$AAB_SIGNED_FINAL" 2>&1)"
  echo "$JARSIGNER_OUT"
  if ! printf '%s' "$JARSIGNER_OUT" | grep -q "jar verified"; then
    echo "Error: AAB signature verification failed." >&2
    exit 1
  fi
  cp "$AAB_SIGNED_FINAL" "$OUT_DIR/mizan-release-signed.aab"
fi

# Generate SHA-256 checksums for release integrity
(
  cd "$OUT_DIR"
  sha256sum mizan-v*-release-signed.* > SHA256SUMS.txt
)

echo ""
echo "=================================================================="
echo "Android Release Build Complete (v${VERSION_NAME} / code ${VERSION_CODE})"
echo "Artifacts saved in: $OUT_DIR"
cat "$OUT_DIR/SHA256SUMS.txt"
echo "=================================================================="
