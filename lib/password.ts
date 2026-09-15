import 'server-only';

import { compare, hash } from 'bcrypt';

export const BCRYPT_ROUNDS = 12;
export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_BYTES = 72;

const BCRYPT_HASH_PATTERN = /^\$2[ab]\$(0[4-9]|[12]\d|3[01])\$[./A-Za-z0-9]{53}$/;

export function getPasswordValidationError(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password minimal ${MIN_PASSWORD_LENGTH} karakter`;
  }
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    return `Password maksimal ${MAX_PASSWORD_BYTES} byte`;
  }
  return null;
}

export function isBcryptHash(value: string | null | undefined) {
  return Boolean(value && BCRYPT_HASH_PATTERN.test(value));
}

export async function hashPassword(password: string) {
  const validationError = getPasswordValidationError(password);
  if (validationError) throw new Error(validationError);
  return hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string | null | undefined) {
  if (!passwordHash || !isBcryptHash(passwordHash)) return false;
  try {
    return await compare(password, passwordHash);
  } catch {
    return false;
  }
}
