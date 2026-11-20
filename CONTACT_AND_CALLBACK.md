# IPS written-contact desk — direct WhatsApp without Meta API

## Policy and configuration (owner decision, 2026-11-20)

IPS never calls customers. Every quotation is reviewed by a human and
replied to only by a customer-selected written method. Legal names are not
required for initial confidential quotations. Academic documents, payment
details and other sensitive files stay in the authenticated IPS workspace.

The owner's chosen WhatsApp workflow is **direct, manual chat** using
https://wa.me/48794088714. This is a user-initiated link to the existing IPS
business number, **not** a WhatsApp Cloud API integration. It requires no
Meta developer application, PHONE_NUMBER_ID, ACCESS_TOKEN or APP_SECRET.
No claim of automated WhatsApp delivery, webhooks, confirmed read receipts,
centralized message synchronization or staff response is permitted.

## Customer enquiry and quote flow

1. Customer submits a request in the real IPS form, choosing WhatsApp and
   providing the phone number that they will send the WhatsApp message from.
   The stored reference is an IPS-Q-... or ENQ-... identifier.
2. A message link opens the business WhatsApp chat with only the reference
   prefilled. The customer must actively press **Send** within WhatsApp.
   This does not silently send a message or expose the research brief.
3. Until an authorized IPS reviewer manually observes a message containing
   the **exact reference** from the **same WhatsApp number**, the contact
   remains unverified in the database and cannot enter a governed quote
   or approved project workflow.
4. The reviewer signs into the IPS admin enquiries queue, inspects the
   real incoming business WhatsApp conversation (outside IPS), types
   the observed sender number and exact reference, and expressly attests
   the match. The server atomically verifies a matching, still-consented,
   open request. It records method, reviewer ID and timestamp without
   importing chat contents or external contact names.
5. The reviewer can then open the customer's WhatsApp chat link from the
   authenticated admin queue and respond manually in writing. All
   confidential deliverables and agreement/payment records must remain
   in the protected IPS workspace. No external chat messages are copied
   into the IPS inbox or marked as delivered by the app.
6. If a customer withdraws consent or sends STOP, staff must record a
   WhatsApp contact withdrawal in the admin queue, which closes that
   request and prevents further replies.

The admin verification and withdrawal APIs are under **support.manage**
permissions. The reference itself is not an authentication credential.
Reviewers must not attest a message they have not personally inspected.

## Deployment and verification

The existing public number is configured in `shared/publicContacts.js`.
The server uses `WHATSAPP_PUBLIC_NUMBER` when supplied, falling back to
the existing approved company number. The optional
`WHATSAPP_CONTACT_MODE=api` is **not** part of this release.

No WhatsApp Meta API credentials need to be installed in Render. The
release checks require a valid direct WhatsApp link, while keeping
Resend email verification, Telegram configuration, persistent MongoDB,
private R2 storage, signed email receipts and the disabled-payment gate.
Source CI and mocked tests are not substitutes for actual production
delivery, account and storage verification.

Do not remove the currently deployed production fallback until the new
company release passes its real nonpayment production qualification.
