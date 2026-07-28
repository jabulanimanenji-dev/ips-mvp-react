# IPS Render deployment

The repository contains a Render Blueprint in `render.yaml`.

## Required secret values

Set these values in the Render dashboard during Blueprint creation:

- `MONGODB_URI`: the working MongoDB Atlas connection string.
- `ADMIN_PASSWORD`: a unique production administrator password.
- `VITE_ADMIN_ENTRY_PATH`: a private path beginning with `/`, such as
  `/your-private-control-entry`. It hides the administrator option from normal
  navigation but does not replace the administrator password.

Render generates `SESSION_SECRET` automatically. Do not add `.env` or secret
values to Git.

## Runtime design

- Render builds the Vite frontend and starts the Express server.
- Express serves the generated frontend and `/api` from one HTTPS origin.
- The service listens on Render's assigned `PORT` on `0.0.0.0`.
- MongoDB data remains in MongoDB Atlas.
- Uploaded files are stored under `/var/data/ips-uploads` on the attached
  persistent disk.
- `/api/health` is used for the Render health check.

## Cost and storage

The Blueprint uses a paid Starter web service because Render's free web
services have an ephemeral filesystem and cannot attach a persistent disk.
Without the disk, client and provider uploads would be lost on restarts and
deployments.

## Deployment check

After the first deploy:

1. Open `/api/health` and confirm that the server is online and the database is
   connected.
2. Test client, provider and administrator sign-in.
3. Upload and download one test file in each role.
4. Restart the Render service and confirm that the uploaded files remain.
5. Delete the test records and files after verification.
