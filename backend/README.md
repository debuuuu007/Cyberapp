# Backend README

This folder contains the server-side logic for the OTP authenticator.

## What is in this folder?

- `server.js` — Express API server
- `otp.js` — HMAC OTP generation and validation logic
- `package.json` — Node dependencies and scripts

## How the backend works

The backend is the part responsible for creating the actual OTP values.

When the frontend sends a request, the backend does this:

1. Reads the secret from the request body
2. Validates the request parameters
3. Converts the secret to bytes if needed
4. Uses HMAC with the secret and counter/time value
5. Extracts a 31-bit value from the HMAC digest
6. Reduces it modulo `10^digits`
7. Returns the generated code to the frontend

## Core file: `otp.js`

This is where the actual cryptographic logic lives.

### `normalizeSecret()`

This function accepts a secret string and converts it into a byte array. It accepts Base32 format, which is what many authenticator apps use.

### `hotp(secret, counter, digits, algorithm)`

This generates a counter-based OTP.

The steps are:

- convert the secret to bytes
- create an 8-byte big-endian counter
- compute `HMAC(secret, counter)`
- take the last nibble as an offset
- extract a 31-bit integer from the digest
- modulo with `10^digits`

### `totp(secret, timestamp, digits, period, algorithm)`

This creates a time-based OTP.

It calculates:

```text
counter = floor(current_unix_time / period)
```

Then it calls the same HOTP logic using that counter.

### `verifyHotp()` and `verifyTotp()`

These functions compare the user-supplied OTP value against the expected generated code.

## Core file: `server.js`

The server handles API requests.

### Routes

#### GET `/api/health`

Used to confirm the server is online.

#### GET `/api/otp/secret`

Creates and returns a new Base32 secret.

#### POST `/api/otp/hotp`

Generates a HOTP code from the current counter.

#### POST `/api/otp/totp`

Generates a TOTP code from the current time.

#### POST `/api/otp/verify`

Checks whether the user-entered OTP matches the expected token.

## Why CORS is important

The backend allows requests from the frontend running on a different local port.

This is configured in `server.js`:

```js
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true
  })
);
```

Without this, the browser would block requests from the React app to the backend.

## Data flow in the backend

```text
Frontend request
    ↓
Express route receives JSON
    ↓
Validate secret and OTP input
    ↓
Generate HMAC-based token
    ↓
Return JSON response to frontend
```

## Running the backend

```bash
cd backend
npm install
npm start
```

The server runs on:

```text
http://localhost:5000
```

## Important things to know

- Secrets are usually Base32 strings.
- HOTP depends on the counter value.
- TOTP depends on the current time step.
- HMAC is the cryptographic core of both flows.
- The `digits` value normally stays at 6 for a standard authenticator code.

## Example logic

```js
const code = hotp(secret, 42, 6, 'SHA1');
```

This creates a 6-digit HOTP code based on the secret and counter 42.

```js
const data = totp(secret, Date.now(), 6, 30, 'SHA1');
```

This creates a TOTP code for the current 30-second time window.

## Security note

This is a demo project. For real production apps, do not store secrets in plain frontend code or browser storage. Real MFA systems should keep shared secrets on a trusted backend and use HTTPS.
