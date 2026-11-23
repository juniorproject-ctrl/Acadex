import assert from 'node:assert/strict';
import test from 'node:test';
import { stripeTestCredentials } from '../community/paymentConfig';

test('Stripe checkout requires both test credentials', () => {
  assert.equal(stripeTestCredentials({}), null);
  assert.equal(stripeTestCredentials({ STRIPE_SECRET_KEY: 'sk_test_unit_key' }), null);
  assert.equal(stripeTestCredentials({ STRIPE_WEBHOOK_SECRET: 'whsec_unit_secret' }), null);
});

test('live, publishable and placeholder keys cannot enable payments', () => {
  for (const key of ['sk_live_unit_key', 'pk_test_unit_key', 'sk_test_', 'sk_test_REPLACE_WITH_YOUR_TEST_KEY']) {
    assert.equal(stripeTestCredentials({ STRIPE_SECRET_KEY: key, STRIPE_WEBHOOK_SECRET: 'whsec_unit_secret' }), null);
  }
  for (const secret of ['not-a-signing-secret', 'whsec_', 'whsec_REPLACE_WITH_YOUR_ENDPOINT_SECRET']) {
    assert.equal(stripeTestCredentials({ STRIPE_SECRET_KEY: 'sk_test_unit_key', STRIPE_WEBHOOK_SECRET: secret }), null);
  }
});

test('test credentials are trimmed without exposing their values to the frontend', () => {
  assert.deepEqual(stripeTestCredentials({ STRIPE_SECRET_KEY: ' sk_test_unit_key\n', STRIPE_WEBHOOK_SECRET: ' whsec_unit_secret ' }), {
    secretKey: 'sk_test_unit_key', webhookSecret: 'whsec_unit_secret',
  });
});
