# Ultimate MVP Phase 12 — Platform Design Studio

Phase 12 replaces the device-only CMS with a database-backed, governed visual configuration system for the IPS public website and all three portals.

## What administrators can control

- Public homepage section order and visibility.
- Client, provider, and admin dashboard widget order, visibility, and width.
- Public, client, provider, and admin navigation order, labels, icons, routes, and visibility.
- Major public and dashboard call-to-action labels, destinations, order, style, custom colors, device visibility, and enabled state.
- Light and dark palettes, brand gradient, typography, button radius, and card radius.
- Portal sidebar width, content padding, density, public content width, and section spacing.
- Brand identity, homepage hero, service cards, pricing, FAQs, testimonials, About content, trust badges, and footer content.
- Desktop and mobile draft previews.
- Configuration import and export.

## Publishing workflow

1. An administrator edits a private draft.
2. `Save Draft` stores the validated draft without changing the live platform.
3. `Review & Publish` accepts an optional release note.
4. Publishing creates an immutable version snapshot and updates the live configuration.
5. Any historical version can be restored. A rollback creates a new version, so history is never erased.

Concurrent saves are protected with a draft version check. If another administrator changed the draft, the older editor must reload instead of overwriting newer work.

## Safety rules

- All write, publish, reset, and rollback endpoints require an authenticated administrator session.
- Button and navigation destinations are limited to safe internal routes and page anchors.
- The editor cannot inject JavaScript, raw HTML, or arbitrary CSS.
- Colors must be six-digit hex values.
- Layout values are constrained to responsive ranges.
- Configuration objects are depth-, key-, array-, and string-limited before storage.
- Every draft save, publish, reset, and rollback creates an audit event.
- Public pages fall back to validated defaults if the database is temporarily unavailable.
- Protected routes stop immediately after an expired or missing session response, preventing duplicate responses and server crashes.

## Data model

- `PlatformConfig` stores the current draft and live configuration.
- `ConfigRevision` stores immutable published snapshots.
- `AuditLog` records administrative configuration activity.

## Main API routes

- `GET /api/platform-config` — public live configuration.
- `GET /api/admin/platform-config` — admin draft, live configuration, and history.
- `PUT /api/admin/platform-config/draft` — save a private draft.
- `POST /api/admin/platform-config/publish` — publish a version.
- `POST /api/admin/platform-config/reset-draft` — restore the live version or factory defaults into the draft.
- `POST /api/admin/platform-config/rollback/:version` — publish a historical snapshot as a new version.

## Verification

Run:

```cmd
npm run check
```

This builds the production frontend, checks the Express server syntax, verifies configuration sanitization, responsive limits, dashboard definitions, and safe-route handling, and launches a temporary backend to confirm unauthenticated protected requests return one `401` response without crashing the process.

## Deliberate boundaries

The visual builder uses a constrained responsive grid. Free-form pixel positioning, arbitrary CSS, arbitrary HTML, and executable scripts are intentionally excluded because they can break mobile layouts or create a security vulnerability.

Media uploads should use durable object storage before being added to the visual builder. The current Render filesystem is not a safe permanent media library.
