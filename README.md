# OTP Authenticator App

This project is a small two-factor authentication demo that generates and verifies one-time passwords using the classic HOTP and TOTP algorithms based on HMAC.

It is split into two independent parts:

- backend: Express API that creates and validates OTP values
- frontend: React interface that lets the user generate secrets, view codes, and verify input

## Project structure

```text
Cyberapp/
├── backend/
│   ├── otp.js
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── src/
│   ├── package.json
│   └── vite.config.js
├── README.md
```

## How the app works

This app follows the standard authenticator flow used by apps like Google Authenticator:

1. The backend generates a shared base32 secret.
2. The frontend displays the secret to the user.
3. The frontend requests a TOTP code from the backend using the current time.
4. The backend converts the secret and timestamp into a counter, then runs HMAC-based generation.
5. The frontend also supports HOTP generation by using a manual counter value.
6. The user enters a code in the UI and the app sends it to the backend for verification.

## OTP algorithm

The core math is based on HMAC:

```text
HOTP(K, C) = Truncate(HMAC(K, C)) mod 10^d
TOTP(K, t) = HOTP(K, floor(t / 30))
```

Where:

- K = shared secret
- C = counter for HOTP
- t = current time in seconds
- d = number of digits (usually 6)
- 30 = TOTP time step in seconds

The backend uses SHA-1, SHA-256, or SHA-512 depending on the request.

## Data flow

### 1. Secret generation flow

```text
User clicks "New Secret" in React
        ↓
Frontend fetches /api/otp/secret
        ↓
Express server calls generateSecret()
        ↓
Node crypto generates random bytes
        ↓
Bytes are converted to Base32
        ↓
Secret is returned to frontend
```

### 2. TOTP flow

```text
User opens app
        ↓
React calls POST /api/otp/totp
        ↓
Backend receives secret + digits + period
        ↓
Server computes current time bucket: floor(unix_time / 30)
        ↓
HMAC(secret, counter) is generated
        ↓
Truncate and mod 10^6 to produce 6-digit code
        ↓
Frontend displays code and countdown timer
```

### 3. HOTP flow

```text
User enters counter value in React
        ↓
Frontend calls POST /api/otp/hotp
        ↓
Server converts counter to 8-byte big-endian value
        ↓
HMAC(secret, counter) is calculated
        ↓
Offset + binary extraction + modulo 10^d
        ↓
Code is returned and shown in UI
```

### 4. Verification flow

```text
User types OTP into frontend
        ↓
React sends secret + otp + type + counter to /api/otp/verify
        ↓
Backend checks expected code against entered code
        ↓
If they match, response is { valid: true }
        ↓
UI shows success or error message
```

## Backend responsibilities

The backend file `backend/otp.js` contains the actual OTP logic.

It handles:

- normalizing secrets
- converting Base32 to bytes
- generating HMAC signatures
- creating counter-based HOTP codes
- generating time-based TOTP codes
- validating codes safely

The backend file `backend/server.js` creates the HTTP API and responds to the frontend.

## Frontend responsibilities

The React app in `frontend/src/App.jsx` handles:

- showing the current TOTP code
- generating HOTP codes using counter values
- managing secret input
- sending requests to the backend
- validating entered OTPs
- rendering the explanation panel for users

## API endpoints

### GET /api/health

Returns app health:

```json
{ "ok": true, "message": "OTP backend is running." }
```

### GET /api/otp/secret

Returns a newly generated Base32 secret.

### POST /api/otp/hotp

Expected body:

```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "counter": 123,
  "digits": 6,
  "algorithm": "SHA1"
}
```

### POST /api/otp/totp

Expected body:

```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "digits": 6,
  "period": 30,
  "algorithm": "SHA1",
  "timestamp": 1700000000000
}
```

### POST /api/otp/verify

Expected body:

```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "otp": "123456",
  "type": "totp",
  "counter": 0,
  "digits": 6,
  "period": 30,
  "algorithm": "SHA1"
}
```

## Local setup

### 1. Backend

```bash
cd backend
npm install
npm start
```

The backend runs on:

```text
http://localhost:5000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on the Vite default port:

```text
http://localhost:5173
```

## CORS setup

The backend enables CORS so the frontend can access it from a different port during local development:

```js
origin: ['http://localhost:5173', 'http://127.0.0.1:5173']
```

This is necessary because the frontend and backend are running as separate apps.

## Security note

This is a demo application. In a production app, you should:

- store secrets securely in a database
- use HTTPS
- protect login APIs with authentication
- avoid exposing secrets in browser logs
- use a stronger backend validation strategy for real MFA systems

## Summary

This app demonstrates the fundamentals of two-factor authenticator logic:

- secret generation
- HOTP and TOTP generation
- HMAC-based computation
- user input handling
- backend validation
- CORS-connected frontend/backend architecture

It is a great starting point for understanding how real authenticator apps build and verify codes.
