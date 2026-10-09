# Community Features

## Run this version

Use `C:\Users\Admin\Downloads\acadex---educational-classifieds`.
Keep the existing `.env.local` private and make sure MySQL is running.

```powershell
npm.cmd install
npm.cmd run db:migrate
npm.cmd run db:catalog
npm.cmd run dev
```

Migrations are tracked in `schema_migrations`; existing users/listings are not
cleared. Stop an older server with Ctrl+C in its terminal before starting this
version on port 3000.

## Features

- Home search routes category names to their pages; other terms search across
  listings, papers, tutors, groups and events.
- Past papers: university/major/course filters, course-code/name search, PDF
  uploads with sharing consent, downloads and owner deletion (10 MB maximum).
- Groups: leader creation/editing, join/leave, members-only chat, scheduled
  sessions and changes/cancellation, meeting links and recording links.
- Tutors: public profile/prices, non-overlapping availability, student requests,
  acceptance/decline, cancellations, accepted meeting links and booking history.
- Events: university/date/search filters, details, publisher edits/cancellation,
  no registration action. Tutors and leaders may publish events.
- Role-specific dashboards and persistent in-app notifications. Public signup
  creates students only. Tutor access requires an administrator-reviewed application;
  existing tutor/leader accounts are preserved. See `TUTOR-PAYMENTS-SETUP.md`.

## Catalogue and content

The committed `server/data/sharjah-catalog.json` comes from the official
University of Sharjah undergraduate pages listed in
<https://www.sharjah.ac.ae/sitemap.xml>. It contains course codes/titles and
source links, not descriptions or exam documents. The importer reads HTML
tables. Some programmes publish only PDFs/non-tabular curricula and therefore
have no imported courses. Different published curriculum versions may coexist;
the official source remains authoritative. Shared courses are classified
conservatively. This is not a complete catalogue of every UAE university.

Tutors/Study Group Leaders can use Dashboard > Add university / course to add
missing universities, majors, shared electives and courses with an official
curriculum URL. These are community submissions, not institutional verification.
The form does not overwrite imported names.

`db:catalog` imports the committed snapshot offline. `catalog:refresh` fetches
the current official pages and updates it. Refresh never deletes old courses
that existing groups/papers may reference.

For local demonstrations, run `npm.cmd run db:demo` after the catalogue import.
This explicitly adds three sample practice PDFs, groups, tutors and events,
nine future tutor slots, sample chat, session/recording placeholders and a
pending booking. It requires installed Microsoft Edge to generate the PDFs.
Sample content is clearly labelled, fictional, and not an official exam/event.
Meeting and recording links use example.com placeholders, not real meetings.
Private random demo passwords are in `.demo-accounts.local.json` (gitignored).
Use the student, tutor or leader account there to test different roles.
Repeated runs preserve existing sample records and credentials; they do not
reset bookings or shift scheduled dates. No samples run automatically at startup.
Never run the demo seed against a production database or publish its credentials.

The account menu includes settings, accessibility, notifications and sign out.
Profile name changes are saved in MySQL. Accessibility preferences are saved
per browser; they are not shared across devices.

## Meetings and notifications

The signed-in app checks MySQL notifications every 30 seconds. Members receive
session/recording announcements and changes. Reminders for sessions within
24 hours are generated once per session/start time when notifications are
checked. This is in-app delivery, not email, mobile push or an offline worker.
Chat checks for messages every four seconds and can load older messages.

Leaders/tutors supply their Teams/other HTTPS meeting and recording links.
Acadex does not create Teams meetings, record calls or manage Microsoft access
permissions. Recording owners must grant access at their recording provider.
Prices are per slot; Stripe test checkout is implemented but requires credentials
and webhook setup. Live charges and payouts are disabled. Display times are
Gulf Standard Time; datetime inputs use the device's local time.

## Deployment

Commit source, lockfile, migrations and catalogue snapshot. Never commit
`.env.local`, uploaded files, database exports or test accounts. Configure the
database/JWT/email/origin environment variables on the host, then run migrations
and catalogue import there. A home-PC `127.0.0.1` MySQL database is not reachable
from a hosted service.

Build with `npm run build`, start with `npm run start`; the host supplies `PORT`.
This restricted Windows tool runtime needs
`npm run build -- --configLoader runner` because its default esbuild config
loader cannot traverse parent directories. Normal Node/TSX commands can be used
from the user's own terminal.

Uploaded files need persistent storage and backups. For a `/var/data` mount,
set `UPLOAD_DIR=/var/data/uploads` and `PAPERS_DIR=/var/data/private-papers`.
Otherwise redeploys can lose files while their database records remain.
PDF checks enforce type/size/signature and download-as-attachment, not malware
scanning.

## Tests

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run test:community
npm.cmd run test:browser
```

Integration tests need a migrated database and imported catalogue. They create
and remove only uniquely identified test users/content; use a test database,
not a busy production database. Browser tests default to `http://localhost:3001`
and headless installed Microsoft Edge. Override with `TEST_BASE_URL` and
`TEST_BROWSER_CHANNEL`. Screenshots go to ignored `test-results/`. Test accounts
have disabled passwords and send no emails.

Point 6 (auth-page animations, new fonts and palette changes) is deferred.
