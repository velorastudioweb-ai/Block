# Test Execution Results — Verity

**Date:** 2026-11-20
**Command:** `npm test`

## Summary

```
Test Files  2 passed (2)
Tests       8 passed (8)
Duration    ~1.5s
```

## Test Files

### tests/core.test.js (7 tests, 7 passed)

1. `hashes object keys deterministically` — PASS
2. `accepts a signed block with two distinct votes` — PASS
3. `rejects an unauthorized proposer` — PASS
4. `rejects a changed parent` — PASS
5. `rejects modified transaction data` — PASS
6. `rejects duplicate votes and insufficient quorum` — PASS
7. `rejects a forged university signature` — PASS

### tests/integration.test.js (1 test, 1 passed)

1. `live API workflow > issues, verifies, revokes, and detects tampering` — PASS (840ms)
   - Login → issue cert → verify "Verified and valid" → revoke → verify "Revoked"

## Additional Manual Tests Executed

| Test | Result |
|---|---|
| Production build (`npm run build`) | PASS |
| Validator sync (delete chain → /sync restores) | PASS |
| Tampered PDF rejection | PASS |
| Blockchain integrity check | PASS |
| Student portal flow | PASS |
| Admin overview | PASS |
| QR endpoint | PASS (HTTP 200) |

## TypeScript

Project uses JavaScript (not TypeScript). Type checking not applicable. Documented as limitation.

## End-to-End Browser Tests

Not implemented (Playwright not configured). Manual browser testing performed. Documented as future work.