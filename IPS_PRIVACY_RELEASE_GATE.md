# IPS Academic Services — privacy-first release gate
Updated: 19 November 2026
Source branch: `commercial/student-support-v1` (GitHub PR #7, draft)

## What the source now enforces

- Students and researchers choose a unique, case-insensitive private username; no legal name is collected by registration, quotation intake or ordinary workspace updates.
- Only specialists supply full legal names for applications and review.
- Student and specialist account access requires successful ownership verification of the email address. Verification codes are random, hashed at rest, single-use, expire after 15 minutes and are limited to five unsuccessful attempts. Verification fails closed if email transport is unavailable.
- Registration and password updates enforce at least 8 characters, an uppercase letter, a digit and a symbol. Account holders must supply their current password for an in-session password change; administration cannot reset a student's password using a prompt.
- The public Get a Quote form works without creating an account, with a chosen username, service category, academic requirements, optional deadline and selected written contact method. Email quotes require a verification code; Telegram/WhatsApp require a customer-initiated conversation and exact reference/identity matching. IPS workspace delivery requires a verified signed-in session.
- No telephone or voice callbacks. Correspondence is written only. Customer contact choices are not silently substituted.
- The administrator quotation queue routes verified email, in-app workspace and connected messenger correspondence separately. Private in-app quotation messages are checked against the account owner on every request.
- Unverified guest enquiries use an expiry index with a 30-day TTL. Verified records are not automatically erased by that TTL and must follow a governed retention schedule.
- The homepage and dedicated `/privacy` page explain limits of ordinary email and Telegram bot confidentiality without claiming unverified end-to-end encryption.
- Existing internal data model terms such as `client` and `writer` remain as implementation identifiers to preserve dependent interfaces. Public labels use Student / Researcher and Specialist.

## Required backend configuration before real customer traffic

Set these values **only in the backend provider's secret manager**, never in `VITE_*` browser variables or tracked source:

- `MONGODB_URI`: actual reachable, protected production MongoDB.
- `SESSION_SECRET`: unique, private session-signing key.
- `CONTACT_RESEND_API_KEY`: verified IPS business sender API key.
- `CONTACT_FROM_EMAIL=support@ipsglobalservice.com`
- `CONTACT_REPLY_TO_EMAIL=contact@ipsglobalservice.com`
- `EMAIL_VERIFICATION_SECRET`: unique cryptographically random secret of at least 32 characters; independent of `SESSION_SECRET`.
- `CONTACT_EMAIL_NOTIFICATIONS_ENABLED=true` only after testing both staff and customer notifications, delivery webhooks and bounce handling.

Optional Telegram/WhatsApp choices must remain disabled until genuine business credentials, webhooks, message delivery and customer-initiated chat linking have all been verified. Signal is **not connected** and must not be advertised as available. An enabled configuration flag alone is not proof of live message delivery.

Do not activate guest email registration or enquiries without a functioning sender and confirmation flow. Domain syntax checks are not proof of a real mailbox: successful single-use email verification is the required evidence.

## Legacy personal data gate — not satisfied by code changes alone

The repository previously required `Client.full_name` and saved names in older orders, service requests and support records. New records avoid this, and the generic administrator account list now hides old legal names, but existing production database values are **not erased by a code deployment**.

Before launch: back up the database, inventory legacy full names and their references, determine which customers have paid/legal/contractual records that must be retained, and remove/anonymize unnecessary names from unpaid accounts and appropriate dependent records. Preserve payment, disputes, invoices and legal evidence required by applicable rules. Never bulk-delete records without scope verification and recovery evidence. Record who authorized changes and the resulting counts without exposing names.

## Qualification and acceptance

GitHub Actions workflows on the exact candidate SHA must all pass:
1. Student Support V1 Verification (`npm run check`) — includes unit/privacy and static/security gates.
2. IPS Student Full Backend Integration — genuine MongoDB account, quote, message, entitlement, payment and messaging tests using fake external delivery credentials only.
3. Student Academic Website Browser QA — desktop/mobile website, quote selection, account labels and privacy notice.

Green CI does not prove real Resend inbox delivery, live Telegram/WhatsApp webhook behavior, external payment settlement, legal sufficiency of the published privacy text, production hosting or migration of legacy data. These require separate source-bound verification after the backend can run.

## Release decision

Do not merge the draft PR into protected `main`, turn on unverified communication methods, auto-start paid work or declare production-ready until backend hosting, verified email delivery, DNS, messenger integrations, protected account access and legacy-data retention have passed a real staging verification. The customer must always approve a written quote before payment or fulfillment.
