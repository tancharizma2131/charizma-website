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
