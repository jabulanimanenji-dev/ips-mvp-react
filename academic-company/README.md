# IPS ACADEMIC SERVICES — FRESH CONSTRUCTION BASELINE
This branch constructs **IPS Academic Services**, not a generic project services company.
Its governing constitution is `GOVERNANCE/IPS_ACADEMIC_SERVICES_COMPANY_CONSTITUTION_V1.md` from the owner-approved requirements consolidation.
The academic company application lives in `academic-company/`. Until specific production acceptance, this branch is isolated and must not replace the public website.
**Never import, re-skin, or copy the rejected International Project Services preview.**
Academic service taxonomy, private student identity, approved specialists, Nyoro root, departmental authorities, written quote routing, academic QA and secure delivery are mandatory.

## Academic document security gate

All newly uploaded PDF, DOCX and TXT documents (Student enquiries and case files, Specialist submissions, Root-only supplier records, and direct company attachments) pass the same scan gate before storage. Configure the ClamAV daemon through `IPS_CLAMAV_HOST` (private-network hostname) and `IPS_CLAMAV_PORT` (default 3310). The application sends file bytes using the official ClamAV `zINSTREAM` protocol; ClamAV's `StreamMaxLength` must exceed the permitted 20 MiB academic attachment size. Keep scanner communications on a trusted private network and update antivirus signatures regularly. An absent, timed-out, or inconclusive scanner results in HTTP 503, and a positive detection results in HTTP 422; neither file is saved. Unscreened existing documents cannot be newly approved for QA release in production.

The disposable review environment deliberately operates without a real scanner and marks its file metadata `synthetic_not_scanned`. The protocol regression tests use a **synthetic ClamAV-compatible test double**, not genuine antivirus coverage. Production readiness requires a running current ClamAV engine, real clean/infected test receipts, documented operations and recovery, and independent acceptance before cutover.

This change does **not** enable payments or promote the isolated evaluation service to production.
