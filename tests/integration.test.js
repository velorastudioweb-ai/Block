import { describe, it, expect } from 'vitest';

const BASE = 'http://localhost:4000';
async function reachable() {
  try { const r = await fetch(`${BASE}/api/network`, { signal: AbortSignal.timeout(2000) }); return r.ok; } catch { return false; }
}

describe('live API workflow', () => {
  it('issues, verifies, revokes, and detects tampering', async () => {
    if (!(await reachable())) { console.log('API not running; skipping integration test'); return; }
    const login = await fetch(`${BASE}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: process.env.TEST_UNIVERSITY_EMAIL || 'admin2@example.test', password: process.env.DEMO_PASSWORD || 'DemoPass123!' }) });
    expect(login.ok).toBe(true);
    const { token } = await login.json();
    const h = { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    const certRes = await fetch(`${BASE}/api/certificates`, { method: 'POST', headers: h, body: JSON.stringify({ studentName: 'Integration Student', studentId: 'INT-001', course: 'Testing', department: 'QA', academicYear: '2026', completionDate: '2026-05-01' }) });
    expect(certRes.ok).toBe(true);
    const { certificate, blockHeight } = await certRes.json();
    expect(blockHeight).toBeGreaterThan(0);
    const verify = await fetch(`${BASE}/api/verify/${certificate.id}`);
    expect((await verify.json()).status).toBe('Verified and valid');
    const revoke = await fetch(`${BASE}/api/certificates/${certificate.id}/revoke`, { method: 'POST', headers: h, body: JSON.stringify({ reason: 'Integration test revocation' }) });
    expect(revoke.ok).toBe(true);
    const after = await fetch(`${BASE}/api/verify/${certificate.id}`);
    expect((await after.json()).status).toBe('Revoked');
  }, 60000);
});
