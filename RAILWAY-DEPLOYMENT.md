# Deploy Acadex using Railway's website

Railway is a good fit for this Express + MySQL project. Hobby has a USD 5 monthly minimum, including USD 5 usage. The web service, MySQL and persistent volume all consume usage, so the total can be higher. Set a usage alert and spending limit in billing.

1. Upload the updated project to your GitHub repository. Include the entire server folder, migrations, package-lock.json, Dockerfile and railway.json. Do not upload .env.local, private files or .demo-accounts.local.json.
2. In Railway, create a project, add a MySQL database, then add a service from your GitHub repository. Keep both in the same project/environment.
3. In the app service Variables, add DATABASE_URL using a reference to the MySQL service's MYSQL_URL. Use Railway's variable reference picker; do not use localhost or the MySQL address on your PC.
4. Add JWT_SECRET (a new long random secret), NODE_ENV=production and TRUST_PROXY=1. Generate a public domain under Settings / Networking and set FRONTEND_ORIGIN to that exact https URL, without a trailing slash.
5. Add a persistent volume to the app service, mounted at /data. Set UPLOAD_DIR=/data/uploads and PAPERS_DIR=/data/private-papers. Railway's MySQL service has its own database storage; do not share that volume with the app.
6. Configure verification emails: Hobby does not allow SMTP. Create a Resend account, verify a domain you control using its DNS instructions, create an API key, and add RESEND_API_KEY and MAIL_FROM=Acadex <verification@your-verified-domain>. The resend.dev test sender is restricted and is not suitable for university users. Local Gmail SMTP still works when RESEND_API_KEY is absent.
7. Deploy. The Dockerfile builds the site; railway.json runs migrations and imports the bundled catalogue before starting the server. Check deployment logs and open /api/health on the public URL. Then test signup, verification, login, creating a listing, uploading a paper, tutoring approval and group notifications.

Your local MySQL accounts, listings and uploaded PDFs are not transferred automatically. Export/import data separately if you want to retain them. A fresh deployment starts with a fresh database and the academic catalogue.

## Owner and tutor test access

For local testing, use admin@acadex.example and tutor@acadex.example with their passwords in .demo-accounts.local.json. Run npm run db:demo -- --accounts-only if these accounts have not been seeded. They are verified database accounts; public registration still requires a university email.

Demo seeding is deliberately disabled in production. For the deployed website, register and verify your real owner account, then change only that account's role to admin in the Railway MySQL database. Admins can approve real tutor applications through their dashboard. Never make every registering user an administrator.

## Payments and meetings

Payments are still Stripe test-mode only. Railway deployment does not enable real payments or payouts. Configure test keys and a Stripe webhook to /api/payments/webhook when testing payments; see TUTOR-PAYMENTS-SETUP.md.

Group owners control Acadex membership, schedules and announcements. Teams meetings are external: removing an Acadex group member does not eject them from an already-open Teams meeting. That must be done by the Teams organizer.

Official references:
- https://docs.railway.com/pricing/plans
- https://docs.railway.com/networking/outbound-networking
- https://docs.railway.com/deployments/pre-deploy-command
- https://resend.com/docs/dashboard/domains/introduction
