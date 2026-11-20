# Architecture and development plan

This repository is an educational prototype, not a production credential system.

## Boundaries

The browser talks to an Express API. The API maintains application metadata and submits signed transactions to three separate HTTP validator processes. Each validator maintains its own append-only JSON-lines ledger and a persisted vote lock. University and validator Ed25519 keys are generated locally during setup and never sent to the browser. The ledger contains certificate IDs and commitments, not student names.

## Consensus specification

The fixed genesis configuration names three authorities and their public keys. At height h (starting at 1), the designated proposer is authority `(h - 1) mod 3`. A candidate contains height, previous hash, timestamp, transaction list, transaction commitment, proposer and round 0. The proposer signs the candidate hash. Each validator independently checks its chain, height, parent, proposer signature, university signature, university authorization, transaction rules and duplicates. It persists a vote lock before returning a signed vote. Two distinct valid votes finalize a block. Every node validates the finalization certificate before appending. Nodes do not vote twice at a height, including after restart.

**Fault assumptions:** this is a deliberately simple crash-fault teaching protocol, not Byzantine fault tolerant. A 2-of-3 quorum intersects in one validator, so a malicious validator can equivocate and undermine safety. There are no timeouts, view changes, dynamic membership or automated catch-up. An unavailable scheduled proposer blocks progress. A validator missing a finalized block must be recovered manually; the system must not claim confirmation if a majority has not appended. Node endpoints and local keys require trusted networking and storage.

## Data model

Prototype metadata is stored in local JSON files: users (id, role, password hash, universityId), universities (id, name, approval, public key), certificates (id, immutable fields, hash, signature, status), sessions (random token, user, expiry), and verification logs. Validators independently store block and vote evidence. This is not the requested Prisma/SQLite relational schema: migration, transactional consistency, session hardening and durable indexing remain future work.

## API contract

- `POST /api/login` and `POST /api/logout`: session authentication.
- `GET /api/me`: current account.
- `GET /api/network`, `GET /api/blocks`: live validator status and finalized chain.
- `POST /api/certificates`: authenticated university issuance, waits for finality.
- `POST /api/certificates/:id/revoke`: issuing university revocation, waits for finality.
- `GET /api/verify/:id`: independent chain/signature/hash verification.
- `GET /api/certificates`: university-scoped certificates.

## Plan and status

1. Architecture and protocol: initial specification complete.
2. Authentication and certificate backend: basic local prototype.
3. Separate validators and persisted signed votes: initial implementation.
4. Certificate generation, public verification and revocation: partial; PDF, QR and upload are not implemented.
5. Frontend: focused functional interface, not the full requested role/page set.
6. Integration and tests: see README for commands and actual results.
7. Remaining work: Prisma migrations, full role model, approval workflows, robust synchronization, restart integration tests, real-time events, QR/PDF, dashboards, security demonstrations, E2E tests, Docker, complete report and presentation.

Do not use the prototype for real student data. Local HTTP endpoints have no transport security or validator authentication and are suitable only for an isolated development machine.
