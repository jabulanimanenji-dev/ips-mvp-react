# Phase 17A — Universal Service Engine

## Purpose

Phase 17A.1 and 17A.2 add a governed, database-backed Service Engine to Platform Studio. Administrators can manage the platform-wide service switch, categories, service definitions, reusable templates, and dynamic intake questions without replacing the existing service-request workflow.

## Phase 17A.1 — Service Engine foundation

The Service Engine workspace provides:

- a dashboard with catalogue totals and lifecycle summaries
- global settings plus category- and service-level inherited toggles
- category and service create, read, update, and delete controls
- draft, published, paused, and archived lifecycle controls, including restore
- normalized slug validation and duplicate-slug protection
- server-side validation, administrator permission enforcement, and audit records
- a public read-only catalogue endpoint with a safe default response while MongoDB is unavailable in development

The effective state of a setting is resolved through the hierarchy:

1. a service override, when present
2. its category override, when present
3. the global Service Engine setting

The interface shows both the effective value and the level that supplied it. Lifecycle actions do not physically delete published or archived records; permanent deletion remains a separate guarded action.

## Phase 17A.2 — Templates and Question Builder

The Question Builder supports short text, long text, number, email, phone, URL, dropdown, single choice, checkboxes, yes/no, date, time, date-and-time, file upload, and image upload questions. Administrators can:

- mark questions required or optional
- organize questions into ordered multi-step forms
- reorder questions and persist the new order
- apply per-type validation rules
- add conditional visibility rules that reference another question
- copy a service's questions to another service
- save a service form as a reusable question set
- apply a reusable question set to a service
- create, edit, apply, and remove service templates

Six starter template kinds are available: academic, cleaning, delivery, digital, consultation, and other. Starter creation is idempotent and must not overwrite administrator-authored records.

## Architecture

Phase 17A uses five MongoDB models:

- `ServiceEngineSettings` — the singleton global configuration
- `ServiceCategory` — category identity, slug, lifecycle, ordering, and inherited controls
- `ServiceDefinition` — a catalogue service, its category, lifecycle, controls, and intake questions
- `ServiceTemplate` — starter or administrator-created service blueprints
- `ServiceQuestionSet` — reusable ordered question collections

Shared normalization and validation live in `shared/serviceEngine.js` so models, API routes, UI previews, and automated verification use the same rules.

Administrator APIs use the `/api/admin/service-engine` namespace. They require a valid administrator session and reuse the existing Platform Studio permission boundary: `design.view` for reads, `design.edit` for edits, and `design.publish` for publish, pause, archive, and restore actions. The public catalogue is read-only at `/api/service-catalog`.

Platform Studio renders the Service Engine inside its existing Services tab. It does not add a new governed page to the Phase 16 page registry.

## Compatibility boundary

Phase 17A intentionally preserves the existing platform contracts:

- `/api/services` and `/api/services/:id` still manage client service requests and provider work. They are not Service Engine definition endpoints.
- `/admin/services` remains Service Operations for quoting, assignment, progress, and request lifecycle management.
- the Phase 15 `PlatformConfig.serviceCatalog` structure remains readable by the homepage, pricing, quote, and marketplace interfaces during the staged migration
- Phase 16 remains at platform schema version 6 with its existing 41 governed preview pages
- client, provider, administrator, messaging, file, audit, visual-builder, publish, and rollback behavior remains unchanged
- no demo accounts or browser-only operational records are seeded

## Current limitations

This package establishes catalogue governance and intake-form authoring. Pricing workflows, provider workflow design, scheduling, location rules, catalogue search and landing pages, SEO, related services, bulk tools, expanded audit views, fine-grained Phase 17 permissions, and the full preloaded IPS catalogue belong to later Phase 17 milestones.

File and image questions define what a future intake form may accept; they do not bypass the existing governed object-storage and file-release rules. The public marketplace continues to use the compatible published catalogue surface until later milestones complete the end-to-end dynamic intake renderer.

## Automated validation

Use Windows Command Prompt (CMD), not PowerShell.

```bat
cd /d "C:\Users\pea\ips-mvp-react-git"
npm ci
npm run check
```

`npm run check` builds the React application, checks server syntax, runs all Phase 9–16 regression verifiers, validates Phase 17A shared normalization and model contracts, exercises local and mocked R2 storage, and confirms that protected routes reject anonymous requests. The automated suite is deterministic and does not require MongoDB or modify application records.

To run only the new checks:

```bat
cd /d "C:\Users\pea\ips-mvp-react-git"
npm run verify:phase17a
npm run verify:sessions
```

## Local database validation

Use a disposable development database. Do not point this test at production or at a database containing records you cannot safely change.

First-time setup:

```bat
cd /d "C:\Users\pea\ips-mvp-react-git"
copy /Y .env.example .env
notepad .env
```

In `.env`, replace every placeholder and keep local storage enabled:

```text
PORT=8080
MONGODB_URI=mongodb+srv://YOUR_DEV_USER:YOUR_DEV_PASSWORD@YOUR_DEV_CLUSTER/ips_phase17a_test?retryWrites=true&w=majority
ADMIN_EMAIL=your-local-admin@example.com
ADMIN_PASSWORD=choose-a-local-password-with-letters-and-123
SESSION_SECRET=paste-a-unique-random-value-containing-at-least-32-characters
VITE_ADMIN_ENTRY_PATH=/local-phase17-admin
STORAGE_PROVIDER=local
```

Start the backend in the first CMD window:

```bat
cd /d "C:\Users\pea\ips-mvp-react-git"
npm run dev:server
```

Confirm the backend and database state:

```bat
curl.exe http://127.0.0.1:8080/api/health
```

The response must report `"server":"online"`, `"database":"connected"`, and `"ready":true` before testing persistence.

Start the frontend in a second CMD window:

```bat
cd /d "C:\Users\pea\ips-mvp-react-git"
npm run dev
```

Open these addresses:

```text
http://127.0.0.1:3000
http://127.0.0.1:3000/local-phase17-admin
```

Sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`, open Platform Studio, and select Service Engine.

## Manual acceptance checklist

Use records prefixed with `VERIFY-17A-` so they are easy to identify and remove from the disposable database.

1. Open Dashboard, Categories, Services, Templates, Question Builder, Settings, and Audit without a reload or console error.
2. Change the global switch and confirm an inheriting category and service report the new effective state.
3. Override the category, then the service, and confirm the effective value and source level at each step.
4. Create, edit, publish, pause, archive, restore, and permanently delete a test category and service.
5. Attempt the same normalized slug with different capitalization, spacing, and punctuation; each duplicate must return a conflict and preserve the original record.
6. Confirm invalid names, slugs, category references, question rules, and lifecycle actions produce a clear validation response.
7. Verify the academic, cleaning, delivery, digital, consultation, and other starter templates appear only once after reloads and server restarts.
8. Create one question of every available type, including file and image, and exercise required/optional settings and type-specific validation.
9. Build at least two steps, reorder their questions, save, reload, and confirm the order is unchanged.
10. Add a conditional question, verify a missing or self-referencing dependency is rejected, and confirm the valid rule survives reload.
11. Copy questions between two services, save them as a reusable question set, and apply both a template and a question set to another service.
12. Sign out and confirm every `/api/admin/service-engine` request returns `401`; confirm an administrator without management permission receives `403` for mutations.
13. Open the public catalogue while MongoDB is connected, then stop the backend/database connection and confirm development fallback behavior after restart.
14. Recheck `/admin/services`, client `/services`, provider assignments, academic pricing, Platform Studio preview, draft save, publish, and rollback.

## Built-frontend smoke test

Stop both development servers, then run:

```bat
cd /d "C:\Users\pea\ips-mvp-react-git"
npm run build
npm start
```

Open `http://127.0.0.1:8080`. This validates that Express serves the built single-page application and APIs together. It is a localhost build smoke test, not a production deployment.

Never commit `.env`, `uploads`, database credentials, administrator passwords, session secrets, or production R2 credentials.
