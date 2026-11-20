import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { hardenAndroidManifestXml, patchAppBuildGradle } from './harden-android.mjs';

test('hardenAndroidManifestXml injects all production anti-Unsafe attributes idempotently', () => {
  const sampleManifest = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application
        android:allowBackup="true"
        android:debuggable="true"
        android:usesCleartextTraffic="true"
        android:label="@string/app_name">
        <activity android:name=".MainActivity" />
    </application>
</manifest>`;

  const hardenedOnce = hardenAndroidManifestXml(sampleManifest);
  assert.match(hardenedOnce, /android:usesCleartextTraffic="false"/);
  assert.match(hardenedOnce, /android:networkSecurityConfig="@xml\/network_security_config"/);
  assert.match(hardenedOnce, /android:allowBackup="false"/);
  assert.match(hardenedOnce, /android:supportsRtl="true"/);
  assert.doesNotMatch(hardenedOnce, /android:debuggable="true"/);

  // Applying twice must produce identical output (idempotent)
  const hardenedTwice = hardenAndroidManifestXml(hardenedOnce);
  assert.equal(hardenedTwice, hardenedOnce);
});

test('patchAppBuildGradle updates version metadata and appends release-signing.gradle once', () => {
  const sampleGradle = `android {
    defaultConfig {
        applicationId "ir.mizan.ledger"
        versionCode 1
        versionName "1.0"
    }
}`;

  const patchedOnce = patchAppBuildGradle(sampleGradle, {
    versionCode: 42,
    versionName: 'v1.4.2',
  });
  assert.match(patchedOnce, /versionCode 42/);
  assert.match(patchedOnce, /versionName "1\.4\.2"/);
  assert.equal((patchedOnce.match(/apply from: 'release-signing\.gradle'/g) ?? []).length, 1);

  const patchedTwice = patchAppBuildGradle(patchedOnce, {
    versionCode: 42,
    versionName: '1.4.2',
  });
  assert.equal((patchedTwice.match(/apply from: 'release-signing\.gradle'/g) ?? []).length, 1);
});

test('harden-android.mjs CLI copies security configs and patches a mock android directory', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mizan-android-test-'));
  try {
    const appDir = path.join(tmpRoot, 'app');
    const mainDir = path.join(appDir, 'src', 'main');
    fs.mkdirSync(mainDir, { recursive: true });

    fs.writeFileSync(
      path.join(mainDir, 'AndroidManifest.xml'),
      `<manifest><application android:allowBackup="true"></application></manifest>`,
      'utf8'
    );
    fs.writeFileSync(
      path.join(appDir, 'build.gradle'),
      `android { defaultConfig { versionCode 1\n versionName "1.0" } }`,
      'utf8'
    );

    execFileSync(
      process.execPath,
      ['scripts/harden-android.mjs', '--android-dir', tmpRoot, '--version-code', '7', '--version-name', '1.2.0'],
      { stdio: 'pipe' }
    );

    const xmlConfig = fs.readFileSync(
      path.join(mainDir, 'res', 'xml', 'network_security_config.xml'),
      'utf8'
    );
    assert.match(xmlConfig, /cleartextTrafficPermitted="false"/);
    assert.ok(fs.existsSync(path.join(appDir, 'proguard-rules.pro')));
    assert.ok(fs.existsSync(path.join(appDir, 'release-signing.gradle')));

    const finalManifest = fs.readFileSync(path.join(mainDir, 'AndroidManifest.xml'), 'utf8');
    assert.match(finalManifest, /android:usesCleartextTraffic="false"/);
    assert.match(finalManifest, /android:allowBackup="false"/);

    const finalGradle = fs.readFileSync(path.join(appDir, 'build.gradle'), 'utf8');
    assert.match(finalGradle, /versionCode 7/);
    assert.match(finalGradle, /versionName "1\.2\.0"/);
    assert.match(finalGradle, /apply from: 'release-signing\.gradle'/);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});
