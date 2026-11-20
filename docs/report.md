# Blockchain-Based Academic Certificate Issuance and Verification System Using Proof of Authority (PoA)

**Project Team:** Manoj Vardhan T N (20241CSE0488), S Neeraj Reddy (20241CSE0485), V Uday Kumar Reddy (20241CSE0492), S Jagadeeshwara Reddy (20241CSE0491)
**Guide:** Ms. Rekha Vadivel
**University:** Presidency University, Bengaluru
**Academic Year:** 2026–2027

## 1. Abstract

This project implements a permissioned blockchain system for issuing, sharing, and verifying academic certificates. Authorized universities issue digitally signed certificate records; three independent Proof of Authority validators finalize blocks using a 2-of-3 quorum; employers verify certificates by ID, QR code, or PDF upload. The system detects modification, revocation, duplicate issuance, and unauthorized validators, and provides a blockchain explorer and consensus monitor.

## 2. Introduction

Academic certificate fraud undermines trust in credentials. Traditional verification depends on contacting the issuing institution, which is slow and error-prone. This project demonstrates how a permissioned blockchain can provide tamper-evident, independently verifiable academic records.

## 3. Problem Statement

There is no lightweight, institution-independent mechanism for employers to verify that an academic certificate is genuine, unmodified, and not revoked.

## 4. Existing System

Manual verification: employers contact universities by phone/email; universities maintain private databases. Limitations: slow, single point of failure, no tamper evidence, no public audit trail.

## 5. Limitations of the Existing System

- Centralized databases can be silently altered.
- No cryptographic proof of issuance.
- Verification is manual and slow.
- No standard for cross-institution verification.
- Revocation is not publicly auditable.

## 6. Proposed System

A permissioned blockchain where approved universities issue signed certificate commitments, independent PoA validators finalize blocks, and anyone can verify a certificate against the finalized ledger. Only commitments (IDs and hashes) are stored on-chain; personal data stays off-chain.

## 7. Objectives

1. Prevent undetected modification of certificate records.
2. Allow authorized universities to issue certificates.
3. Generate PDF certificates with unique IDs and QR codes.
4. Record issuance and revocation on a blockchain.
5. Use authorized validators to propose and validate blocks.
6. Allow independent employer verification.
7. Detect modified, invalid, duplicate, or revoked certificates.
8. Provide auditable history via a blockchain explorer.
9. Demonstrate real consensus operation.
10. Run entirely locally without external testnets.

## 8. Scope

Local educational prototype. Not production-grade. See limitations.

## 9. Literature Review (summary)

Blockchain in education (Blockcerts, EduCTX) demonstrates decentralized credential verification. PoA (Aura/Clique/IBFT family) is widely used in permissioned settings for its efficiency. Ed25519 provides fast, secure digital signatures. This project implements a simplified educational PoA for teaching.

## 10. Research Gaps Addressed

- Combining issuance, revocation, PDF/QR, and upload verification in one demonstrable system.
- Explicit, documented consensus assumptions rather than claiming BFT.
- Security demonstration scenarios for evaluation.

## 11. Proposed Methodology

Phase-based development: architecture → backend → blockchain → certificates → frontend → integration → testing → documentation.

## 12. System Architecture

Browser (React/Vite) → Express API → three validator processes (HTTP). API holds application metadata (JSON files). Validators hold independent append-only ledgers and vote locks. University/validator Ed25519 keys are local files, never exposed to the browser.

## 13. Data Flow Diagram (text)

University login → issue certificate form → API validates → hashes certificate → signs transaction → proposes block to scheduled validator → all validators verify and vote → 2-of-3 finalization → persist block → generate PDF + QR → student downloads → employer verifies by ID/QR/PDF.

## 14. Use-Case Summary

Actors: Super Admin, University Admin, Student, Employer/Verifier. Use cases: manage universities, manage students, issue/revoke certificates, view/download certificates, verify certificates, explore blockchain, monitor validators.

## 15. Sequence Diagram (issuance)

1. University submits certificate data.
2. API creates certificate record and computes SHA-256.
3. API creates signed ISSUE transaction.
4. Scheduled validator proposes block.
5. All validators independently validate and vote.
6. 2-of-3 votes finalize; block persisted to all agreeing nodes.
7. API returns confirmation; PDF generated.

## 16. Database / Storage Design

JSON files for prototype: users, universities (config), students, certificates, verification logs. Validators store JSONL ledgers and vote-lock JSON. A production version would use Prisma + SQLite/PostgreSQL with the schema described in architecture.md.

## 17. Blockchain Block Structure

height, previousHash, timestamp, transactions[], commitment, proposer, round, hash, proposerSignature, votes[].

## 18. Proof of Authority Algorithm

Round-robin proposer selection: proposer = validators[(height-1) mod n]. Proposer signs block hash. Each validator validates height, parent, proposer authorization, signatures, transactions, duplicates, then persists a vote lock and returns a signed vote. Finalization requires ≥2 distinct valid votes. All nodes validate the finalization certificate before appending.

## 19. Consensus Workflow

See architecture.md. Fault assumptions: crash-fault, not BFT; 2-of-3 quorum; no view changes; unavailable proposer stalls progress.

## 20. Certificate Issuance Algorithm

Generate UUID → build canonical record → SHA-256 → create transaction → sign with university key → propose block → collect votes → finalize → persist certificate → generate PDF with QR.

## 21. Certificate Verification Algorithm

Lookup transaction by certificate ID → recompute certificate hash → compare → verify university signature → check revocation → return status. PDF upload: SHA-256 of bytes vs documentHash commitment.

## 22. Security Mechanisms

bcrypt passwords, session tokens, RBAC middleware, Zod validation, rate limiting, Ed25519 signatures, hash chaining, vote locks, no private keys in frontend, minimal on-chain PII.

## 23. Implementation Details

Node.js/Express backend, React/Vite frontend, custom blockchain core package, PDFKit + qrcode, multer for uploads, three validator processes.

## 24. Screenshots

(To be captured during demo: Home, Login, Dashboard, Issue, Explorer, Verify, PDF.)

## 25. Testing Methodology

Unit tests (Vitest) for consensus logic; integration test for full issue→verify→revoke workflow; manual responsive testing.

## 26. Test Cases and Results

- 7 consensus unit tests: passed.
- 1 end-to-end integration test: passed.
- PDF upload verification: tampered PDF rejected.
- Revocation: status changes to Revoked.

## 27. Advantages

- Tamper-evident records.
- Independent verification without contacting university.
- Efficient PoA consensus.
- Open audit trail via explorer.
- Minimal on-chain personal data.

## 28. Limitations

- Educational crash-fault protocol, not BFT.
- No automated validator synchronization.
- JSON file storage, not transactional.
- In-memory sessions.
- Local HTTP, no TLS.
- Not for real credentials.

## 29. Future Enhancements

Prisma/SQLite, Byzantine fault tolerance, automated sync, university onboarding workflow, certificate templates, batch issuance, mobile app, production deployment.

## 30. Conclusion

The project demonstrates a functional permissioned blockchain for academic certificate verification with real cryptographic hashing, signatures, multi-validator PoA consensus, PDF/QR generation, public verification, and revocation. It is suitable for academic demonstration while honestly documenting its limitations.

## 31. References

1. Nakamoto, S. (2008). Bitcoin: A Peer-to-Peer Electronic Cash System.
2. Wood, G. (2014). Ethereum: A Secure Decentralised Generalised Transaction Ledger.
3. De Angelis, S. et al. (2018). PBFT vs Proof-of-Authority.
4. Blockcerts. https://www.blockcerts.org/
5. Node.js, Express, React, Vite documentation.
6. RFC 8032 — EdDSA (Ed25519).