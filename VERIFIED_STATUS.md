# IPS MVP React — Verification Status

This package is the consolidated localhost source version.

## Verified

- All relative imports resolve to existing files.
- All JavaScript and JSX files parse successfully.
- `server.js` and MongoDB model syntax pass Node checks.
- React providers are mounted in the correct order.
- Public, client, writer, and admin routes are present.
- Vite development server is configured for `http://localhost:3000`.
- `/api` requests proxy to the Express server at `http://localhost:8080`.
- Express serves the production `dist` build on port 8080.
- `node_modules`, `dist`, `.git`, and secrets are excluded from the archive.

## Required on your Windows computer

1. Copy `.env.example` to `.env` and fill in the real values.
2. Run `npm install` so npm installs Windows-compatible binaries.
3. Start the backend with `npm run dev:server`.
4. Start the frontend in a second CMD window with `npm run dev`.
5. Open `http://localhost:3000`.

MongoDB-dependent features require a reachable MongoDB Atlas connection.
