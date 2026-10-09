# Acadex

A place for university students to buy, sell, learn and connect.

Acadex brings campus life together in one website. Find affordable textbooks and study essentials, share past papers, join study groups, book a tutor and discover events at your university.

## Marketplace

Browse listings for textbooks, electronics, study materials, supplies and lab equipment. Search by keyword, filter by category, condition or price, and post items you no longer need.

## Learning and Community

- **Past papers:** Find course materials using searchable university, major and course filters.
- **Study groups:** Create or join a group, chat with other members, follow announcements and access scheduled meetings and recording links.
- **Tutoring:** Browse tutor profiles and available times, request a session and receive booking updates.
- **Campus events:** Explore event details, locations and timings.

Group creators manage their group's sessions, announcements and membership. University faculty and senior students can apply to tutor; approved tutors manage their profiles, availability and booking requests through a dedicated dashboard.

## Your Account

Register with a supported UAE university email address and verify it using an email code. Your account gives you access to your listings, learning activities, notifications, payment history and preferences.

Account settings and accessibility options are available from the account menu. Users can report problems, and administrators review complaints and tutor applications.

## Payments

Checkout currently supports **Stripe test-mode payments**. Card payments and eligible digital wallets are handled through Stripe's hosted checkout. Real charges and seller payouts are not enabled.

Study-group meetings and recordings use external links supplied by the group owner. Tutor meeting links are supplied when a booking is accepted.

## Technology

- React, TypeScript and Vite
- Express REST API
- MySQL
- JWT authentication and bcrypt password hashing
- Email verification through SMTP or Resend
- Stripe hosted checkout in test mode

Accounts, listings and learning activities are stored in MySQL. Browser storage keeps the signed-in session and local preferences, not account passwords.

## Local Setup

You will need Node.js 22 or later and MySQL 8 or later.

1. Install dependencies:

   ```sh
   npm install
   ```

2. Create a MySQL database named `acadex`.

3. Copy `.env.example` to `.env.local`. Set your database connection, authentication secret and email configuration:

   ```dotenv
   DATABASE_URL=mysql://YOUR_USER:YOUR_PASSWORD@127.0.0.1:3306/acadex
   JWT_SECRET=YOUR_LONG_RANDOM_SECRET
   FRONTEND_ORIGIN=http://localhost:3000
   ```

   For email verification, configure either the SMTP values in the example file or `RESEND_API_KEY` and a `MAIL_FROM` address using a verified sender domain.

4. Create the database tables and load the academic catalogue:

   ```sh
   npm run db:migrate
   npm run db:catalog
   ```

5. Start the website:

   ```sh
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000).

On Windows PowerShell, use `npm.cmd` instead of `npm` if execution policy prevents npm from running.

## Deployment

The repository includes a Dockerfile and Railway configuration for the web service. Deployment also requires MySQL, environment variables, persistent storage for uploaded files and a configured email sender.

Follow [Railway Deployment](RAILWAY-DEPLOYMENT.md) for the setup steps. See [Tutor Applications and Payments](TUTOR-PAYMENTS-SETUP.md) for checkout configuration.

Keep `.env.local`, private account credentials, user uploads and database exports out of GitHub. Configure production secrets through your hosting provider.

## Development Checks

```sh
npm run lint
npm test
npm run build
```

Database-backed integration checks and browser tests require the local database and their corresponding test configuration.
