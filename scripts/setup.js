import fs from 'node:fs';
import { generateKeyPairSync } from 'node:crypto';
import bcrypt from 'bcryptjs';

if (fs.existsSync('data/config.json')) {
  console.log('Existing configuration preserved. Delete data manually only if you intend to reset all demo data.');
  process.exit(0);
}
fs.mkdirSync('data', { recursive: true });
const keypair = () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return { publicKey: publicKey.export({ type: 'spki', format: 'pem' }), privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
};
const validators = [1, 2, 3].map((n) => {
  const keys = keypair();
  fs.writeFileSync(`data/validator-${n}.key`, keys.privateKey, { mode: 0o600 });
  return { id: `validator-${n}`, publicKey: keys.publicKey, url: `http://localhost:${4100 + n}` };
});
const universities = ['Northbridge University', 'Cedar Valley Institute', 'Westlake University'].map((name, i) => {
  const keys = keypair();
  fs.writeFileSync(`data/university-${i + 1}.key`, keys.privateKey, { mode: 0o600 });
  return { id: `university-${i + 1}`, name, approved: true, publicKey: keys.publicKey };
});
fs.writeFileSync('data/config.json', JSON.stringify({ validators, universities }, null, 2));
const password = process.env.DEMO_PASSWORD || 'DemoPass123!';
const users = [{ id: 'admin', email: 'superadmin@example.test', passwordHash: bcrypt.hashSync(password, 10), role: 'admin' }];
const universityEmails = ['admin1@example.test', 'admin2@example.test', 'admin3@example.test'];
const universityPasswords = [password, password, password];
universities.forEach((u, i) => users.push({ id: `user-${i + 1}`, email: universityEmails[i], passwordHash: bcrypt.hashSync(universityPasswords[i], 10), universityId: u.id, role: 'university' }));
fs.writeFileSync('data/users.json', JSON.stringify(users, null, 2));
fs.writeFileSync('data/students.json', '[]');
fs.writeFileSync('data/certificates.json', '[]');
fs.writeFileSync('data/verification-logs.json', '[]');
console.log('Fictional demo initialized.');
console.log('Super admin login: superadmin@example.test');
console.log('University logins: admin1@example.test, admin2@example.test, admin3@example.test');
console.log('Demo password:', password, '(set DEMO_PASSWORD before setup to choose another). Never use these accounts in production.');
