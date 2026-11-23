type PaymentEnvironment = Partial<Pick<NodeJS.ProcessEnv, 'STRIPE_SECRET_KEY' | 'STRIPE_WEBHOOK_SECRET'>>;

export function stripeTestCredentials(env: PaymentEnvironment = process.env) {
  const secretKey = env.STRIPE_SECRET_KEY?.trim() || '';
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET?.trim() || '';
  const placeholder = /REPLACE|YOUR_|EXAMPLE|CHANGE[-_]ME/i;
  if (!secretKey.startsWith('sk_test_') || secretKey.length <= 8 || placeholder.test(secretKey)) return null;
  if (!webhookSecret.startsWith('whsec_') || webhookSecret.length <= 6 || placeholder.test(webhookSecret)) return null;
  return { secretKey, webhookSecret };
}
