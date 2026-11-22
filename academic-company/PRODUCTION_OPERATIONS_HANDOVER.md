# IPS Academic Services — non-payment production engineering handover

This register is NOT a statement that the current isolated evaluation server is production-ready. Payments, payouts, settlements and tax receipts remain disabled.

## Source and infrastructure

- Authoritative application: GitHub jabulanimanenji-dev/ips-mvp-react, branch company/ips-academic-services-2026, only after an independently successful complete CI and exact-head promotion.
- Current preview: https://ips-academic-services-review-20261121.onrender.com (Render service srv-dc0qs16c6qcc73f6ieug, isolated fictional evaluation data).
- New independent Atlas project IPS Academic Services Production, ID 6b0222c3b054b0e3c183a91a, cluster ips-academic-prod, Frankfurt EU_CENTRAL_1. Free-tier storage alone does not establish backup coverage or production adequacy.
- Legacy Atlas project 6a5800b52d2de3b806c0b679 retains ips-cluster and old ips data. Preserve the former live Render service srv-d9bso3hkh4rs73bl22e0 until verified independent backup, outstanding customer-obligation reconciliation and rollback.
- Render workspace renaming is deliberately unnecessary.
- New Atlas production database `ips_academic_services_2026` has been created. Its single release-control record is **FALSE for activation and owner acceptance**. This is source admission preparation, not an active customer platform.
- New production database also stores a strictly no-PII redacted legacy boundary-audit record. It contains no imported clients, orders, password hashes or customer files.
- The isolated independent Render topology is proposed in `render.ips-academic-final-production-stack.yaml`. Blueprint `exs-dc164pl9fdbs739tjchg` has been planned, NOT APPROVED/APPLIED. It resolves pre-cutover URLs and private antivirus hostnames dynamically and leaves historical services unchanged.

## Migration boundaries

Historical orders tagged TEST / Physical Goods and professional-service requests are NOT academic-company jobs and cannot be blindly imported. Specifically, there are four test physical-goods orders, three professional requests (one in progress, one assigned, one new), two old SENT invoices marked PENDING_VERIFICATION whose order references do not join the audited historical orders, and one OPEN historical support ticket. Preserve the open ticket and potential obligations for separate review; do not invent settled payments. Four channel messages join legacy contacts by MongoDB ObjectId _id, but are not copied to the new company. The old client and Specialist identities are not transferable without new verified ownership and fresh qualification. Historical manager privileges are never automatically inherited.

An executable no-PII read-only audit is supplied in scripts/audit-legacy-boundary.mjs, using environment IPS_LEGACY_READONLY_MONGODB_URI pointing only to the historic ips database. It prints redacted category/status counts and referential match counts, without names, emails, passwords, text or files. It does not modify or migrate any record.

## Real encrypted backups and independent restore

The streaming AES-256-GCM source and negative tests are in scripts/encrypted-mongo-archive.mjs and scripts/verify-encrypted-archive.mjs. Authentication is now a complete first pass into a no-output sink; a wrong key or corrupt archive emits ZERO plaintext before restore. A distinct `scripts/backup-offsite.sh` runner, `Dockerfile.ips-academic-backup`, `scripts/verify-offsite-backup.mjs` and Frankfurt Render Cron proposal implement scheduled AES-256-GCM, S3 bucket-versioning/public-access checks, SSE-S3, immutable unique object keys, full independent remote readback and authentication. All checks and the real cron container have passed the source CI. These are NOT a claim of live AWS object storage, deployed cron execution or actual customer backups. Provide a securely stored 64-character hexadecimal IPS_BACKUP_AES256_KEY environment variable. The backup output must be an absolute path OUTSIDE the application repository and must be transported to encrypted, versioned, access-controlled offsite storage. Never commit or paste backup material or keys.

In a trusted production shell with MongoDB database tooling, after injecting the approved MongoDB URI and encryption key from a secret manager:

~~~bash
set -euo pipefail
mongodump --uri "$MONGODB_URI" --db ips_academic_services_2026 --archive |
 node scripts/encrypted-mongo-archive.mjs encrypt "/secure-offsite/ips/academic-$(date -u +%Y%m%dT%H%M%SZ).aesgcm"
~~~

Independently drill the restore to a DIFFERENT database and server, never production:

~~~bash
set -euo pipefail
node scripts/encrypted-mongo-archive.mjs decrypt /secure-offsite/ips/SELECTED_BACKUP.aesgcm |
 mongorestore --uri "$IPS_ISOLATED_RESTORE_MONGODB_URI" --archive --nsFrom 'ips_academic_services_2026.*' --nsTo 'ips_academic_restore_drill.*'
~~~

Confirm exit status of the entire pipe. The current two-pass GCM reader authenticates a complete file before releasing any plaintext to the restore pipe. For independent drills use a separate, explicitly authorized restore database/cluster: compare restored account/quote/commission/audit counts and GridFS bytes and SHA256 against source. Keep Atlas-managed recovery snapshots active as the primary protection; streaming mongodump is an additional layer and is not a point-in-time snapshot under concurrent writes. Record independent evidence and keep secrets offline. CI proves the workflow with fictional sandbox data only, not live customer backup coverage.

## Real provider and official-domain evidence

- Resend: the proposed Render Blueprint may securely reference the old running IPS service's CONTACT_RESEND_API_KEY, CONTACT_FROM_EMAIL and webhook configuration as a starting point without exporting credentials. The NEW webhook endpoint requires independent Resend registration and its own verified signing secret. Prove genuine login verification, password recovery, signed delivery events, bounce handling and private message delivery, not merely an API receipt.
- Telegram: staging must use a SEPARATE Telegram bot. Add TELEGRAM_BOT_TOKEN, IPS_TELEGRAM_BOT_USERNAME and IPS_TELEGRAM_WEBHOOK_SECRET. Verify linked real incoming and outgoing updates; provider acknowledgment does not prove a customer read a message. Never repoint the live legacy bot before reversible cutover.
- Malware screening: the proposed independent private Render ClamAV 2 GB service has a persistent signature disk and dynamically mapped private host; do not expose port 3310 publicly. Verify real safe, EICAR standard test signature and scanner outage responses. Review-mode simulated scanner is not production antivirus.
- Provider preflight: scripts/probe-real-providers.mjs checks real Resend domain, live Telegram bot/webhook, and actual ClamAV signature recognition without logging credentials. An explicitly approved staging mailbox is required for outbound provider tests; API acceptance is not a human read receipt.
- Domain: configure HTTPS and ipsglobalservice.com only after live verified role-specific workflows, privacy policies, data recovery, email and Telegram acceptance and working rollback. Do not re-use test secrets for production.

## Source-bound admission

The production program refuses startup unless exactly one ips_academic_services_2026 release-control document names the actual deployed SHA and contains evidence-supported true flags for historical reconciliation, independent database/file recovery, real providers, real malware scanner, security checks and explicit owner acceptance. Never set those flags without independent evidence simply to obtain an HTTP 200.

Remaining OWNER-ONLY actions after technical qualification: authorize paid backup-capable Atlas and adequate Render resources; provide secure object-storage destination and encryption-key custodianship; configure dashboard-only DNS and provider secrets unavailable to connectors; witness actual email and Telegram receipt; accept the final design, company policies and official publication. The implementation work, source tests, role workflows and release engineering belong to the developer, not to the owner.

## Live status and cutover safety

- Exact accepted source qualification and an evaluation deployment are necessary but never sufficient for the whole-company release.
- The pre-cutover production instance must use its own HTTPS Render URL for Origin, verify all five identities, preserve strict role boundaries, and remain off the official domain until owner approval.
- On final cutover, set PUBLIC_APP_URL to the official HTTPS origin, migrate approved provider webhooks with rollback, verify genuine inbound/outbound contact, confirm new production release control source SHA and owner acceptance; only then attach the official domain.
- The full production stack Blueprint contains paid, recurring components and several missing secure environment values. Its planning outcome is valid, but approval is deliberately withheld until subscription authorization, Atlas access and secure S3 custodianship exist. No fake values should be inserted to force a deployment.

The payment gateway is a separate future release.
