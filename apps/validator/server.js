import express from 'express';
import fs from 'node:fs';
import { blockPayload, hash, signature, validateCandidate, validateChain, validateFinalized, votePayload } from '../../packages/core/index.js';

const port = Number(process.argv[2]);
const index = process.env.VALIDATOR_INDEX === undefined ? port - 4101 : Number(process.env.VALIDATOR_INDEX);
const config = JSON.parse(fs.readFileSync('data/config.json'));
const self = config.validators[index];
if (!self) throw Error('Unknown validator port');
const key = fs.readFileSync(`data/${self.id}.key`, 'utf8');
const chainPath = `data/${self.id}.jsonl`;
const locksPath = `data/${self.id}-votes.json`;
const readChain = () => fs.existsSync(chainPath) ? fs.readFileSync(chainPath, 'utf8').split('\n').filter(Boolean).map(JSON.parse) : [];
const app = express();
app.use(express.json({ limit: '100kb' }));
app.get('/status', (req, res) => {
  try { const chain = readChain(); validateChain(chain, config); res.json({ id: self.id, height: chain.length, tip: chain.at(-1)?.hash || null, healthy: true }); }
  catch (e) { res.status(503).json({ id: self.id, healthy: false, error: e.message }); }
});
app.get('/chain', (req, res) => {
  try { const chain = readChain(); validateChain(chain, config); res.json(chain); }
  catch (e) { res.status(503).json({ error: e.message }); }
});
app.post('/propose', (req, res) => {
  try {
    const chain = readChain(); validateChain(chain, config);
    const b = { height: chain.length + 1, previousHash: chain.at(-1)?.hash || '0'.repeat(64), timestamp: new Date().toISOString(), transactions: [req.body.transaction], commitment: hash([req.body.transaction]), proposer: self.id, round: 0 };
    b.hash = hash(blockPayload(b)); b.proposerSignature = signature(b.hash, key);
    validateCandidate(b, chain, config);
    res.json(b);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.post('/vote', (req, res) => {
  try {
    const b = req.body; const chain = readChain(); validateChain(chain, config); validateCandidate(b, chain, config);
    const locks = fs.existsSync(locksPath) ? JSON.parse(fs.readFileSync(locksPath)) : {};
    if (locks[b.height] && locks[b.height] !== b.hash) throw Error('Already voted for another block at this height');
    locks[b.height] = b.hash;
    fs.writeFileSync(locksPath, JSON.stringify(locks));
    res.json({ validatorId: self.id, signature: signature(votePayload(b.height, b.hash, self.id), key) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.post('/finalize', (req, res) => {
  try {
    const b = req.body; const chain = readChain(); validateChain(chain, config);
    if (chain[b.height - 1]?.hash === b.hash) return res.json({ ok: true });
    validateFinalized(b, chain, config);
    fs.appendFileSync(chainPath, `${JSON.stringify(b)}\n`);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.post('/sync', (req, res) => {
  try {
    const incoming = req.body;
    if (!Array.isArray(incoming)) throw Error('Expected chain array');
    const current = readChain();
    if (incoming.length <= current.length) return res.json({ ok: true, height: current.length, changed: false });
    validateChain(incoming, config);
    fs.writeFileSync(chainPath, incoming.map(b => JSON.stringify(b)).join('\n') + '\n');
    res.json({ ok: true, height: incoming.length, changed: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.listen(port, '127.0.0.1', () => console.log(`${self.id} listening on ${port}`));
