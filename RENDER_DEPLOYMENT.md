# IPS Phase 13: Render production deployment

The repository contains a Render Blueprint in `render.yaml`. It deploys the
`main` branch as one Node web service, builds the React frontend, runs every
repository verification, starts Express, checks MongoDB readiness, and stores
uploads on a persistent disk.

## 1. Prepare and push the Phase 13 branch

Open Windows Command Prompt and run:

```bat
cd /d "C:\Users\pea\ips-mvp-react-git"
git fetch --prune origin
git switch phase-11-visual-builder-2-admin-hierarchy
git pull --ff-only origin phase-11-visual-builder-2-admin-hierarchy
git switch -c phase-13-production-deployment
npm run check
git status
git add .
git commit -m "Prepare Phase 13 Render production deployment"
git push -u origin phase-13-production-deployment
```

Do not continue if `npm run check` fails. PowerShell on this computer can block
`npm.ps1`; these commands are intended for Command Prompt.

## 2. Promote the tested branch to main

After reviewing the Phase 13 changes, fast-forward `main`:

```bat
cd /d "C:\Users\pea\ips-mvp-react-git"
git fetch --prune origin
git switch main
git pull --ff-only origin main
git merge --ff-only phase-13-production-deployment
git push origin main
```

The Blueprint explicitly deploys `main`. Do not point production at an older
phase branch.

## 3. Create or synchronize the Render Blueprint

1. Sign in to Render and choose **New > Blueprint**.
2. Connect `jabulanimanenji-dev/ips-mvp-react`.
3. Select the repository-root `render.yaml`.
4. Review the paid Starter service and 1 GB persistent disk.
5. Enter every required value below before applying the Blueprint.

For an existing Blueprint, open it and synchronize the latest `render.yaml`.
For a manually configured service, copy the build command, start command,
health check, branch, disk, and environment settings from the Blueprint.

## 4. Required Render environment values

Set these in Render. Never place their real values in Git:

- `MONGODB_URI`: a working MongoDB Atlas `mongodb+srv://` connection string.
- `ADMIN_PASSWORD`: at least 10 characters with at least one letter and number.
- `VITE_ADMIN_ENTRY_PATH`: a unique path such as `/private-control-7f3a`.

The Blueprint supplies:

- `NODE_ENV=production`
- `ADMIN_EMAIL=admin@ipsglobal.com`
- a generated `SESSION_SECRET`
- `UPLOADS_DIR=/var/data/ips-uploads`

For a manually configured service, set those four values yourself. Generate
`SESSION_SECRET` in Windows Command Prompt, copy the output into Render, and do
not reuse `ADMIN_PASSWORD`:

```bat
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

`VITE_ADMIN_ENTRY_PATH` is compiled into the frontend. Saving a new value is
not enough: trigger a new build and deploy. The path is a navigation
convenience, not a secret or an authentication control; the administrator
password and signed session still protect administrator access.

On an existing Blueprint, values marked `sync: false` are not automatically
added or replaced during synchronization. Confirm all three required values
manually under **Environment**.

## 5. MongoDB Atlas network access

In Render, open the service's **Connect** page and copy its outbound IP ranges.
In MongoDB Atlas, add those ranges to the project's Network Access list. Also
confirm that the Atlas database user in `MONGODB_URI` has access to the IPS
database.

The production server refuses to start with placeholders, missing credentials,
or an unreachable database. `/api/health` returns HTTP 503 whenever production
MongoDB readiness is lost, so Render cannot promote a database-broken deploy.

## 6. Expected Render settings

```text
Branch: main
Build command: npm ci --include=dev && npm run check
Start command: npm start
Health check path: /api/health
Region: Frankfurt
Disk mount path: /var/data
```

The project pins Node `24.14.1` in `.node-version`.

## 7. Production acceptance test

After Render reports the deploy as live:

1. Open `https://YOUR-SERVICE.onrender.com/api/health`.
2. Confirm HTTP 200, `"server":"online"`, `"database":"connected"`, and
   `"ready":true`.
3. Open the public home page and refresh a nested React route.
4. Test client sign-up and sign-in.
5. Test provider sign-in and assigned-work access.
6. Open the configured private administrator path and test administrator
   sign-in.
7. Create a disposable order or service request and confirm it persists.
8. Upload and download one disposable file.
9. Restart the Render service and confirm the file still downloads.
10. Delete the disposable records and files.

## 8. Operational notes

Only files under `/var/data` persist. MongoDB records remain in Atlas. The
attached disk limits the service to one instance and means deployments include
a short interruption while Render swaps the instance.

Render sends `SIGTERM` during replacement. The server handles it by stopping
new HTTP work, closing active connections, and disconnecting MongoDB before
exit.

## 9. Rollback

If a new deploy is unhealthy, use Render's deploy history to roll back to the
last known-good deploy. If the Git change itself must be undone, create a
revert commit instead of rewriting shared history:

```bat
cd /d "C:\Users\pea\ips-mvp-react-git"
git switch main
git pull --ff-only origin main
git revert COMMIT_HASH
git push origin main
```
