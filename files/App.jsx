import { useEffect, useRef, useState } from 'react'
import './App.css'

const API_URL = 'http://localhost:5000/api'

// Single source of truth so the UI, the requests, and the help text can't drift apart.
const DIGITS = 6
const PERIOD = 30
const ALGORITHM = 'SHA1'

async function postJson(path, body) {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  let data = null
  try {
    data = await response.json()
  } catch {
    // Non-JSON response; handled by the status check below.
  }

  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status}).`)
  }

  return data
}

function App() {
  const [secret, setSecret] = useState('JBSWY3DPEHPK3PXP')
  const [secretError, setSecretError] = useState('')

  const [totpCode, setTotpCode] = useState('')
  const [totpError, setTotpError] = useState('')
  const [remaining, setRemaining] = useState(PERIOD)

  const [hotpCounter, setHotpCounter] = useState(0)
  const [hotpCode, setHotpCode] = useState('')
  const [hotpError, setHotpError] = useState('')
  const [loading, setLoading] = useState(false)

  const [otpInput, setOtpInput] = useState('')
  const [verifyType, setVerifyType] = useState('totp')
  const [verification, setVerification] = useState(null)
  const [verifying, setVerifying] = useState(false)

  // Bumped whenever a result becomes stale, so late responses for old inputs are ignored.
  const hotpRequestRef = useRef(0)
  const verifyRequestRef = useRef(0)

  const clearHotp = () => {
    hotpRequestRef.current += 1
    setHotpCode('')
    setHotpError('')
    setLoading(false)
  }

  const clearVerification = () => {
    verifyRequestRef.current += 1
    setVerification(null)
    setVerifying(false)
  }

  // TOTP: refresh every second. The secret is the only input, so the effect only re-runs when it changes.
  useEffect(() => {
    let cancelled = false

    setTotpCode('')
    setTotpError('')

    const updateTotp = async () => {
      if (!secret.trim()) {
        setTotpCode('')
        setTotpError('Enter a secret to generate a TOTP code.')
        return
      }

      try {
        const data = await postJson('/otp/totp', {
          secret,
          digits: DIGITS,
          period: PERIOD,
          algorithm: ALGORITHM
        })

        if (cancelled) return // response belongs to a previous secret
        setTotpCode(data.code)
        setRemaining(data.remainingSeconds)
        setTotpError('')
      } catch (error) {
        if (cancelled) return
        setTotpCode('') // don't keep showing an old code next to an error
        setTotpError(error.message)
      }
    }

    updateTotp()
    const timer = setInterval(updateTotp, 1000)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [secret])

  const handleSecretChange = (value) => {
    setSecret(value)
    setSecretError('')
    clearHotp() // the old HOTP / verification result belongs to the old secret
    clearVerification()
  }

  const handleCounterChange = (event) => {
    const next = Math.floor(Number(event.target.value))
    setHotpCounter(Number.isFinite(next) && next >= 0 ? next : 0)
    clearHotp()
    clearVerification()
  }

  const handleOtpInputChange = (event) => {
    setOtpInput(event.target.value.replace(/\D/g, '').slice(0, DIGITS))
    clearVerification()
  }

  const handleVerifyTypeChange = (type) => {
    setVerifyType(type)
    clearVerification()
  }

  const generateSecret = async () => {
    try {
      const response = await fetch(`${API_URL}/otp/secret`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Unable to generate a secret.')
      }

      handleSecretChange(data.secret)
    } catch (error) {
      setSecretError(error.message)
    }
  }

  const generateHotp = async () => {
    const requestId = ++hotpRequestRef.current
    setLoading(true)
    setHotpError('')

    try {
      const data = await postJson('/otp/hotp', {
        secret,
        counter: hotpCounter,
        digits: DIGITS,
        algorithm: ALGORITHM
      })

      if (requestId !== hotpRequestRef.current) return
      setHotpCode(data.code)
    } catch (error) {
      if (requestId !== hotpRequestRef.current) return
      setHotpCode('')
      setHotpError(error.message)
    } finally {
      if (requestId === hotpRequestRef.current) setLoading(false)
    }
  }

  const verifyOtp = async () => {
    const requestId = ++verifyRequestRef.current
    setVerifying(true)

    try {
      const data = await postJson('/otp/verify', {
        secret,
        otp: otpInput,
        type: verifyType,
        counter: hotpCounter,
        digits: DIGITS,
        period: PERIOD,
        algorithm: ALGORITHM
      })

      if (requestId !== verifyRequestRef.current) return
      setVerification({ valid: data.valid })
    } catch (error) {
      if (requestId !== verifyRequestRef.current) return
      setVerification({ valid: false, error: error.message })
    } finally {
      if (requestId === verifyRequestRef.current) setVerifying(false)
    }
  }

  return (
    <div className="app-shell">
      <div className="auth-card">
        <div className="card-header">
          <p className="eyebrow">Two-Factor Authentication</p>
          <h1>Authenticator OTP</h1>
        </div>

        <label className="field-label" htmlFor="secret">Shared secret</label>
        <div className="secret-row">
          <input
            id="secret"
            type="text"
            value={secret}
            onChange={(event) => handleSecretChange(event.target.value)}
            placeholder="Enter base32 secret"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" className="secondary" onClick={generateSecret}>
            New Secret
          </button>
        </div>
        {secretError && <p role="alert">❌ {secretError}</p>}

        <div className="otp-grid">
          <section className="otp-panel">
            <div className="panel-title-row">
              <h2>TOTP</h2>
              <span className="badge">{totpError ? '–' : `${remaining}s`}</span>
            </div>
            <div className="otp-display">{totpError ? '------' : totpCode || 'Loading...'}</div>
            {totpError ? (
              <p role="alert">❌ {totpError}</p>
            ) : (
              <p>Time-based OTP generated from HMAC-{ALGORITHM}</p>
            )}
          </section>

          <section className="otp-panel">
            <div className="panel-title-row">
              <h2>HOTP</h2>
              <span className="badge">#{hotpCounter}</span>
            </div>
            <div className="counter-row">
              <input
                type="number"
                value={hotpCounter}
                onChange={handleCounterChange}
                min="0"
                step="1"
              />
              <button type="button" onClick={generateHotp} disabled={loading}>
                {loading ? 'Generating...' : 'Generate HOTP'}
              </button>
            </div>
            <div className="otp-display small">{hotpCode || 'Awaiting code'}</div>
            {hotpError && <p role="alert">❌ {hotpError}</p>}
          </section>
        </div>

        <div className="verify-box">
          <h3>Verify OTP</h3>

          <div role="radiogroup" aria-label="Verify against" style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
            <label>
              <input
                type="radio"
                name="verify-type"
                value="totp"
                checked={verifyType === 'totp'}
                onChange={() => handleVerifyTypeChange('totp')}
              />{' '}
              TOTP (current code)
            </label>
            <label>
              <input
                type="radio"
                name="verify-type"
                value="hotp"
                checked={verifyType === 'hotp'}
                onChange={() => handleVerifyTypeChange('hotp')}
              />{' '}
              HOTP (counter #{hotpCounter})
            </label>
          </div>

          <div className="verify-row">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otpInput}
              onChange={handleOtpInputChange}
              placeholder={`Enter ${DIGITS}-digit OTP`}
              maxLength={DIGITS}
            />
            <button
              type="button"
              onClick={verifyOtp}
              disabled={verifying || otpInput.length !== DIGITS}
            >
              {verifying ? 'Verifying...' : 'Verify'}
            </button>
          </div>

          {verification && (
            <div className={`verification ${verification.valid ? 'success' : 'error'}`}>
              {verification.valid ? '✅ OTP is valid.' : `❌ ${verification.error || 'OTP does not match.'}`}
            </div>
          )}
        </div>

        <div className="algorithm-box">
          <h3>Traditional HMAC-based OTP Algorithm</h3>
          <ol>
            <li>Convert the secret key to bytes.</li>
            <li>Compute the moving factor T = floor(unix_time / time_step) for TOTP or C for HOTP.</li>
            <li>Encode the counter as an 8-byte big-endian value.</li>
            <li>Compute HMAC(secret, counter) using SHA-1, SHA-256, or SHA-512.</li>
            <li>Take the last 4 bits of the HMAC as an offset and extract a 31-bit value.</li>
            <li>Modulo 10^digits to get the final numeric code.</li>
          </ol>
          <pre>
{`HOTP(K, C) = Truncate(HMAC-SHA1(K, C)) mod 10^d
TOTP(K, t) = HOTP(K, floor(t / 30))`}
          </pre>
        </div>
      </div>
    </div>
  )
}

export default App
