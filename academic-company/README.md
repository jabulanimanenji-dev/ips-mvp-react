# IPS ACADEMIC SERVICES — FRESH CONSTRUCTION BASELINE
This branch constructs **IPS Academic Services**, not a generic project services company.
Its governing constitution is `GOVERNANCE/IPS_ACADEMIC_SERVICES_COMPANY_CONSTITUTION_V1.md` from the owner-approved requirements consolidation.
The academic company application lives in `academic-company/`. Until specific production acceptance, this branch is isolated and must not replace the public website.
**Never import, re-skin, or copy the rejected International Project Services preview.**
Academic service taxonomy, private student identity, approved specialists, Nyoro root, departmental authorities, written quote routing, academic QA and secure delivery are mandatory.

## Academic document security gate

All newly uploaded PDF, DOCX and TXT documents (Student enquiries and case files, Specialist submissions, Root-only supplier records, and direct company attachments) pass the same scan gate before storage. Configure the ClamAV daemon through `IPS_CLAMAV_HOST` (private-network hostname) and `IPS_CLAMAV_PORT` (default 3310). The application sends file bytes using the official ClamAV `zINSTREAM` protocol; ClamAV's `StreamMaxLength` must exceed the permitted 20 MiB academic attachment size. Keep scanner communications on a trusted private network and update antivirus signatures regularly. An absent, timed-out, or inconclusive scanner results in HTTP 503, and a positive detection results in HTTP 422; neither file is saved. Unscreened existing documents cannot be newly approved for QA release in production.

The disposable review environment deliberately operates without a real scanner and marks its file metadata `synthetic_not_scanned`. The protocol regression tests use a **synthetic ClamAV-compatible test double**, not genuine antivirus coverage. Production readiness requires a running current ClamAV engine, real clean/infected test receipts, documented operations and recovery, and independent acceptance before cutover.

This change does **not** enable payments or promote the isolated evaluation service to production.

## Verified Telegram written contact

Telegram is optional and is **not** inferred from an account's @username. When approved for deployment, configure three separate secret/environment settings: `TELEGRAM_BOT_TOKEN`, `IPS_TELEGRAM_BOT_USERNAME` (public bot handle, no @), and `IPS_TELEGRAM_WEBHOOK_SECRET` (16–256 allowed characters). Register the secure webhook with Telegram Bot API `setWebhook`: URL `https://<official-company-host>/api/integrations/telegram/webhook`, `allowed_updates=["message"]`, and `secret_token` equal to `IPS_TELEGRAM_WEBHOOK_SECRET`. Keep the bot token confidential and restrict webhook configuration to authorized operations staff.

Verified Student/Researcher and Specialist accounts can request a 20-minute single-use Telegram bot deep link in their profile. Only a private chat with a matching Telegram sender and the current one-time link becomes a destination. The account holder can revoke it. An account can select Telegram as a written reply method only after the chat is linked and confirmed. Existing guest Telegram enquiries are not converted into fake deliveries; new guests use verified email or can register a private IPS account and link the bot. Academic subject, price, documents, messages and personal details **never** appear in outbound bot notifications; they are kept within the authenticated workspace.

Production Telegram `sendMessage` returns provider acceptance, **not** proof that a user read the message. IPS records `provider_accepted` rather than `delivered`, retries eligible failures and surfaces exceptions to Root. The disposable review environment records only synthetic Telegram responses and has no external Telegram bot credentials. Real delivery and webhook receipt must be independently proved before company cutover.

## Telegram operator conversation qualification

The authenticated Root and authorized Communications department personnel can read linked inbound private Telegram text in the unified IPS inbox, mark it read, and queue controlled replies. Sender identity is bound to a one-use bot link and private sender/chat identity. A replayed update ID is rejected by a MongoDB unique index. Revoked destinations cannot receive new operator replies. Neither audit events nor external notifications copy inbound academic text.

Operator replies require an explicit privacy acknowledgement and are recorded in `academic_telegram_messages` and queued through `academic_notification_deliveries`. Provider acceptance is **not** a human read receipt. Telegram does not provide an exactly-once guarantee following an uncertain network send. The CI uses a **synthetic** bot; live inbound/outbound, webhook cutover from the legacy endpoint, provider credentials, and retention validation must be independently proved before production acceptance.

## Signed Resend delivery webhooks

A signed Resend/Svix POST is handled at `/api/integrations/resend/webhook`. Configure `RESEND_WEBHOOK_SECRET` to the real endpoint's `whsec_` secret in a secure production environment. The route verifies an HMAC-SHA256 signature over **exact raw bytes**, webhook identifier and timestamp, rejects invalid or stale signatures, and stores only a message identifier, provider event type and status. Unique identifiers make retries idempotent. Early/out-of-order events reconcile with the durable sending queue after provider ID assignment.

Delivery events `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.failed` and `email.suppressed` update company delivery status. Hard bounces and complaints generate private Root exceptions and **cannot** be automatically retried as normal transient queue errors. A delivered state means recipient-server delivery, **not** that the recipient read an email. CI signs synthetic events with a test-only key; production still requires a real provider endpoint and an externally witnessed inbox delivery and failure test. This integration does not provide inbound email conversation ingestion or authorize production cutover.

## Finance operating foundation — actual payments deliberately disabled

When a genuine verified Student accepts an approved written quotation, IPS idempotently creates exactly one non-payable billing-preparation record linked to the accepted academic commission. `/api/finance/my-billing` shows the Student's own records without claiming an invoice or receipt. The Root and authorized Finance department view a separate `/api/finance/overview` with accepted-quote values distinct from collected revenue (always zero until a verified payment integration exists).

An assigned Specialist can submit idempotent, dated, meaningful work logs using `/api/finance/work-logs`. Only Root/authorized Finance managers can approve or reject those records, with an audit trail; a Student, an unrelated manager or Specialist cannot approve. Root/Finance may propose scoped Specialist fees at or below the agreed quote, which the assigned Specialist must explicitly accept or decline. Neither fee agreement nor approved time results in a real payout. Students can raise private billing concerns and Finance can document resolution; without settled money the system cannot invent a refund.

**No payment provider, charge, refund, settlement, payout execution, tax invoice or receipt is implemented or claimed.** Production legal tax invoicing, accounting integration, pricing/currency expansion, reporting and provider-backed reconciliation require separate checks before activation. The isolated qualification uses fictional accounts and a synthetic commission gate; it cannot certify real payouts, receipts or tax compliance.
