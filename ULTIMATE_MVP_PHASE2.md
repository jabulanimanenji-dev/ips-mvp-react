# Ultimate MVP — Phase 2

Phase 2 extends the shared workspace across academic orders, professional services, and odd jobs.

## Shared workspace

- Requirements and reference uploads
- Before, progress, and completion evidence
- Receipts and expense evidence
- Drafts, revisions, final deliveries, signed approvals, and incident reports
- Admin file review, release, visibility, and archive controls
- Quote changes, clarifications, revisions, cancellations, and disputes
- Job messages and announcements
- Expense submission, admin review, reasons, and client visibility
- Audit history for administrators

## Direct-contact control

- Client-provider messaging is disabled by default on every job
- Only an authenticated administrator can enable or disable it
- The policy is stored separately on each academic order or marketplace request
- The backend rejects direct messages while contact is disabled
- Clients and providers always retain their separate admin channels

## Session protection

- Successful logins issue signed, expiring session tokens
- Workspace, message, file, expense, decision, and contact-policy operations verify the session
- Job ownership and assignment are checked before workspace access
- File downloads verify both identity and job access

After installing this phase, every existing user must log out and sign in again to receive a signed session.
