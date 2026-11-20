# Security Test Results — Verity

## Tests Executed

| # | Scenario | Method | Result |
|---|---|---|---|
| 1 | Genuine certificate | Issue + verify by ID | PASS — "Verified and valid" |
| 2 | Modified certificate (PDF bytes changed) | Upload tampered PDF | PASS — "Data mismatch or unrecognized PDF" |
| 3 | Modified certificate (data field changed) | Recompute hash mismatch | PASS — "Data mismatch" |
| 4 | Unauthorized university | Unapproved university transaction | PASS — rejected by validators ("University not approved") |
| 5 | Invalid validator | Block signed by unknown proposer | PASS — rejected ("Unauthorized proposer") |
| 6 | Duplicate certificate | Second ISSUE for same cert ID | PASS — rejected ("Duplicate certificate") |
| 7 | Revoked certificate | Revoke then verify | PASS — "Revoked" |
| 8 | Validator unavailable | Stop 1 validator, issue | PASS — 2-of-3 quorum succeeds |
| 9 | Blockchain tampering | Modify stored block file | PASS — integrity check reports `ok: false` |
| 10 | Invalid signature (university) | Forged transaction signature | PASS — rejected ("signature") |
| 11 | Invalid signature (validator) | Forged vote | PASS — rejected ("Invalid vote") |
| 12 | Insufficient quorum | Only 1 vote | PASS — rejected ("quorum") |
| 13 | Rate limiting | Exceed 120 req/min | PASS — 429 returned |
| 14 | Input validation | Malformed certificate data | PASS — Zod rejection |
| 15 | Auth bypass attempt | Access protected endpoint without token | PASS — 401 |
| 16 | Role escalation | Student accessing university endpoint | PASS — 403 |

## Evidence

- Tampered PDF test: uploaded modified bytes → `{"status":"Data mismatch or unrecognized PDF"}`.
- Integrity check after tampering: `{"allValid":false, "validators":[{"id":"validator-1","ok":false,...}]}`.
- Consensus unit tests: 7/7 pass (see TEST_EXECUTION_RESULTS.md).
- Unauthorized proposer test: `validateCandidate` throws "Unauthorized proposer".

## Limitations (Honest)

- No TLS (local HTTP).
- In-memory sessions (lost on restart).
- No Byzantine fault tolerance.
- Educational prototype only.