#!/usr/bin/env node
/**
 * Applies production Android security hardening and versioning to the generated
 * Capacitor `android/` directory before building a signed APK / AAB.
 *
 * Security protections applied (prevents Play Protect / Unsafe warnings):
 * 1. Disables cleartext HTTP traffic (`usesCleartextTraffic="false"` + `network_security_config.xml`).
 * 2. Disables ADB app data extraction (`allowBackup="false"`).
 * 3. Explicitly disables debugging (`debuggable="false"`).
 * 4. Enables native RTL layout (`supportsRtl="true"`).
 * 5. Injects ProGuard/R8 shrinking + log stripping (`proguard-rules.pro`).
 * 6. Wires v1/v2/v3/v4 release signing (`release-signing.gradle`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * Pure helper exported for unit testing and reuse.
 * Idempotently injects production security attributes into AndroidManifest.xml.
 */
export function hardenAndroidManifestXml(manifestXml) {
  const appTagRegex = /<application\b([^>]*)>/;
  const match = manifestXml.match(appTagRegex);
  if (!match) {
    throw new Error('Could not locate <application ...> tag in AndroidManifest.xml');
  }

  let attrs = match[1];

  const requiredAttrs = [
    ['android:usesCleartextTraffic', 'false'],
    ['android:networkSecurityConfig', '@xml/network_security_config'],
    ['android:allowBackup', 'false'],
    ['android:supportsRtl', 'true'],
  ];

  // Remove any accidental android:debuggable="true" so release is never debuggable
  attrs = attrs.replace(/\s+android:debuggable="[^"]*"/g, '');

  for (const [name, value] of requiredAttrs) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existingRegex = new RegExp(`(\\s+)${escaped}="[^"]*"`);
    if (existingRegex.test(attrs)) {
      attrs = attrs.replace(existingRegex, `$1${name}="${value}"`);
    } else {
      attrs = `${attrs}\n        ${name}="${value}"`;
    }
  }

  return manifestXml.replace(appTagRegex, `<application${attrs}>`);
}

/**
 * Pure helper to patch versionCode, versionName, and apply release-signing.gradle
 * inside android/app/build.gradle idempotently.
 */
export function patchAppBuildGradle(gradleText, { versionCode, versionName } = {}) {
  let updated = gradleText;

  if (versionCode !== undefined && versionCode !== null && String(versionCode).trim() !== '') {
    const numericCode = Number.parseInt(String(versionCode), 10);
    if (!Number.isFinite(numericCode) || numericCode < 1) {
      throw new Error(`Invalid versionCode: ${versionCode}`);
    }
    updated = updated.replace(/versionCode\s+\d+/, `versionCode ${numericCode}`);
  }

  if (versionName && String(versionName).trim() !== '') {
    const cleanName = String(versionName).trim().replace(/^v/, '').replace(/"/g, '');
    updated = updated.replace(/versionName\s+"[^"]*"/, `versionName "${cleanName}"`);
  }

  const applyLine = "apply from: 'release-signing.gradle'";
  if (!updated.includes(applyLine)) {
    updated = `${updated.trimEnd()}\n\n${applyLine}\n`;
  }

  return updated;
}

function parseArgs(argv) {
  const opts = {
    androidDir: path.join(ROOT_DIR, 'android'),
    versionName: process.env.MIZAN_VERSION_NAME || '',
    versionCode: process.env.MIZAN_VERSION_CODE || '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--android-dir' && argv[i + 1]) {
      opts.androidDir = path.resolve(argv[i + 1]);
      i += 1;
    } else if (arg === '--version-name' && argv[i + 1]) {
      opts.versionName = argv[i + 1];
      i += 1;
    } else if (arg === '--version-code' && argv[i + 1]) {
      opts.versionCode = argv[i + 1];
      i += 1;
    }
  }

  return opts;
}

function syncLauncherIcons(androidAppDir) {
  const icon512 = path.join(ROOT_DIR, 'public', 'icon-512.png');
  const icon192 = path.join(ROOT_DIR, 'public', 'icon-192.png');
  const resDir = path.join(androidAppDir, 'src', 'main', 'res');
  if (!fs.existsSync(resDir)) return;

  const densityMap = [
    ['mipmap-mdpi', icon192],
    ['mipmap-hdpi', icon192],
    ['mipmap-xhdpi', icon192],
    ['mipmap-xxhdpi', icon512],
    ['mipmap-xxxhdpi', icon512],
  ];

  for (const [folder, sourceIcon] of densityMap) {
    if (!fs.existsSync(sourceIcon)) continue;
    const targetFolder = path.join(resDir, folder);
    if (!fs.existsSync(targetFolder)) continue;
    for (const filename of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) {
      const targetPath = path.join(targetFolder, filename);
      if (fs.existsSync(targetPath)) {
        fs.copyFileSync(sourceIcon, targetPath);
      }
    }
  }
}

function run() {
  const opts = parseArgs(process.argv.slice(2));
  const androidAppDir = path.join(opts.androidDir, 'app');
  const manifestPath = path.join(androidAppDir, 'src', 'main', 'AndroidManifest.xml');
  const buildGradlePath = path.join(androidAppDir, 'build.gradle');
  const xmlDir = path.join(androidAppDir, 'src', 'main', 'res', 'xml');

  if (!fs.existsSync(manifestPath) || !fs.existsSync(buildGradlePath)) {
    console.error(
      `[harden-android] Android project not found at "${opts.androidDir}". Run "npx cap add android" first.`
    );
    process.exit(1);
  }

  // 1. Copy network_security_config.xml
  fs.mkdirSync(xmlDir, { recursive: true });
  fs.copyFileSync(
    path.join(ROOT_DIR, 'android-config', 'network_security_config.xml'),
    path.join(xmlDir, 'network_security_config.xml')
  );

  // 2. Copy proguard-rules.pro & release-signing.gradle
  fs.copyFileSync(
    path.join(ROOT_DIR, 'android-config', 'proguard-rules.pro'),
    path.join(androidAppDir, 'proguard-rules.pro')
  );
  fs.copyFileSync(
    path.join(ROOT_DIR, 'android-config', 'release-signing.gradle'),
    path.join(androidAppDir, 'release-signing.gradle')
  );

  // 3. Harden AndroidManifest.xml
  const originalManifest = fs.readFileSync(manifestPath, 'utf8');
  const hardenedManifest = hardenAndroidManifestXml(originalManifest);
  fs.writeFileSync(manifestPath, hardenedManifest, 'utf8');

  // 4. Patch android/app/build.gradle
  const originalGradle = fs.readFileSync(buildGradlePath, 'utf8');
  const patchedGradle = patchAppBuildGradle(originalGradle, {
    versionCode: opts.versionCode || undefined,
    versionName: opts.versionName || undefined,
  });
  fs.writeFileSync(buildGradlePath, patchedGradle, 'utf8');

  // 5. Sync Mizan app icons into Android mipmap folders
  syncLauncherIcons(androidAppDir);

  console.log('[harden-android] Applied production security config, R8 rules, and v1/v2/v3/v4 signing hooks.');
}

// Execute CLI only when invoked directly
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  run();
}
