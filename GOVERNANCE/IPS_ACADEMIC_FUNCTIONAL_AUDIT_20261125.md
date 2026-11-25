# IPS Academic Services — source-bound company audit (25 November 2026)

**Authority:** Owner instructions consolidated in `GOVERNANCE/IPS_ACADEMIC_SERVICES_COMPANY_CONSTITUTION_V1.md` and the 409-case `IPS_COMPANY_SCENARIO_ACCEPTANCE_V1.csv`.  
**Inspected application:** `company/ips-academic-services-2026` baseline `d4205c250912c0d267cc50fb888d7604d61956bf`.  
**Purpose:** Engineering acceptance assessment, not a production release certificate. No historical client data or public website migration is authorized by this report.

## Verified boundaries

- Source inventory: 129 literal HTTP routes in 11 route modules; 49 named frontend forms and 59 ordinary action labels have corresponding recognized frontend dispatch patterns. This is **static wiring inspection**, not an assertion that every interaction succeeds.
- Automated checks present: 63 real-MongoDB lifecycle assertions and 38 Chrome browser journeys, plus an independent native Edge run and live five-workspace Render browser acceptance on source `d4205c2`. The final three jobs all passed on 23 November 2026. They are not proofs of real provider delivery.
- Hosted synthetic review: `https://ips-academic-services-review-20261121.onrender.com` at Render deployment `d4205c2`. Dedicated free Atlas cluster `ips-academic-review-free`, database `ips_academic_sandbox`. Read-only 25 November check: four active fictional regular identities (Student, Specialist, Client Relations Manager, Client Relations Staff), four quotations (2 accepted, 1 offered, 1 received), two commissions (1 completed, 1 active), four synthetic-dispatched email queue records. Root is an independent protected principal, not a normal account.
- **Production is not active:** separate new Atlas `ips_academic_services_2026` holds one control row with `productionActivated=false`, `legacyDataMigrated=false`, `ownerAccepted=false` and email/Telegram/malware verification false. The live public `main` branch is distinct from academic source. No production cutover permitted.
- The governing scenario register still marks **387 non-payment scenarios NOT_INDIVIDUALLY_ADMITTED** and **22 PAYMENT_DEFERRED**. Aggregate green checks cannot automatically change those statuses.

## Domain-by-domain audit of all requested functionality

| Domain (scenario count) | Existing code / evidence | Acceptance boundary |
|---|---|---|
| Visitor & public contact (16) | Academic homepage, 16 service areas, guest intake, verification, support/privacy contact; Chrome journeys | Real public email delivery and all 16 negatives not individually admitted; duplicate submissions require extra proof |
| Student / Researcher account (20) | Private username without legal name, verified email gate, strong password, one-use recovery, settings, privacy cases; Mongo/Chrome | Real mailbox witness, historic retention, compromised-account exercises not admitted |
| Academic intake & integrity (20) | Service, discipline, requirements, guidance, academic-integrity guard, CL ownership and escalation; tests | **Found:** past/impossible deadlines accepted by base source; targeted repair and negative regression in this review; all hard service/exception decisions not individually admitted |
| Quotations & decisions (17) | Scoped human prices, revisions, expiry/reminders, student accept/decline, verified guest private view/change/decline/resend; Mongo/Chrome | Real customer mail delivery and complete provider exception matrix not admitted |
| Prepayment commission gate (12) | Accepted offers create truthful `awaiting_payment_integration` and non-payable billing records; fictional isolated settlement only | No real paid commissioning or real-world fulfilled orders until payments and release acceptance |
| Specialist recruitment (20) | Name, qualifications, signed versioned agreement, email ownership, credential-review decision, availability and suspensions | External credential truth and all exceptional cases require independent witnesses |
| Specialist allocation (20) | Qualified availability/capacity, explicit fee/offer acceptance, Root override/withdrawal, concurrent reservations tested | Paid-job proof is synthetic; genuine capacity and leave procedures unadmitted |
| Academic job execution (24) | Scoped workroom, attachments, messages, milestones, real file bytes/GridFS in sandbox, Root takeover/private supplier protocol | Live malware screening, third-party supplier witness, outages and exceptions unadmitted |
| Quality assurance (16) | Separate QA status, correction/revision loops, approval gates and no early student release; Mongo/Chrome | Professional judgment, real antivirus and contested QA need owner/provider evidence |
| Delivery & aftercare (18) | Authenticated document retrieval, client decision, included revision and case closure tested | Historic restorations/complaints/long-term retention not individually admitted |
| Written communications (25) | Workspace/direct messages, queued generic Resend/Telegram notifications, signed webhook handlers, retries, exceptions and Telegram inbox code | Review has **no live provider credentials**, no real messages sent. Real bidirectional Telegram/Resend and receipts not verified |
| Support & complaints (18) | Cases, owner/department queues, claim, reply, resolve, reopen, escalations tested | High-stakes disputes, historic complaints and recovery need real operational witness |
| Seven departments (7) | Client Relations, Academic Delivery, Specialist Network, Communications, QA, Finance, Governance authority checks in source | Hosted one-click role review exposes only **Client Relations** Manager/Staff accounts; no seven-department interactive owner acceptance yet |
| Managers & employees (20) | Root invites Managers, Managers create scoped Staff; assignment, history, offboarding/session revocation tested | Absence, leave, cross-department operational handoff and multiple managers need scenario-specific review |
| Nyoro Root Admin (26) | Protected independent Root, full admin, people directories, support/cases, real Student/Specialist lenses, direct files/messages and Root takeover tested | Root cannot forge consent/customer acceptance; correct safety control. Emergency/manual/private supplier procedures need owner witness |
| Finance & contracts (18) | Non-payable billing, Specialist fee consent, work logs, review and disputes; revenue zero | Real legal invoices, taxes, payouts, settlements, refunds not implemented/accepted before payment integration |
| Security & privacy (24) | Authenticated scoped API checks, session revocation, HMAC, signed webhook tests, file screening gate, read-only audit | Live ClamAV absent, no live penetration test, incident/retention procedures incomplete |
| Hosting & continuity (24) | Isolated Render/Atlas deployment and CI encrypted backup/restore drill on fictional data | Live paid backup, offsite store/cron, restore of customer data, disaster recovery and real production release are **not verified** |
| Long-term company operation (26) | Some staffing, service and queues source foundations | Scaling, legal market review, data disposal, enterprise governance and closure are not individually tested |
| Academic service types (16) | Full public service catalogue; workflow shares reusable scoped intake | Individual discipline-specific accuracy and lawful service delivery not owner-admitted |
| Future real payments (22) | Deliberately disabled; simulated payment labelled synthetic in isolated tests | `PAYMENT_DEFERRED` for every payment, chargeback, payout and reconciliation case |

## Repair admission

**Q08 / past academic deadline:** `validateBrief()` accepted arbitrary deadline strings, including dates in the past or impossible dates. This violates the documented intake requirement. Repair must check real ISO calendar dates and reject earlier-than-today dates on both guest and Student intake before inserting cases, add date-picker minimum, and use positive/negative Mongo and Chrome checks. Do not mark the repair accepted before exact-head CI.

## Honest owner review

Owner should only need to open the hosted **fictional** review and inspect normal Student, Specialist, Manager, Staff and Nyoro workrooms for professional quality and usability. No ZIP, local database or tour is required. This review is not a place to prove live email verification, Telegram, malware detection, customer payments or 7-department staffing; those require separate genuine-provider/role evidence.

## Production blockers (not payment-only)

1. Real Resend sender, one-use verification/recovery, inbound/outbound disposition and hard-bounce/complaint witness.
2. Real independent Telegram private bot, webhook signature, inbound conversation visibility, outbound notice and connection/revocation witnesses (never reuse legacy token without rotation and cutover plan).
3. Real private ClamAV file scanning and denial during outage, plus secure object/file persistence under production load.
4. Independent actual backup and restore to different cluster with files, verified offsite store and tested disaster recovery.
5. Explicit reconcile/retain historical IPS obligations, no blind legacy migration or data loss.
6. Production security and privacy/retention acceptance, complete manager/team and customer workflows on genuine provider staging, Root acceptance of visual interface.
7. Final source-bound production release authorization by owner, appropriate paid infrastructure where necessary. Payments themselves remain future phase.

**Evidence standard:** One immutable source SHA, exact completed job and environment, actual allowed/forbidden role behavior, screenshot/database/file hash if relevant, provider receipt where genuinely required, and owner judgment. No claim that 409 separate cases are green.
