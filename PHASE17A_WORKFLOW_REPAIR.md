# Phase 17A Workflow Repair

This repair addresses the manual end-to-end findings after Phase 17A.3/A.4.

## Fixed

- Super Admin can assign an active, approved provider directly from `New Request`.
- Provider identity and display name are validated and derived by the server.
- Assigning a provider moves the request to `Assigned`.
- Removing a provider moves the request to `Awaiting Assignment`.
- Service Operations refreshes after successful updates and clears stale errors.
- Action Center labels administrative ownership separately from provider assignment.
- A regression verifier checks assignment behavior and immutable intake snapshots.

## Windows CMD verification

```cmd
cd /d "C:\Users\pea\Downloads\ips-mvp-react-phase17a-workflow-repair\ips-mvp-react-git"
npm install
npm run check
```

Start the backend:

```cmd
node server.js
```

Start the frontend in a second CMD window:

```cmd
cd /d "C:\Users\pea\Downloads\ips-mvp-react-phase17a-workflow-repair\ips-mvp-react-git"
npm run dev
```

## Manual assignment test

1. Sign in as Super Admin in a normal browser window.
2. Sign in as a client in an incognito window and submit a service request.
3. Open Admin > Service Operations.
4. Select an active, approved provider while the request is `New Request`.
5. Confirm the row changes to `Assigned` and displays the selected provider.
6. Open Action Center and confirm the assignment action is no longer active.
7. If an Action Center item has an administrative owner, confirm the control says `Admin owner`, not `Assigned`.
8. Remove the provider and confirm the request changes to `Awaiting Assignment`.

## Snapshot test

1. Submit a dynamic request with recognizable answers.
2. Open the request in the admin portal and record the original question labels and answers.
3. Edit and republish the live service questions.
4. Reopen the old request and confirm its original snapshot remains unchanged.
5. Start a new request and confirm it uses the newly published service definition.
