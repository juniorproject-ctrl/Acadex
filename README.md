# Acadex SR1 Foundation

Acadex is a UAE student marketplace. SR1 replaces the original browser-only prototype persistence with an Express REST API, MySQL database, JWT sessions, bcrypt password hashing, OTP verification, and server-side listing uploads.

## Run locally

Prerequisites: Node.js 20+ and a running MySQL 8+ server.

1. Run npm.cmd install.
2. Copy .env.example to .env.local and set DATABASE_URL, a long random JWT_SECRET, and SMTP values.
3. Create the database named in DATABASE_URL.
4. Run npm.cmd run db:migrate.
5. Run npm.cmd run db:seed to load the current catalogue into MySQL.
6. Run npm.cmd run dev and open http://localhost:3000.

Example local database URL:

    DATABASE_URL="mysql://acadex_user:strong-password@localhost:3306/acadex"
    JWT_SECRET="generate-a-long-random-value-for-this-project"

## Security model

- Passwords are validated on the client and server, then hashed with bcrypt before being stored.
- Login and verified-OTP responses issue one-hour JWTs. The password hash is never returned to the browser.
- OTP codes are bcrypt-hashed, expire after 10 minutes, allow five incorrect attempts, and are rate-limited.
- Login attempts are rate-limited. Protected listing routes require a valid JWT and check ownership before update/delete.
- Browser storage holds only the current access token and basic user profile, never account passwords or listings.

## Database and uploads

server/migrations/001_initial.sql creates users, OTP records, listings, and listing images with primary/foreign keys and timestamps. User-created images are uploaded to uploads/ locally and are served from /uploads.

For production, attach persistent storage to the service or replace the disk uploader with an object-storage provider before claiming persistent image support across service restarts. Do not commit .env.local, uploads contents, node_modules, or dist.

## Tests

Run npm.cmd run lint, npm.cmd test, and npm.cmd run build.

The automated tests cover valid UAE university domains, including student@sharjah.ac.ae, plus invalid domains. The remaining SR1 manual test matrix is in docs/phase1-test-matrix.md.

## Deployment

render.yaml declares the required production variables, but deployment is not complete until you supply a managed MySQL DATABASE_URL, SMTP configuration, a production FRONTEND_ORIGIN, and persistent upload storage. After deployment, run migration and seed commands against the production database, then complete the test matrix on the deployed URL.
