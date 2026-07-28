# IPS Service Marketplace

This branch adds one managed marketplace for professional services and odd jobs.

## Included

- Premium responsive public services page
- Professional and odd-job category discovery
- Structured request form with location, delivery mode, deadline, urgency, and budget
- Client Service Hub with request and progress visibility
- Unified client home combining marketplace and academic/writing activity
- Clear Client, Service Provider, and Admin entry choices
- Service Provider workspace for assigned professional and odd-job work
- Admin Service Operations for quoting, assignment, progress, and lifecycle control
- MongoDB service-request model, status history, and audit events
- API filtering by client, provider, and service family
- Light and dark theme compatibility

## Workflow

1. A signed-in client submits a request.
2. Admin reviews the scope and creates a quote.
3. Admin assigns an available provider.
4. Admin/provider updates progress and lifecycle status.
5. The client follows delivery from the Service Hub.

## Local verification

Copy `.env.example` to `.env`, insert the working MongoDB URI, then run:

```bat
npm install
npm run build
npm run dev:server
```

In a second terminal:

```bat
npm run dev
```

Open `http://localhost:3000/services`.

Never commit `.env` or a real database password.
