# Windows localhost setup

Open Command Prompt (CMD), not PowerShell.

## First-time setup

```bat
cd /d "C:\Users\pea\ips-mvp-react"
copy .env.example .env
npm install
```

Edit `.env` and replace the MongoDB placeholders with a real Atlas connection
string. If you do not have one yet, the website will still launch, but
database-backed actions will be unavailable.

## Development launch

Keep the first CMD window open:

```bat
cd /d "C:\Users\pea\ips-mvp-react"
npm run dev:server
```

Open a second CMD window and keep it open:

```bat
cd /d "C:\Users\pea\ips-mvp-react"
npm run dev
```

Open this exact address:

```text
http://127.0.0.1:3000
```

The backend alone (`npm run dev:server`) does not start the React development
server. Avoid `http://localhost:3000` if an old IPv6 Vite process is still
running.

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
cd /d "C:\Users\pea\ips-mvp-react"
npm start
```

Open:

```text
http://127.0.0.1:8080
```
