# International Project Services — Company Operating System

This branch is a **new source tree**, not a renamed historical IPS build. Only the fresh company runtime, isolated evaluation tools, and pinned dependency manifest are retained.

## Company authority
- Root Admin **Nyoro** is environment-controlled, is never an employee record, has no manager, and cannot be suspended by company staff.
- Root creates department managers. Department managers invite their own staff. No staff member creates a Root or manager.
- Client identities use a private username, not a compulsory full name. Professional specialists provide their professional name and require verified-mail and company approval.
- All human contact is written. Staff cannot see, set, or reset anyone else's password; they send one-use, verified-mail recovery links.
- Confidential documents and communications require signed sessions and project authority.
- Project work progresses through quote, explicit acceptance, verified payment gate, specialist assignment, submission, QA, revisions, final client acceptance, and auditable notifications.
- **No actual payment processing is enabled.** Only deliberately isolated CI can simulate payment. Fake paid records are labeled in the disposable review service.

## Production boundary
New MongoDB database: `ips_company_2026`. Historic `ips` / `ips_database` collections must not be imported, reactivated, deleted or treated as new authenticated accounts without a verified migration and rollback.

Review container: `Dockerfile.ips-company-cleanroom` and `scripts/ips-company-sandbox-entrypoint.sh`. It boots its own localhost MongoDB and refuses production email/payment/messenger credentials. All review accounts are fictional and the database may reset.

Historical production source is separately archived at branch `archive/ips-production-before-company-replacement-20261121`, commit `2179c061c368097d061a65137af777f65366a589`.

## Test gates
`company-next/scripts/verify-company.mjs` runs 14 authenticated journeys against real, disposable MongoDB. `verify-browser.mjs` covers eight Chrome desktop/mobile journeys. `verify-image-review.mjs` qualifies five separate authenticated identities in the exact Docker review image.

## Publication conditions
1. Isolated CI and Docker review qualification green.
2. New company actually hosted, its interface manually reviewed by the owner.
3. Production database role/credential access, backup and restoration confirmed independently.
4. Verified real email deliverability; outbound Telegram receipt separately confirmed by owner.
5. No payment claims or live financial amounts before payment integration.
6. Controlled migration and rollback from old production only after the above gates; no destructive deletion of historical customer data without retention review and verified backups.

Current status: **independent evaluation candidate; not publication-approved**.
