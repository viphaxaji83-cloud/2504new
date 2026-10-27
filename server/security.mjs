import {randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt = promisify(scryptCallback);
export const token = () => randomBytes(32).toString('base64url');
export const digest = value => createHash('sha256').update(value).digest('hex');
export const validLogin = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.@-]{2,79}$/.test(value);
export const validPassword = value => typeof value === 'string' && value.length >= 12 && Buffer.byteLength(value) <= 256;
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('base64url');
  const hash = await scrypt(password, salt, 64, {N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024});
  return `scrypt:${salt}:${hash.toString('base64url')}`;
}
export async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || Buffer.byteLength(password) > 256) return false;
  const [, salt, value] = encoded.split(':');
  const actual = await scrypt(password, salt, 64, {N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024});
  const expected = Buffer.from(value, 'base64url');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
