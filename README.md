# IPS Service Platform

IPS is a full-stack service operations platform for academic work, professional services, and odd jobs. It includes client, provider, and hidden administrator portals with governed messaging, file/evidence workflows, action queues, support tickets, analytics, and a versioned visual builder.

## Stack

- React 18 and Vite
- Express
- MongoDB with Mongoose
- Server-signed session cookies
- Render deployment

## Local setup on Windows CMD

```bat
cd /d "C:\Users\pea\ips-mvp-react-git"
copy .env.example .env
npm install
```

Fill in the real values in `.env`. Never commit `.env`.

Start the backend in one CMD window:

```bat
npm run dev:server
```

Start the frontend in a second CMD window:

```bat
cd /d "C:\Users\pea\ips-mvp-react-git"
npm run dev
```

Open `http://127.0.0.1:3000`.

## Required environment

- `MONGODB_URI`
- `SESSION_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `VITE_ADMIN_ENTRY_PATH`

Production should also set `NODE_ENV=production`.

## Data architecture

MongoDB is the single source of truth for clients, providers, admins, academic orders, service requests, workspaces, files, messages, actions, support tickets, reports, finance tracking, audits, and published platform configuration.

Browser storage is only used to remember theme and cached signed-in identity. Protected operations require a valid server-signed session.

## Commands

```bat
npm run dev
npm run dev:server
npm run build
npm run check
npm start
```

`npm run check` builds the app, validates the server, verifies the Phase 12 visual builder, verifies Phase 9 data consolidation, and tests unauthorized access to protected routes.

## Current phase status

- Phases 1–7: core workflows, governed communication, files/evidence, and action centre.
- Phase 9: MongoDB data consolidation and support/reporting/settings upgrade.
- Phase 12: versioned visual builder with preview, publish, and rollback.
- Phase 8 remains intentionally deferred until a verified payment provider is selected.
- Phases 10 and 11 remain for production communications and full security/session hardening.

See `ULTIMATE_MVP_PHASE9.md`, `PHASE12_VISUAL_BUILDER.md`, and the existing phase verification documents for details.

## Security

Do not commit `.env`, private keys, database credentials, production passwords, or user-uploaded files. The JSON export excludes password hashes and file storage names. Database restoration and destructive bulk changes require a controlled maintenance process.

## License

Proprietary — IPS internal use.
