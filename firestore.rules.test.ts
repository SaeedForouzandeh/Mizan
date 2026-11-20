import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Security rules contract verification for the "Dirty Dozen" adversarial scenarios
 * defined in security_spec.md. Verifies that every required security invariant
 * and guard is present in the Firestore ruleset.
 */
const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const draftPath = path.resolve(process.cwd(), 'DRAFT_firestore.rules');
const activePath = fs.existsSync(rulesPath) ? rulesPath : draftPath;
const rules = fs.readFileSync(activePath, 'utf8');

test('Global Safety Net denies all unmatched paths', () => {
  assert.match(rules, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;/);
});

test('Dirty Dozen #1 & #12: Strict owner isolation on get and list (no blanket reads)', () => {
  assert.doesNotMatch(rules, /allow read:\s*if isSignedIn\(\);/);
  assert.doesNotMatch(rules, /allow list:\s*if isSignedIn\(\);/);
  assert.match(rules, /allow list:\s*if isOwner\(userId\) && resource\.data\.ownerId == request\.auth\.uid;/);
});

test('Dirty Dozen #2: Verified email is mandated for writes', () => {
  assert.match(rules, /request\.auth\.token\.email_verified == true/);
});

test('Dirty Dozen #3 & #7: Owner identity integrity and immutability on updates', () => {
  assert.match(rules, /data\.ownerId == request\.auth\.uid/);
  assert.match(rules, /incoming\(\)\.ownerId == existing\(\)\.ownerId/);
  assert.match(rules, /incoming\(\)\.createdAt == existing\(\)\.createdAt/);
});

test('Dirty Dozen #4 & #6: Strict schema keys (hasAll/hasOnly) and affectedKeys on updates', () => {
  assert.match(rules, /data\.keys\(\)\.hasAll/);
  assert.match(rules, /data\.keys\(\)\.hasOnly/);
  assert.match(rules, /incoming\(\)\.diff\(existing\(\)\)\.affectedKeys\(\)\.hasOnly/);
});

test('Dirty Dozen #5: Path ID regex and size hardening', () => {
  assert.match(rules, /id\.size\(\) <= 128 && id\.matches\('\^\[a-zA-Z0-9_\\\\-\]\+\$'\)/);
});

test('Dirty Dozen #8: Master Gate parent existence check for batches, sales, adjustments', () => {
  assert.match(rules, /hasStoreProfile\(userId\)/);
  assert.match(rules, /hasProduct\(userId, incoming\(\)\.productId\)/);
});

test('Dirty Dozen #9: Terminal state locking on voided sales', () => {
  assert.match(rules, /existing\(\)\.status == 'completed'/);
  assert.match(rules, /incoming\(\)\.status == 'voided'/);
});

test('Dirty Dozen #10: Total array guarding on consumedBatches', () => {
  assert.match(rules, /listVal\.size\(\) <= 25/);
  assert.match(rules, /listVal\[0\] is map/);
});

test('Dirty Dozen #11: Temporal integrity enforced via request.time', () => {
  assert.match(rules, /incoming\(\)\.createdAt == request\.time/);
  assert.match(rules, /incoming\(\)\.updatedAt == request\.time/);
});
