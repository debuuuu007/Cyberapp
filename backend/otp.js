const crypto = require('crypto');

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const ALGORITHMS = ['SHA1', 'SHA256', 'SHA512'];

/* ---------- validation helpers ---------- */

function normalizeAlgorithm(algorithm = 'SHA1') {
  const name = String(algorithm).toUpperCase().replace('-', '');
  if (!ALGORITHMS.includes(name)) {
    throw new Error(`Unsupported algorithm. Use one of: ${ALGORITHMS.join(', ')}.`);
  }
  return name;
}

function assertDigits(digits) {
  if (!Number.isInteger(digits) || digits < 6 || digits > 8) {
    throw new Error('digits must be an integer between 6 and 8.');
  }
}

function assertCounter(counter) {
  if (!Number.isSafeInteger(counter) || counter < 0) {
    throw new Error('counter must be a non-negative integer.');
  }
}

function assertPeriod(period) {
  if (!Number.isInteger(period) || period <= 0) {
    throw new Error('period must be a positive integer (seconds).');
  }
}

// Constant-time string comparison so response timing doesn't leak how many digits matched.
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

function checkToken(token, digits) {
  const value = String(token).trim();
  if (!new RegExp(`^\\d{${digits}}$`).test(value)) {
    throw new Error(`OTP must be exactly ${digits} digits.`);
  }
  return value;
}

/* ---------- base32 ---------- */

function normalizeSecret(secret) {
  if (!secret) {
    throw new Error('A secret value is required.');
  }

  const trimmed = String(secret).trim();
  // Authenticator apps often show base32 secrets in groups ("JBSW Y3DP ..."), so ignore spaces.
  const compact = trimmed.replace(/\s+/g, '');
  const base32Pattern = /^[A-Z2-7]+=*$/i;

  const key = base32Pattern.test(compact)
    ? base32ToBuffer(compact)
    : Buffer.from(trimmed, 'utf8');

  if (key.length === 0) {
    throw new Error('The secret is too short.');
  }

  return key;
}

function base32ToBuffer(secret) {
  const cleaned = secret.replace(/\s+/g, '').toUpperCase();
  let bits = '';

  for (const char of cleaned) {
    if (char === '=') break;
    const value = BASE32_ALPHABET.indexOf(char);
    if (value === -1) {
      throw new Error(`Invalid base32 character: ${char}`);
    }
    bits += value.toString(2).padStart(5, '0');
  }

  const bytes = [];
  for (let i = 0; i + 7 < bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }

  return Buffer.from(bytes);
}

// RFC 4648 base32, unpadded (the form authenticator apps expect in otpauth:// URIs).
function base32Encode(buffer) {
  let bits = '';
  let output = '';

  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, '0');
  }

  for (let i = 0; i < bits.length; i += 5) {
    // The last chunk may be shorter than 5 bits; pad it with zeros instead of dropping it.
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    output += BASE32_ALPHABET[parseInt(chunk, 2)];
  }

  return output;
}

// 20 bytes (160 bits) is the size recommended by RFC 4226 and gives a 32-character secret.
function generateSecret(length = 20) {
  return base32Encode(crypto.randomBytes(length));
}

/* ---------- HOTP / TOTP ---------- */

function hotp(secret, counter, digits = 6, algorithm = 'SHA1') {
  assertDigits(digits);
  assertCounter(counter);
  const algo = normalizeAlgorithm(algorithm);

  const key = normalizeSecret(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hash = crypto
    .createHmac(algo.toLowerCase(), key)
    .update(counterBuffer)
    .digest();

  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const otp = binary % 10 ** digits;
  return String(otp).padStart(digits, '0');
}

function totp(secret, timestamp = Date.now(), digits = 6, period = 30, algorithm = 'SHA1') {
  if (!Number.isFinite(timestamp) || timestamp < 0) {
    throw new Error('timestamp must be a non-negative number (milliseconds).');
  }
  assertPeriod(period);

  const seconds = Math.floor(timestamp / 1000);
  const counter = Math.floor(seconds / period);
  const code = hotp(secret, counter, digits, algorithm);
  const remainingSeconds = period - (seconds % period);

  return {
    code,
    counter,
    remainingSeconds,
    period,
    digits,
    timestamp: seconds,
    algorithm: normalizeAlgorithm(algorithm)
  };
}

/* ---------- verification ---------- */

function verifyHotp(secret, token, counter, digits = 6, algorithm = 'SHA1') {
  const expected = hotp(secret, counter, digits, algorithm); // validates every argument
  return safeEqual(expected, checkToken(token, digits));
}

// `window` allows +/- N time steps of clock drift between client and server.
function verifyTotp(secret, token, options = {}) {
  const {
    timestamp = Date.now(),
    digits = 6,
    period = 30,
    algorithm = 'SHA1',
    window = 1
  } = options;

  assertDigits(digits);
  assertPeriod(period);
  const value = checkToken(token, digits);
  const current = Math.floor(Math.floor(timestamp / 1000) / period);

  let valid = false;
  for (let step = -window; step <= window; step += 1) {
    const counter = current + step;
    if (counter < 0) continue;
    // No early exit, so timing doesn't reveal which step matched.
    if (safeEqual(hotp(secret, counter, digits, algorithm), value)) {
      valid = true;
    }
  }
  return valid;
}

module.exports = {
  hotp,
  totp,
  verifyHotp,
  verifyTotp,
  normalizeSecret,
  normalizeAlgorithm,
  generateSecret,
  base32Encode,
  base32ToBuffer
};
