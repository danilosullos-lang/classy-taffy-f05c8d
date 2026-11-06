import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { db } from './db.js';
const scrypt = promisify(scryptCallback);
const TOKEN_TTL_SECONDS = 60 * 60 * 12;
const b64 = value => Buffer.from(value).toString('base64url');
const equal = (a, b) => {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
function secret() {
  const value = process.env.JWT_SECRET || '';
  if (Buffer.byteLength(value, 'utf8') < 32) {
    const error = new Error('auth_not_configured'); error.status = 503; throw error;
  }
  return value;
}
export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) {
    const error = new Error('password_must_be_10_to_128_characters'); error.status = 400; throw error;
  }
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return 'scrypt$16384$' + salt.toString('base64url') + '$' + Buffer.from(derived).toString('base64url');
}
export async function verifyPassword(password, encoded) {
  try {
    const [scheme, cost, saltText, keyText] = String(encoded).split('$');
    if (scheme !== 'scrypt' || cost !== '16384' || !saltText || !keyText) return false;
    const salt = Buffer.from(saltText, 'base64url');
    const expected = Buffer.from(keyText, 'base64url');
    const actual = Buffer.from(await scrypt(password, salt, expected.length, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }));
    return equal(actual, expected);
  } catch { return false; }
}
export function issueToken(userId) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64(JSON.stringify({ sub: userId, iat: now, exp: now + TOKEN_TTL_SECONDS, iss: 'aetheria-rpg' }));
  const unsigned = header + '.' + payload;
  const signature = createHmac('sha256', secret()).update(unsigned).digest('base64url');
  return unsigned + '.' + signature;
}
export function verifyToken(token) {
  if (typeof token !== 'string' || token.length > 4096) return null;
  const key = secret();
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const [header, payload, signature] = parts;
    const parsedHeader = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'));
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (parsedHeader.alg !== 'HS256' || parsedHeader.typ !== 'JWT') return null;
    const expected = createHmac('sha256', key).update(header + '.' + payload).digest('base64url');
    const now = Math.floor(Date.now() / 1000);
    if (!equal(signature, expected) || claims.iss !== 'aetheria-rpg' ||
        typeof claims.sub !== 'string' || !claims.sub ||
        !Number.isFinite(claims.exp) || claims.exp <= now) return null;
    return { userId: claims.sub, expiresAt: claims.exp };
  } catch { return null; }
}
export async function requireUser(req) {
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const claims = verifyToken(token);
  if (!claims) { const error = new Error('unauthorized'); error.status = 401; throw error; }
  const sql = db();
  const rows = await sql`SELECT id, email FROM aetheria_users WHERE id = ${claims.userId} LIMIT 1`;
  if (!rows.length) { const error = new Error('unauthorized'); error.status = 401; throw error; }
  return rows[0];
}
