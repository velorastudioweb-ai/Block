# Demo Instructions — Verity

## Setup (repeatable, isolated)

```sh
npm install
npm run setup          # creates fictional data in data/ (gitignored)
npm run dev            # starts validators + API + web
```

Open http://localhost:5173.

Demo accounts (password `DemoPass123!` unless `DEMO_PASSWORD` is set):
- Super admin: `superadmin@example.test`
- University: `admin1@example.test`
- Students created during demo

To run a fresh demo, use a separate project copy and run setup there. Do not delete the existing `data/` directory; it contains certificates, validator keys, and blockchain history.

## 8–10 Minute Demo Script

1. **Homepage** (30s) — introduce Verity, verification search box.
2. **University login** (30s) — log in as `admin1@example.test`.
3. **Certificate issuance** (1.5 min) — fill form (student "Manoj", course "Engineering"), submit. Show "confirmed in block N".
4. **PoA consensus** (1.5 min) — open Blockchain Explorer, show block N with proposer, votes from 3 validators, hashes.
5. **Certificate ID verification** (1 min) — go to Verify, paste ID, show "Verified and valid", block #.
6. **PDF verification** (1 min) — download PDF, upload it, show "Verified and valid".
7. **Modified PDF rejection** (1 min) — modify a byte in the PDF, upload, show "Data mismatch".
8. **QR verification** (1 min) — scan QR, opens verify page.
9. **Revocation** (1 min) — revoke a certificate, re-verify, show "Revoked".
10. **Wrap-up** (30s) — validator status, integrity check.

## Fictional Data Only

All names, universities, and certificates are fictional demonstration data. Do not use real student data.

## Notes

- Keep all 3 validators running during demo (concurrently -k kills all if one dies).
- If a validator dies, restart the whole stack.
- Internet not required (all local).
