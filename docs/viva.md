# Viva Preparation — Blockchain-Based Academic Certificate Verification

**Team:** Manoj Vardhan T N (20241CSE0488), S Neeraj Reddy (20241CSE0485), V Uday Kumar Reddy (20241CSE0492), S Jagadeeshwara Reddy (20241CSE0491) — Presidency University, Bengaluru. Guide: Ms. Rekha Vadivel. Academic Year 2026–2027.

## Core concepts

**1. What is blockchain?** A distributed, append-only ledger where records are grouped into blocks linked by cryptographic hashes. Once finalized, historical records cannot be changed without detection.

**2. Why blockchain for certificates?** Academic fraud (fake degrees) is common. A blockchain gives employers an independent, tamper-evident way to verify a certificate without trusting the university's database alone.

**3. What is a consensus mechanism?** The rules by which distributed nodes agree on the next valid state of the ledger.

**4. What is Proof of Authority (PoA)?** A consensus where only pre-approved, identified validators may propose and validate blocks. Identity and reputation replace computational work.

**5. Why PoA over PoW/PoS?** PoW wastes energy and is slow; PoS needs token economics. PoA is efficient, predictable, and suits a permissioned network of trusted universities.

**6. How do validators work?** Three independent Node.js processes each hold an Ed25519 key, a local chain, and a vote lock. They propose (round-robin), verify, and sign votes.

**7. What is a cryptographic hash?** A deterministic one-way function producing a fixed-size digest; any input change changes the output unpredictably.

**8. What is SHA-256?** The Secure Hash Algorithm producing a 256-bit digest, used here for certificate data and block hashes.

**9. What is a digital signature?** A cryptographic proof that a message was signed by the holder of a private key, verifiable by anyone with the public key.

**10. How are certificates verified?** Recompute the certificate hash, compare to the on-chain commitment, verify the university signature, check revocation status, and confirm two validators agree on the chain.

**11. What if a validator goes offline?** With three validators and a 2-of-3 quorum, one offline node still allows progress; two offline stops finalization rather than reporting false success.

**12. What if a certificate is modified?** Its hash no longer matches the on-chain commitment, so verification returns "Data mismatch."

**13. Can blockchain data be deleted?** No — the ledger is append-only; revocation adds a new transaction rather than deleting the original.

**14. How are revoked certificates handled?** A REVOKE transaction referencing the original certificate ID and reason is finalized; verification then returns "Revoked."

**15. Why a database alongside blockchain?** The database holds mutable application metadata (users, students, search indexes); the blockchain holds immutable commitments. The DB is not the source of truth for authenticity.

**16. Limitations of this implementation?** Educational crash-fault protocol (not Byzantine fault tolerant), no view changes, trusted local networking, JSON file storage, no automated sync, in-memory sessions.

## Architecture and implementation

**17. Block structure?** height, previousHash, timestamp, transactions, commitment (Merkle-less deterministic hash of tx list), proposer, round, hash, proposerSignature, votes.

**18. How is the proposer chosen?** Round-robin: validator index = (height-1) mod 3.

**19. Finality rule?** At least two distinct validators must sign a valid vote; the finalization certificate is stored in the block.

**20. How are duplicate certificates prevented?** Consensus validation rejects an ISSUE transaction whose certificateId already appears in the chain.

**21. How is revocation validated?** The revocation must reference an existing issuance by the same university with the same data hash, include a reason, and not duplicate a prior revocation.

**22. What does the API do?** Express REST layer: auth, certificate CRUD, verification, PDF/QR generation, admin endpoints, SSE.

**23. How is authentication handled?** bcrypt password hashing, random session tokens in memory, role-based middleware.

**24. What is Zod used for?** Request body validation with clear error messages.

**25. How is the PDF generated?** PDFKit creates a landscape certificate with university name, student, course, details, certificate ID, and an embedded QR code linking to the verification page.

**26. How does QR verification work?** The QR encodes the public verification URL with the certificate ID; scanning opens the verify page.

**27. How does PDF upload verification work?** SHA-256 of the entire uploaded bytes is compared to the finalized documentHash commitment; any change fails.

**28. What is the frontend stack?** React + Vite, single-page app with role-based views.

**29. How is state refreshed?** Polling every 15 seconds plus manual refresh; SSE endpoint available for push.

**30. What testing exists?** 7 consensus unit tests + 1 end-to-end integration test (issue → verify → revoke).

## Security

**31. Where are private keys stored?** Local files in data/ (gitignored), never sent to the browser.

**32. Is transport secure?** No — local HTTP only; production would require TLS and authenticated validator channels.

**33. Rate limiting?** express-rate-limit on /api.

**34. Input validation?** Zod schemas on all mutation endpoints.

**35. Audit logging?** Basic; full audit log table is future work.

## Project management

**36. Monorepo layout?** apps/{web,api,validator}, packages/core, scripts, tests, docs.

**37. How to run?** npm install && npm run setup && npm run dev.

**38. How to test?** npm test.

**39. Deployment?** Frontend on Vercel possible; validators need long-running hosts (Docker Compose provided).

**40. Future enhancements?** Prisma/SQLite, Byzantine fault tolerance, automated sync, university onboarding workflow, mobile app, certificate templates, batch issuance.

## Honest limitations to state in viva

- Not Byzantine fault tolerant; a malicious validator can equivocate.
- No view changes or timeouts; a missing proposer stalls progress.
- JSON files are not transactional; sessions are in-memory.
- Verification depends on the local application metadata and fixed configuration.
- Educational prototype only; not for real credentials.