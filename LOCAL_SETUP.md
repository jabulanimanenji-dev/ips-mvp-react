# Windows localhost setup

Open Command Prompt (CMD), not PowerShell.

## First-time setup

```bat
cd /d "C:\Users\pea\ips-mvp-react-git"
copy .env.example .env
npm ci
notepad .env
```

Edit `.env` and replace the MongoDB placeholders with a real Atlas connection
string. If you do not have one yet, the website will still launch, but
database-backed actions will be unavailable.

Keep `STORAGE_PROVIDER=local` for normal localhost work. The backend creates an
`uploads` directory under the repository unless `UPLOADS_DIR` is set to another
absolute Windows path. Never commit `.env` or the local upload directory.

## Development launch

Keep the first CMD window open:

```bat
cd /d "C:\Users\pea\ips-mvp-react-git"
npm run dev:server
```

Open a second CMD window and keep it open:

```bat
cd /d "C:\Users\pea\ips-mvp-react-git"
npm run dev
```

Open this exact address:

```text
http://127.0.0.1:3000
```

The backend alone (`npm run dev:server`) does not start the React development
server. Avoid `http://localhost:3000` if an old IPv6 Vite process is still
running.

## Optional private R2 development test

Do not use the production bucket or production token on a developer computer.
Create a separate private development bucket and a separate Account API token
with Object Read & Write permission limited to that bucket.

Open `.env` in Notepad:

```bat
cd /d "C:\Users\pea\ips-mvp-react-git"
notepad .env
```

Set these values with the development bucket's real details:

```text
STORAGE_PROVIDER=r2
R2_ENDPOINT=https://ACCOUNT_ID.eu.r2.cloudflarestorage.com
R2_BUCKET_NAME=ips-private-dev-unique-suffix
R2_ACCESS_KEY_ID=replace-with-development-access-key-id
R2_SECRET_ACCESS_KEY=replace-with-development-secret-access-key
R2_PREFIX=development
```

Keep the bucket's public `r2.dev` URL disabled and do not add a public custom
domain. These names are server-only; never prefix an R2 variable with `VITE_`.
Restart `npm run dev:server` after changing `.env`.

When the R2 test is complete, restore `STORAGE_PROVIDER=local` and remove the
R2 credential values from `.env` if they are no longer needed. Revoke any
temporary development token in Cloudflare.

## If port 3000 is already in use

Find the listener:

```bat
netstat -ano | findstr LISTENING | findstr :3000
```

For each stale PID shown in the last column, stop it (replace `12345`):

```bat
taskkill /PID 12345 /F
```

Then run `npm run dev` again.

## Production-style localhost

Stop the development servers first, then run:

```bat
cd /d "C:\Users\pea\ips-mvp-react-git"
npm run build
npm start
```

Open:

```text
http://127.0.0.1:8080
```
