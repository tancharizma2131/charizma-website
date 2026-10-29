# Charizma website launch sequence

Agreed with the user on 28 October 2026:

1. Finish the remaining website edits and save a Git checkpoint.
2. Connect the approved application form and dashboard: staff login, permanent application records, private photo storage, and email alerts.
3. Import existing Google Form responses, retaining original submission dates and available photo/portfolio links.
4. Test a complete submission, notifications, and the review workflow through both team members’ accounts.
5. Run Astra’s final visual and technical review of the complete site.
6. Fix the review findings, then publish with the user’s approval.

The form and dashboard are currently interactive previews with sample data. No application backend, staff authentication, email delivery, or historical-data import has been connected.


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
