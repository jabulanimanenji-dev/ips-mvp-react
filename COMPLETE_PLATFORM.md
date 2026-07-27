# IPS Complete Platform

This branch consolidates the Client, Writer, and Admin workflow around MongoDB.

## Included

- Client requirements and reference uploads
- Writer draft and final-delivery uploads
- Admin uploads with role visibility controls
- Admin review, release, and archive controls
- Authorized role-specific download views
- Writer/Admin progress and status updates
- Client revision requests
- Client–Admin and Writer–Admin messaging
- Admin internal notes and audit history
- MongoDB-backed Admin orders, clients, writers, and dashboard
- File version metadata, categories, download counts, and review states
- Notifications data model and API
- 25 MB upload limit and allowlisted file extensions

## Local storage

Development file contents are stored under `uploads/`. The folder is excluded
from Git and the ZIP. File metadata is stored in MongoDB. For production,
replace local file writes with private S3, R2, or equivalent object storage.

## Start

```bat
copy .env.example .env
npm install
npm run dev:server
```

In a second terminal:

```bat
npm run dev
```

Open `http://127.0.0.1:3000`.

## Production security note

This package completes the functional workflow, but the inherited MVP
authentication still requires password hashing, server-issued sessions, and
role middleware before exposure to untrusted public traffic.
