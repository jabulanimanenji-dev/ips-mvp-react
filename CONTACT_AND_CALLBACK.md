# IPS Contact & Callback Desk — Source-bound Implementation

This feature is built on the isolated `commercial/student-support-v1` branch and does not merge or change protected `main`.

## Two distinct modes

1. **Static Vercel design preview** (`VITE_DESIGN_PREVIEW=true`): visitors can complete the contact form and prepare a WhatsApp message to the published IPS Business phone. The form **does not save** a request, and there is no automatically delivered lead. The visitor must press Send in WhatsApp. Telegram's public link opens @IPScontactBot but is not proof of a connected bot webhook.
2. **Full IPS Express/MongoDB backend**: a visitor can submit `POST /api/contact-enquiries` without registering. The backend validates consent and email/phone, limits requests, then saves a unique reference and a record in the admin contact inbox. Authorized staff can open `/admin/enquiries`, view contact details and enquiry history, track status, and initiate the preferred follow-up.

## Customer journey

1. Open `/#contact-ips` from the academic home page.
2. Enter name, preferred contact method (email, call, WhatsApp or Telegram), relevant contact details, a subject and an enquiry message.
3. Explicitly consent to IPS contacting the customer about **this enquiry only**. This is not marketing consent.
4. Submit to the real API if available. The API returns a reference such as `ENQ-...`; it never starts a paid project or grants access to protected files.
5. IPS staff see the lead in the role-protected admin queue and can contact the customer through the **chosen** method.
6. For email, staff can send a verified email from the admin inbox **only** when a Resend key and a verified sending email are configured in the backend. Provider acceptance is recorded, not claimed recipient delivery.
7. For manual phone calls and WhatsApp chat, staff can launch the OS/app using the callback details. This does not constitute a verified sent message in IPS; manual follow-up should be recorded honestly.
8. Existing registered student support tickets and service workspaces continue to be used for confidential or paid project operations.

## Production backend variables

Store these on the secure Express hosting service, **never** GitHub or `VITE_*`:

- `CONTACT_RESEND_API_KEY`: production email provider API credential (stored on the backend only)
- `CONTACT_FROM_EMAIL=support@ipsglobalservice.com`: verified IPS-only sender address
- `CONTACT_REPLY_TO_EMAIL=contact@ipsglobalservice.com`: monitored Cloudflare routing alias; required before IPS email sending activates

No provider credentials are required for the public click-to-chat links. SMS and automated telephone calls are **not** included without a verified communications provider and explicit customer permission.

### Anti-abuse and privacy

- No pre-checked consent. Intake is for the enquiry only, not bulk marketing.
- Basic 4 requests per 15 minutes per instance, Origin check, input restrictions and a hidden bot trap. **Before production traffic** add a centrally enforced rate limit / bot defense (for example Cloudflare Turnstile and durable Redis limits); in-memory limits alone are not sufficient at scale.
- Public requests are not an authentication method. The admin inbox requires an actual IPS admin session and `support.view`/`support.manage` permissions.
- Do not send passwords, payment card data or sensitive academic files through contact channels.
- Privacy notice, retention and deletion, consent evidence, vendor agreements and data access review require owner acceptance before exposing the API.
- Telegram Bot API cannot initiate chats with users who have not started the bot. WhatsApp Business API outbound templates have provider policy constraints.

## Qualification

`npm run verify:student-support`, `npm run check`, real MongoDB GitHub integration and Chrome desktop/mobile website tests. The CI suite checks unregistered lead intake, owner-only visibility, callback status, disabled-email fail-closed, form fallback and prior quote/payment protections. No actual phone/email sending is claimed from mocked or missing credentials.

## Still needed for go-live

Live Express hosting, real MongoDB, verified sending domain/email service, legal privacy/retention notices, optional telephony/SMS service, owner-confirmed operating hours, and genuine human callback acceptance. The Vercel static website remains a design preview and not a transactional contact backend.
