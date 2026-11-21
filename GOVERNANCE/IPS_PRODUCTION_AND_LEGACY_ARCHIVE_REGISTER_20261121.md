# IPS Academic Services — production priority, historical preservation and release register

Evidence date: 2026-11-21. This is a source-bound infrastructure ledger, not authority to delete customer records or activate an unverified company. This register branch is NOT attached to any live Render service.

## Owner intent
IPS Academic Services is the primary company. The target Render workspace display name is "IPS Academic Services"; target environments are Production and Staging, with separate secrets, durable storage and application identities. The user has authorized archiving superseded IPS services and preserving past client obligations. Never move, overwrite or delete an unrelated project.

## Verified Render workspace
Workspace ID: tea-d9bsjmojs32c73esokb0; current display name: "My Workspace".
The connected Render interface supports reading services and creating new ones but not renaming workspaces, changing service configurations, suspending or deleting existing services.

| ID | Service | Deployed source | Status / disposition |
|---|---|---|---|
| srv-d9bso3hkh4rs73bl22e0 | ips-mvp-react | main @ 2179c061c368097d061a65137af777f65366a589 | Legacy live / **do not stop before accepted new production cutover** |
| srv-dc0qs16c6qcc73f6ieug | ips-academic-services-review-20261121 | company/ips-academic-services-2026 @ 588de009bb177de8a62c0d6193c774b0926ca72f | Latest academic REVIEW; evaluation Docker bundles disposable DB, **not production** |
| srv-dc0ps56c6qcc73f3mhbg | ips-new-company-review-20261121 | company/ips-new-standalone-20261121 @ 420f751e3c6585c0232837c29dac0aaacba944ef | Withdrawn review/HTTP 410, retire after review |
| srv-dbvjk760tbcc738n9li0 | ips-academic-evaluation-20261119 | audit/central-ips-privacy-queue-20261119 @ d86697b567b32a78e9d0b3c2504399d6762bc4dd | Superseded evaluation, retire after review |
| srv-d9kav3pt0dsc739b6e30 | ips-mvp-react-phase12-preview | phase-11-visual-builder-2-admin-hierarchy @ 5cb897705dccd8c480327eed9a78d35dfe923023 | Superseded preview/redirect, retire after review |

Three old revision references created:
- archive/ips-withdrawn-new-company-preview-20261121
- archive/ips-legacy-phase12-preview-20261121
- archive/ips-legacy-evaluation-20261119

Pre-existing protected reference archive/ips-production-before-company-replacement-20261121 exactly preserves live deployment 2179c061c368097d061a65137af777f65366a589. Historical sources are archived with Git object reuse; do not create publicly accessible ZIPs of private MongoDB contents.

## Verified MongoDB state
Atlas project 6a5800b52d2de3b806c0b679 ("Project 0"), single Free M0 cluster "ips-cluster", MongoDB 8.0, AWS US_EAST_1. Legacy database `ips` has 157 collections, containing real client, specialist, staff, messages, invoices and service obligations. New database `ips_academic_services_2026` currently contains release-control metadata only with `environment=evaluation`, `legacyDataMigrated=false`, `productionActivated=false`. Never relabel these without evidence.

Preserve original database until a separately stored, encrypted source-bound backup has passed independent restoration and a migration manifest reconciles every legal obligation. A Git branch is not a database backup. Do not move raw credentials, client documents or legacy hash material into Git. Archive old MongoDB to secured out-of-cluster object storage with least-privilege access, retention policy, checksums and restore instructions, then migrate safely and consider removal only after acceptance and retention review.

## Accepted academic source
Authoritative qualified academic branch `company/ips-academic-services-2026` at `588de009bb177de8a62c0d6193c774b0926ca72f`. Previously qualified: two-way account-linked Telegram inbox, signed Resend delivery webhooks, truthful Finance preparations, paged company worklists, durable abuse rate limiting, production-only image, fail-closed source-matched release admission, protected external-provider staging. These have been verified in **isolated CI**, not in live production.

Unqualified additional branch `work/ips-academic-governed-people-20261121` contains draft people-management changes. Do not merge without complete current-commit GitHub and browser qualification.


## November 21 post-qualification implementation and live data reconciliation

Authoritative academic application advanced by exact-head fast-forward from 588de009bb177de8a62c0d6193c774b0926ca72f to **678b42224ed38f771b861bc985f212ab32c07703**. MongoDB lifecycle, Chrome journeys, review image, independent backup/restore and production-image admission checks passed in GitHub Actions run **44959332435**. Render academic review service srv-dc0qs16c6qcc73f6ieug automatically deployed matching commit (deployment dep-dc124fflk1mc7380sjbg, status live). The runtime logs remain explicit that this is a **fictional isolated evaluation**, not a real company production deployment. This implementation includes management sessions, staff offboarding/reassignment, documented Specialist review and real browser management screens.

Read-only MongoDB Atlas grouped inventory on legacy `ips` (no customer values exported):

| Historical collection | Verified state counts | Mandatory disposition |
|---|---|---|
| orders | 4 New | Investigate each order, ownership and customer expectation before moving/retiring |
| servicerequests | 1 In Progress; 1 Assigned; 1 New Request | Preserve assignment, scope, history and fulfilment status |
| invoices | 2 SENT, payment_status=PENDING_VERIFICATION | **Do not** mark paid, create receipts or discard financial evidence |
| supporttickets | 1 Open | Carry forward with written history and ownership |
| clients | 148 Active | Protect privacy; reconcile authentication without importing legacy passwords |
| writers | 39 application_status=approved; 1 more_information | Revalidate professional verification and non-disclosure agreements before authorizing new specialist work |
| admins | 34 Active, 1 Suspended | Do not import legacy roles/permissions as trusted; establish Root and new scoped management explicitly |
| channelmessages | 3 inbound received, 1 outbound sent | A recorded 'sent' status is not a demonstrated delivered Telegram receipt; preserve conversation provenance |
| platformfiles | 1 released with visibility=admin_writer | Preserve private file bytes, evidence and original visibility until audited migration |

Legacy field names differ from the new academic schema (old `clients/client_id`, `writers/writer_id`, `orders/order_id`, `servicerequests/request_id`, `invoices/invoice_id`, `channelmessages/contact_id`, `platformfiles/order_id`). The legacy client, account, writer and admin documents all contain historical credential fields; **never export them to Git or copy them to new identities**. Build an explicit source-to-destination mapping and one-time verification before migration. The combined state is **not yet production reconciled**. No archive delete/unmount is authorized until verified escrow backup, independent restore and obligation-by-obligation reconciliation.

## Required non-payment go-live gate
1. Single release source and protected deployment with independent hosting configuration, monitoring, meaningful health checks and costs.
2. Dedicated backed-up production MongoDB and verified byte-level private file storage, properly isolated from legacy and staging.
3. Read-only audit, selective legacy mapping, idempotent migration, legal record retention and account verification before admission.
4. Real Resend verification/recovery/quotations and signed delivered/bounced/failed event proof; real inbound email reply handling.
5. Verified Telegram bot handoff from old webhook only at cutover, full two-way receipt with historical thread permissions and backout.
6. Actual maintained ClamAV or equivalent scanner; all upload routes fail closed and real malicious/clean fixture tests.
7. Real authenticated Student, Specialist, Nyoro Root, scoped Manager/Staff journeys: enquiry, quotation, assignment, permitted assistance, file work, QA, revision, handover, support, closure.
8. Fully qualified people management, departmental operations, time tracking, Finance decisions, outsourcing controls, automated escalation/retries and responsible ownership.
9. Security, privacy/retention, integrity controls, vulnerability review, rate controls, incident response and genuine authorization-negative tests.
10. Independent production-equivalent database+GridFS/object-blob archive/restore drill, source checksum and rollback runbook.
11. Final premium UI, realistic/licensed images, Edge/Chrome/mobile, accessibility, back navigation and human owner review.
12. Locked final domain/HTTPS/Cloudflare transition, monitoring verification and source-bound documented owner acceptance.

Payments are intentionally disabled and must remain the only absent item **after**, not before, the above evidence is accepted.

## Required manual/account actions (current connector limitation)
A. In Render dashboard, rename "My Workspace" to "IPS Academic Services" and organize protected Production/Staging project environments; this connector has no rename action.
B. Verify no custom domains, clients, webhooks or secret dependencies on the three superseded preview services; then suspend and remove their running Render resources only after archive/capture review. Do not suspend the current review or legacy live service yet.
C. Configure paid production hosting/availability and production-ready Atlas backups/isolated cluster in the owner's billing/account settings. Avoid unapproved charges.
D. Independently own/approve licensed service photos, public legal policy, data retention, professional verification, external provider access and final company release.
E. Witness an authentic provider email inbox receipt and distinct Telegram test-bot message; approve eventual BotFather webhook handoff and domain DNS only after qualified proof.

## Non-negotiable operations
Do not delete the legacy source or any old real client records merely to reclaim storage. Do not equate a Free/Starter plan with an always-on production guarantee without verification. Do not silently copy unhashed passwords or private details from historic schemas into new accounts. Do not activate the production release-control flag before all gates. All source builds require exact commit, CI, signed service identity, transaction evidence and owner acceptance.
