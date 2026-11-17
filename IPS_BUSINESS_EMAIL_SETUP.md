# IPS Business Email — ipsglobalservice.com

**Status:** configured in application source; Cloudflare aliases, DNS records, and sending-domain verification are not yet verified live. Do not publish these addresses as working until tested.

## Address plan

| IPS identity | Function | Incoming destination |
|---|---|---|
| contact@ipsglobalservice.com | First contact, customer replies, website enquiries | Verified mailbox through Cloudflare Email Routing |
| support@ipsglobalservice.com | Personalised support and outgoing customer follow-up | Verified mailbox through Cloudflare Email Routing |
| orders@ipsglobalservice.com | Accepted quotations, order notifications | Verified mailbox through Cloudflare Email Routing |
| billing@ipsglobalservice.com | Receipts, billing enquiries | Verified mailbox through Cloudflare Email Routing |
| privacy@ipsglobalservice.com | Privacy and access/deletion requests | Monitored verified mailbox through Cloudflare Email Routing |

These are **routing aliases**, not independent login mailboxes. A forwarding destination may be a private existing mailbox; that does not make it the public sender.

## Incoming: Cloudflare Email Routing (Free)

In Cloudflare dashboard for `ipsglobalservice.com`, navigate to **Email > Email Routing** (or **Compute > Email Service > Email Routing** if the UI was updated).
1. Confirm Email Routing is **active** and the destination mailbox is **verified**.
2. Create five separate custom-address rules for the five IPS identities above, pointing to the verified receiving mailbox or another deliberately chosen monitored team inbox.
3. Leave the existing apex/root MX records and active Cloudflare Email Routing records unchanged; **do not replace them with mail-provider MX records**.
4. Send five separate inbound test emails, from an external sender, and verify all five arrive with the original **To** recipient intact. Check spam and filters.
5. Do not use an unverified catch-all in place of these explicit rules.

Cloudflare Email Routing is not a full outgoing mail service. Simply replying from the destination mailbox normally exposes that mailbox as the sender; do not do that for IPS client communication.

## Outgoing: Resend business-domain identity (Free tier subject to provider limits)

Use Resend to send transactional, scoped messages from the private IPS backend:
1. In Resend dashboard add `ipsglobalservice.com` as a sending domain.
2. Resend will show its exact DNS records: DKIM and a return-path/SPF/MX record set, often on a **sending subdomain**. Copy the **actual values from Resend**, not values inferred from tutorials or another customer's domain.
3. Add only those nonconflicting records in Cloudflare DNS. Leave Cloudflare Email Routing MX at the **root `@`** untouched. SPF may be on a dedicated subdomain; do not create two competing SPF TXT records for the same hostname. Use **DNS only** (not proxied) where relevant.
4. Add a basic domain DMARC policy only after reviewing all legitimate senders and verifying SPF/DKIM alignment. Configure DKIM, SPF and DMARC to preserve deliverability; do not set restrictive DMARC prematurely.
5. Confirm Resend shows **Verified** for the exact domain. Test a business-sender email to two different inboxes. Inspect From, Reply-To, DKIM/SPF/DMARC results and where replies arrive.
6. Create a **sending-only** Resend API key with the minimal practical permissions and install it securely on the Express backend host. Do not paste it into chat, GitHub, Vercel's public `VITE_*` variables or website source.

Set the following **server-only** environment variables on a verified, running IPS Express backend:

```dotenv
CONTACT_FROM_EMAIL=support@ipsglobalservice.com
CONTACT_REPLY_TO_EMAIL=contact@ipsglobalservice.com
CONTACT_RESEND_API_KEY=<SET_IN_HOSTING_SECRET_MANAGER>
```

The application uses these exact values for the admin's verified email-reply action:
- **From:** `IPS Academic Services <support@ipsglobalservice.com>`
- **Reply-To:** `contact@ipsglobalservice.com`
- **To:** the customer email stored against an authenticated, consented IPS enquiry
- **Subject:** project-related subject and enquiry reference

The backend refuses to send mail if `CONTACT_FROM_EMAIL` or `CONTACT_REPLY_TO_EMAIL` point to a personal/foreign domain. The sender's real activation still requires successful Resend/DNS verification.

## Security and operating boundary

- Public Cloudflare incoming email and API-based outgoing replies are two different services.
- The full `/admin/enquiries` inbox requires a live, database-backed IPS backend and an authorized `support.manage` administrator session. The static Vercel design preview has no sending credential and cannot deliver email.
- Automatic acknowledgement emails should not be enabled until sending domain, rate limits, consent rules, provider bounce processing, support staffing, and anti-spam controls are verified.
- For normal, manually composed mailboxes with independent logins, use a legitimate business mailbox host. Resend plus Email Routing is primarily transactional sending plus forwarding, not a full conventional team inbox.
- If forwarding to a personal destination, never use a plain manual reply from that destination. Use the authenticated IPS admin sender instead.
- Test inbound delivery, authenticated outbound sending, reply path, bounce handling, recipient opt-out/privacy requests, domain authentication, and account recovery before go-live.
- Do not configure DNS records on behalf of the owner without access to the actual Cloudflare zone and independent review of existing records.
- Future changes to providers must preserve existing inbound routing and domain ownership.

**State as of 2026-11-17:** No authenticated Cloudflare DNS connector is available in this ChatGPT session, so routing rules and DNS changes must be completed inside the Cloudflare account by an authorized owner. No Resend API key or verified sending-domain proof has been supplied. This document is an exact implementation plan, not proof of activation.
