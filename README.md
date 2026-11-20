# Verity — Academic Certificate Blockchain

An **incomplete educational prototype** for issuing and publicly verifying academic credentials using a custom permissioned Proof of Authority ledger. All sample institutions and accounts are fictional. Do not use with real student data or deploy publicly.

## Run locally

Requires Node.js 20 or later and npm. In the project directory:

```sh
npm install
npm run setup
npm run dev
```

Open the Vite URL displayed in the terminal (normally http://localhost:5173). Setup generates private keys and local data in the ignored `data/` directory. Demo university logins are `admin1@example.test`, `admin2@example.test`, and `admin3@example.test`, with password `DemoPass123!` unless `DEMO_PASSWORD` is set. Set `DEMO_PASSWORD` before first setup to choose another. Setup deliberately does not overwrite existing data.

Sign in, issue a certificate, copy its ID from the confirmation or dashboard, and verify it publicly. Revoke it from the university dashboard, then verify again. The explorer shows the actual finalized block and signed votes. All three validator processes must be started by `npm run dev`; stopping the scheduled proposer stops progress. Certificates are not considered verified without agreement from two independently validated ledgers.

```sh
npm test
npm run build
```

## Important limitations

See [architecture and consensus specification](docs/architecture.md). This is a partial implementation, **not the complete system requested**. It uses JavaScript and JSON files, not TypeScript, Prisma or SQLite. It lacks PDF/QR creation and upload verification, students and super administrators, university onboarding, templates, migration and sample certificate seeding, real-time events, automatic validator recovery/synchronization, network authentication, Docker, comprehensive frontend/E2E tests, academic report, slides and viva preparation. JSON metadata is not transactionally durable; a failed issuance can leave an unconfirmed local record. Sessions are in memory and reset on API restart. Vote locks can block progress after interrupted consensus. The educational 2-of-3 vote scheme is **not Byzantine fault tolerant**. It has no view changes and assumes honest authorities and trusted local infrastructure. Its verification is not independent of the local application metadata and fixed configuration.

Do not publish `data/`, private keys, or demo credentials. Local HTTP endpoints are unauthenticated between validators; bind and protect services appropriately in any future redesign. The dependency audit may report vulnerabilities; review `npm audit` before any deployment.
