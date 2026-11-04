# Charizma Netlify backup

Project: [charizma-backup](https://app.netlify.com/projects/charizma-backup). Protected test: [backup-test](https://backup-test--charizma-backup.netlify.app/). The live domain is managed separately.

On 4 November 2026, the protected draft passed staff sign-in, application submission with four generated images, viewing private photos, and archiving the labelled test. The owner confirmed the email arrived and its link reached Netlify's sign-in gate. The test used the existing Supabase project, so the archived record also appears on the other hosting environment.

## Rebuild and redeploy the protected draft from a Mac

Run from a checkout containing this checkpoint. Use Node.js 22 and the Netlify account that manages the backup project. The export below contains tracked source only and leaves out private setup notes and migration files.

```sh
(
  set -e
  backup_dir="$(mktemp -d /private/tmp/charizma-netlify-backup.XXXXXX)"
  git archive HEAD | tar -x -C "$backup_dir" --exclude='*.md' --exclude='tests' --exclude='supabase'
  cd "$backup_dir"
  npm ci
  for spec in sharp-linux-x64@0.35.5 sharp-libvips-linux-x64@1.3.4; do
    package="${spec%@*}"
    archive="$(npm pack "@img/$spec" --silent)"
    mkdir -p "node_modules/@img/$package"
    tar -xzf "$archive" --strip-components=1 -C "node_modules/@img/$package"
    rm "$archive"
  done
  npx --yes netlify-cli@27.16.2 deploy --site charizma-backup --context branch:backup-test --alias backup-test
)
```

Run `npx netlify-cli@27.16.2 login` first if needed. The Linux x64 Sharp packages are necessary because the CLI builds on macOS and the functions execute on Linux. If Sharp changes, check both package versions against its optional dependencies.

The existing project stores `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `RESEND_ALERTS_KEY`, `APPLICATIONS_ENABLED=true` and `APP_ORIGIN=https://backup-test--charizma-backup.netlify.app` for `branch:backup-test`. Recreate them from the approved local settings if the project is replaced. Store secrets through Netlify's environment settings. The CLI alias runs as a branch deployment, so generic Deploy Preview settings alone were insufficient.

Check `/api/submit` reports enabled, `/api/applicants` denies a request without a staff session, and `/.env.local` and `/server/staff-auth.js` return 404. Test staff sign-in and a labelled submission with synthetic images when validating a new build.

For a planned cutover, configure the production context with the live HTTPS origin, publish the backup, connect the domain, and repeat the access and application checks. Scheduled retries and cleanup need their own production configuration on Netlify. The Vercel schedule does not run there.
