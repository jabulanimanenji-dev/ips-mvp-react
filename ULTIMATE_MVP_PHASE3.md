# Ultimate MVP — Phase 3

## Credential security

- New client, provider, and database-admin passwords use salted scrypt hashes.
- Existing legacy plaintext passwords remain usable once.
- A successful legacy login immediately replaces the old password with a hash.
- Password updates are hashed before storage.

## Sessions and authorization

- Login issues a signed, expiring, HttpOnly, SameSite cookie.
- Logout clears the server session cookie.
- Client/order/provider/admin lists are role restricted.
- Clients can access only their own orders and services.
- Providers can access only assigned orders and services.
- Destructive operations require admin access.
- Workspace files, messages, decisions, expenses, and downloads verify ownership.

## Workflow governance

- Academic and service status transitions follow explicit allowed paths.
- Providers cannot mark their own work finally completed.
- Marketplace work must reach Ready for Client before client completion approval.
- Academic work must be delivered before client completion approval.

## Quote governance

- Every marketplace quote revision creates an immutable version.
- Previous versions remain visible and are marked superseded.
- Quotes record issuer, notes, amount, currency, expiry, and version.
- Expired quotes cannot be accepted.
- Acceptance records the client and timestamp.

All users must log out and sign in again after installing this phase.
