# I P S — React MVP

> **I P S** (Intellectual Property Service) is a full-stack academic writing and professional services platform. This repository contains the React frontend MVP with an embedded **God Mode CMS**, client portal, admin dashboard, and Express production server.

---

## Prerequisites

- **Node.js** `18.x` or higher
- **npm** `9.x` or higher (bundled with Node.js)

---

## Installation

```bash
npm install
```

This installs React 18, React Router 6, Vite, and Express.

---

## Development

Start the Vite development server:

```bash
npm run dev
```

- Dev server runs on **http://localhost:3000**
- Hot Module Replacement (HMR) enabled
- CMS data is persisted to `localStorage`

---

## Build

Create an optimized production build:

```bash
npm run build
```

Output is written to the `dist/` folder.

---

## Production

Build the app and start the Express server in one command:

```bash
npm start
```

- Express serves the built React app from `dist/`
- Handles SPA fallback (all routes serve `index.html`)
- Default port: **8080** (override with `PORT` env variable)

To run only the server (requires a prior build):

```bash
npm run server
```

---

## Project Structure

```
ips-mvp-react/
├── public/                 # Static assets
├── src/
│   ├── components/
│   │   ├── admin/          # Admin dashboard components (AdminCMS, AdminDashboard, etc.)
│   │   ├── client/         # Client portal components
│   │   ├── common/         # Shared UI components
│   │   └── public/         # Public page sections
│   ├── context/
│   │   ├── AuthContext.js  # Client & admin authentication
│   │   ├── CMSContext.js   # God Mode CMS state & persistence
│   │   └── ThemeContext.js # Light / dark mode toggle
│   ├── hooks/
│   │   └── useLocalStorage.js
│   ├── pages/
│   │   ├── PublicLayout.js # Shell for marketing pages
│   │   ├── HomePage.js     # Landing page
│   │   ├── QuotePage.js    # Instant price calculator
│   │   ├── LoginPage.js    # Client login
│   │   ├── SignupPage.js   # Client registration
│   │   ├── ClientLayout.js # Dashboard shell for clients
│   │   └── AdminLayout.js  # Dashboard shell for admins
│   ├── styles/
│   │   └── global.css      # Design tokens, utilities, components
│   ├── utils/
│   │   ├── constants.js    # CMS defaults, enums, demo data
│   │   ├── dataSeed.js     # Seeding helpers
│   │   └── formatters.js   # Display formatting utilities
│   ├── App.js              # Route definitions & guards
│   └── index.js            # Entry point
├── server.js               # Express production server
├── vite.config.js
├── package.json
└── README.md
```

---

## Demo Credentials

| Role  | Email               | Password  |
|-------|---------------------|-----------|
| Client| `amara@example.com` | *(any)*   |
| Admin | `admin@ips.com`     | `admin123`|

> **Note:** Client login is simulated (no backend). Any password is accepted for the demo client. Admin login validates against `ADMIN_CREDENTIALS` in `src/utils/constants.js`.

---

## Architecture Notes

### Contexts

- **AuthContext** — Manages `user` (client) and `admin` objects in memory. Provides login/logout helpers and route guards.
- **CMSContext** — Persists the entire site content object to `localStorage` under the key `ips-cms-config`. Exposes `saveCMS`, `resetCMS`, `exportCMS`, `updateCMS`, and `updateCMSField`.
- **ThemeContext** — Toggles `light` / `dark` mode via `data-theme` attribute on `<html>`. Persisted to `localStorage`.

### Routing

React Router handles three route groups:

1. **Public** (`/`, `/quote`, `/login`, `/signup`) — Wrapped in `PublicLayout`
2. **Client** (`/client/*`) — Protected by `ProtectedClientRoute`; wrapped in `ClientLayout`
3. **Admin** (`/admin/*`) — Protected by `ProtectedAdminRoute`; wrapped in `AdminLayout`

### CMS (God Mode)

The CMS editor lives at `/admin/cms`. It edits a single JSON-like object stored in `localStorage` with the following top-level keys:

- `brand` — name, tagline, email, whatsapp
- `hero` — badge, headline, subheadline, CTAs
- `services` — 4 cards (icon, title, description)
- `pricing` — per-page rates, flat fees, rush surcharges
- `faq` — 6 Q&A pairs
- `testimonials` — 3 cards (text, client)
- `about` — headline, paragraphs, 3 stats
- `trustBadges` — 4 text labels
- `footer` — copyright

Changes are kept in local component state until **Save Changes** is clicked. Use **Export JSON** to back up the config, and **Reset to Default** to restore factory defaults.

---

## Production Checklist

Before deploying to a live server:

- [ ] Run `npm run build` and verify no Vite errors
- [ ] Confirm `dist/` folder exists with `index.html` and bundled assets
- [ ] Set `NODE_ENV=production` in environment
- [ ] Set `PORT` env variable if not using default `8080`
- [ ] Configure reverse proxy (Nginx / Caddy) with gzip + cache headers for static assets
- [ ] Enable HTTPS / TLS termination at the reverse proxy
- [ ] (Optional) Replace demo auth with a real backend API
- [ ] (Optional) Move CMS persistence from `localStorage` to a database + API
- [ ] (Optional) Add rate limiting and security headers on Express

---

## License

Proprietary — I P S Internal Use Only.
