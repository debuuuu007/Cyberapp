const express = require('express');
const cors = require('cors');
const {
  hotp,
  totp,
  verifyHotp,
  verifyTotp,
  normalizeAlgorithm,
  generateSecret
} = require('./otp');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true
  })
);

app.use(express.json({ limit: '10kb' }));

// Secrets and codes must never be cached by the browser or a proxy.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'OTP backend is running.' });
});

app.get('/api/otp/secret', (req, res) => {
  const secret = generateSecret();
  res.json({ secret });
});

app.post('/api/otp/hotp', (req, res) => {
  try {
    const { secret, counter = 0, digits = 6, algorithm = 'SHA1' } = req.body || {};

    if (!secret) {
      return res.status(400).json({ error: 'A secret is required.' });
    }

    const code = hotp(secret, Number(counter), Number(digits), algorithm);

    return res.json({
      code,
      counter: Number(counter),
      digits: Number(digits),
      algorithm: normalizeAlgorithm(algorithm)
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.post('/api/otp/totp', (req, res) => {
  try {
    const { secret, digits = 6, period = 30, algorithm = 'SHA1', timestamp = Date.now() } = req.body || {};

    if (!secret) {
      return res.status(400).json({ error: 'A secret is required.' });
    }

    const data = totp(secret, Number(timestamp), Number(digits), Number(period), algorithm);

    return res.json(data);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

// type = "hotp" (default, checks the given counter) or "totp" (checks the current time step, +/- 1).
app.post('/api/otp/verify', (req, res) => {
  try {
    const {
      secret,
      otp,
      type = 'hotp',
      counter = 0,
      digits = 6,
      period = 30,
      algorithm = 'SHA1'
    } = req.body || {};

    if (!secret || !otp) {
      return res.status(400).json({ error: 'Secret and otp are required.' });
    }

    let valid;
    if (type === 'totp') {
      valid = verifyTotp(secret, otp, {
        digits: Number(digits),
        period: Number(period),
        algorithm
      });
    } else if (type === 'hotp') {
      valid = verifyHotp(secret, otp, Number(counter), Number(digits), algorithm);
    } else {
      return res.status(400).json({ error: 'type must be "totp" or "hotp".' });
    }

    // Never send the expected code back, or the check is pointless.
    return res.json({ valid, type });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

// Malformed JSON bodies and any unexpected error return JSON instead of Express's HTML page.
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON.' });
  }
  console.error(err);
  return res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`OTP backend running on http://localhost:${PORT}`);
});
