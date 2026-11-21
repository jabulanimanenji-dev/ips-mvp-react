# IPS Academic Services — non-payment production engineering handover

This register is NOT a statement that the current isolated evaluation server is production-ready. Payments, payouts, settlements and tax receipts remain disabled.

## Source and infrastructure

- Authoritative application: GitHub jabulanimanenji-dev/ips-mvp-react, branch company/ips-academic-services-2026, only after an independently successful complete CI and exact-head promotion.
- Current preview: https://ips-academic-services-review-20261121.onrender.com (Render service srv-dc0qs16c6qcc73f6ieug, isolated fictional evaluation data).
- New independent Atlas project IPS Academic Services Production, ID 6b0222c3b054b0e3c183a91a, cluster ips-academic-prod, Frankfurt EU_CENTRAL_1. Free-tier storage alone does not establish backup coverage or production adequacy.
- Legacy Atlas project 6a5800b52d2de3b806c0b679 retains ips-cluster and old ips data. Preserve the former live Render service srv-d9bso3hkh4rs73bl22e0 until verified independent backup, outstanding customer-obligation reconciliation and rollback.
- Render workspace renaming is deliberately unnecessary.

## Migration boundaries

Historical orders tagged TEST / Physical Goods and professional-service requests are NOT academic-company jobs and cannot be blindly imported. Two old invoices have unmatched order references; payment pending is not settled money. Channel messages join channelcontacts by MongoDB ObjectId _id. The old client and Specialist identities are not transferable without new verified ownership and fresh qualification. Historical manager privileges are never automatically inherited.

An executable no-PII read-only audit is supplied in scripts/audit-legacy-boundary.mjs, using environment IPS_LEGACY_READONLY_MONGODB_URI pointing only to the historic ips database. It prints redacted category/status counts and referential match counts, without names, emails, passwords, text or files. It does not modify or migrate any record.

## Real encrypted backups and independent restore

The streaming AES-256-GCM source and negative tests are in scripts/encrypted-mongo-archive.mjs and scripts/verify-encrypted-archive.mjs. Provide a securely stored 64-character hexadecimal IPS_BACKUP_AES256_KEY environment variable. The backup output must be an absolute path OUTSIDE the application repository and must be transported to encrypted, versioned, access-controlled offsite storage. Never commit or paste backup material or keys.

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

Confirm exit status of the entire pipe. A corrupt GCM stream can output partial bytes before final authentication fails: destroy the failed drill instance, never promote it. Compare restored account/quote/commission/audit counts and GridFS bytes and SHA256 against source. Record independent evidence and keep secrets offline. CI proves the workflow with fictional sandbox data only, not live customer backup coverage.

## Real provider and official-domain evidence

- Resend: add RESEND_API_KEY, verified FROM_EMAIL, and signed RESEND_WEBHOOK_SECRET to the secured environment; prove genuine login verification, password recovery, signed delivery events, bounce handling and private message delivery.
- Telegram: staging must use a SEPARATE Telegram bot. Add TELEGRAM_BOT_TOKEN, IPS_TELEGRAM_BOT_USERNAME and IPS_TELEGRAM_WEBHOOK_SECRET. Verify linked real incoming and outgoing updates; provider acknowledgment does not prove a customer read a message. Never repoint the live legacy bot before reversible cutover.
- Malware screening: provision a genuine updated ClamAV daemon reachable privately through IPS_CLAMAV_HOST and IPS_CLAMAV_PORT and prove a real safe, malicious and outage test. Review-mode simulated scanner is not production antivirus.
- Domain: configure HTTPS and ipsglobalservice.com only after live verified role-specific workflows, privacy policies, data recovery, email and Telegram acceptance and working rollback. Do not re-use test secrets for production.

## Source-bound admission

The production program refuses startup unless exactly one ips_academic_services_2026 release-control document names the actual deployed SHA and contains evidence-supported true flags for historical reconciliation, independent database/file recovery, real providers, real malware scanner, security checks and explicit owner acceptance. Never set those flags without independent evidence simply to obtain an HTTP 200.

Remaining OWNER-ONLY actions after technical qualification: authorize paid backup-capable Atlas and adequate Render resources; provide secure object-storage destination and encryption-key custodianship; configure dashboard-only DNS and provider secrets unavailable to connectors; witness actual email and Telegram receipt; accept the final design, company policies and official publication. The implementation work, source tests, role workflows and release engineering belong to the developer, not to the owner.

The payment gateway is a separate future release.
