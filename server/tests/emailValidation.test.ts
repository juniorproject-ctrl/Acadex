import assert from 'node:assert/strict';
import test from 'node:test';
import { isAllowedUniversityEmail } from '../validation';

test('accepts valid university email domains including .ac.ae subdomains', () => {
  assert.equal(isAllowedUniversityEmail('student@sharjah.ac.ae'), true);
  assert.equal(isAllowedUniversityEmail('student@cs.sharjah.ac.ae'), true);
  assert.equal(isAllowedUniversityEmail('student@aus.edu'), true);
});

test('rejects personal, malformed, and unrelated domains', () => {
  assert.equal(isAllowedUniversityEmail('student@gmail.com'), false);
  assert.equal(isAllowedUniversityEmail('student@sharjah.edu'), false);
  assert.equal(isAllowedUniversityEmail('student@notac.ae.example'), false);
  assert.equal(isAllowedUniversityEmail('not-an-email'), false);
});
