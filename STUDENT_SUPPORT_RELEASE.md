# IPS Student Support — V1 Commercial Release Candidate

Source: branch `commercial/student-support-v1`, based on main commit `3cf0b45faea22a81f103732d8154e821f78ad918`.
Status: **release candidate only — NOT production approved**.

## What is in scope

Three eligible service families:
1. Assignments and Coursework Support — tutoring, planning, student draft feedback, references.
2. Thesis and Dissertation Support — research planning, methods coaching, chapter editing, formatting.
3. Research Project and Data Support — study design, data interpretation coaching and presentation feedback.

This product does not sell ready-to-submit assessed work or impersonation. Students retain responsibility for academic authorship.

## End-to-end intended journey

1. Visit `/student-support` and select one of the three service packages.
2. Create account or log in; login/signup returns to the selected package.
3. Fill in course, level, deadline and specific legitimate support request.
4. Server creates a validated `ServiceRequest` with an immutable client identity, `payment_status=unpaid`, and no client-supplied quotation or staff status.
5. Student opens `/client/services/{id}` and uploads necessary supporting materials through the existing governed workspace.
6. Admin reviews scope, assigns a PLN quotation and supplies terms/delivery schedule.
7. Student accepts the quote from the existing Service Hub.
8. Student clicks **Pay** inside the request detail. The backend revalidates ownership and the accepted quote and creates a Stripe Checkout session using server-verified amount/currency.
9. Only signed Stripe webhooks can make payment status `paid`. Redirecting back from checkout never confirms payment. Duplicate events are idempotent at the order transition.
10. The existing service-delivery workflow becomes eligible for assignment after verified payment. The client can view messages, approved files, progress, revisions and final delivery.

## Protected scope

- Main branch unmodified.
- Existing non-academic service routes retained.
- Existing academic-order routes retained for compatibility (not used for new student commerce checkout).
- No System Fabric, EGN-046, EGN-047 or EGN-048 requirement added.
- Existing database and credentials untouched.

## Merchant configuration

Set only on the production/test host, not in Git:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `PUBLIC_APP_URL` (HTTPS in production)

Register webhook endpoint: `/api/student-payments/stripe-webhook`.
Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` and `checkout.session.expired`.
Enable only permitted payment methods, account country and currency in Stripe dashboard.

## Automated verification

```sh
npm ci
npm run verify:student-support
npm run check
```

The student-support test exercises product eligibility, accepted-quote amount validation, cross-customer quote rejection, invalid amount/currency and raw Stripe signature integrity. It does NOT certify live Stripe, database, browser or refunds.

## Mandatory acceptance gates before selling

- [ ] Production database, session, storage, permissions and deployment qualify in a real browser.
- [ ] End-to-end signup/login and request submission, including failed input and recovery.
- [ ] Actual intake supporting-file upload, byte integrity and role-based download tested through existing workspace.
- [ ] Real admin quote, expired quote, revised quote, acceptance and correct paid transition verified.
- [ ] Stripe test-mode Checkout, signed events, delayed payments, retries, concurrent clicks, duplicate callbacks and refund/chargeback workflows verified.
- [ ] Customer cannot pay the wrong order, alter price, access another customer's files, or forge payment confirmation.
- [ ] Paid order cannot be deleted casually; finance records and receipts must be retained under applicable rules.
- [ ] Delivery, client acceptance, genuine revisions and dispute handling qualify end-to-end.
- [ ] Email delivery and support response path qualify; no demo claims or fake testimonials.
- [ ] Commercial policies, privacy, academic-integrity service terms, consumer rights, tax/invoice, business registration and merchant payout are reviewed.
- [ ] Approved merchant account and bank payout identity configured by business owner.
- [ ] Authorized low-value live payment, receipt and bank reconciliation checked before public launch.

## Known limitations and risks

- Published database configuration may differ from changed code defaults; inspect the live catalogue before release.
- The older `/client/order` academic order path remains separate and has no payment integration in this candidate.
- The older finance dashboard includes tracked values and must not be interpreted as payment revenue.
- No external email-provider integration or merchant credentials are supplied.
- Human review remains required for academic support quality; no automated assignment/thesis ghostwriting.
- Existing sequential request IDs are not concurrency-safe; qualify/repair before high-volume launch.
- No refund automation or chargeback synchronization is delivered in this candidate.
- Source inspection and unit tests do not replace database-backed, real-browser, or actual-provider acceptance.

## Commercial acceptance rule

Do not mark launch-ready until a real student account can place a real support request, accept a valid quote, pay via an approved provider, obtain verified payment confirmation, receive agreed legitimate support and review the resulting financial record — all without bypassing any real interface.
