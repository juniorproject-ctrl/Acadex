# Tutor Applications and Test Payments

Tutor applications now collect university, faculty/senior-student role, academic position or study year, subjects, teaching mode and experience. No legal documents or permits are uploaded or reviewed. Existing historical document files are not deleted, but their download routes have been removed. Admins approve or decline applications with review notes; approval grants tutor dashboard access.

All verified students may create study groups. The creator is the group administrator, without gaining platform-admin privileges. Group owners manage schedules, announcements and membership. Any signed-in user may submit a complaint through the account menu; platform admins review complaints in their dashboard.

## Stripe test checkout

This implementation deliberately accepts only `sk_test_` keys. Live payments,
seller payouts, commissions, shipping/fulfilment, disputes, partial refunds and
production marketplace onboarding are not enabled. Test transactions can mark
listings sold and unlock tutor meetings in this database, so use test items.

Hosted checkout uses card payments (Visa/Mastercard and compatible cards).
Stripe displays Apple Pay/Google Pay only when eligible for the account,
device/browser and wallet setup. No cash option is offered. Card details never
pass through Acadex. Prices are read from MySQL, not trusted from the browser.
Tutoring is paid after the tutor accepts; positive-price meeting links stay
locked until server verification of payment. Cancelling a paid tutor booking
requests a full test refund. Free sessions require no payment.

In the private `.env.local` or hosting environment, configure real TEST values:

```dotenv
STRIPE_SECRET_KEY=sk_test_REPLACE_WITH_YOUR_TEST_KEY
STRIPE_WEBHOOK_SECRET=whsec_REPLACE_WITH_YOUR_ENDPOINT_SECRET
FRONTEND_ORIGIN=http://localhost:3001
```

Keep the origin equal to the URL where the app runs. Normal `npm run dev` uses
port 3000 unless `PORT` overrides it. Restart the backend after env changes.
The current Codex preview uses 3001.

For local forwarding, use the official Stripe CLI after signing into your test
account: `stripe listen --forward-to localhost:3001/api/payments/webhook`.
Use the signing secret printed by that command, not a different endpoint's secret.
For hosted HTTPS, register `/api/payments/webhook` in Stripe with these events:
`checkout.session.completed`, `checkout.session.expired`,
`checkout.session.async_payment_succeeded`, `charge.refunded`.

Webhook signatures are checked against the raw request body. Browser redirects
alone never mark orders paid. Duplicate completions are idempotent. Pending
orders reserve the item until Stripe confirms completion/expiry/cancellation.
After a connection error, retry the same checkout; its idempotency key is retained.
Keep webhook delivery working so abandoned reservations can expire.

Refunding a listing does not automatically relist it, because fulfilment/return
state cannot be inferred from a refund. Full refunds received out of order retry
until their order is linked. Failed refund requests must be retried before a
paid tutoring booking can be cancelled. An order history is available under
Account menu > My payments for both buyer and seller.

Official provider references:
- https://docs.stripe.com/payments/checkout
- https://docs.stripe.com/webhooks/signature
- https://support.stripe.com/questions/connect-availability-in-the-uae

Stripe's UAE Connect rules require supported business structures/trade licences;
ordinary student sellers must not be assumed eligible. Choose and obtain approval
for the marketplace payout model/provider before building live transfers.

## Database and checks

Run `npm.cmd run db:migrate` before starting this version. Migration 003 adds
application, audit, order and webhook tables without clearing existing data.
Private documents and demo credentials are gitignored. Do not upload them to GitHub.

Run `npm.cmd run lint`, `npm.cmd run build`, and `npm.cmd run test:browser`.
The restricted Codex Windows runner uses `npm.cmd run build -- --configLoader runner`.
For focused backend tests in PowerShell against a test database:

```powershell
$env:COMMERCE_INTEGRATION="1"
npm.cmd test
npm.cmd run test:applications:browser
```

Backend payment tests use a fake Stripe transport with real signature verification;
they do not charge cards. Real Stripe-hosted checkout and wallets still require
your test credentials and an end-to-end provider test. The browser application
test expects checkout to be unconfigured and does not upload real documents.
Existing npm audit findings also require triage before a public production release.
