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
