# IPS Phase 13: Render Starter with private Cloudflare R2

The repository contains a Render Blueprint in `render.yaml`. It deploys the
`main` branch as one Node web service, builds the React frontend, runs every
repository verification, starts Express, checks MongoDB readiness, and stores
file content in a private Cloudflare R2 bucket. No Render persistent disk is
required.

## 1. Prepare and test the R2 branch

Open Windows Command Prompt (CMD), not PowerShell:

```bat
cd /d "C:\Users\pea\ips-mvp-react-git"
git fetch --prune origin
git switch main
git pull --ff-only origin main
git switch -c phase-13-r2-storage
npm ci
npm run check
git status
git add .
git commit -m "Use private Cloudflare R2 for production files"
git push -u origin phase-13-r2-storage
```

Do not continue if `npm run check` fails. Review the branch before promoting
it. If the branch already exists, switch to it and pull it instead of creating
it again.

## 2. Promote the tested branch to main

After review, fast-forward `main`:

```bat
cd /d "C:\Users\pea\ips-mvp-react-git"
git fetch --prune origin
git switch main
git pull --ff-only origin main
git merge --ff-only phase-13-r2-storage
git push origin main
```

The Blueprint explicitly deploys `main`. Do not leave production pointed at an
older phase branch.

## 3. Create the private R2 bucket

In the Cloudflare dashboard:

1. Open **R2 Object Storage** and enable R2 if required.
2. Create a uniquely named bucket, for example
   `ips-private-prod-unique-suffix`.
3. Choose **European Union (EU) jurisdiction** and **Standard** storage. The
   jurisdiction cannot be changed after creation.
4. In the bucket settings, keep the public `r2.dev` URL disabled and do not
   attach a public custom domain.
5. Do not add a CORS policy. The IPS server communicates with R2 directly; the
   browser never receives R2 credentials.

The bucket name must contain only lowercase letters, numbers, and hyphens. Do
not put client names, email addresses, or other personal data in the name.

## 4. Create least-privilege R2 credentials

From the R2 overview, open **Manage R2 API Tokens** and create an **Account API
token** with:

- permission: **Object Read & Write**
- bucket scope: the single production IPS bucket

Do not grant Admin permission and do not select every bucket. Cloudflare shows
the Secret Access Key only once. Put the Access Key ID and Secret Access Key
directly into Render, and save a recovery copy in an approved password manager.
Never paste either value into Git, source files, chat, screenshots, support
tickets, or build logs.

For an EU-jurisdiction bucket, the endpoint has this exact form:

```text
https://ACCOUNT_ID.eu.r2.cloudflarestorage.com
```

The endpoint and bucket name identify the service but are not credentials. The
Access Key ID and Secret Access Key are credentials.

## 5. Create or synchronize the Render Blueprint

1. Sign in to Render and choose **New > Blueprint**, or open the existing
   Blueprint.
2. Connect `jabulanimanenji-dev/ips-mvp-react`.
3. Select the repository-root `render.yaml`.
4. Confirm the branch is `main`, the region is Frankfurt, and the service plan
   is Starter.
5. Confirm there is no `disk:` section and no `/var/data` mount.
6. Enter every `sync: false` value before applying or synchronizing.

For a manually configured service, remove `UPLOADS_DIR` and any persistent disk
after confirming that any files already on that disk have been copied to R2.
Then copy the build command, start command, health check, branch, plan, region,
and environment settings from `render.yaml`.

Removing a disk that contains the only copy of a file can cause permanent data
loss. Do not detach a populated disk until migration and download tests pass.

## 6. Required Render environment values

Set these in the Render service environment:

```text
NODE_ENV=production
ADMIN_EMAIL=admin@ipsglobalservice.com
STORAGE_PROVIDER=r2
R2_ENDPOINT=https://ACCOUNT_ID.eu.r2.cloudflarestorage.com
R2_BUCKET_NAME=ips-private-prod-unique-suffix
R2_ACCESS_KEY_ID=<bucket-scoped access key ID>
R2_SECRET_ACCESS_KEY=<secret access key>
R2_PREFIX=production
```

Also set:

- `MONGODB_URI`: a working MongoDB Atlas `mongodb+srv://` connection string.
- `ADMIN_PASSWORD`: a unique password with at least 10 characters, one letter,
  and one number.
- `SESSION_SECRET`: a unique random value of at least 32 characters that is
  different from `ADMIN_PASSWORD`.
- `VITE_ADMIN_ENTRY_PATH`: a unique path such as `/private-control-7f3a`.

The Blueprint generates `SESSION_SECRET`. For a manually configured service,
generate one in Windows CMD:

```bat
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

All `R2_` variables are server-only. Never rename them with a `VITE_` prefix,
because Vite-prefixed values can be compiled into browser assets.

`VITE_ADMIN_ENTRY_PATH` is intentionally compiled into the frontend. It is a
navigation convenience, not a secret or authentication control. Saving a new
value requires a rebuild and deploy.

Values marked `sync: false` are not automatically added or replaced during
Blueprint synchronization. Confirm each one under **Environment** before
deploying. Use **Save, rebuild, and deploy** after changing build-time values.

## 7. MongoDB Atlas network access

In Render, open the service's **Connect** page and copy its outbound IP ranges.
In MongoDB Atlas, add those ranges to the project's Network Access list. Also
confirm that the Atlas database user in `MONGODB_URI` has access to the IPS
database.

The production server refuses to start with placeholders, missing credentials,
an unreachable database, or unreachable R2 storage. `/api/health` returns HTTP
503 whenever required production readiness is lost.

## 8. Expected Render settings

```text
Branch: main
Build command: npm ci --include=dev && npm run check
Start command: npm start
Health check path: /api/health
Region: Frankfurt
Plan: Starter
Persistent disk: none
```

The project pins Node `24.14.1` in `.node-version`.

## 9. Production acceptance test

After Render reports the deploy as live:

1. Open `https://YOUR-SERVICE.onrender.com/api/health`.
2. Confirm HTTP 200, `"server":"online"`, `"database":"connected"`,
   `"storage":"r2"`, and `"ready":true`.
3. Open the public home page and refresh a nested React route.
4. Test client sign-up and sign-in.
5. Test provider sign-in and assigned-work access.
6. Open the configured administrator path and sign in as
   `admin@ipsglobalservice.com`.
7. Create a disposable order or service request and confirm it persists.
8. Upload and download a workspace file.
9. Upload and download a direct-message attachment.
10. Upload a visual-builder image, confirm it renders publicly through the IPS
    `/api/media/` route, then delete the disposable image.
11. Restart the Render service and confirm both private test files still
    download.
12. Deploy the same commit again and repeat the download checks.
13. Confirm the R2 bucket still has no public URL or custom domain.
14. Delete the remaining disposable records and objects through the app.

Test access boundaries as well: an unrelated client, an unassigned provider,
and a nonparticipant in a conversation must not be able to download another
user's files.

## 10. Operational security

MongoDB stores file metadata and R2 stores file content. Because storage is
external to Render, a normal deploy or instance replacement does not remove
uploads, and the service remains compatible with zero-downtime replacement and
future horizontal scaling.

Use a separate bucket and separate bucket-scoped token for development or
staging. Rotate the production R2 token by creating a replacement, updating
Render, deploying and testing, and only then revoking the old token.

Do not log environment values, Authorization headers, R2 signatures, or full
storage error responses. Review retention and deletion requirements before
adding bucket locks or automatic lifecycle deletion.

Render sends `SIGTERM` during replacement. The server handles it by stopping
new HTTP work, closing active connections, and disconnecting MongoDB before
exit.

## 11. Rollback

Roll back only to a known-good commit that supports R2. An older disk-dependent
commit can fail after the Render disk and `UPLOADS_DIR` have been removed.

Use Render's deploy history to roll back to the last known-good R2 deploy. If a
Git change must be undone, create a revert commit instead of rewriting shared
history:

```bat
cd /d "C:\Users\pea\ips-mvp-react-git"
git switch main
git pull --ff-only origin main
git revert COMMIT_HASH
git push origin main
```
