# IPS Phase 14 — Service Provider Self-Registration

Implemented:
- Public route: `/become-a-provider`
- Public provider application form
- `POST /api/provider/register`
- Pending/approved/rejected/more-information workflow
- Expanded Writer model for provider profile/application data
- Admin review controls under Mission Control > Service Providers
- Approval activates the provider account
- Pending/rejected/more-information providers cannot sign in
- Existing/admin-created providers remain approved and active
- Provider-login page links to the application form

Local test flow:
1. Run `npm install`.
2. Run `npm run dev`.
3. Open `/become-a-provider` and submit an application.
4. Confirm the new record appears under Admin > Service Providers > Pending.
5. Attempt provider login and confirm it is blocked while pending.
6. Approve the application in Admin.
7. Sign in through `/writer/login` and confirm dashboard access.

Validation note:
- `node --check server.js` passed.
- The Vite build could not be run in the assistant container because its internal npm registry was missing the `yallist@3.1.1` package. Run the normal build locally with `npm install` and `npm run build`.
