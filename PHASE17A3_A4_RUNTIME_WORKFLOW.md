# Phase 17A.3 + 17A.4 — Runtime and Workflow Integration

## Phase 17A.3

Published Service Engine definitions now execute on the public service marketplace. The runtime provides service selection, ordered multi-step forms, conditional visibility, all existing question types, client- and server-side required-field checks, type-specific validation, and a stable request snapshot containing the service revision, question schema and submitted answers.

Two public runtime endpoints were added:

- `GET /api/service-catalog/:slug/runtime`
- `POST /api/service-catalog/:slug/requests`

Only published categories and services with an effective `acceptingRequests` switch can execute. Server validation remains authoritative.

## Phase 17A.4

Dynamic submissions enter the existing governed `ServiceRequest` workflow rather than creating a parallel order system. They receive the normal request ID, client identity, audit history and administrator notification. Existing admin quote, assignment, provider progress, messaging, expense and decision workflows continue to operate on the created request.

Each dynamic request records:

- service definition ID, slug and revision
- normalized intake answers
- immutable intake snapshot
- `service_engine` source marker

Legacy `/api/services` submissions and academic `/api/orders` remain compatible.

## Automated checks

```bat
npm run verify:phase17a34
npm run check
```

## Manual acceptance

1. Publish a category and service in Platform Studio and enable accepting requests.
2. Add at least two steps and a conditional required question.
3. Open `/services`, select the published service and verify the generated steps and questions.
4. Confirm the conditional question appears only when its dependency matches.
5. Submit while signed out and confirm login is required.
6. Submit while signed in and confirm the request appears in Client Services and Admin Service Operations.
7. Open the request as admin and confirm the intake snapshot and normal quote/assignment workflow remain available.
8. Pause the service or disable accepting requests and confirm new runtime submissions are rejected.
