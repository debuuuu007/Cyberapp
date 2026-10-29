# Frontend README

This folder contains the React user interface for the OTP authenticator app.

## What the frontend does

The React app lets a user:

- see a TOTP code generated from the current time
- generate a HOTP code using a custom counter
- input a secret
- generate a new secret
- verify OTP input against the backend

## Main UI flow

### 1. Secret input

The app starts with a default secret value. The user may leave it as-is or click "New Secret" to generate a fresh one.

That secret is sent to the backend when the app requests a TOTP or HOTP code.

### 2. TOTP display

The app calls the backend every second with:

```json
{
  "secret": "YOUR_SECRET",
  "digits": 6,
  "period": 30,
  "algorithm": "SHA1"
}
```

The backend responds with a code and the remaining time in the current period.

The UI then shows:

- the current 6-digit code
- a countdown timer
- the current TOTP status

### 3. HOTP generation

The user can set a counter value and click "Generate HOTP".

The frontend sends:

```json
{
  "secret": "YOUR_SECRET",
  "counter": 123,
  "digits": 6,
  "algorithm": "SHA1"
}
```

The backend returns a code for that counter.

### 4. OTP verification

The user types a 6-digit code and chooses whether to verify it as:

- TOTP: current time-based code
- HOTP: code for the selected counter

The frontend sends the value to `/api/otp/verify` and then shows:

- ✅ OTP is valid
- ❌ OTP does not match

## How the frontend talks to the backend

The frontend uses the `fetch()` API and sends JSON requests.

Example pattern:

```js
const response = await fetch('http://localhost:5000/api/otp/totp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ secret, digits: 6, period: 30, algorithm: 'SHA1' })
});
```

This is why the backend must be running before the frontend is used.

## Important parts of the UI file

The main React component is in `src/App.jsx`.

It contains:

- state for the secret, TOTP code, HOTP code, and OTP input
- a timer loop for TOTP refreshes
- event handlers for generation and verification
- a display panel explaining the OTP algorithm

## Frontend structure

```text
frontend/
├── src/
│   ├── App.jsx
│   ├── App.css
│   ├── index.css
│   └── main.jsx
├── package.json
├── vite.config.js
└── index.html
```

## Running the frontend

```bash
cd frontend
npm install
npm run dev
```

Then open the local address shown by Vite, typically:

```text
http://localhost:5173
```

## Data flow in the frontend

```text
User input / button click
    ↓
React state updates
    ↓
fetch() sends JSON to backend
    ↓
Backend responds with OTP data
    ↓
UI updates code or verification result
```

## Why this app is beginner-friendly

The interface is simple:

- a secret field
- a new secret button
- live TOTP value
- HOTP counter and button
- verification input

It is designed to teach how authenticator apps work without requiring a full production login system.

## Security note

This app is for learning and demonstration. In a real authentication system, the secret should be stored safely on the server and not exposed in the browser in a production environment.
