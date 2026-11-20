# Blockchain & Consensus Report — Verity

## 1. Is it a real blockchain?

Yes. Evidence:
- Blocks are persisted as JSONL in `data/validator-*.jsonl`, one file per validator.
- Each block contains `previousHash` linking to the prior block.
- Block hash = SHA-256 of canonical block payload.
- Transactions are digitally signed by the issuing university (Ed25519).
- Validators independently verify and sign votes.
- Finalization requires ≥2 distinct validator votes.
- Chain integrity is validated on every read via `validateChain`.

## 2. Block Structure

```
{
  height, previousHash, timestamp, transactions[], commitment,
  proposer, round, hash, proposerSignature, votes[]
}
```

## 3. Proof of Authority Consensus

- **Validators:** 3 (validator-1, validator-2, validator-3), each a separate Node.js process with its own Ed25519 key pair, chain file, and vote-lock file.
- **Proposer selection:** round-robin: `validators[(height-1) % 3]`.
- **Proposal:** scheduled proposer builds block, signs `hash`.
- **Validation (each validator independently):**
  - height == current height + 1
  - previousHash matches tip
  - proposer is the scheduled authority
  - proposer signature valid
  - transaction commitment matches
  - university exists and is approved
  - university signature valid
  - transaction type valid (ISSUE/REVOKE)
  - no duplicate transaction ID
  - no duplicate certificate (for ISSUE)
  - valid revocation (for REVOKE)
- **Vote lock:** each validator persists a vote lock per height to prevent double-voting, including across restarts.
- **Finality:** ≥2 distinct valid signed votes. Block appended only after finalization.
- **Finalization certificate:** stored in block's `votes[]`.

## 4. Safety & Liveness Guarantees (Honest)

Implemented:
- Crash-fault tolerance: 1 of 3 validators may be offline and progress continues (2-of-3 quorum).
- Tamper detection: any historical block modification breaks `validateChain`.
- Unauthorized proposer rejection: enforced.
- Invalid signature rejection: enforced.
- Duplicate transaction/certificate rejection: enforced.
- Vote-lock prevents double-voting across restarts.

NOT implemented (documented limitations):
- Byzantine fault tolerance: a malicious validator can equivocate; 2-of-3 quorum does not provide BFT.
- No view changes or timeouts: a missing scheduled proposer stalls progress.
- No automated catch-up originally; **added** `/sync` endpoint + best-effort sync after finalization.
- No dynamic membership.

## 5. Validator Restart Recovery

- Each validator persists its chain to `data/validator-N.jsonl`.
- On restart, it reads the persisted chain.
- If it missed blocks, the API's `chain()` still works (2 of 3 agree).
- The `/sync` endpoint allows a lagging validator to catch up when given a valid longer chain.
- The API triggers best-effort sync to all validators after each finalization.

## 6. Test Results

| Scenario | Result |
|---|---|
| All validators online | PASS |
| One validator offline | PASS (2-of-3 quorum) |
| Unauthorized proposer | Rejected ("Unauthorized proposer") |
| Invalid block signature | Rejected |
| Invalid previous hash | Rejected ("previous hash") |
| Conflicting proposals | Rejected (vote lock) |
| Validator restart + sync | PASS (height restored) |
| Network failure | API returns "Blockchain validation unavailable" (no false success) |

## 7. Evidence

- Validator processes: 3 separate Node.js processes on ports 4101/4102/4103.
- Each has unique key file: `data/validator-1.key`, etc.
- Chain files: `data/validator-1.jsonl`, etc.
- Vote locks: `data/validator-1-votes.json`, etc.
- Sync test: deleted validator-1's chain → height 0 → /sync restored to height 6.