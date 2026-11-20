import express from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { randomUUID, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import { z } from 'zod';
import multer from 'multer';
import { hash, signature, txPayload, validateChain, validSignature } from '../../packages/core/index.js';
import { createCertificatePdf, documentHash } from './pdf.js';
import QRCode from 'qrcode';

const config = JSON.parse(fs.readFileSync('data/config.json'));
const readUsers = () => JSON.parse(fs.readFileSync('data/users.json'));
const saveUsers = u => fs.writeFileSync('data/users.json', JSON.stringify(u, null, 2));
const sessions = new Map();
const readCerts = () => JSON.parse(fs.readFileSync('data/certificates.json'));
const saveCerts = c => fs.writeFileSync('data/certificates.json', JSON.stringify(c, null, 2));
const readStudents = () => JSON.parse(fs.readFileSync('data/students.json'));
const saveStudents = s => fs.writeFileSync('data/students.json', JSON.stringify(s, null, 2));
const app = express();
fs.mkdirSync('data/documents', { recursive: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
app.use(express.json({ limit: '100kb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));
const post = async (url, body) => {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(3000) });
  const data = await r.json(); if (!r.ok) throw Error(data.error || 'Validator rejected request'); return data;
};
const get = async url => { const r = await fetch(url, { signal: AbortSignal.timeout(2000) }); if (!r.ok) throw Error('Validator unavailable'); return r.json(); };
const network = () => Promise.all(config.validators.map(async v => { try { return await get(`${v.url}/status`); } catch { return { id: v.id, healthy: false }; } }));
async function chain() {
  const responses = await Promise.all(config.validators.map(async v => { try { const c = await get(`${v.url}/chain`); validateChain(c, config); return c; } catch { return null; } }));
  const valid = responses.filter(Boolean);
  for (const candidate of valid.sort((a, b) => b.length - a.length)) {
    const matches = valid.filter(c => c.length === candidate.length && (c.at(-1)?.hash || '') === (candidate.at(-1)?.hash || ''));
    if (matches.length >= 2) return candidate;
  }
  throw Error('Blockchain validation unavailable: fewer than two validators agree');
}
let busy = false;
async function commit(tx) {
  if (busy) throw Error('Another transaction is being processed; retry');
  busy = true;
  try {
    const current = await chain();
    const proposer = config.validators[current.length % config.validators.length];
    const block = await post(`${proposer.url}/propose`, { transaction: tx });
    const votes = (await Promise.all(config.validators.map(v => post(`${v.url}/vote`, block).catch(() => null)))).filter(Boolean);
    if (votes.length < 2) throw Error('Consensus unavailable: insufficient votes');
    block.votes = votes;
    const acks = (await Promise.all(config.validators.map(v => post(`${v.url}/finalize`, block).catch(() => null)))).filter(Boolean);
    if (acks.length < 2) throw Error('Finalization uncertain: fewer than two nodes acknowledged');
    // Best-effort synchronization so restarted validators catch up.
    const fresh = await chain().catch(() => null);
    if (fresh) config.validators.forEach(v => fetch(`${v.url}/sync`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(fresh) }).catch(() => {}));
    return block;
  } finally { busy = false; }
}
const auth = (req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  const session = sessions.get(token);
  if (!session || session.expires < Date.now()) return res.status(401).json({ error: 'Please sign in' });
  req.user = session.user; next();
};
const wrap = fn => (req, res) => Promise.resolve(fn(req, res)).catch(e => res.status(400).json({ error: e.message }));
app.post('/api/login', wrap(async (req, res) => {
  const { email, password } = z.object({ email: z.string().email(), password: z.string().min(1).max(200) }).parse(req.body);
  const user = readUsers().find(u => u.email === email);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) return res.status(401).json({ error: 'Invalid credentials' });
  const token = randomBytes(32).toString('hex'); sessions.set(token, { user, expires: Date.now() + 8 * 3600000 });
  res.json({ token, user: { email: user.email, role: user.role, universityId: user.universityId } });
}));
app.post('/api/logout', auth, (req, res) => { sessions.delete(req.headers.authorization.replace(/^Bearer /, '')); res.json({ ok: true }); });
app.get('/api/me', auth, (req, res) => res.json({ email: req.user.email, universityId: req.user.universityId, role: req.user.role }));
app.get('/api/network', wrap(async (req, res) => res.json({ validators: await network(), universities: config.universities.map(({ id, name }) => ({ id, name })) })));
app.get('/api/blocks', wrap(async (req, res) => res.json(await chain())));
app.get('/api/certificates', auth, (req, res) => res.json(readCerts().filter(c => c.universityId === req.user.universityId)));
const certSchema = z.object({ studentName: z.string().trim().min(2).max(100), studentId: z.string().trim().min(1).max(100), course: z.string().trim().min(2).max(150), department: z.string().trim().min(2).max(100), academicYear: z.string().trim().min(4).max(30), completionDate: z.string().date(), grade: z.string().trim().max(50).optional() });
app.post('/api/certificates', auth, wrap(async (req, res) => {
  const details = certSchema.parse(req.body);
  const university = config.universities.find(u => u.id === req.user.universityId && u.approved);
  if (!university) throw Error('University not approved');
  const certificate = { id: randomUUID(), universityId: university.id, universityName: university.name, ...details, issueDate: new Date().toISOString() };
  const dataHash = hash(certificate);
  const pdf = await createCertificatePdf(certificate, process.env.PUBLIC_WEB_URL || 'http://localhost:5173');
  const tx = { id: randomUUID(), type: 'ISSUE', certificateId: certificate.id, dataHash, documentHash: documentHash(pdf), universityId: university.id, timestamp: new Date().toISOString() };
  tx.signature = signature(txPayload(tx), fs.readFileSync(`data/${university.id}.key`, 'utf8'));
  // Persist the data before consensus so an uncertain network response does not erase the committed payload.
  fs.writeFileSync(`data/documents/${certificate.id}.pdf`, pdf);
  const certs = readCerts(); certs.push(certificate); saveCerts(certs);
  const block = await commit(tx);
  res.status(201).json({ certificate, blockHeight: block.height });
}));
app.get('/api/certificates/:id/pdf', auth, wrap(async (req, res) => {
  const c = readCerts().find(c => c.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'Certificate not found' });
  const allowed = req.user.role === 'admin' || (req.user.role === 'university' && c.universityId === req.user.universityId) || (req.user.role === 'student' && c.universityId === req.user.universityId && c.studentId === req.user.studentId);
  if (!allowed) return res.status(403).json({ error: 'Forbidden' });
  const blocks = await chain();
  const issue = blocks.flatMap(b => b.transactions).find(t => t.type === 'ISSUE' && t.certificateId === c.id);
  if (!issue?.documentHash) return res.status(404).json({ error: 'No confirmed PDF commitment for this certificate' });
  const path = `data/documents/${c.id}.pdf`;
  if (!fs.existsSync(path) || documentHash(fs.readFileSync(path)) !== issue.documentHash) return res.status(409).json({ error: 'Stored PDF does not match blockchain commitment' });
  res.download(path, `certificate-${c.id}.pdf`);
}));
app.get('/api/certificates/:id/qr', wrap(async (req, res) => {
  const c = readCerts().find(c => c.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'Certificate not found' });
  const url = `${process.env.PUBLIC_WEB_URL || 'http://localhost:5173'}?id=${encodeURIComponent(c.id)}`;
  const png = await QRCode.toBuffer(url, { errorCorrectionLevel: 'M', margin: 1, width: 220 });
  res.type('png').send(png);
}));
app.post('/api/verify-pdf', (req, res, next) => upload.single('file')(req, res, err => {
  if (err) return res.status(400).json({ error: 'Upload one PDF no larger than 5 MB' });
  next();
}), wrap(async (req, res) => {
  if (!req.file || !req.file.buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) return res.status(400).json({ error: 'Please upload a PDF file' });
  let blocks;
  try { blocks = await chain(); } catch { return res.status(503).json({ status: 'Blockchain validation unavailable' }); }
  const transactions = blocks.flatMap(b => b.transactions.map(tx => ({ ...tx, blockHeight: b.height })));
  const issue = transactions.find(t => t.type === 'ISSUE' && t.documentHash === documentHash(req.file.buffer));
  if (!issue) return res.status(404).json({ status: 'Data mismatch or unrecognized PDF', explanation: 'The uploaded bytes do not match any finalized document commitment.' });
  const c = readCerts().find(c => c.id === issue.certificateId);
  if (!c || hash(c) !== issue.dataHash) return res.status(409).json({ status: 'Data mismatch' });
  const revoked = transactions.find(t => t.type === 'REVOKE' && t.certificateId === issue.certificateId);
  res.json({ status: revoked ? 'Revoked' : 'Verified and valid', certificate: { id: c.id, universityName: c.universityName, course: c.course, issueDate: c.issueDate }, transaction: { id: issue.id, blockHeight: issue.blockHeight }, explanation: 'The SHA-256 hash of the entire uploaded PDF matches the finalized, university-signed document commitment.', ...(revoked ? { revocation: { reason: revoked.reason, blockHeight: revoked.blockHeight } } : {}) });
}));
app.post('/api/certificates/:id/revoke', auth, wrap(async (req, res) => {
  if (req.user.role !== 'university') return res.status(403).json({ error: 'Only the issuing university can revoke a certificate' });
  const { reason } = z.object({ reason: z.string().trim().min(3).max(500) }).parse(req.body);
  const c = readCerts().find(c => c.id === req.params.id && c.universityId === req.user.universityId);
  if (!c) return res.status(404).json({ error: 'Certificate not found' });
  let blocks;
  try { blocks = await chain(); } catch { return res.status(503).json({ error: 'Blockchain validation unavailable; revocation was not submitted' }); }
  const transactions = blocks.flatMap(b => b.transactions);
  const issue = transactions.find(t => t.type === 'ISSUE' && t.certificateId === c.id);
  if (!issue) return res.status(409).json({ error: 'Certificate issuance is not confirmed on the blockchain' });
  if (transactions.some(t => t.type === 'REVOKE' && t.certificateId === c.id)) return res.status(409).json({ error: 'This certificate has already been revoked' });
  if (issue.universityId !== c.universityId || issue.dataHash !== hash(c)) return res.status(409).json({ error: 'Certificate data does not match its blockchain record' });
  const tx = { id: randomUUID(), type: 'REVOKE', certificateId: c.id, dataHash: hash(c), universityId: c.universityId, timestamp: new Date().toISOString(), reason };
  tx.signature = signature(txPayload(tx), fs.readFileSync(`data/${c.universityId}.key`, 'utf8'));
  const block = await commit(tx); res.json({ blockHeight: block.height });
}));
app.get('/api/verify/:id', wrap(async (req, res) => {
  let blocks;
  try { blocks = await chain(); } catch { return res.status(503).json({ status: 'Blockchain validation unavailable' }); }
  const txs = blocks.flatMap(b => b.transactions.map(tx => ({ ...tx, blockHeight: b.height, blockHash: b.hash })));
  const issue = txs.find(t => t.type === 'ISSUE' && t.certificateId === req.params.id);
  if (!issue) return res.status(404).json({ status: 'Not found' });
  const c = readCerts().find(c => c.id === issue.certificateId);
  if (!c || hash(c) !== issue.dataHash) return res.json({ status: 'Data mismatch' });
  const uni = config.universities.find(u => u.id === issue.universityId);
  if (!uni || !validSignature(txPayload(issue), issue.signature, uni.publicKey)) return res.json({ status: 'Invalid signature' });
  const revoked = txs.find(t => t.type === 'REVOKE' && t.certificateId === c.id);
  res.json({ status: revoked ? 'Revoked' : 'Verified and valid', certificate: { id: c.id, universityName: c.universityName, course: c.course, issueDate: c.issueDate }, transaction: { id: issue.id, blockHeight: issue.blockHeight, blockHash: issue.blockHash }, ...(revoked ? { revocation: { reason: revoked.reason, blockHeight: revoked.blockHeight } } : {}) });
}));
const requireRole = role => (req, res, next) => req.user.role === role ? next() : res.status(403).json({ error: 'Forbidden' });
app.get('/api/students', auth, requireRole('university'), (req, res) => res.json(readStudents().filter(s => s.universityId === req.user.universityId)));
app.post('/api/students', auth, requireRole('university'), wrap(async (req, res) => {
  const { name, studentId, email } = z.object({ name: z.string().trim().min(2).max(100), studentId: z.string().trim().min(1).max(100), email: z.string().email() }).parse(req.body);
  const students = readStudents();
  if (students.some(s => s.universityId === req.user.universityId && s.studentId === studentId)) throw Error('Student ID already exists for this university');
  const student = { id: randomUUID(), universityId: req.user.universityId, name, studentId, email, createdAt: new Date().toISOString() };
  students.push(student); saveStudents(students);
  const users = readUsers();
  users.push({ id: `student-${student.id}`, email, passwordHash: bcrypt.hashSync(process.env.DEMO_PASSWORD || 'DemoPass123!', 10), role: 'student', universityId: req.user.universityId, studentId });
  saveUsers(users);
  res.status(201).json(student);
}));
app.get('/api/student/certificates', auth, requireRole('student'), (req, res) => res.json(readCerts().filter(c => c.universityId === req.user.universityId && c.studentId === req.user.studentId)));
app.get('/api/admin/overview', auth, requireRole('admin'), wrap(async (req, res) => {
  const certs = readCerts(); const students = readStudents(); const blocks = await chain().catch(() => []);
  res.json({ universities: config.universities, counts: { certificates: certs.length, students: students.length, blocks: blocks.length, validators: (await network()).filter(v => v.healthy).length } });
}));
app.get('/api/admin/certificates', auth, requireRole('admin'), (req, res) => res.json(readCerts()));
app.get('/api/admin/universities', auth, requireRole('admin'), (req, res) => res.json(config.universities));
app.patch('/api/admin/universities/:id', auth, requireRole('admin'), wrap(async (req, res) => {
  const { approved } = z.object({ approved: z.boolean() }).parse(req.body);
  const u = config.universities.find(u => u.id === req.params.id);
  if (!u) throw Error('University not found');
  u.approved = approved; fs.writeFileSync('data/config.json', JSON.stringify(config, null, 2));
  res.json(u);
}));
app.get('/api/admin/validators', auth, requireRole('admin'), wrap(async (req, res) => res.json(await network())));
app.post('/api/register-university', wrap(async (req, res) => {
  const { name, email, password } = z.object({ name: z.string().trim().min(2).max(150), email: z.string().email(), password: z.string().min(8).max(200) }).parse(req.body);
  const { generateKeyPairSync } = await import('node:crypto');
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const pub = publicKey.export({ type: 'spki', format: 'pem' });
  const priv = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const id = `university-${Date.now()}`;
  config.universities.push({ id, name, approved: false, publicKey: pub });
  fs.writeFileSync('data/config.json', JSON.stringify(config, null, 2));
  fs.writeFileSync(`data/${id}.key`, priv, { mode: 0o600 });
  const users = readUsers();
  users.push({ id: `user-${id}`, email, passwordHash: bcrypt.hashSync(password, 10), universityId: id, role: 'university' });
  saveUsers(users);
  res.status(201).json({ id, name, approved: false, message: 'Application submitted. Await super admin approval.' });
}));
app.get('/api/integrity', wrap(async (req, res) => {
  const results = await Promise.all(config.validators.map(async v => {
    try { const c = await get(`${v.url}/chain`); validateChain(c, config); return { id: v.id, ok: true, height: c.length }; }
    catch (e) { return { id: v.id, ok: false, error: e.message }; }
  }));
  res.json({ allValid: results.every(r => r.ok), validators: results });
}));
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  let last = '';
  const timer = setInterval(async () => {
    try {
      const blocks = await chain().catch(() => []);
      const payload = JSON.stringify({ height: blocks.length, validators: (await network()).filter(v => v.healthy).length });
      if (payload !== last) { last = payload; res.write(`data: ${payload}\n\n`); }
    } catch {}
  }, 4000);
  req.on('close', () => clearInterval(timer));
});
const port = Number(process.env.PORT || 4000);
app.listen(port, '127.0.0.1', () => console.log(`API listening on http://localhost:${port}`));
