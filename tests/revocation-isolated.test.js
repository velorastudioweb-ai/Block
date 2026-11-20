import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';

const root = resolve('.');
const children = [];
let dir, base, credentials;

async function freePort() {
  const server = createServer();
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  const port = server.address().port;
  await new Promise(resolveClose => server.close(resolveClose));
  return port;
}
async function waitFor(url) {
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise(resolveWait => setTimeout(resolveWait, 100));
  }
  throw new Error(`Service failed to start: ${url}`);
}
function start(file, args, env = {}) {
  const child = spawn(process.execPath, [resolve(root, file), ...args], { cwd: dir, env: { ...process.env, ...env }, stdio: 'ignore' });
  children.push(child);
}
async function json(path, options = {}) {
  const response = await fetch(base + path, options);
  return { status: response.status, data: await response.json() };
}

describe('isolated revocation workflow', () => {
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'verity-revocation-'));
    const env = { ...process.env, DEMO_PASSWORD: 'IsolatedTestPassword123!' };
    const setup = spawnSync(process.execPath, [resolve(root, 'scripts/setup.js')], { cwd: dir, env });
    if (setup.status !== 0) throw new Error('Isolated setup failed');
    const configPath = join(dir, 'data/config.json');
    const config = JSON.parse(readFileSync(configPath));
    const ports = await Promise.all([freePort(), freePort(), freePort(), freePort()]);
    config.validators.forEach((validator, i) => { validator.url = `http://127.0.0.1:${ports[i]}`; });
    writeFileSync(configPath, JSON.stringify(config));
    config.validators.forEach((validator, i) => start('apps/validator/server.js', [String(ports[i])], { VALIDATOR_INDEX: String(i) }));
    await Promise.all(config.validators.map(v => waitFor(`${v.url}/status`)));
    base = `http://127.0.0.1:${ports[3]}`;
    start('apps/api/server.js', [], { PORT: String(ports[3]), DEMO_PASSWORD: env.DEMO_PASSWORD });
    await waitFor(`${base}/api/network`);
    const login = await json('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin2@example.test', password: env.DEMO_PASSWORD }) });
    expect(login.status).toBe(200);
    credentials = { 'content-type': 'application/json', authorization: `Bearer ${login.data.token}` };
  }, 30000);

  afterAll(async () => {
    await Promise.all(children.map(child => new Promise(resolveExit => {
      if (child.exitCode !== null || child.signalCode !== null) return resolveExit();
      child.once('exit', resolveExit);
      child.kill();
    })));
    if (dir) rmSync(dir, { recursive: true, force: true });
  }, 15000);

  it('finalizes revocation once, preserves issuance, and rejects repeats', async () => {
    const issued = await json('/api/certificates', { method: 'POST', headers: credentials, body: JSON.stringify({ studentName: 'Fictional Student', studentId: 'REVOKE-TEST', course: 'Computer Science', department: 'Computing', academicYear: '2026', completionDate: '2026-05-01' }) });
    expect(issued.status).toBe(201);
    const id = issued.data.certificate.id;
    expect((await json(`/api/verify/${id}`)).data.status).toBe('Verified and valid');
    const otherLogin = await json('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin3@example.test', password: 'IsolatedTestPassword123!' }) });
    const otherHeaders = { 'content-type': 'application/json', authorization: `Bearer ${otherLogin.data.token}` };
    const unauthorized = await json(`/api/certificates/${id}/revoke`, { method: 'POST', headers: otherHeaders, body: JSON.stringify({ reason: 'Not our certificate' }) });
    expect(unauthorized.status).toBe(404);
    const invalidReason = await json(`/api/certificates/${id}/revoke`, { method: 'POST', headers: credentials, body: JSON.stringify({ reason: 'x' }) });
    expect(invalidReason.status).toBe(400);
    const pdf = await fetch(`${base}/api/certificates/${id}/pdf`, { headers: credentials });
    expect(pdf.status).toBe(200);
    const pdfBytes = await pdf.arrayBuffer();
    const revoke = () => json(`/api/certificates/${id}/revoke`, { method: 'POST', headers: credentials, body: JSON.stringify({ reason: 'Fictional test' }) });
    expect((await revoke()).status).toBe(200);
    expect((await json(`/api/verify/${id}`)).data.status).toBe('Revoked');
    const form = new FormData();
    form.append('file', new Blob([pdfBytes], { type: 'application/pdf' }), 'certificate.pdf');
    expect((await json('/api/verify-pdf', { method: 'POST', body: form })).data.status).toBe('Revoked');
    const duplicate = await revoke();
    expect(duplicate.status).toBe(409);
    expect(duplicate.data.error).toBe('This certificate has already been revoked');
    const blocks = (await json('/api/blocks')).data;
    expect(blocks.flatMap(b => b.transactions).filter(t => t.certificateId === id).map(t => t.type)).toEqual(['ISSUE', 'REVOKE']);
  }, 30000);
});
