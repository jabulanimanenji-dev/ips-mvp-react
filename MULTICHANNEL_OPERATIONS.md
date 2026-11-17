# IPS Academic Services — Working Orders, Messaging and Channel Readiness

## Current implementation scope and protection

This guide describes the isolated `commercial/student-support-v1` branch and its legitimate student-support workflows. `main` is protected and not automatically merged.

The existing IPS Express/Mongoose application remains the **single order authority** for customer identity, quotations, workspaces, document files, messages and payments. External chat services are supplementary support channels: they cannot independently grant access to a student's project, authorize payments, deliver protected documents, or create an accepted quote.

The Vercel `ips-academic-design-preview` is a static website demonstration built with `VITE_DESIGN_PREVIEW=true`, NOT the Express backend. It shows only safe public content and cannot receive webhooks or fulfill orders.

## Public communication identities (2026-11-17)

- WhatsApp Business public number: **+48 794 088 714**, click-to-chat `https://wa.me/48794088714`.
- Telegram bot public username: **@IPScontactBot**, eventual link `https://t.me/IPScontactBot`.
- The owner reported the Telegram token was rotated on 2026-11-17. The **public link is enabled**, but automated bot replies and webhook integration are still unverified; no token has been supplied to the secure runtime. Do not use or check in the previously exposed token.
- WhatsApp click-to-chat can open without Meta Cloud API provisioning. That does not mean messages are received by the IPS administrator inbox or automatically replied to; Cloud API setup is separate.
- Neither identity is a basis for customer authentication. Keep authoritative orders and files in IPS.

## Customer lifecycle

1. Student browses 16 supported services and creates an account.
2. Student submits a support request under their signed account and sees their workspace.
3. IPS admin reviews scope and issues a real quote (not a fictitious displayed price).
4. Student accepts the quote. A merchant-configured Stripe Checkout session may be created.
5. Only Stripe's authenticated webhook records paid status; returning from Checkout is insufficient.
6. Paid support can move into the existing assignment and delivery workflow.
7. Student reviews real files, milestone updates and permitted revision requests in the workspace.
8. Finance reviews confirmed charges and separately handles refunds, disputes, fees and payouts.

All stages require database-backed, cross-role browser acceptance before real customer use.

## WhatsApp Business integration (backend only; disabled until credentials are verified)

Configure these values in the authenticated server host's protected environment (never the GitHub repository or Vite client):

- `WHATSAPP_PUBLIC_NUMBER`: your verified WhatsApp Business number in international digits only, no `+`
- `WHATSAPP_PHONE_NUMBER_ID`: the matching WhatsApp Cloud API phone-number ID
- `WHATSAPP_ACCESS_TOKEN`: approved API access token with minimum necessary messaging permission
- `WHATSAPP_APP_SECRET`: Meta App Secret used to check `X-Hub-Signature-256`
- `WHATSAPP_VERIFY_TOKEN`: a random, private webhook setup challenge token
- `WHATSAPP_GRAPH_VERSION`: an explicitly reviewed supported Graph API version

Configure the verified Meta callback URL as:

`https://<YOUR-REAL-IPS-API-HOST>/api/channels/whatsapp/webhook`

Webhook GET returns challenge text only when the verify token matches. Webhook POST checks the HMAC of the exact raw JSON body before processing. Only customer text messages are added to the owner inbox; delivery statuses and unknown media are ignored.

Admin text responses use the official Cloud API, allowed only after a customer has messaged recently. Out-of-window outbound messages require approved message templates and are not provided in this first release.

**Do not replace the API hostname with the public static Vercel preview**.

## Telegram integration (backend only; disabled until credentials are verified)

Create a real business bot in Telegram using BotFather, then set:

- `TELEGRAM_BOT_USERNAME`: public bot username without `@`
- `TELEGRAM_BOT_TOKEN`: private Bot API token
- `TELEGRAM_WEBHOOK_SECRET`: random secret satisfying Telegram's webhook secret-token requirements

Set the webhook to:

`https://<YOUR-REAL-IPS-API-HOST>/api/channels/telegram/webhook`

Use Telegram's `setWebhook` with `secret_token` and HTTPS; pass secrets through protected administration, not URL history or public logs. The server rejects requests without the expected `X-Telegram-Bot-Api-Secret-Token` header. Only private text chat updates are ingested.

Telegram bots do not support Telegram's end-to-end encrypted Secret Chat experience. Do **not** describe bot conversations as end-to-end encrypted.

## Customer account linking and private information

- An unlinked external chat is an **unverified guest contact** in the owner inbox.
- A student can generate a 120-bit random, 20-character account-link code *after signing into IPS*.
- The code expires in 10 minutes, can be used once, is stored only as SHA-256, and is limited to three requests every ten minutes.
- The customer sends `/link <code>` to the business chat. The backend validates the code and records the channel-to-student association.
- Received account-link codes are **never stored in the message transcript**.
- Customers can unlink a channel from their IPS account.
- A channel link does **not** authenticate the sender to your website or grant access to order files, invoices, or payment controls.
- An admin inbox displays the conversation, linked/unlinked status, unread count, and permits controlled text replies.
- No automatic sharing of students' documents or order details to these third parties.

For GDPR/privacy readiness, finalize a truthful privacy policy, messaging data retention, security, data deletion handling, processing agreements and customer opt-in where required. Do not collect or expose research participant data in chat.

## Missing externally controlled requirements

- A **real MongoDB connection** for the Express application. The current MongoDB Atlas ChatGPT integration reports organization-level AI-client access disabled; an Atlas Organization Owner must enable it before the connector can inspect/act. This is not a database runtime diagnosis.
- An available **Node/Express backend host**. Existing IPS Render services were previously suspended for billing. The static Vercel design preview is not a backend host.
- A **Cloudflare R2** account, bucket, credentials and secure storage policy for actual file bytes. No Cloudflare account connector is currently available in this environment; connect the storage provider through its normal secure configuration, not by pasting secrets into chat.
- A real WhatsApp Business account / Cloud API registration and verified number; a real Telegram bot and its username/token.
- A merchant account and protected Stripe configuration before enabling any payments.
- Complete live backend tests, production account/role tests, email notifications, file security, dispute/refund/invoice policy, and lifecycle acceptance.
- Audit existing dependency vulnerabilities (last CI install reported 13 vulnerabilities) before public production authorization.

## Verified CI evidence

The complete MongoDB-backed HTTP integration suite runs in a disposable GitHub Actions `mongo:7` service container, not on the user's host or against production Atlas. It has passed **20/20** assertions, including signed sessions, client isolation, student intake, administrator quotation, forged quote rejection, simulated correctly signed Stripe webhook, exactly-once paid status, paid quote immutability, duplicate Telegram/WhatsApp events, redacted linking codes, admin inbox permissions and customer unlinking.

The three CI workflows must remain green: full repository checks, real Chrome desktop/mobile qualification, and real MongoDB-backed integration. These prove implementation correctness in the CI sandbox, **not** provider onboarding, live message delivery, a real bank payout, or an authorized customer purchase.

## Test instructions

```sh
npm ci
npm run verify:student-support
npm run check
```

The new verification suite checks provider webhook HMACs and token signatures, malformed chat handles, input parsers, supported service catalogue, quote validation and no public disclosure of secrets. The real Chrome workflow validates the public website and mobile views. Unit tests **do not** prove a connected Meta/Telegram provider, MongoDB transactions, bot provisioning, Cloudflare permissions or production delivery.

## Delivery acceptance contract

Do not present the commercial release as operational until this complete evidence-backed journey passes:

real signup → real user session → real support request → user-owned file upload → legitimate admin quotation → student acceptance → approved payment provider transaction → verified webhook → scoped assignment → reviewed delivery → verified download/revision → accurate ledger/reconciliation.

For external messaging additionally require:

incoming authentic Meta and Telegram events → correct chat identity & deduplication → visible admin inbox → accurate owner reply → student links account with a single-use token → unverified guest cannot access order → unlink/relink/expiration/retention tests → channel privacy notices and operational support rules.

Preserve protected source and do not turn off verification gates merely to make a demo pass.
