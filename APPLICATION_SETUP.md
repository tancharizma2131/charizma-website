# Charizma application setup

## Confirmed project

- Live website host: Vercel (verified via public response headers and DNS).
- Supabase organization: Charizma Management.
- Supabase project: Charizma Applications.
- Project reference: svrruplyqccstnutpjgo.
- Project URL: https://svrruplyqccstnutpjgo.supabase.co.
- Region: Singapore (ap-southeast-1).
- Staff login and alert mailbox approved by owner: info@charizma-mgmt.com (shared for now).

## Completed 28 October 2026

Executed `supabase/migrations/202610280001_applications_foundation.sql` using the project's SQL editor. The script completed successfully.

Created applications, application_photos, application_notes, application_events, and application_notifications. All five tables have row-level security enabled, with privileges revoked from anon and authenticated. Only the server service role has table access; backend routes must verify staff sessions before any dashboard access.

Created private bucket application-digitals: JPG/PNG/WebP only, maximum 10 MiB per image, no public policies. Backend-issued upload and temporary viewing links are still to be implemented.

Verified all five tables report RLS enabled and no SELECT privileges for anon or authenticated, and the bucket is private. No applicants or photos have been imported.

## Remaining connections

1. Create email delivery account and verify a sending domain; configure staff sign-in email delivery and application alerts.
2. Connect the correct Vercel project and server-only credentials without committing secrets.
3. Build and test application submission, controlled uploads, staff login, dashboard records, notes/status history, and retryable notifications.
4. Provision the approved staff login. Prevent public staff registration.
5. Import existing Google Form responses with original dates and source identifiers.
6. Test both submission and review with the owner before final Astra review and publication.

The public Google Form remains the active application route. The custom form and dashboard remain sample-only previews; creating the database does not connect or publish them.

## Resend sending domain — 28 October 2026

- Account/team: charizma-mgmt.
- Domain: notifications.charizma-mgmt.com.
- Resend domain ID: 24bca499-c75b-46fb-a34f-e4fe8ca7eba6.
- Sending region: Tokyo (ap-northeast-1), dashboard default.
- Owner explicitly approved saving the three domain authorization records.
- Saved in Squarespace: TXT resend._domainkey.notifications (Resend DKIM public key), CNAME rsend.notifications → rsend-apne1.forge.rmta.net, CNAME send.notifications → send.forge.rmta.net. TTL 4 hours.
- Existing root website, www, Google Workspace MX/SPF/DKIM entries were preserved.
- Resend reports Verified (28 October 2026, 15:21 Bangkok time). All three records were also confirmed through public DNS. Sending credentials and actual email delivery remain untested.
- Receiving is disabled. A restricted SMTP credential has now been connected as detailed below.

## Supabase sign-in email connection — 28 October 2026

- Owner explicitly approved creating a sending-only credential and saving it directly in Supabase SMTP settings.
- Resend key name: Charizma Supabase Sign-in.
- Resend key ID: 8ed15b38-9e00-4abf-b1e5-35efc36b56f7.
- Permission: Sending access, restricted to notifications.charizma-mgmt.com.
- Supabase custom SMTP is enabled and persisted after reload.
- Sender: Charizma Management <access@notifications.charizma-mgmt.com>.
- Host: smtp.resend.com; port: 465; username: resend.
- Credential stored only in Supabase's encrypted SMTP settings. No key value was written to repository files. Temporary clipboard content was cleared.
- Actual email delivery has not been tested. No staff account or dashboard login has been provisioned yet. Application alert delivery is still separate work.

## Local staff sign-in implementation — 28 October 2026

- Added staff.html, staff.css, js/staff.js and the server-only /api/staff handler.
- Passwordless email-code flow restricted to info@charizma-mgmt.com; code requests never create users.
- Supabase sessions are checked server-side against the confirmed staff email. Access/refresh tokens use HttpOnly, SameSite=Strict cookies and Secure in production. No tokens are returned to page JavaScript.
- POST requests enforce same-origin and JSON input; session responses are not cached.
- Disabled Supabase public user signup and verified it persisted after reload. Anonymous sign-in remains off; email confirmation remains on.
- Saved the Magic link or OTP template with subject 'Your Charizma sign-in code' and the Token variable. Template source is in supabase/templates/staff-sign-in.html.
- Supabase public project configuration is in ignored .env.local, with file mode 0600. No service-role credential has been obtained.
- Local app server: npm run dev:app, http://127.0.0.1:8052/staff.html. Existing static preview remains on 8051.
- npm run test:auth: six access-control tests passed. Unauthenticated local API returned 401; requests for .env.local and server source returned 404. Desktop/mobile sign-in layout checked.
- Shared staff account info@charizma-mgmt.com exists and is confirmed. UID: fa2ee240-caed-42ab-a2be-62ce3bc60306. The owner approved activation and a test sign-in email; the account was already present when inspected, so no duplicate account was created.
- Actual sign-in, production deployment and application record access are still incomplete. Signed-in screen explicitly points to the separate sample dashboard until the real records are connected.

## First sign-in email delivery test

The local staff sign-in form successfully requested a code from Supabase. Resend reports Delivered for 'Your Charizma sign-in code' to info@charizma-mgmt.com (email ID 01a181af-99f1-76e5-9800-ffa6675f8696). The owner must enter the code directly on the local sign-in page. The owner entered the code directly; successful sign-in and session persistence after navigating back to staff.html were subsequently confirmed. No code was read from the mailbox or saved in files.

## Staff sign-in verified

The owner completed the email-code sign-in. Reloading the local staff page showed 'You’re signed in' for info@charizma-mgmt.com, confirming the server validated the persisted session. The dashboard link still leads to sample-only applicants-preview.html; live records, real application submission, photo uploads, alerts, import, and deployment remain pending. No sign-out or long-duration refresh-token test has been completed yet.

## Persistent dashboard prepared — 28 October 2026

- New applicants.html uses real API responses only. The sample-only preview remains separate.
- Added /api/applicants with authenticated reads, 50-record pagination, search/source/status filters, validated status changes and notes, and five-minute signed photo links.
- Uses the current staff user's session and public project key. No service-role credential was obtained or used for this step.
- Prepared migration 202610280002_staff_dashboard.sql. It grants review access only to the confirmed UID fa2ee240-caed-42ab-a2be-62ce3bc60306 and email info@charizma-mgmt.com. Only status updates and notes are writable; audit events are database-generated. Anonymous applicants receive no new permissions. Photo bucket remains private.
- Prepared rollback-only database verification in supabase/checks/staff_dashboard.sql (read/status/note/audit checks and a second-user denial check).
- Owner approved the access rules. Migration 202610280002_staff_dashboard.sql was executed successfully in the Charizma Applications project.
- Six staff authentication tests and ten dashboard/API/UI tests passed. Dashboard tests use mocked provider responses; real database testing is pending migration approval. Image and digitals checks passed.
- Local server restarted on 8052 with both staff and applicants API handlers.

## Persistent dashboard connected and verified — 28 October 2026

- Supabase confirmed success for the staff dashboard migration.
- Executed supabase/checks/staff_dashboard.sql. It completed without assertion errors: verified staff read, status update, note insert and two audit events; denied unnecessary email edits, delete access, anonymous reads, notification queue reads and another authenticated account's application reads. The transaction rolled back all test data.
- Opened applicants.html through the signed-in staff page. The real API returned an empty list (0 applicants), confirming access and removal of the temporary test record. Reloading retained the authenticated database connection.
- Desktop and 390px mobile layout checked; no horizontal overflow.
- This is still local only. Public submissions, uploaded-photo delivery, notification alerts, old-response import and production deployment remain pending. Browser-based note/status changes with an actual application and signed-photo viewing still require end-to-end testing once submission/import supplies a record.

## Public form, uploads and alerts prepared — 28 October 2026

- Added apply.html using the approved form design and Ksenia framing examples. Examples never count as uploads; no fake-details button exists on this connected form.
- Added /api/submit: readiness, validated application start, four signed private uploads and atomic completion. Saves one application, four photo rows, receipt history and an outbox entry in one transaction. The same ticket is reused after uncertain responses to prevent duplicates.
- Server-side Sharp image decoding, pixel limits and WebP re-encoding strip metadata; temporary upload files have a private 2 MiB-per-file bucket. Browser accepts original JPG/PNG/WebP up to 10 MiB and prepares files to at most 2000px/2 MiB. Originals in the user's folders are untouched.
- Executed migration 202610280003_public_submissions.sql and rollback-only check supabase/checks/public_submissions.sql; both completed successfully.
- DB rate limits: five tickets/IP/hour, three/email/day, 50/day globally, with private storage capacity reservation. Identifiers are keyed hashes rather than raw IP addresses.
- /api/notifications retries the durable outbox using stable Resend idempotency keys; only the verified staff session or a configured CRON_SECRET can run it. Alerts contain only a private-dashboard link and application reference, never DOB, measurements or photo attachments.
- Immediate delivery attempts target the just-submitted application. Failed deliveries remain queued. A staff 'Retry email alerts' button is available. A production schedule must be configured and tested at deployment; no scheduled worker is running yet.
- Maintenance removes expired temporary uploads and incomplete normalized files, clears draft answers after expiry and removes ticket/rate-limit rows older than 48h. Original Google Form responses are untouched.
- Owner approved server-only credentials and a labelled test submission using Ksenia digitals. Configured SUPABASE_SECRET_KEY, RESEND_ALERTS_KEY, APP_ORIGIN=http://127.0.0.1:8052 and APPLICATIONS_ENABLED=true in ignored .env.local (mode 0600). No secret values are committed. Existing sign-in SMTP credential is separate and unchanged.
- 28 automated authentication/dashboard/submission tests pass, including image validation, retry idempotency and refusal to count example digitals. Provider calls in submission tests are mocked. Real submission/upload/alert verification still pending credentials and migration.
- Added Sharp and applied compatible dependency security fixes; npm audit reports zero known vulnerabilities at this point.
- Existing Google Form page remains the public application route. apply.html is a separate local connection page; no production deployment has occurred.

## Real submission and alert verified — 28 October 2026

- Created dedicated Supabase secret key named charizma_applications_server. It is used only by the backend; dashboard requests still use the staff user's scoped session.
- Created Resend sending-only key Charizma Application Alerts, ID b7bb6d8d-ea4b-4c4b-80ad-ad8f723ffb55, restricted to notifications.charizma-mgmt.com. Temporary key-transfer file and clipboard content were cleared after copying into the ignored local environment file.
- Approved test record: CONNECTION TEST — not an applicant, ID f8c70a4b-29ac-4c07-b5ac-7998fbbf3455, synthetic details, Ksenia example digitals (01,04,02,04). Submitted through apply.html in the browser and received the confirmation reference.
- Real dashboard shows one application with four actual private WebP photos. Both thumbnails and enlarged photo navigation were checked. Photo sizes: 73,412 + 61,136 + 43,302 + 61,136 bytes.
- Temporary upload list is empty after completion. Both application buckets are private. An unauthenticated public-photo request returned HTTP 400 (not an image).
- Outbox state sent, attempts 1, Resend email ID 01a18284-5ab4-795f-bd1f-ba5b361c1faf. Resend confirms Delivered to info@charizma-mgmt.com, subject New Charizma application.
- Actual browser attempt to change this test record to Reviewing was blocked by automatic approval review: it requires explicit authorization for that specific persistent record change. No workaround or database mutation was attempted. The record remains New with no notes. Need explicit approval to set Reviewing, add a labelled connection-test note and archive it after verifying persistence/history.
- Live Google Form is still the public route. No deployment or import has occurred. Scheduled notification retry/cleanup remains to be configured at deployment.

## Review workflow completed — 28 October 2026

- Owner explicitly approved the specific test-record changes after automatic review requested additional authorization.
- Through the real browser dashboard, set CONNECTION TEST — not an applicant (f8c70a4b-29ac-4c07-b5ac-7998fbbf3455) from New to Reviewing, saved one labelled connection-test note, and set it to Archived.
- Found and fixed stale detail reads after the first successful status write: browser GET requests now carry unique request IDs, server provider reads request no-cache/no-store, and private responses vary by Cookie. Updated script cache versions. All 28 automated tests still passed after the fix.
- Reloaded the dashboard and reopened the record: Archived persisted, the note persisted, and history shows Application received → New to Reviewing → Team note added → Reviewing to Archived.
- The single labelled test record and its four private photos remain archived for reference; nothing was deleted. No real applications have been imported yet.
- Local end-to-end checks now cover submission, private uploads, actual photo display/enlargement, delivered alert, persistent note/status/history and session refresh. Production configuration, scheduled retry/cleanup, historical import and final review/publication remain pending.


## Main application page — 28 October 2026
The approved connected form now lives at `be-charizmatic.html`, replacing the Google Form embed locally. Existing navigation uses this route. `apply.html` redirects to it. Production publication and historical response import remain pending.


## Google Form history imported — 29 October 2026
Imported all 91 original responses into private applications with source Google Form and original submission dates. Stable row hashes prevent repeat-import duplicates; repeat run inserted zero. All original answers remain in server-only legacy_response. 76 records include historical photo links; photo files were not copied. 29 ambiguous measurement values remain null rather than guessed. Imported events were added, with no notification queue entries. Original Google Form and responses remain intact. Import utility: scripts/import-google-form.py (dry run by default; --save writes). Raw CSV ZIP remains outside repository in Downloads.


## Publication boundary — 29 October 2026
Vercel now runs `npm run build` and publishes only generated `dist/`. The packager explicitly lists public HTML/CSS/browser JavaScript and copies approved image/font formats. Backend modules remain outside static output and are imported by root `api/` function entrypoints. `.vercelignore` additionally excludes local credentials, SQL, documentation, tests, CSV/ZIP exports and demo pages from CLI uploads. Live pages still require the shared stylesheets named application-preview.css/applicants-preview.css; those styles remain included. Generated output is ignored by Git.
Validation: `npm run test:publication` builds output and checks excluded paths plus every local HTML/CSS asset reference. Deployment preview verification remains required: check public routes and all four function endpoints, and confirm `/server/staff-auth.js`, `/api/staff.js`, `/supabase/migrations/202610280001_applications_foundation.sql`, `/tests/staff-auth.test.js`, `/APPLICATION_SETUP.md`, `/.env.local`, `/package.json`, and `/applicants-preview.html` return 404. Do not claim production protection verified until these deployed checks pass. No deployment performed in this step.


## Abandoned-upload cleanup — 29 October 2026
Cleanup processes expired, uncleaned tickets oldest-first (expiry then ID), 20 per run. Retention pruning requires cleaned_at to be non-null and created_at older than 48 hours. Failed file deletion or cleanup-record update aborts the run without discarding manifests. Completed applications retain their final digitals. Regression checks cover a 23-ticket backlog across two runs and failures at temporary deletion, normalized deletion, and record update. No real storage deletion or scheduled cleanup was run while validating this fix.


## Note-save draft protection — 29 October 2026
While a team note is saving, its textarea is read-only and the Save button shows Saving…. The draft is cleared only if it still matches the submitted version. Failures restore editing and retain the original draft, including across a detail refresh. Delayed success, failure, duplicate-submit prevention and newer-draft retention are covered by mocked UI tests. No real applicant notes were created or changed during validation.


## Submission timeouts and retry recovery — 29 October 2026
Browser requests now have abortable deadlines covering both connection and body reads: readiness 15 seconds, start 60 seconds, each photo upload 60 seconds, completion 90 seconds. Failure restores controls with Retry application, retaining details, prepared photos and the same ticket/token. An interrupted/rejected upload invalidates cached signed URLs so retry requests fresh URLs for that same ticket and skips confirmed uploads. Uncertain completion retries the same identifier without reuploading. Actual ticket expiry still creates a fresh ticket on retry while retaining the form/photos. Mocked UI checks cover stalled start/upload/completion (including stalled response bodies), expired upload URL recovery and preservation of confirmed uploads. No real application, upload or email was sent during these checks.


## Field validation alignment — 29 October 2026
The browser checks trimmed required text, email, calendar dates/year bounds, Instagram usernames/profile URLs, measurements, yes/no answers and optional portfolio URLs before continuing/submitting. Field errors are displayed inline with aria-invalid/aria-describedby and clear on editing. Structured server validation errors include the field name, returning the browser to its step and focusing it without discarding photos. Server validation remains authoritative. Tests cover invalid first-step progression, correction, rejected portfolio URLs and server field error recovery.


## Dashboard working space and readability — 29 October 2026
Desktop uses a flex layout that gives the two-pane workspace the remaining viewport height after header, controls and footer. Header/title/status spacing is compressed; at 1440×900 workspace starts around 275px and page height is 900px. Short screens below 720px may scroll rather than clip controls. List initials are smaller; operational labels/meta/counts are at least 12px with #595750 secondary text. General errors now appear above the workspace, not below it. Mobile retains the list/detail/back flow and natural detail scrolling. Verified 390px layout without horizontal overflow using only the labelled connection-test record; no real applicant records changed.


## Responsive profile photos — 29 October 2026
All five profiles now provide intrinsic width/height and responsive srcset/sizes for their 100 portfolio images and 20 digitals. Two uncropped WebP variants (400/800px) supplement unchanged originals; gallery enlargement continues using original src. Variants are generated in image/responsive/ and excluded from Git/CLI upload; npm run build recreates them before packaging. Use npm run images:refresh after replacing source photos to refresh dimensions/markup. Smallest variants total 2.03 MiB versus 16.01 MiB originals (87% lower asset weight, not a measured page-transfer claim). Mobile 390px selected a 400px variant and enlargement loaded the 1600px original. Tests verify dimensions, candidate widths/proportions and smaller byte sizes for all 120 photos.
