# IPS Email Automation — Deployment and Acceptance

**Scope:** `commercial/student-support-v1` branch. Protected `main` and the existing Gmail/Cloudflare settings are unchanged.

## What is now implemented

1. A guest submits the public IPS enquiry form and consents to enquiry-related contact.
2. The Express backend saves the enquiry to MongoDB before attempting notifications. The response returns an `ENQ-...` reference, never a false "email delivered" claim.
3. When an authorized owner enables notifications on the **real backend**, two outbox records are created transactionally with the enquiry workflow:
   - `staff_notice`: a minimal new-enquiry notification to `contact@ipsglobalservice.com`, forwarded by Cloudflare to the monitored inbox.
   - `client_receipt`: a brief plain-text acknowledgement to the customer's email if provided with consent. A phone/WhatsApp-only enquiry does not trigger a customer email.
4. A 20-second opt-in worker processes persisted outbox jobs with atomic leases, stable Resend `Idempotency-Key` values and bounded retries. It **never** sends marketing messages or reproduces original enquiry attachments or sensitive text.
5. An owner can reply personally through `/admin/enquiries`; the email sender is `IPS Academic Services <support@ipsglobalservice.com>`, reply-to `contact@ipsglobalservice.com`. Personal-email senders are rejected.
6. With a properly configured Resend webhook, only authentic signed delivery events change job status from `accepted` to `delivered`, `bounced` or `complained`. IPS staff see these states in the enquiry inbox; provider acceptance is never misrepresented as inbox placement.

## Safe activation prerequisites

- An operational, private-source **Node/Express** IPS API host running this branch. **Existing Render hosts were billing-suspended** when last checked. The Vercel website is a read-only static design preview with no API/database.
- A working private `MONGODB_URI` for IPS contact records; the Atlas organization previously restricted AI-client access. Verify the real application runtime separately.
- Existing verified `ipsglobalservice.com` sending domain with Resend and Cloudflare incoming routing (the owner has confirmed real successful send/reply tests).
- Before exposing a public data-collection API: privacy notice/retention policy, abuse controls beyond the current per-instance memory throttle, and an authorized team able to follow up.
- No real customer email without business sender verification and explicit owner approval for enabling automation.

### Backend-only environment (example — never insert secrets into source)

```dotenv
CONTACT_FROM_EMAIL=support@ipsglobalservice.com
CONTACT_REPLY_TO_EMAIL=contact@ipsglobalservice.com
CONTACT_RESEND_API_KEY=<PRIVATE_RESEND_SENDING_API_KEY>
CONTACT_EMAIL_NOTIFICATIONS_ENABLED=false
CONTACT_RESEND_WEBHOOK_SECRET=<SEPARATE_PRIVATE_RESEND_WEBHOOK_SECRET>
```

Keep `CONTACT_EMAIL_NOTIFICATIONS_ENABLED=false` while qualifying the deployed backend. Set it to `true` only after the live test suite passes, rate limiting is ready, and the domain owner authorizes real notifications. New enquiries are saved even when notifications are disabled, but do not queue emails retroactively by default.

### Resend webhook (after a public backend URL is verified)

In **Resend → Webhooks**, create a webhook for the actual HTTPS **backend** host:

`https://<VERIFIED_BACKEND_HOST>/api/contact-email/resend-webhook`

Subscribe to `email.delivered`, `email.bounced`, `email.complained`, and `email.failed`. Save its `whsec_...` signing secret **in the backend secrets manager** as `CONTACT_RESEND_WEBHOOK_SECRET`. This webhook secret is not your API key. Test a valid signed event and an invalid one. It must not point to the static Vercel design-preview URL.

### Verification sequence

1. Check `/api/health` responds with `database: connected`.
2. Submit a real, consented **test enquiry** from an account you control. Confirm a single new `ENQ-...` record exists.
3. With production sending enabled, confirm one IPS staff notice and (when an email was provided) one client receipt. Check the email provider logs.
4. Confirm messages arrive, and a customer reply reaches Cloudflare-forwarded `contact@ipsglobalservice.com`.
5. Verify status changes from `accepted` to `delivered` only after a signed Resend event. Test bounce/complaint handling without sending to real customers.
6. Verify repeating a request or retrying a worker does not send duplicates. Verify unverified sessions cannot read other customers' enquiries or email statuses.
7. Check the inbox staff-reply flow with the true business From/Reply-To; make sure the owner's personal Gmail does not appear.

### Verified CI scope

The GitHub integration workflow runs a real disposable MongoDB database with **mock Resend HTTP responses and synthetic signed webhooks**. Those tests verify outbound identity, persistence, deduplication, signed delivery events, and private admin access without sending real mail. Actual sending to customer mailboxes must be tested on an operational backend before production acceptance.

### Do not change

Do not touch Cloudflare root MX records, the nine existing routing aliases, existing Gmail send-as configuration or protected `main`. Never paste the saved Resend API key into a chat, source file, browser-side `VITE_*` variable or build log. Provider acceptance does not guarantee inbox placement.
