import { createHash, sign, verify } from 'node:crypto';

export const canonical = value => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
};
export const hash = value => createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex');
export const signature = (value, key) => sign(null, Buffer.from(canonical(value)), key).toString('base64');
export const validSignature = (value, sig, key) => {
  try { return verify(null, Buffer.from(canonical(value)), key, Buffer.from(sig, 'base64')); } catch { return false; }
};
export const GENESIS = '0'.repeat(64);
export const blockPayload = b => ({ height: b.height, previousHash: b.previousHash, timestamp: b.timestamp, transactions: b.transactions, commitment: b.commitment, proposer: b.proposer, round: b.round });
export const txPayload = tx => ({ id: tx.id, type: tx.type, certificateId: tx.certificateId, dataHash: tx.dataHash, universityId: tx.universityId, timestamp: tx.timestamp, ...(tx.documentHash ? { documentHash: tx.documentHash } : {}), ...(tx.reason ? { reason: tx.reason } : {}) });
export const votePayload = (height, blockHash, validatorId) => ({ height, blockHash, validatorId });

export function validateCandidate(block, chain, config) {
  const height = chain.length + 1;
  if (block.height !== height || block.previousHash !== (chain.at(-1)?.hash || GENESIS)) throw Error('Invalid height or previous hash');
  const expected = config.validators[(height - 1) % config.validators.length];
  if (block.proposer !== expected.id || block.round !== 0) throw Error('Unauthorized proposer');
  if (!Array.isArray(block.transactions) || block.transactions.length !== 1 || block.commitment !== hash(block.transactions)) throw Error('Invalid transaction commitment');
  if (block.hash !== hash(blockPayload(block)) || !validSignature(block.hash, block.proposerSignature, expected.publicKey)) throw Error('Invalid block signature or hash');
  const tx = block.transactions[0];
  const uni = config.universities.find(u => u.id === tx.universityId && u.approved);
  if (!uni || !validSignature(txPayload(tx), tx.signature, uni.publicKey)) throw Error('Invalid university or transaction signature');
  if (!['ISSUE', 'REVOKE'].includes(tx.type)) throw Error('Invalid transaction type');
  const previous = chain.flatMap(b => b.transactions);
  if (previous.some(t => t.id === tx.id)) throw Error('Duplicate transaction');
  const issue = previous.find(t => t.type === 'ISSUE' && t.certificateId === tx.certificateId);
  if (tx.type === 'ISSUE' && issue) throw Error('Duplicate certificate');
  if (tx.type === 'REVOKE' && (!issue || issue.universityId !== tx.universityId || issue.dataHash !== tx.dataHash || !tx.reason || previous.some(t => t.type === 'REVOKE' && t.certificateId === tx.certificateId))) throw Error('Invalid revocation');
  return true;
}

export function validateFinalized(block, chain, config) {
  validateCandidate(block, chain, config);
  const ids = new Set();
  for (const vote of block.votes || []) {
    const validator = config.validators.find(v => v.id === vote.validatorId);
    if (!validator || ids.has(vote.validatorId) || !validSignature(votePayload(block.height, block.hash, vote.validatorId), vote.signature, validator.publicKey)) throw Error('Invalid vote');
    ids.add(vote.validatorId);
  }
  if (ids.size < 2) throw Error('Insufficient quorum');
  return true;
}

export function validateChain(chain, config) {
  const checked = [];
  for (const block of chain) { validateFinalized(block, checked, config); checked.push(block); }
  return true;
}
