import { describe, it, expect } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { GENESIS, blockPayload, hash, signature, txPayload, validateCandidate, validateFinalized, votePayload } from '../packages/core/index.js';

const pair = () => { const k = generateKeyPairSync('ed25519'); return { publicKey: k.publicKey.export({ type: 'spki', format: 'pem' }), privateKey: k.privateKey.export({ type: 'pkcs8', format: 'pem' }) }; };
function fixture() {
  const keys = [pair(), pair(), pair()], uni = pair();
  const config = { validators: keys.map((k, i) => ({ id: `v${i}`, publicKey: k.publicKey })), universities: [{ id: 'u', approved: true, publicKey: uni.publicKey }] };
  const tx = { id: 't', type: 'ISSUE', certificateId: 'c', dataHash: hash('certificate'), universityId: 'u', timestamp: '2026-01-01' };
  tx.signature = signature(txPayload(tx), uni.privateKey);
  const block = { height: 1, previousHash: GENESIS, timestamp: '2026-01-01', transactions: [tx], commitment: hash([tx]), proposer: 'v0', round: 0 };
  block.hash = hash(blockPayload(block)); block.proposerSignature = signature(block.hash, keys[0].privateKey);
  block.votes = keys.slice(0, 2).map((k, i) => ({ validatorId: `v${i}`, signature: signature(votePayload(1, block.hash, `v${i}`), k.privateKey) }));
  return { block, config };
}
describe('educational authority consensus', () => {
  it('hashes object keys deterministically', () => expect(hash({ a: 1, b: 2 })).toBe(hash({ b: 2, a: 1 })));
  it('accepts a signed block with two distinct votes', () => { const { block, config } = fixture(); expect(validateFinalized(block, [], config)).toBe(true); });
  it('rejects an unauthorized proposer', () => { const { block, config } = fixture(); block.proposer = 'v1'; expect(() => validateCandidate(block, [], config)).toThrow('Unauthorized proposer'); });
  it('rejects a changed parent', () => { const { block, config } = fixture(); block.previousHash = 'fake'; expect(() => validateCandidate(block, [], config)).toThrow('previous hash'); });
  it('rejects modified transaction data', () => { const { block, config } = fixture(); block.transactions[0].dataHash = 'modified'; expect(() => validateCandidate(block, [], config)).toThrow('commitment'); });
  it('rejects duplicate votes and insufficient quorum', () => { const { block, config } = fixture(); block.votes = [block.votes[0], block.votes[0]]; expect(() => validateFinalized(block, [], config)).toThrow('Invalid vote'); block.votes.pop(); expect(() => validateFinalized(block, [], config)).toThrow('quorum'); });
  it('rejects a forged university signature', () => { const { block, config } = fixture(); block.transactions[0].signature = 'bad'; block.commitment = hash(block.transactions); block.hash = hash(blockPayload(block)); expect(() => validateCandidate(block, [], config)).toThrow('signature'); });
});
