import type { PinRecord } from "../state/schema";

/**
 * Hashing and checking the Guest mode PIN.
 *
 * The PIN stops a guest from casually turning Guest mode off. It isn't meant
 * to resist someone with full access to the device: four digits can always be
 * guessed by anyone who can read extension storage. Still, the PIN itself is
 * never stored, only a slow, salted hash of it.
 */

export const PIN_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const HASH_BITS = 256;

/** A PIN is exactly four digits. */
export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

export interface HashOptions {
  /** Defaults to `PIN_ITERATIONS`. Lower values are only for tests. */
  readonly iterations?: number;
  /** Defaults to fresh random bytes. */
  readonly salt?: Uint8Array<ArrayBuffer>;
}

export async function hashPin(
  pin: string,
  { iterations = PIN_ITERATIONS, salt = randomSalt() }: HashOptions = {},
): Promise<PinRecord> {
  if (!isValidPin(pin)) throw new RangeError("A PIN must be exactly 4 digits.");
  const hash = await derive(pin, salt, iterations);
  return {
    algo: "PBKDF2-SHA256",
    iterations,
    salt: toBase64(salt),
    hash: toBase64(hash),
  };
}

/** Checks a PIN against a stored record, in constant time. */
export async function verifyPin(
  pin: string,
  record: PinRecord,
): Promise<boolean> {
  if (!isValidPin(pin)) return false;
  const actual = await derive(pin, fromBase64(record.salt), record.iterations);
  return constantTimeEqual(toBase64(actual), record.hash);
}

async function derive(
  pin: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    HASH_BITS,
  );
  return new Uint8Array(bits);
}

function randomSalt(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(SALT_BYTES));
}

/** Compares two strings without returning early on the first difference. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return difference === 0;
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  try {
    return Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
  } catch {
    // An unreadable record can never match.
    return new Uint8Array(0);
  }
}
